use anchor_lang::prelude::*;
use inco_lightning::types::Euint128;

#[account]
pub struct Vault {
    /// Authority that can apply yield
    pub authority: Pubkey,
    /// Encrypted total balance (handle to off-chain encrypted value)
    pub total_encrypted_balance: Euint128,
    /// Total escrowed SOL across all user PDAs (lamports)
    pub total_escrow_lamports: u64,
    /// Global yield index (fixed-point, scaled by 1e12)
    pub yield_index: u128,
    /// PDA bump seed
    pub bump: u8,
}

impl Vault {
    pub const SIZE: usize = 8 + // discriminator
        32 +  // authority
        16 +  // Euint128 handle (128-bit)
        8 +   // total_escrow_lamports
        16 +  // yield_index
        1;    // bump
}
