use anchor_lang::prelude::*;
use inco_lightning::cpi::accounts::{Allow, Operation};
use inco_lightning::cpi::{allow, as_euint128, e_add};
use inco_lightning::ID as INCO_LIGHTNING_ID;
use crate::state::{StealthNote, UserPosition, Vault};
use crate::constants::{STEALTH_NOTE_SEED, USER_SEED, VAULT_SEED};
use crate::errors::VaultError;
use crate::instructions::yield_utils::apply_pending_yield;

/// Claim a stealth note by proving knowledge of the secret.
/// The claimer provides the raw secret, which is hashed to derive the note_id.
/// If the hash matches, the note's funds are transferred to the claimer's position.
#[derive(Accounts)]
#[instruction(secret: Vec<u8>)]
pub struct ClaimStealthNote<'info> {
    #[account(
        mut,
        seeds = [VAULT_SEED],
        bump = vault.bump
    )]
    pub vault: Account<'info, Vault>,

    #[account(
        mut,
        // The note_id is derived from hashing the secret
        seeds = [STEALTH_NOTE_SEED, &anchor_lang::solana_program::hash::hash(&secret).to_bytes()],
        bump = stealth_note.bump,
        constraint = !stealth_note.claimed @ VaultError::NoteAlreadyClaimed
    )]
    pub stealth_note: Account<'info, StealthNote>,

    #[account(
        init_if_needed,
        payer = claimer,
        seeds = [USER_SEED, claimer.key().as_ref()],
        bump,
        space = UserPosition::SIZE
    )]
    pub claimer_position: Account<'info, UserPosition>,

    #[account(mut)]
    pub claimer: Signer<'info>,

    pub system_program: Program<'info, System>,

    /// CHECK: Inco Lightning program for encrypted operations
    #[account(address = INCO_LIGHTNING_ID)]
    pub inco_lightning_program: AccountInfo<'info>,
}

pub fn handler<'info>(
    ctx: Context<'_, '_, 'info, 'info, ClaimStealthNote<'info>>,
    secret: Vec<u8>,
) -> Result<()> {
    let inco_program = ctx.accounts.inco_lightning_program.to_account_info();
    let signer = ctx.accounts.claimer.to_account_info();
    let stealth_note = &mut ctx.accounts.stealth_note;
    let claimer_position = &mut ctx.accounts.claimer_position;

    // Verify the secret hashes to the note_id (already enforced by PDA seeds, but double-check)
    let computed_hash = anchor_lang::solana_program::hash::hash(&secret).to_bytes();
    require!(computed_hash == stealth_note.note_id, VaultError::InvalidSecret);

    // Initialize claimer position if new
    if claimer_position.owner == Pubkey::default() {
        let cpi_ctx = CpiContext::new(inco_program.clone(), Operation { signer: signer.clone() });
        claimer_position.encrypted_balance = as_euint128(cpi_ctx, 0u128)?;
        claimer_position.last_yield_index = ctx.accounts.vault.yield_index;
    }

    // Apply any pending yield before adding claimed funds
    apply_pending_yield(
        &mut ctx.accounts.vault,
        claimer_position,
        inco_program.clone(),
        signer.clone(),
        ctx.accounts.system_program.to_account_info(),
    )?;

    // Transfer SOL from stealth note PDA to claimer's position PDA
    // Use manual lamport adjustment since stealth_note carries data
    let lamports = stealth_note.lamports;
    **stealth_note.to_account_info().try_borrow_mut_lamports()? -= lamports;
    **claimer_position.to_account_info().try_borrow_mut_lamports()? += lamports;

    // Update vault's total escrow (adding the claimed amount)
    ctx.accounts.vault.total_escrow_lamports = ctx
        .accounts
        .vault
        .total_escrow_lamports
        .checked_add(lamports)
        .ok_or(VaultError::Overflow)?;

    // Add the encrypted amount to claimer's balance
    let cpi_ctx = CpiContext::new(inco_program.clone(), Operation { signer: signer.clone() });
    let new_claimer_balance = e_add(
        cpi_ctx,
        claimer_position.encrypted_balance,
        stealth_note.encrypted_amount,
        0,
    )?;
    claimer_position.encrypted_balance = new_claimer_balance;

    // Add to vault's total encrypted balance
    let cpi_ctx = CpiContext::new(inco_program.clone(), Operation { signer: signer.clone() });
    let new_vault_balance = e_add(
        cpi_ctx,
        ctx.accounts.vault.total_encrypted_balance,
        stealth_note.encrypted_amount,
        0,
    )?;
    ctx.accounts.vault.total_encrypted_balance = new_vault_balance;

    // Set owner and bump if first interaction
    claimer_position.owner = ctx.accounts.claimer.key();
    if claimer_position.bump == 0 {
        claimer_position.bump = ctx.bumps.claimer_position;
    }

    // Mark note as claimed
    stealth_note.claimed = true;
    stealth_note.lamports = 0;

    // Auto-Authorize: grant decrypt access to the claimer for their new balance
    // This is OPTIONAL - if remaining_accounts is not provided, skip auto-authorize.
    // remaining_accounts (if provided):
    // [0] allowance_claimer (mut)
    // [1] allowed_address (readonly) - claimer pubkey
    // [2] allowance_vault (mut)
    // [3] allowed_address (readonly) - claimer pubkey
    if ctx.remaining_accounts.len() >= 4 {
        let allowance_claimer = &ctx.remaining_accounts[0];
        let allowed_claimer = &ctx.remaining_accounts[1];
        let allowance_vault = &ctx.remaining_accounts[2];
        let allowed_vault = &ctx.remaining_accounts[3];
        let system_program = ctx.accounts.system_program.to_account_info();
        let claimer_key = ctx.accounts.claimer.key();

        let cpi_ctx = CpiContext::new(
            inco_program.clone(),
            Allow {
                allowance_account: allowance_claimer.clone(),
                signer: signer.clone(),
                allowed_address: allowed_claimer.clone(),
                system_program: system_program.clone(),
            },
        );
        allow(cpi_ctx, new_claimer_balance.0, true, claimer_key)?;

        let cpi_ctx = CpiContext::new(
            inco_program,
            Allow {
                allowance_account: allowance_vault.clone(),
                signer,
                allowed_address: allowed_vault.clone(),
                system_program,
            },
        );
        allow(cpi_ctx, new_vault_balance.0, true, claimer_key)?;
    }

    msg!("Stealth note claimed successfully!");

    Ok(())
}
