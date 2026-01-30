use anchor_lang::prelude::*;
use inco_lightning::cpi::accounts::Operation;
use inco_lightning::cpi::as_euint128;
use inco_lightning::ID as INCO_LIGHTNING_ID;
use crate::state::Vault;

#[derive(Accounts)]
pub struct InitializeVault<'info> {
    #[account(
        init,
        payer = authority,
        seeds = [b"vault_v2"],
        bump,
        space = Vault::SIZE
    )]
    pub vault: Account<'info, Vault>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,

    /// CHECK: Inco Lightning program for encrypted operations
    #[account(address = INCO_LIGHTNING_ID)]
    pub inco_lightning_program: AccountInfo<'info>,
}

pub fn handler(ctx: Context<InitializeVault>) -> Result<()> {
    let vault = &mut ctx.accounts.vault;
    vault.authority = ctx.accounts.authority.key();
    vault.bump = ctx.bumps.vault;
    vault.total_escrow_lamports = 0;
    vault.yield_index = 0;

    // Initialize encrypted total balance to encrypted zero.
    let cpi_ctx = CpiContext::new(
        ctx.accounts.inco_lightning_program.to_account_info(),
        Operation {
            signer: ctx.accounts.authority.to_account_info(),
        },
    );
    vault.total_encrypted_balance = as_euint128(cpi_ctx, 0u128)?;

    Ok(())
}
