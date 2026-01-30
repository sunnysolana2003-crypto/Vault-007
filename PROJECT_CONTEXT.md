# Project Status & Context Report
**Generated on:** 2026-01-28
**Project:** Private Alpha Vault (Solana + Inco Lightning FHE)

## Current Status
- **Frontend:** React/Vite app with Inco SDK integration
- **Backend:** Anchor program using `inco-lightning` crate for FHE operations
- **Encryption:** Real Inco Lightning SDK (no mocks)

---

## Dependencies

### Backend (Rust/Anchor)
```toml
[dependencies]
anchor-lang = "0.32.1"
inco-lightning = { version = "0.1.4", features = ["cpi"] }
```

### Frontend (TypeScript)
```json
{
  "@inco/solana-sdk": "latest",
  "@solana/web3.js": "^1.77.0"
}
```

---

## Inco Lightning Integration

### Rust SDK Usage
The program uses Inco Lightning's CPI operations for encrypted arithmetic:

```rust
use inco_lightning::cpi::accounts::Operation;
use inco_lightning::cpi::{e_add, e_sub, new_euint128};
use inco_lightning::types::Euint128;
use inco_lightning::ID as INCO_LIGHTNING_ID;
```

**Key Points:**
- `Euint128` - 128-bit encrypted integer handle (stored on-chain)
- `e_add` / `e_sub` - CPI calls for encrypted arithmetic
- All instructions require the Inco Lightning program account

### JavaScript SDK Usage
The frontend uses Inco's encryption/decryption utilities:

```typescript
import { encryptValue } from '@inco/solana-sdk/encryption';
import { decrypt } from '@inco/solana-sdk/attested-decrypt';
import { hexToBuffer } from '@inco/solana-sdk/utils';

// Encrypt before sending to program
const encrypted = await encryptValue(1000n);

// Decrypt handle for display (requires wallet signature)
const result = await decrypt([handle], {
  address: wallet.publicKey,
  signMessage: wallet.signMessage,
});
```

---

## Program IDs

| Program | ID |
|---------|-----|
| Private Alpha Vault | `DmfUVqYJ5DG1iWww8YXt75zsB6RdmMws5qQMBWH4ofvC` |
| Inco Lightning | `5sjEbPiqgZrYwR31ahR6Uk9wf5awoX61YGg7jExQSwaj` |

---

## Build & Deploy

### Prerequisites
1. Rust 1.75.0 (compatible with Solana SBF tools)
2. Solana CLI 1.18.x
3. Anchor CLI 0.32.1

### Commands
```bash
# Backend
cd "private-alpha-vault-backend 2"
anchor build
anchor deploy

# Frontend
npm install
npm run dev
```

---

## Architecture

### Account Structure
- **Vault PDA** (`seeds = [b"vault"]`)
  - `authority: Pubkey` - Can apply yield
  - `total_encrypted_balance: Euint128` - FHE-encrypted total
  - `bump: u8`

- **UserPosition PDA** (`seeds = [b"user", user_pubkey]`)
  - `owner: Pubkey`
  - `encrypted_balance: Euint128` - User's FHE-encrypted balance
  - `bump: u8`

### Instructions
1. `initialize_vault` - Create vault with encrypted zero balance
2. `deposit` - Add encrypted amount to user & vault balances
3. `withdraw` - Subtract encrypted amount from balances
4. `apply_yield` - Authority adds encrypted yield to vault

All operations preserve confidentiality - amounts are encrypted client-side and remain encrypted throughout computation via Inco's FHE.
