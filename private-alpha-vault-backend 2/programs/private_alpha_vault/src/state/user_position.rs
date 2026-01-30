use anchor_lang::prelude::*;
use inco_lightning::types::Euint128;

#[account]
pub struct UserPosition {
    /// Owner of this position
    pub owner: Pubkey,
    /// Encrypted balance (handle to off-chain encrypted value)
    pub encrypted_balance: Euint128,
    /// Last yield index observed by this user (fixed-point, scaled by 1e12)
    pub last_yield_index: u128,
    /// PDA bump seed
    pub bump: u8,
}

impl UserPosition {
    pub const SIZE: usize = 8 + // discriminator
        32 +  // owner
        16 +  // Euint128 handle (128-bit)
        16 +  // last_yield_index
        1;    // bump
}
