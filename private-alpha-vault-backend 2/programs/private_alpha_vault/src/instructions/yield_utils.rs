use anchor_lang::prelude::*;
use anchor_lang::solana_program::{program::invoke_signed, system_instruction};
use inco_lightning::cpi::accounts::Operation;
use inco_lightning::cpi::{as_euint128, e_add};
use inco_lightning::types::Euint128;

use crate::errors::VaultError;
use crate::state::{UserPosition, Vault};

pub const YIELD_INDEX_SCALE: u128 = 1_000_000_000_000;

pub fn apply_pending_yield<'info>(
    vault: &mut Account<'info, Vault>,
    user_position: &mut Account<'info, UserPosition>,
    inco_program: AccountInfo<'info>,
    signer: AccountInfo<'info>,
    system_program: AccountInfo<'info>,
) -> Result<()> {
    let current_index = vault.yield_index;

    if user_position.last_yield_index == 0 && current_index > 0 {
        // Legacy account (pre-yield-index upgrade) starts at current index.
        user_position.last_yield_index = current_index;
        return Ok(());
    }

    if current_index == user_position.last_yield_index {
        return Ok(());
    }

    let rent = Rent::get()?;
    let user_min = rent.minimum_balance(UserPosition::SIZE);
    let user_lamports = **user_position.to_account_info().lamports.borrow();
    let user_escrow = user_lamports.saturating_sub(user_min);

    let delta_index = current_index.saturating_sub(user_position.last_yield_index);
    let pending = (user_escrow as u128)
        .saturating_mul(delta_index)
        / YIELD_INDEX_SCALE;

    if pending == 0 {
        user_position.last_yield_index = current_index;
        return Ok(());
    }

    let vault_min = rent.minimum_balance(Vault::SIZE);
    let vault_lamports = **vault.to_account_info().lamports.borrow();
    let vault_available = vault_lamports.saturating_sub(vault_min);
    if vault_available < pending as u64 {
        return Err(VaultError::InsufficientYieldPool.into());
    }

    // Transfer pending yield from vault PDA to user PDA.
    let seeds: &[&[u8]] = &[b"vault_v2", &[vault.bump]];
    let transfer_ix = system_instruction::transfer(
        &vault.key(),
        &user_position.key(),
        pending as u64,
    );
    invoke_signed(
        &transfer_ix,
        &[
            vault.to_account_info(),
            user_position.to_account_info(),
            system_program,
        ],
        &[seeds],
    )?;

    // Add pending yield to encrypted balance.
    let cpi_ctx = CpiContext::new(inco_program.clone(), Operation { signer: signer.clone() });
    let pending_handle: Euint128 = as_euint128(cpi_ctx, pending)?;
    let cpi_ctx = CpiContext::new(inco_program, Operation { signer });
    let new_balance = e_add(cpi_ctx, user_position.encrypted_balance, pending_handle, 0)?;
    user_position.encrypted_balance = new_balance;

    vault.total_escrow_lamports = vault.total_escrow_lamports.saturating_add(pending as u64);
    user_position.last_yield_index = current_index;

    Ok(())
}
