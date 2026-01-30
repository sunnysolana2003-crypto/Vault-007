use anchor_lang::prelude::*;
use inco_lightning::cpi::accounts::Allow;
use inco_lightning::cpi::allow;
use inco_lightning::ID as INCO_LIGHTNING_ID;
use crate::state::UserPosition;

/// Allows a user to claim decrypt access to their own balance handle.
/// This is needed after receiving a transfer, since the sender cannot
/// grant access to handles they don't own.
#[derive(Accounts)]
pub struct ClaimAccess<'info> {
    #[account(
        seeds = [b"user_v2", user.key().as_ref()],
        bump = user_position.bump,
        constraint = user_position.owner == user.key() @ ClaimAccessError::Unauthorized
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
    ctx: Context<'_, '_, 'info, 'info, ClaimAccess<'info>>,
) -> Result<()> {
    let inco_program = ctx.accounts.inco_lightning_program.to_account_info();
    let signer = ctx.accounts.user.to_account_info();
    let user_key = ctx.accounts.user.key();
    let handle = ctx.accounts.user_position.encrypted_balance;

    // Grant decrypt access to the user for their own balance handle
    // remaining_accounts:
    // [0] allowance_account (mut)
    // [1] allowed_address (readonly) - user pubkey
    if ctx.remaining_accounts.len() >= 2 {
        let allowance_account = ctx.remaining_accounts[0].clone();
        let allowed_address = ctx.remaining_accounts[1].clone();
        let system_program = ctx.accounts.system_program.to_account_info();

        let cpi_ctx = CpiContext::new(
            inco_program,
            Allow {
                allowance_account,
                signer,
                allowed_address,
                system_program,
            },
        );
        allow(cpi_ctx, handle.0, true, user_key)?;
    } else {
        return Err(ClaimAccessError::MissingAccounts.into());
    }

    Ok(())
}

#[error_code]
pub enum ClaimAccessError {
    #[msg("Unauthorized: signer is not the position owner")]
    Unauthorized,
    #[msg("Missing required remaining accounts for allowance")]
    MissingAccounts,
}
