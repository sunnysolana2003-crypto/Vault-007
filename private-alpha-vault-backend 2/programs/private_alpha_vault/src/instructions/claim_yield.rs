use anchor_lang::prelude::*;
use inco_lightning::ID as INCO_LIGHTNING_ID;

use crate::instructions::yield_utils::apply_pending_yield;
use crate::state::{UserPosition, Vault};

#[derive(Accounts)]
pub struct ClaimYield<'info> {
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
        constraint = user_position.owner == user.key() @ ClaimYieldError::Unauthorized
    )]
    pub user_position: Account<'info, UserPosition>,

    #[account(mut)]
    pub user: Signer<'info>,

    pub system_program: Program<'info, System>,

    /// CHECK: Inco Lightning program for encrypted operations
    #[account(address = INCO_LIGHTNING_ID)]
    pub inco_lightning_program: AccountInfo<'info>,
}

pub fn handler<'info>(ctx: Context<'_, '_, 'info, 'info, ClaimYield<'info>>) -> Result<()> {
    apply_pending_yield(
        &mut ctx.accounts.vault,
        &mut ctx.accounts.user_position,
        ctx.accounts.inco_lightning_program.to_account_info(),
        ctx.accounts.user.to_account_info(),
        ctx.accounts.system_program.to_account_info(),
    )?;
    Ok(())
}

#[error_code]
pub enum ClaimYieldError {
    #[msg("Unauthorized: signer is not the position owner")]
    Unauthorized,
}
