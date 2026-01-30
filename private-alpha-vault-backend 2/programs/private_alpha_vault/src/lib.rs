use anchor_lang::prelude::*;

pub mod constants;
pub mod errors;
pub mod state;
pub mod instructions;

use instructions::*;

// Will be replaced with actual program ID after deployment
declare_id!("DmfUVqYJ5DG1iWww8YXt75zsB6RdmMws5qQMBWH4ofvC");

#[program]
pub mod private_alpha_vault {
    use super::*;

    pub fn initialize_vault(ctx: Context<InitializeVault>) -> Result<()> {
        initialize_vault::handler(ctx)
    }

    pub fn deposit<'info>(
        ctx: Context<'_, '_, 'info, 'info, Deposit<'info>>,
        encrypted_amount: Vec<u8>,
        lamports: u64,
    ) -> Result<()> {
        deposit::handler(ctx, encrypted_amount, lamports)
    }

    pub fn withdraw<'info>(
        ctx: Context<'_, '_, 'info, 'info, Withdraw<'info>>,
        encrypted_amount: Vec<u8>,
        lamports: u64,
    ) -> Result<()> {
        withdraw::handler(ctx, encrypted_amount, lamports)
    }

    pub fn apply_yield(ctx: Context<ApplyYield>, encrypted_yield: Vec<u8>, lamports: u64) -> Result<()> {
        apply_yield::handler(ctx, encrypted_yield, lamports)
    }

    pub fn transfer<'info>(
        ctx: Context<'_, '_, 'info, 'info, Transfer<'info>>,
        encrypted_amount: Vec<u8>,
        lamports: u64,
    ) -> Result<()> {
        transfer::handler(ctx, encrypted_amount, lamports)
    }

    /// Claim decrypt access to your own balance handle.
    /// Call this after receiving a transfer to be able to decrypt your balance.
    pub fn claim_access<'info>(ctx: Context<'_, '_, 'info, 'info, ClaimAccess<'info>>) -> Result<()> {
        claim_access::handler(ctx)
    }

    /// Claim any pending yield for the caller.
    pub fn claim_yield<'info>(ctx: Context<'_, '_, 'info, 'info, ClaimYield<'info>>) -> Result<()> {
        claim_yield::handler(ctx)
    }

    /// Create a stealth note - send funds to a secret identifier instead of a public address.
    /// The recipient can claim by proving knowledge of the secret passphrase.
    pub fn create_stealth_note<'info>(
        ctx: Context<'_, '_, 'info, 'info, CreateStealthNote<'info>>,
        note_id: [u8; 32],
        encrypted_amount: Vec<u8>,
        lamports: u64,
    ) -> Result<()> {
        create_stealth_note::handler(ctx, note_id, encrypted_amount, lamports)
    }

    /// Claim a stealth note by providing the secret passphrase.
    /// The secret is hashed and matched against the note_id.
    pub fn claim_stealth_note<'info>(
        ctx: Context<'_, '_, 'info, 'info, ClaimStealthNote<'info>>,
        secret: Vec<u8>,
    ) -> Result<()> {
        claim_stealth_note::handler(ctx, secret)
    }
}
