use anchor_lang::prelude::*;

#[error_code]
pub enum VaultError {
    #[msg("Invalid encrypted input data")]
    InvalidEncryptedInput,
    #[msg("Unauthorized operation")]
    Unauthorized,
    #[msg("Arithmetic overflow in encrypted operation")]
    Overflow,
    #[msg("Arithmetic underflow in encrypted operation")]
    Underflow,
    #[msg("Insufficient escrowed SOL for this operation")]
    InsufficientEscrow,
    #[msg("Insufficient yield pool funds")]
    InsufficientYieldPool,
    #[msg("No escrowed funds to distribute yield")]
    NoEscrow,
}
