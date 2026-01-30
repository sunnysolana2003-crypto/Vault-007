use anchor_lang::prelude::*;
use inco_lightning::cpi::accounts::{Allow, Operation};
use inco_lightning::cpi::{allow, as_euint128, e_add, new_euint128};
use inco_lightning::types::Euint128;
use inco_lightning::ID as INCO_LIGHTNING_ID;
use crate::state::{Vault, UserPosition};
use crate::errors::VaultError;
use crate::instructions::yield_utils::apply_pending_yield;

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(
        mut,
        seeds = [b"vault_v2"],
        bump = vault.bump
    )]
    pub vault: Account<'info, Vault>,

    #[account(
        init_if_needed,
        payer = user,
        seeds = [b"user_v2", user.key().as_ref()],
        bump,
        space = UserPosition::SIZE
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
    ctx: Context<'_, '_, 'info, 'info, Deposit<'info>>,
    encrypted_amount: Vec<u8>,
    lamports: u64,
) -> Result<()> {
    let inco_program = ctx.accounts.inco_lightning_program.to_account_info();
    let signer = ctx.accounts.user.to_account_info();

    // Ensure newly created position has a valid encrypted zero handle (not just zeroed bytes)
    if ctx.accounts.user_position.owner == Pubkey::default() {
        let cpi_ctx = CpiContext::new(inco_program.clone(), Operation { signer: signer.clone() });
        ctx.accounts.user_position.encrypted_balance = as_euint128(cpi_ctx, 0u128)?;
        ctx.accounts.user_position.last_yield_index = ctx.accounts.vault.yield_index;
    }

    // Apply any pending yield before adding new deposit.
    apply_pending_yield(
        &mut ctx.accounts.vault,
        &mut ctx.accounts.user_position,
        inco_program.clone(),
        signer.clone(),
        ctx.accounts.system_program.to_account_info(),
    )?;

    // Move real SOL into the user's escrow PDA.
    let cpi_ctx = CpiContext::new(
        ctx.accounts.system_program.to_account_info(),
        anchor_lang::system_program::Transfer {
            from: ctx.accounts.user.to_account_info(),
            to: ctx.accounts.user_position.to_account_info(),
        },
    );
    anchor_lang::system_program::transfer(cpi_ctx, lamports)?;
    ctx.accounts.vault.total_escrow_lamports = ctx
        .accounts
        .vault
        .total_escrow_lamports
        .checked_add(lamports)
        .ok_or(VaultError::Overflow)?;

    // Convert ciphertext -> encrypted handle (input_type = 0)
    let cpi_ctx = CpiContext::new(inco_program.clone(), Operation { signer: signer.clone() });
    let amount_handle: Euint128 = new_euint128(cpi_ctx, encrypted_amount, 0)?;

    // Add to user's encrypted balance
    let cpi_ctx = CpiContext::new(inco_program.clone(), Operation { signer: signer.clone() });
    let new_user_balance = e_add(cpi_ctx, ctx.accounts.user_position.encrypted_balance, amount_handle, 0)?;
    ctx.accounts.user_position.encrypted_balance = new_user_balance;

    // Add to vault's total encrypted balance
    let cpi_ctx = CpiContext::new(inco_program.clone(), Operation { signer: signer.clone() });
    let new_vault_balance = e_add(cpi_ctx, ctx.accounts.vault.total_encrypted_balance, amount_handle, 0)?;
    ctx.accounts.vault.total_encrypted_balance = new_vault_balance;

    // Set owner if first deposit
    ctx.accounts.user_position.owner = ctx.accounts.user.key();
    ctx.accounts.user_position.bump = ctx.bumps.user_position;

    // Demo policy: grant decrypt access to the user for BOTH resulting handles.
    // remaining_accounts:
    // [0] allowance_user (mut)
    // [1] allowed_address (readonly) - typically user pubkey
    // [2] allowance_vault (mut)
    // [3] allowed_address (readonly) - typically user pubkey
    if ctx.remaining_accounts.len() >= 4 {
        let allowance_user = ctx.remaining_accounts[0].clone();
        let allowed_user = ctx.remaining_accounts[1].clone();
        let allowance_vault = ctx.remaining_accounts[2].clone();
        let allowed_vault = ctx.remaining_accounts[3].clone();
        let system_program = ctx.accounts.system_program.to_account_info();
        let user_key = ctx.accounts.user.key();

        let cpi_ctx = CpiContext::new(
            inco_program.clone(),
            Allow {
                allowance_account: allowance_user,
                signer: signer.clone(),
                allowed_address: allowed_user,
                system_program: system_program.clone(),
            },
        );
        allow(cpi_ctx, new_user_balance.0, true, user_key)?;

        let cpi_ctx = CpiContext::new(
            inco_program,
            Allow {
                allowance_account: allowance_vault,
                signer,
                allowed_address: allowed_vault,
                system_program,
            },
        );
        allow(cpi_ctx, new_vault_balance.0, true, user_key)?;
    }

    Ok(())
}

// Note: ciphertext parsing/validation errors are surfaced by Inco CPI calls.
