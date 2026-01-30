# Vault-007

> **A Confidential Yield Vault on Solana powered by Fully Homomorphic Encryption (FHE)**

[![Solana](https://img.shields.io/badge/Solana-Devnet-9945FF?style=flat&logo=solana)](https://solana.com)
[![Inco](https://img.shields.io/badge/Inco-Lightning-00D4AA?style=flat)](https://inco.org)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat&logo=react)](https://react.dev)
[![Anchor](https://img.shields.io/badge/Anchor-0.31.1-blue?style=flat)](https://anchor-lang.com)

---

## Overview

Vault-007 is a **privacy-preserving DeFi vault** that enables users to deposit, withdraw, and transfer funds while keeping all balances completely confidential on-chain. Using Inco Network's Fully Homomorphic Encryption (FHE) technology, the vault performs arithmetic operations on encrypted data without ever revealing the underlying values.

**Key Innovation**: Unlike traditional DeFi protocols where all balances are publicly visible, Vault-007 ensures that:
- Your deposit amounts remain private
- Your current balance is encrypted
- Transfer amounts are hidden from observers
- Only YOU can decrypt and view your balance (using your wallet signature)

---

## Demo

**Live Demo**: http://localhost:3003 (after running locally)

**Deployed Program**: [`DmfUVqYJ5DG1iWww8YXt75zsB6RdmMws5qQMBWH4ofvC`](https://explorer.solana.com/address/DmfUVqYJ5DG1iWww8YXt75zsB6RdmMws5qQMBWH4ofvC?cluster=devnet)

---

## Features

### 1. Confidential Deposits
- Encrypt your deposit amount client-side before sending to Solana
- On-chain FHE addition updates your encrypted balance
- No one can see how much you deposited

### 2. Confidential Withdrawals
- Withdraw funds without revealing the amount
- FHE subtraction maintains balance privacy
- Overdraft protection via encrypted comparisons

### 3. Private Transfers
- Send funds to other users privately
- Balance validation happens on encrypted data (no one knows if you have enough)
- Both sender and recipient balances remain hidden

### 4. Yield Distribution
- Vault authority can distribute yield to all depositors
- Yield amounts are encrypted
- Individual allocations remain private

### 5. Attested Decryption
- Only the balance owner can decrypt their balance
- Requires wallet signature for authentication
- Decrypted values exist only in browser memory (never stored)

### 6. Stealth Notes (100% Hidden Recipient)
- Send funds using a **secret passphrase** instead of a public wallet address
- **Recipient's wallet address is NEVER visible on-chain**
- Sender creates a note with a secret, shares it off-chain (message, email, etc.)
- Recipient claims by entering the secret passphrase
- Perfect for truly anonymous transfers

---

## How It Works

### The FHE Magic

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER'S BROWSER                           │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐         │
│  │ Enter 1 SOL │ -> │  Encrypt    │ -> │ Ciphertext  │         │
│  │             │    │ (Inco SDK)  │    │ 0x7f3a...   │         │
│  └─────────────┘    └─────────────┘    └─────────────┘         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     SOLANA BLOCKCHAIN                           │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                      Vault-007 Program                   │   │
│  │                                                          │   │
│  │   encrypted_balance = e_add(encrypted_balance, amount)   │   │
│  │                                                          │   │
│  │   // All math happens on ENCRYPTED values!               │   │
│  │   // No one can see the actual numbers                   │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      INCO NETWORK (L3)                          │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  • Stores encrypted ciphertexts                          │   │
│  │  • Performs FHE computations                             │   │
│  │  • Manages decrypt permissions                           │   │
│  │  • Returns handles (128-bit references)                  │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### Encrypted Operations

| Operation | FHE Function | Description |
|-----------|--------------|-------------|
| Deposit | `e_add()` | Add encrypted amount to balance |
| Withdraw | `e_sub()` | Subtract encrypted amount from balance |
| Transfer | `e_ge()` + `e_select()` + `e_sub()` + `e_add()` | Validate balance, conditionally transfer |
| Compare | `e_ge()` | Check if balance >= amount (returns encrypted boolean) |

### Decryption Flow

```
1. User clicks "Decrypt & Reveal"
2. Frontend fetches encrypted handle from Solana account
3. User signs the handle with their wallet (proves ownership)
4. Signature sent to Inco covalidator API
5. Covalidator verifies signature matches allowed address
6. Plaintext returned ONLY to the authorized user
7. Value displayed in browser (never stored on-chain)
```

---

## Architecture

```
┌────────────────────────────────────────────────────────────────────┐
│                           FRONTEND                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │   React 19   │  │  Tailwind    │  │   Framer     │              │
│  │  TypeScript  │  │     CSS      │  │   Motion     │              │
│  └──────────────┘  └──────────────┘  └──────────────┘              │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                      VaultService                             │  │
│  │  • Wallet connection (Phantom, Solflare, Trust, etc.)        │  │
│  │  • Client-side encryption via @inco/solana-sdk               │  │
│  │  • Transaction building & signing                            │  │
│  │  • Browser-compatible decryption                             │  │
│  └──────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌────────────────────────────────────────────────────────────────────┐
│                     SOLANA PROGRAM (Anchor)                        │
│                                                                     │
│  Instructions:                                                      │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐        │
│  │ initialize_    │  │    deposit     │  │   withdraw     │        │
│  │    vault       │  │                │  │                │        │
│  └────────────────┘  └────────────────┘  └────────────────┘        │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐        │
│  │   transfer     │  │  apply_yield   │  │ claim_access   │        │
│  └────────────────┘  └────────────────┘  └────────────────┘        │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐        │
│  │ create_stealth │  │ claim_stealth  │  │  claim_yield   │        │
│  │    _note       │  │    _note       │  │                │        │
│  └────────────────┘  └────────────────┘  └────────────────┘        │
│                                                                     │
│  Accounts:                                                          │
│  • Vault PDA: Total encrypted balance, authority, yield index      │
│  • UserPosition PDA: Individual encrypted balances, yield index    │
│  • StealthNote PDA: Secret-based transfers with hidden recipient   │
└────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌────────────────────────────────────────────────────────────────────┐
│                    INCO LIGHTNING (FHE Layer)                      │
│                                                                     │
│  Program ID: 5sjEbPiqgZrYwR31ahR6Uk9wf5awoX61YGg7jExQSwaj          │
│                                                                     │
│  CPI Functions:                                                     │
│  • new_euint128() - Convert ciphertext to handle                   │
│  • as_euint128()  - Create encrypted constant                      │
│  • e_add()        - Encrypted addition                             │
│  • e_sub()        - Encrypted subtraction                          │
│  • e_ge()         - Encrypted greater-or-equal comparison          │
│  • e_select()     - Encrypted conditional selection                │
│  • allow()        - Grant decrypt permission                       │
└────────────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Frontend** | React 19, TypeScript, Vite | Modern web UI |
| **Styling** | Tailwind CSS, Framer Motion | Beautiful, animated interface |
| **Blockchain** | Solana (Devnet) | Fast, low-cost settlement |
| **Smart Contract** | Anchor 0.31.1 (Rust) | Type-safe program development |
| **FHE** | Inco Lightning | Encrypted computations |
| **Encryption SDK** | @inco/solana-sdk | Client-side encryption |
| **Wallet** | @solana/wallet-adapter | Multi-wallet support |

---

## Getting Started

### Prerequisites

- Node.js 18+
- Rust & Cargo
- Solana CLI
- Anchor CLI

### Installation

```bash
# Clone the repository
git clone <repo-url>
cd private-alpha-vault

# Install frontend dependencies
npm install

# Start the development server
npm run dev
```

### Connect to Devnet

1. Open http://localhost:3003
2. Click "Connect Wallet"
3. Select your wallet (Phantom, Solflare, etc.)
4. Ensure you're on Solana Devnet
5. Get devnet SOL from https://faucet.solana.com

### Try It Out

1. **Deposit**: Enter an amount and click "Encrypt & Deposit"
2. **View Balance**: Click "Decrypt & Reveal" to see your encrypted balance
3. **Transfer**: Switch to Transfer tab, enter recipient address and amount
4. **Withdraw**: Enter amount and click "Withdraw"
5. **Stealth Notes**: Use the "Stealth Notes" panel to send funds with a secret passphrase (recipient address stays hidden!)

---

## Deploy to Vercel (Devnet)

This app is configured for Vercel using `vercel.json`.

1. Push the repo to GitHub
2. Import it into Vercel
3. Build command: `npm run build`
4. Output directory: `dist`
5. Deploy

Notes:
- The app uses `VITE_RPC_URL` and `VITE_CLUSTER` (see `.env.example`).
- Optional: set `VITE_DEVNET_RPC_URL`, `VITE_TESTNET_RPC_URL`, `VITE_MAINNET_RPC_URL` to override defaults.
- Users must connect a wallet for the chosen cluster and have SOL for that network.

---

## Smart Contract Details

### Program ID
```
DmfUVqYJ5DG1iWww8YXt75zsB6RdmMws5qQMBWH4ofvC
```

### Account Structure

**Vault Account** (57 bytes)
```rust
pub struct Vault {
    pub authority: Pubkey,           // 32 bytes
    pub total_encrypted_balance: Euint128,  // 16 bytes (handle)
    pub bump: u8,                    // 1 byte
}
```

**User Position Account** (57 bytes)
```rust
pub struct UserPosition {
    pub owner: Pubkey,               // 32 bytes
    pub encrypted_balance: Euint128, // 16 bytes (handle)
    pub bump: u8,                    // 1 byte
}
```

### Instruction Discriminators

| Instruction | Discriminator (hex) |
|-------------|---------------------|
| initialize_vault | `30bfa32c47813fa4` |
| deposit | `f223c68952e1f2b6` |
| withdraw | `b712469c946da122` |
| apply_yield | `6e7ea020cbc9228f` |
| transfer | `a334c8e78c0345ba` |
| claim_access | `0e67cbb5aa3873da` |
| claim_yield | `314a6f07ba163da5` |
| create_stealth_note | `4b5aad640e9e1898` |
| claim_stealth_note | `d3fe1d44d7b68a40` |

---

## Security Considerations

### What's Private
- All deposit/withdraw/transfer amounts
- User balances (encrypted on-chain)
- Total vault balance
- **Stealth Note recipients** (wallet address never appears on-chain!)

### What's Public
- Transaction existence (that a deposit/withdraw occurred)
- Account addresses (PDAs are deterministic, but stealth note PDAs are derived from secret hashes)
- Vault authority address
- Stealth note existence (but not who can claim it)

### Trust Assumptions
- Inco Network operates honestly (FHE computations)
- Solana validators process transactions correctly
- User's browser is not compromised

---

## Use Cases

1. **Private Savings**: Store funds without revealing your balance to the world
2. **Confidential Payments**: Transfer funds without exposing amounts
3. **Private Yield Farming**: Earn yield while keeping your position size private
4. **Corporate Treasury**: Manage funds without competitors knowing your holdings
5. **Privacy-Preserving DeFi**: Foundation for private lending, trading, etc.

---

## Future Roadmap

- [x] ~~Stealth Notes for hidden recipient transfers~~
- [x] ~~Lazy yield distribution with global yield index~~
- [ ] Proportional yield distribution based on encrypted balances
- [ ] Multi-asset support (SPL tokens)
- [ ] Private governance voting
- [ ] Cross-chain confidential transfers
- [ ] Encrypted order book DEX
- [ ] Private lending protocol

---

## Team

Built for [Hackathon Name] by [Team Name]

---

## License

MIT License - see [LICENSE](LICENSE) for details

---

## Acknowledgments

- [Inco Network](https://inco.org) - FHE infrastructure
- [Solana Foundation](https://solana.org) - Blockchain platform
- [Anchor](https://anchor-lang.com) - Smart contract framework

---

## Links

- **Live Demo**: http://localhost:3003
- **Program Explorer**: [View on Solana Explorer](https://explorer.solana.com/address/DmfUVqYJ5DG1iWww8YXt75zsB6RdmMws5qQMBWH4ofvC?cluster=devnet)
- **Inco Docs**: https://docs.inco.org
- **Solana Docs**: https://docs.solana.com
