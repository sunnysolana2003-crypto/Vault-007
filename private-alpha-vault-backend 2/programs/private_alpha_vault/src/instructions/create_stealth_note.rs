use anchor_lang::prelude::*;
use inco_lightning::cpi::accounts::{Allow, Operation};
use inco_lightning::cpi::{allow, new_euint128};
use inco_lightning::types::Euint128;
use inco_lightning::ID as INCO_LIGHTNING_ID;
use crate::state::StealthNote;
use crate::constants::STEALTH_NOTE_SEED;

/// Create a stealth note that can be claimed by anyone who knows the secret.
/// The sender provides a note_id (hash of secret passphrase) and encrypted amount.
/// Real SOL is transferred to the note PDA.
#[derive(Accounts)]
#[instruction(note_id: [u8; 32], encrypted_amount: Vec<u8>, lamports: u64)]
pub struct CreateStealthNote<'info> {
    #[account(
        init,
        payer = sender,
        seeds = [STEALTH_NOTE_SEED, note_id.as_ref()],
        bump,
        space = StealthNote::SIZE
    )]
    pub stealth_note: Account<'info, StealthNote>,

    #[account(mut)]
    pub sender: Signer<'info>,

    pub system_program: Program<'info, System>,

    /// CHECK: Inco Lightning program for encrypted operations
    #[account(address = INCO_LIGHTNING_ID)]
    pub inco_lightning_program: AccountInfo<'info>,
}

pub fn handler<'info>(
    ctx: Context<'_, '_, 'info, 'info, CreateStealthNote<'info>>,
    note_id: [u8; 32],
    encrypted_amount: Vec<u8>,
    lamports: u64,
) -> Result<()> {
    let inco_program = ctx.accounts.inco_lightning_program.to_account_info();
    let signer = ctx.accounts.sender.to_account_info();
    let clock = Clock::get()?;

    // Transfer real SOL to the stealth note PDA
    let cpi_ctx = CpiContext::new(
        ctx.accounts.system_program.to_account_info(),
        anchor_lang::system_program::Transfer {
            from: ctx.accounts.sender.to_account_info(),
            to: ctx.accounts.stealth_note.to_account_info(),
        },
    );
    anchor_lang::system_program::transfer(cpi_ctx, lamports)?;

    // Convert ciphertext -> encrypted handle (input_type = 0)
    let cpi_ctx = CpiContext::new(inco_program.clone(), Operation { signer: signer.clone() });
    let amount_handle: Euint128 = new_euint128(cpi_ctx, encrypted_amount, 0)?;

    // Initialize the stealth note
    let stealth_note = &mut ctx.accounts.stealth_note;
    stealth_note.note_id = note_id;
    stealth_note.encrypted_amount = amount_handle;
    stealth_note.lamports = lamports;
    stealth_note.sender = ctx.accounts.sender.key();
    stealth_note.created_at = clock.unix_timestamp;
    stealth_note.claimed = false;
    stealth_note.bump = ctx.bumps.stealth_note;

    // Note: We do NOT grant decrypt access here - the claimer will get access when they claim.
    // The sender can optionally grant themselves access if they want to verify.

    msg!("Stealth note created with ID: {:?}", note_id);

    Ok(())
}
