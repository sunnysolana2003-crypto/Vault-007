use anchor_lang::prelude::*;
use inco_lightning::types::Euint128;

/// A stealth note allows sending funds to a secret identifier (hash) instead of
/// a public wallet address. The recipient can claim by proving knowledge of the
/// secret that hashes to the note_id.
#[account]
pub struct StealthNote {
    /// Unique identifier for this note (hash of secret passphrase)
    /// The sender creates this from a secret they share with recipient off-chain
    pub note_id: [u8; 32],
    /// Encrypted amount stored in this note
    pub encrypted_amount: Euint128,
    /// Real SOL lamports escrowed in this note PDA
    pub lamports: u64,
    /// The sender's pubkey (for reference/audit, not used for claiming)
    pub sender: Pubkey,
    /// Timestamp when the note was created
    pub created_at: i64,
    /// Whether the note has been claimed
    pub claimed: bool,
    /// PDA bump seed
    pub bump: u8,
}

impl StealthNote {
    pub const SIZE: usize = 8 +   // discriminator
        32 +  // note_id
        16 +  // Euint128 handle (128-bit)
        8 +   // lamports
        32 +  // sender
        8 +   // created_at
        1 +   // claimed
        1;    // bump
}
