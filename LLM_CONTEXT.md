# Private Alpha Vault - LLM Context File

> **Purpose**: This file provides comprehensive context for LLMs (Claude, GPT, etc.) to understand, modify, and extend this codebase. It documents architecture, key files, data flows, and implementation details.

---

## Project Overview

**Private Alpha Vault** is a confidential yield vault built on Solana using Inco Lightning's Fully Homomorphic Encryption (FHE). Users can deposit and withdraw SOL while keeping their balances completely private on-chain.

### Key Value Proposition
- Balances are **encrypted on-chain** using FHE
- Only the owner can **decrypt their balance** via wallet signature
- Arithmetic operations (add/subtract) work on **encrypted values** without revealing them
- Enables **institutional-grade privacy** for DeFi

---

## Technology Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| Blockchain | Solana (Devnet) | Settlement layer |
| Smart Contracts | Anchor Framework (Rust) | Program logic |
| Privacy Layer | Inco Lightning | FHE operations |
| Frontend | React 19 + TypeScript | User interface |
| Build Tool | Vite 6 | Frontend bundling |
| Styling | Tailwind CSS | UI styling |
| Animation | Framer Motion | UI animations |
| Wallet | Phantom | Solana wallet integration |

---

## Deployed Addresses (Devnet)

```
Program ID:        DmfUVqYJ5DG1iWww8YXt75zsB6RdmMws5qQMBWH4ofvC
Vault PDA:         5SDA2ZsZ6Du2fhRw1UqgkHG4HwNwnCyeAPiMK4XDTerL
Inco Lightning:    5sjEbPiqgZrYwR31ahR6Uk9wf5awoX61YGg7jExQSwaj
IDL Account:       64ZYpxfGvnAJp7oUMnWbjr5MHmVR95pkA1xRpchdRRFJ
```

---

## Directory Structure

```
private-alpha-vault (1)/
├── App.tsx                          # Main React app entry
├── index.tsx                        # React DOM render
├── index.html                       # HTML template
├── package.json                     # Frontend dependencies
├── vite.config.ts                   # Vite configuration
├── tsconfig.json                    # TypeScript config
│
├── context/
│   └── VaultContext.tsx             # React context for vault state
│
├── services/
│   └── vault.ts                     # Solana + Inco SDK integration
│
├── components/
│   ├── Navbar.tsx                   # Navigation bar
│   ├── Hero.tsx                     # Landing section
│   ├── VaultTerminal.tsx            # Main vault dashboard
│   ├── ActionSuite.tsx              # Deposit/withdraw panel
│   ├── StatusMonitor.tsx            # Activity log
│   ├── PrivateValue.tsx             # Encrypted value display
│   ├── WhyConfidential.tsx          # Features section
│   ├── HowItWorks.tsx               # Explanation section
│   ├── ProtocolSpecs.tsx            # Technical specs
│   ├── CTA.tsx                      # Call to action
│   └── DashboardPreview.tsx         # Preview component
│
├── scripts/
│   ├── initialize-vault.ts          # CLI script to init vault
│   └── test-vault-state.ts          # CLI script to read vault
│
└── private-alpha-vault-backend 2/   # Solana program (Anchor)
    ├── Anchor.toml                  # Anchor configuration
    ├── Cargo.toml                   # Workspace Cargo config
    ├── programs/
    │   └── private_alpha_vault/
    │       ├── Cargo.toml           # Program dependencies
    │       └── src/
    │           ├── lib.rs           # Program entry point
    │           ├── constants.rs     # PDA seeds
    │           ├── errors.rs        # Custom errors
    │           ├── state/
    │           │   ├── mod.rs
    │           │   ├── vault.rs     # Vault account struct
    │           │   └── user_position.rs  # User position struct
    │           └── instructions/
    │               ├── mod.rs
    │               ├── initialize_vault.rs
    │               ├── deposit.rs
    │               ├── withdraw.rs
    │               └── apply_yield.rs
    ├── target/
    │   ├── deploy/
    │   │   └── private_alpha_vault.so  # Compiled program
    │   └── idl/
    │       └── private_alpha_vault.json  # IDL file
    └── vendor/                      # Vendored crates for build compatibility
        ├── constant_time_eq-0.4.2/
        ├── blake3-1.8.3/
        └── borsh-derive-1.6.0/
```

---

## Core Data Structures

### Vault Account (On-Chain)
```rust
// programs/private_alpha_vault/src/state/vault.rs
pub struct Vault {
    pub authority: Pubkey,              // Can apply yield
    pub total_encrypted_balance: Euint128,  // FHE handle (16 bytes)
    pub bump: u8,                       // PDA bump seed
}
// Size: 8 (discriminator) + 32 (pubkey) + 16 (Euint128) + 1 (bump) = 57 bytes
```

### User Position Account (On-Chain)
```rust
// programs/private_alpha_vault/src/state/user_position.rs
pub struct UserPosition {
    pub owner: Pubkey,                  // Position owner
    pub encrypted_balance: Euint128,    // FHE handle (16 bytes)
    pub bump: u8,                       // PDA bump seed
}
// Size: 8 (discriminator) + 32 (pubkey) + 16 (Euint128) + 1 (bump) = 57 bytes
```

### Euint128 (Inco Lightning)
```rust
// From inco-lightning crate
pub struct Euint128(pub u128);  // 128-bit handle to off-chain encrypted value
```

---

## Program Instructions

### 1. initialize_vault
**Purpose**: Create the vault PDA with an encrypted zero balance

```rust
// Accounts required:
- vault: PDA [seeds: "vault"]
- authority: Signer (becomes vault authority)
- system_program: System
- inco_lightning_program: Inco Lightning

// No arguments
// Creates vault with as_euint128(0) as initial balance
```

### 2. deposit
**Purpose**: Add encrypted amount to user's balance and vault total

```rust
// Accounts required:
- vault: PDA [seeds: "vault"]
- user_position: PDA [seeds: "user", user.key()]
- user: Signer
- system_program: System
- inco_lightning_program: Inco Lightning
// + remaining_accounts for allow() CPI (4 accounts)

// Arguments:
- encrypted_amount: Vec<u8>  // Ciphertext from client

// Operations:
1. new_euint128(ciphertext) -> amount_handle
2. e_add(user_balance, amount_handle) -> new_user_balance
3. e_add(vault_balance, amount_handle) -> new_vault_balance
4. allow() CPI to grant decrypt permission
```

### 3. withdraw
**Purpose**: Subtract encrypted amount from user's balance and vault total

```rust
// Same accounts as deposit

// Arguments:
- encrypted_amount: Vec<u8>

// Operations:
1. new_euint128(ciphertext) -> amount_handle
2. e_sub(user_balance, amount_handle) -> new_user_balance
3. e_sub(vault_balance, amount_handle) -> new_vault_balance
4. allow() CPI to grant decrypt permission
```

### 4. apply_yield
**Purpose**: Authority adds yield to vault total (admin function)

```rust
// Accounts required:
- vault: PDA
- authority: Signer (must match vault.authority)
- inco_lightning_program: Inco Lightning

// Arguments:
- encrypted_yield: Vec<u8>

// Operations:
1. new_euint128(ciphertext) -> yield_handle
2. e_add(vault_balance, yield_handle) -> new_vault_balance
```

### 5. transfer (NEW)
**Purpose**: Transfer encrypted amount from one user to another

```rust
// Accounts required:
- sender_position: PDA [seeds: "user", sender.key()]
- recipient_position: PDA [seeds: "user", recipient.key()]
- sender: Signer
- recipient: UncheckedAccount (recipient address)
- system_program: System
- inco_lightning_program: Inco Lightning
// + remaining_accounts for allow() CPI (4 accounts)

// Arguments:
- encrypted_amount: Vec<u8>

// Operations:
1. new_euint128(ciphertext) -> amount_handle
2. e_ge(sender_balance, amount_handle) -> has_sufficient (balance check)
3. as_euint128(0) -> zero_handle
4. e_select(has_sufficient, amount_handle, zero_handle) -> validated_amount
5. e_sub(sender_balance, validated_amount) -> new_sender_balance
6. e_add(recipient_balance, validated_amount) -> new_recipient_balance
7. allow() CPI to grant decrypt permission to both parties

// Security: Uses e_ge + e_select to prevent overdrafts without revealing balances
```

---

## Instruction Discriminators (from IDL)

```typescript
const DISCRIMINATORS = {
  initialize_vault: [48, 191, 163, 44, 71, 129, 63, 164],   // 0x30bfa32c47813fa4
  deposit:          [242, 35, 198, 137, 82, 225, 242, 182], // 0xf223c68952e1f2b6
  withdraw:         [183, 18, 70, 156, 148, 109, 161, 34],  // 0xb712469c946da122
  apply_yield:      [110, 126, 160, 32, 203, 201, 34, 143], // 0x6e7ea020cbc9228f
  transfer:         [163, 52, 200, 231, 140, 3, 69, 186],   // 0xa334c8e78c0345ba
};
```

---

## PDA Derivations

```typescript
// Vault PDA
const [vaultPda] = PublicKey.findProgramAddressSync(
  [Buffer.from('vault')],
  PROGRAM_ID
);
// Result: 5SDA2ZsZ6Du2fhRw1UqgkHG4HwNwnCyeAPiMK4XDTerL

// User Position PDA
const [userPositionPda] = PublicKey.findProgramAddressSync(
  [Buffer.from('user'), userPublicKey.toBuffer()],
  PROGRAM_ID
);

// Allowance PDA (Inco Lightning)
const [allowancePda] = PublicKey.findProgramAddressSync(
  [handleBuffer, allowedAddress.toBuffer()],  // handle is 16-byte LE buffer
  INCO_LIGHTNING_ID
);
```

---

## Frontend Data Flow

### Deposit Flow
```
1. User enters amount (e.g., 0.5 SOL)
2. Convert to lamports: 500_000_000n
3. Encrypt client-side: encryptValue(500_000_000n) -> "0x7f3a2b..."
4. Build transaction with encrypted ciphertext
5. Simulate to get resulting Euint128 handles
6. Derive allowance PDAs for both handles
7. Send real transaction with remaining_accounts
8. Program performs e_add() on encrypted values
9. Refresh vault metadata to get new handle
```

### Decrypt Flow
```
1. User clicks "Decrypt & Reveal"
2. Fetch vault's encryptedBalanceHandle (decimal string)
3. Call decrypt([handle], { signMessage }) 
4. Inco network verifies wallet signature
5. Returns plaintext value
6. Display formatted SOL amount
```

---

## Key Frontend Files

### services/vault.ts
```typescript
class VaultService {
  // Connection to Solana
  private connection = new Connection(RPC_ENDPOINT, 'confirmed');
  
  // Wallet state
  private wallet?: PhantomProvider;
  private publicKey?: PublicKey;
  
  // Core methods
  async connect(): Promise<PublicKey>
  async disconnect(): Promise<void>
  async deposit(amount: number): Promise<string>      // Returns tx signature
  async withdraw(amount: number): Promise<string>     // Returns tx signature
  async fetchVaultState(): Promise<VaultMetadataSummary>
  async fetchUserPositionHandle(): Promise<string>
  async decryptBalance(handle: string): Promise<DecryptedBalance>
  
  // Internal helpers
  private async submitEncryptedOperation(...)
  private buildInstructionData(name, payload)
  private serializeVector(payload)  // Borsh Vec<u8> encoding
  private async simulateAndGetHandles(...)
}
```

### context/VaultContext.tsx
```typescript
interface VaultState {
  wallet: { address: string | null; status: WalletStatus }
  vault: { status: VaultStatus; metadata: VaultMetadataSummary | null }
  isRevealed: boolean
  activeOperation: OperationType
  logs: SystemLog[]
  systemError: string | null
}

// Actions
type VaultAction =
  | { type: 'CONNECT_WALLET'; payload: string }
  | { type: 'DISCONNECT_WALLET' }
  | { type: 'SET_VAULT_METADATA'; payload: VaultMetadataSummary }
  | { type: 'TOGGLE_REVEAL' }
  | { type: 'PUSH_LOG'; payload: SystemLog }
  // ...

// Exposed methods
const VaultContext = {
  state, dispatch,
  connectWallet, disconnectWallet,
  deposit, withdraw,
  refreshVaultMetadata,
  decryptBalance,
  fetchUserPositionHandle,
}
```

---

## Inco Lightning SDK Usage

### Rust (Backend)
```rust
use inco_lightning::cpi::accounts::{Allow, Operation};
use inco_lightning::cpi::{allow, as_euint128, e_add, e_sub, new_euint128};
use inco_lightning::types::Euint128;
use inco_lightning::ID as INCO_LIGHTNING_ID;

// Convert plaintext to encrypted handle
let handle = as_euint128(cpi_ctx, 0u128)?;

// Convert ciphertext to encrypted handle
let handle = new_euint128(cpi_ctx, ciphertext_bytes, input_type)?;

// Encrypted addition
let result = e_add(cpi_ctx, handle_a, handle_b, scalar_byte)?;

// Encrypted subtraction
let result = e_sub(cpi_ctx, handle_a, handle_b, scalar_byte)?;

// Grant decrypt permission
allow(cpi_ctx, handle.0, permanent, allowed_pubkey)?;
```

### TypeScript (Frontend)
```typescript
import { encryptValue } from '@inco/solana-sdk/encryption';
import { decrypt } from '@inco/solana-sdk/attested-decrypt';
import { hexToBuffer } from '@inco/solana-sdk/utils';

// Encrypt value client-side
const ciphertextHex = await encryptValue(1000000000n);  // 1 SOL in lamports
const ciphertextBuffer = hexToBuffer(ciphertextHex);

// Decrypt with wallet signature
const result = await decrypt([handleString], {
  address: walletPublicKey,
  signMessage: async (msg) => wallet.signMessage(msg),
});
const plaintext = result.plaintexts[0];  // bigint
```

---

## Account Data Parsing

### Vault Account Layout (57 bytes)
```
Offset  Size  Field
------  ----  -----
0       8     Discriminator (d308e82b02987577)
8       32    Authority (Pubkey)
40      16    total_encrypted_balance (Euint128, little-endian)
56      1     bump
```

### Parsing Euint128 Handle
```typescript
function parseEuint128HandleFromAccountData(data: Uint8Array): bigint {
  const handleBytes = data.slice(40, 56);  // 16 bytes
  let handle = 0n;
  for (let i = handleBytes.length - 1; i >= 0; i--) {
    handle = handle * 256n + BigInt(handleBytes[i]);
  }
  return handle;
}
```

---

## Build & Deploy Commands

### Backend (Solana Program)
```bash
# Set Solana to devnet
solana config set --url devnet

# Ensure Solana 3.x tools are in PATH
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"

# Build program
cd "private-alpha-vault-backend 2"
anchor build

# Deploy to devnet
anchor deploy --provider.cluster devnet

# Verify deployment
solana program show DmfUVqYJ5DG1iWww8YXt75zsB6RdmMws5qQMBWH4ofvC
```

### Frontend
```bash
# Install dependencies
npm install --legacy-peer-deps

# Start dev server
npm run dev
# Opens at http://localhost:3000 (or next available port)

# Build for production
npm run build
```

### Initialize Vault (One-time)
```bash
npx tsx scripts/initialize-vault.ts
```

---

## Environment Requirements

- **Node.js**: 18+
- **Rust**: 1.77+ (system), 1.84+ (Solana toolchain)
- **Solana CLI**: 3.0.x (includes cargo-build-sbf with rustc 1.84)
- **Anchor CLI**: 0.31.1 or 0.32.1
- **Phantom Wallet**: Browser extension, set to Devnet

---

## Common Issues & Solutions

### 1. "init_if_needed requires feature"
```toml
# In programs/private_alpha_vault/Cargo.toml
anchor-lang = { version = "0.31.1", features = ["init-if-needed"] }
```

### 2. "idl-build feature is missing"
```toml
# In programs/private_alpha_vault/Cargo.toml
[features]
idl-build = ["anchor-lang/idl-build"]
```

### 3. Lifetime errors with remaining_accounts
```rust
// Use explicit lifetime annotations
pub fn handler<'info>(
  ctx: Context<'_, '_, 'info, 'info, Deposit<'info>>,
  encrypted_amount: Vec<u8>
) -> Result<()>
```

### 4. "rustc X.X.X is not supported"
```bash
# Install latest Solana tools
sh -c "$(curl -sSfL https://release.anza.xyz/stable/install)"
```

### 5. Vite polyfill errors for Inco SDK
```typescript
// vite.config.ts
import { nodePolyfills } from 'vite-plugin-node-polyfills';

export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({
      include: ['buffer', 'crypto', 'stream', 'util', 'process'],
      globals: { Buffer: true, global: true, process: true },
    }),
  ],
});
```

---

## Testing Checklist

1. [ ] Connect Phantom wallet (Devnet)
2. [ ] Verify vault metadata loads (authority, handle)
3. [ ] Deposit 0.01 SOL
4. [ ] Check transaction on Solana Explorer
5. [ ] Click "Decrypt & Reveal"
6. [ ] Sign message in Phantom
7. [ ] Verify decrypted balance shows
8. [ ] Withdraw 0.005 SOL
9. [ ] Verify balance updates after decrypt

---

## Security Considerations

1. **FHE Handles**: The 128-bit handles stored on-chain are references to encrypted data, not the encrypted data itself. The actual ciphertext is stored off-chain by Inco Network.

2. **Allowance System**: Users must be explicitly granted permission to decrypt handles via the `allow()` CPI. This is done automatically during deposit/withdraw.

3. **No Balance Validation**: Current implementation doesn't validate sufficient balance before withdrawal (would require encrypted comparison). Production should add `e_ge()` checks.

4. **Authority Control**: Only the vault authority can call `apply_yield`. Ensure authority key is secured.

---

## Recently Added Features (Jan 29, 2026)

1. ✅ **Yield Distribution UI**: Vault authority can now distribute encrypted yield via admin panel
2. ✅ **Private Transfers**: Users can transfer encrypted amounts to other users with `e_ge()` balance validation
3. ✅ **Balance Validation**: Transfer uses `e_ge()` + `e_select()` to prevent overdrafts

## Future Enhancements

1. **Multiple Assets**: Support SPL tokens, not just native SOL
2. **Yield Strategies**: Integrate with DeFi protocols for actual yield generation
3. **Mainnet Deployment**: Security audit and deploy to mainnet
4. **Mobile Support**: Add mobile wallet adapters
5. **Transaction History**: Track encrypted transaction history per user

---

## References

- [Inco Network Docs](https://docs.inco.org)
- [Inco Lightning Rust Crate](https://docs.inco.org/svm/rust-sdk/overview)
- [Inco Solana SDK (JS)](https://docs.inco.org/svm/js-sdk/overview)
- [Anchor Framework](https://www.anchor-lang.com)
- [Solana Cookbook](https://solanacookbook.com)

---

*Last Updated: January 29, 2026*
*Program Version: 0.1.0*
*Network: Solana Devnet*
