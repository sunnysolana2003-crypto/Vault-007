use anchor_lang::prelude::*;
use inco_lightning::cpi::accounts::{Allow, Operation};
use inco_lightning::cpi::{allow, e_sub, new_euint128};
use inco_lightning::types::Euint128;
use inco_lightning::ID as INCO_LIGHTNING_ID;
use crate::state::{Vault, UserPosition};
use anchor_lang::solana_program::{program::invoke_signed, system_instruction};
use crate::errors::VaultError;
use crate::instructions::yield_utils::apply_pending_yield;

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(
        mut,
        seeds = [b"vault_v2"],
        bump = vault.bump
    )]
    pub vault: Account<'info, Vault>,

    #[account(
        mut,
        seeds = [b"user_v2", user.key().as_ref()],
        bump = user_position.bump,
        constraint = user_position.owner == user.key() @ WithdrawError::Unauthorized
    )]
    pub user_position: Account<'info, UserPosition>,

    #[account(mut)]
    pub user: Signer<'info>,

    pub system_program: Program<'info, System>,

    /// CHECK: Inco Lightning program for encrypted operations
    #[account(address = INCO_LIGHTNING_ID)]
    pub inco_lightning_program: AccountInfo<'info>,
}

pub fn handler<'info>(
    ctx: Context<'_, '_, 'info, 'info, Withdraw<'info>>,
    encrypted_amount: Vec<u8>,
    lamports: u64,
) -> Result<()> {
    let inco_program = ctx.accounts.inco_lightning_program.to_account_info();
    let signer = ctx.accounts.user.to_account_info();

    // Apply any pending yield before withdrawal.
    apply_pending_yield(
        &mut ctx.accounts.vault,
        &mut ctx.accounts.user_position,
        inco_program.clone(),
        signer.clone(),
        ctx.accounts.system_program.to_account_info(),
    )?;

    let user_lamports = **ctx.accounts.user_position.to_account_info().lamports.borrow();
    let rent = Rent::get()?;
    let min_balance = rent.minimum_balance(UserPosition::SIZE);
    let escrow_lamports = user_lamports.saturating_sub(min_balance);
    if escrow_lamports < lamports {
        return Err(VaultError::InsufficientEscrow.into());
    }
    if ctx.accounts.vault.total_escrow_lamports < lamports {
        return Err(VaultError::InsufficientEscrow.into());
    }

    // Convert ciphertext -> encrypted handle (input_type = 0)
    let cpi_ctx = CpiContext::new(inco_program.clone(), Operation { signer: signer.clone() });
    let amount_handle: Euint128 = new_euint128(cpi_ctx, encrypted_amount, 0)?;

    // Subtract amount from user's encrypted balance
    let cpi_ctx = CpiContext::new(inco_program.clone(), Operation { signer: signer.clone() });
    let new_user_balance = e_sub(cpi_ctx, ctx.accounts.user_position.encrypted_balance, amount_handle, 0)?;
    ctx.accounts.user_position.encrypted_balance = new_user_balance;

    // Subtract amount from vault's total encrypted balance
    let cpi_ctx = CpiContext::new(inco_program.clone(), Operation { signer: signer.clone() });
    let new_vault_balance = e_sub(cpi_ctx, ctx.accounts.vault.total_encrypted_balance, amount_handle, 0)?;
    ctx.accounts.vault.total_encrypted_balance = new_vault_balance;

    // Move real SOL out of the user's escrow PDA back to the wallet.
    **ctx.accounts.user_position.to_account_info().try_borrow_mut_lamports()? -= lamports;
    **ctx.accounts.user.to_account_info().try_borrow_mut_lamports()? += lamports;

    ctx.accounts.vault.total_escrow_lamports = ctx
        .accounts
        .vault
        .total_escrow_lamports
        .saturating_sub(lamports);

    // Auto-Authorize: grant decrypt access to the user for BOTH resulting handles.
    // This is OPTIONAL - if remaining_accounts is not provided, skip auto-authorize.
    // remaining_accounts (if provided):
    // [0] allowance_user (mut)
    // [1] allowed_address (readonly) - user pubkey
    // [2] allowance_vault (mut)
    // [3] allowed_address (readonly) - user pubkey
    if ctx.remaining_accounts.len() >= 4 {
        let allowance_user = &ctx.remaining_accounts[0];
        let allowed_user = &ctx.remaining_accounts[1];
        let allowance_vault = &ctx.remaining_accounts[2];
        let allowed_vault = &ctx.remaining_accounts[3];
        let system_program = ctx.accounts.system_program.to_account_info();
        let user_key = ctx.accounts.user.key();

        let cpi_ctx = CpiContext::new(
            inco_program.clone(),
            Allow {
                allowance_account: allowance_user.clone(),
                signer: signer.clone(),
                allowed_address: allowed_user.clone(),
                system_program: system_program.clone(),
            },
        );
        allow(cpi_ctx, new_user_balance.0, true, user_key)?;

        let cpi_ctx = CpiContext::new(
            inco_program,
            Allow {
                allowance_account: allowance_vault.clone(),
                signer,
                allowed_address: allowed_vault.clone(),
                system_program,
            },
        );
        allow(cpi_ctx, new_vault_balance.0, true, user_key)?;
    }

    Ok(())
}

#[error_code]
pub enum WithdrawError {
    #[msg("Unauthorized: signer is not the position owner")]
    Unauthorized,
}
