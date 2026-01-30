use anchor_lang::prelude::*;
use inco_lightning::cpi::accounts::Operation;
use inco_lightning::cpi::{e_add, new_euint128};
use inco_lightning::ID as INCO_LIGHTNING_ID;
use crate::state::Vault;
use anchor_lang::solana_program::system_instruction;

const YIELD_INDEX_SCALE: u128 = 1_000_000_000_000;

#[derive(Accounts)]
pub struct ApplyYield<'info> {
    #[account(
        mut,
        seeds = [b"vault_v2"],
        bump = vault.bump,
        constraint = vault.authority == authority.key() @ YieldError::Unauthorized
    )]
    pub vault: Account<'info, Vault>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,

    /// CHECK: Inco Lightning program for encrypted operations
    #[account(address = INCO_LIGHTNING_ID)]
    pub inco_lightning_program: AccountInfo<'info>,
}

pub fn handler(ctx: Context<ApplyYield>, encrypted_yield: Vec<u8>, lamports: u64) -> Result<()> {
    let inco_program = ctx.accounts.inco_lightning_program.to_account_info();
    let signer = ctx.accounts.authority.to_account_info();

    if ctx.accounts.vault.total_escrow_lamports == 0 {
        return Err(YieldError::NoEscrow.into());
    }

    // Transfer real SOL into the vault PDA as the yield pool.
    let cpi_ctx = CpiContext::new(
        ctx.accounts.system_program.to_account_info(),
        anchor_lang::system_program::Transfer {
            from: ctx.accounts.authority.to_account_info(),
            to: ctx.accounts.vault.to_account_info(),
        },
    );
    anchor_lang::system_program::transfer(cpi_ctx, lamports)?;

    // Convert ciphertext -> encrypted handle (input_type = 0)
    let cpi_ctx = CpiContext::new(inco_program.clone(), Operation { signer: signer.clone() });
    let yield_handle = new_euint128(cpi_ctx, encrypted_yield, 0)?;

    // Add yield to vault's total encrypted balance
    let cpi_ctx = CpiContext::new(inco_program, Operation { signer });
    let new_balance = e_add(cpi_ctx, ctx.accounts.vault.total_encrypted_balance, yield_handle, 0)?;
    ctx.accounts.vault.total_encrypted_balance = new_balance;

    // Update yield index (fixed-point): delta = yield / total_escrow
    let delta_index = (lamports as u128)
        .saturating_mul(YIELD_INDEX_SCALE)
        / (ctx.accounts.vault.total_escrow_lamports as u128);
    ctx.accounts.vault.yield_index = ctx.accounts.vault.yield_index.saturating_add(delta_index);

    Ok(())
}

#[error_code]
pub enum YieldError {
    #[msg("Unauthorized: only vault authority can apply yield")]
    Unauthorized,
    #[msg("No escrowed funds to distribute yield")]
    NoEscrow,
}
