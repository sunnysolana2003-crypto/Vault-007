use anchor_lang::prelude::*;
use inco_lightning::cpi::accounts::{Allow, Operation};
use inco_lightning::cpi::{allow, as_euint128, e_add, e_sub, new_euint128};
use inco_lightning::types::Euint128;
use inco_lightning::ID as INCO_LIGHTNING_ID;
use crate::state::{UserPosition, Vault};
use anchor_lang::solana_program::{program::invoke_signed, system_instruction};
use crate::errors::VaultError;
use crate::instructions::yield_utils::apply_pending_yield;

#[derive(Accounts)]
pub struct Transfer<'info> {
    #[account(
        mut,
        seeds = [b"vault_v2"],
        bump = vault.bump
    )]
    pub vault: Account<'info, Vault>,

    #[account(
        mut,
        seeds = [b"user_v2", sender.key().as_ref()],
        bump = sender_position.bump,
        constraint = sender_position.owner == sender.key() @ TransferError::Unauthorized
    )]
    pub sender_position: Account<'info, UserPosition>,

    #[account(
        init_if_needed,
        payer = sender,
        seeds = [b"user_v2", recipient.key().as_ref()],
        bump,
        space = UserPosition::SIZE
    )]
    pub recipient_position: Account<'info, UserPosition>,

    #[account(mut)]
    pub sender: Signer<'info>,

    /// CHECK: Recipient address
    pub recipient: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,

    /// CHECK: Inco Lightning program for encrypted operations
    #[account(address = INCO_LIGHTNING_ID)]
    pub inco_lightning_program: AccountInfo<'info>,
}

pub fn handler<'info>(
    ctx: Context<'_, '_, 'info, 'info, Transfer<'info>>,
    encrypted_amount: Vec<u8>,
    lamports: u64,
) -> Result<()> {
    let inco_program = ctx.accounts.inco_lightning_program.to_account_info();
    let signer = ctx.accounts.sender.to_account_info();

    // Ensure newly created recipient position has a valid encrypted zero handle
    if ctx.accounts.recipient_position.owner == Pubkey::default() {
        let cpi_ctx = CpiContext::new(inco_program.clone(), Operation { signer: signer.clone() });
        ctx.accounts.recipient_position.encrypted_balance = as_euint128(cpi_ctx, 0u128)?;
        ctx.accounts.recipient_position.owner = ctx.accounts.recipient.key();
        ctx.accounts.recipient_position.bump = ctx.bumps.recipient_position;
        ctx.accounts.recipient_position.last_yield_index = ctx.accounts.vault.yield_index;
    }

    // Apply any pending yield for the sender before transferring.
    apply_pending_yield(
        &mut ctx.accounts.vault,
        &mut ctx.accounts.sender_position,
        inco_program.clone(),
        signer.clone(),
        ctx.accounts.system_program.to_account_info(),
    )?;

    let rent = Rent::get()?;
    let min_balance = rent.minimum_balance(UserPosition::SIZE);
    let sender_lamports = **ctx.accounts.sender_position.to_account_info().lamports.borrow();
    let sender_escrow = sender_lamports.saturating_sub(min_balance);
    if sender_escrow < lamports {
        return Err(VaultError::InsufficientEscrow.into());
    }

    // Convert ciphertext -> encrypted handle (input_type = 0)
    let cpi_ctx = CpiContext::new(inco_program.clone(), Operation { signer: signer.clone() });
    let amount_handle: Euint128 = new_euint128(cpi_ctx, encrypted_amount, 0)?;

    // Subtract from sender's encrypted balance
    let cpi_ctx = CpiContext::new(inco_program.clone(), Operation { signer: signer.clone() });
    let new_sender_balance = e_sub(
        cpi_ctx,
        ctx.accounts.sender_position.encrypted_balance,
        amount_handle,
        0,
    )?;
    ctx.accounts.sender_position.encrypted_balance = new_sender_balance;

    // Add to recipient's encrypted balance
    let cpi_ctx = CpiContext::new(inco_program.clone(), Operation { signer: signer.clone() });
    let new_recipient_balance = e_add(
        cpi_ctx,
        ctx.accounts.recipient_position.encrypted_balance,
        amount_handle,
        0,
    )?;
    ctx.accounts.recipient_position.encrypted_balance = new_recipient_balance;

    // Move real SOL between user escrow PDAs.
    **ctx.accounts.sender_position.to_account_info().try_borrow_mut_lamports()? -= lamports;
    **ctx.accounts.recipient_position.to_account_info().try_borrow_mut_lamports()? += lamports;

    // Auto-Authorize: grant decrypt access to both sender and recipient for their new balances.
    // remaining_accounts:
    // [0] allowance_sender (mut)
    // [1] allowed_address (readonly) - sender pubkey
    // [2] allowance_recipient (mut)
    // [3] allowed_address (readonly) - recipient pubkey
    let allowance_sender = &ctx.remaining_accounts[0];
    let allowed_sender = &ctx.remaining_accounts[1];
    let allowance_recipient = &ctx.remaining_accounts[2];
    let allowed_recipient = &ctx.remaining_accounts[3];
    let system_program = ctx.accounts.system_program.to_account_info();
    let sender_key = ctx.accounts.sender.key();
    let recipient_key = ctx.accounts.recipient.key();

    // Grant access to sender for their new balance
    let cpi_ctx = CpiContext::new(
        inco_program.clone(),
        Allow {
            allowance_account: allowance_sender.clone(),
            signer: signer.clone(),
            allowed_address: allowed_sender.clone(),
            system_program: system_program.clone(),
        },
    );
    allow(cpi_ctx, new_sender_balance.0, true, sender_key)?;

    // Grant access to recipient for their new balance
    let cpi_ctx = CpiContext::new(
        inco_program,
        Allow {
            allowance_account: allowance_recipient.clone(),
            signer,
            allowed_address: allowed_recipient.clone(),
            system_program,
        },
    );
    allow(cpi_ctx, new_recipient_balance.0, true, recipient_key)?;

    Ok(())
}

#[error_code]
pub enum TransferError {
    #[msg("Unauthorized: signer is not the sender position owner")]
    Unauthorized,
}
