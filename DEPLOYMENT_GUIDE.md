# Deployment Guide - Yield & Transfer Features

## Implementation Status: ✅ COMPLETE (Pending Program Upgrade)

All code for yield distribution and private transfers has been implemented. The program needs to be upgraded on devnet to activate the transfer feature.

---

## What's Ready NOW

### ✅ Yield Distribution (LIVE on Devnet)
The `apply_yield` instruction was already deployed, so yield distribution works immediately!

**How to test:**
1. Open `http://localhost:3003`
2. Connect with wallet `9SgoCZ...dkbS` (the vault authority)
3. You'll see a yellow "Admin Panel" section
4. Enter yield amount (e.g., 0.1 SOL)
5. Click "Distribute Yield"
6. All user balances will increase by the encrypted amount

### ⏳ Private Transfers (Needs Program Upgrade)
Transfer instruction is coded but needs ~1.2 more SOL to upgrade the program on devnet.

---

## To Complete Deployment

### Step 1: Get More Devnet SOL

Current balance: **1.05 SOL**  
Needed: **2.17 SOL** (upgrade cost)  
Additional needed: **~1.2 SOL**

**Option A: Wait for faucet rate limit (recommended)**
```bash
# Wait 5-10 minutes, then:
solana airdrop 1.5
```

**Option B: Use web faucet**
Visit https://faucet.solana.com and request SOL for address:
```
9SgoCZCCjqMHTKi5MCyTCze2oonAX4gMXLeUssF7dkbS
```

**Option C: Use another wallet**
```bash
# Generate new keypair with more SOL
solana-keygen new -o new-keypair.json
solana airdrop 2 new-keypair.json
# Then use this for upgrades
```

### Step 2: Upgrade Program

Once you have enough SOL:
```bash
cd "private-alpha-vault-backend 2"
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"

# Upgrade with new transfer instruction
anchor upgrade target/deploy/private_alpha_vault.so \
  --program-id DmfUVqYJ5DG1iWww8YXt75zsB6RdmMws5qQMBWH4ofvC \
  --provider.cluster devnet
```

### Step 3: Test Transfer Feature

After upgrade:
1. Open `http://localhost:3003`
2. Connect wallet and deposit some SOL
3. Switch to "Transfer" tab in the action panel
4. Enter recipient address and amount
5. Click "Send Transfer"
6. Both sender and recipient can decrypt their new balances

---

## What's Been Implemented

### Backend Changes ✅
1. **New instruction**: `programs/private_alpha_vault/src/instructions/transfer.rs`
   - Uses `e_ge()` to check sender has sufficient balance
   - Uses `e_select()` to prevent overdrafts (transfers 0 if insufficient)
   - Performs encrypted subtraction from sender
   - Performs encrypted addition to recipient
   - Grants decrypt permission to both parties

2. **Updated files**:
   - `src/instructions/mod.rs` - Added transfer module
   - `src/lib.rs` - Added transfer function to program

3. **Build status**: ✅ Compiled successfully (277KB .so file)

### Frontend Changes ✅
1. **New components**:
   - `components/AdminPanel.tsx` - Yield distribution UI for authority
   - `components/TransferPanel.tsx` - Standalone transfer UI

2. **Updated services**:
   - `services/vault.ts` - Added `applyYield()` and `transfer()` methods
   - `services/vault.ts` - Added `simulateTransferAndGetHandles()` helper
   - `services/vault.ts` - Added transfer discriminator

3. **Updated context**:
   - `context/VaultContext.tsx` - Exposed `applyYield` and `transfer` methods

4. **Updated components**:
   - `components/VaultTerminal.tsx` - Integrated AdminPanel and TransferPanel
   - `components/ActionSuite.tsx` - Added transfer tab with recipient input

---

## New UI Features

### Admin Panel (Vault Authority Only)
```
┌────────────────────────────────────────────┐
│  🛡️  Admin Panel                           │
│     You are the vault authority            │
├────────────────────────────────────────────┤
│                                            │
│  Yield Amount                              │
│  ┌──────────────────────────────────────┐ │
│  │ 0.5                             SOL  │ │
│  └──────────────────────────────────────┘ │
│                                            │
│  [💰 Distribute Yield]                     │
│                                            │
│  ℹ️ This amount will be added to the       │
│     vault's total encrypted balance        │
└────────────────────────────────────────────┘
```

### Transfer Tab (All Users)
```
┌────────────────────────────────────────────┐
│  DEPOSIT | WITHDRAW | TRANSFER             │
├────────────────────────────────────────────┤
│                                            │
│  Asset: 🔵 SOL                             │
│                                            │
│  Recipient Address                         │
│  ┌──────────────────────────────────────┐ │
│  │ 7xK9Aq...3mPq                        │ │
│  └──────────────────────────────────────┘ │
│                                            │
│  Amount to Send                            │
│  ┌──────────────────────────────────────┐ │
│  │ 0.3                             SOL  │ │
│  └──────────────────────────────────────┘ │
│                                            │
│  [🔄 Send Transfer]                        │
│                                            │
│  ℹ️ Transfer amount is encrypted -         │
│     only you and recipient can see it      │
└────────────────────────────────────────────┘
```

---

## Technical Details

### Transfer Instruction Flow
```
1. Client encrypts amount: encryptValue(300000000n) // 0.3 SOL
2. Build instruction with sender/recipient PDAs
3. Simulate transaction to get resulting handles
4. Derive allowance PDAs for both parties
5. Send real transaction with remaining_accounts
6. Program executes:
   a. Convert ciphertext to handle
   b. Check balance: e_ge(sender_balance, amount)
   c. Conditional: e_select(has_sufficient, amount, zero)
   d. Subtract from sender: e_sub(sender, validated_amount)
   e. Add to recipient: e_add(recipient, validated_amount)
   f. Grant decrypt access to both via allow()
```

### Security Features
- **Overdraft Prevention**: Uses FHE comparison to check balance without decryption
- **Conditional Logic**: `e_select` ensures insufficient transfers become zero transfers
- **Privacy**: Neither total balances nor transfer amounts are visible on-chain
- **Access Control**: Both parties get decrypt permission for their new balances

---

## Testing Instructions

### Test Yield (Available Now)
```bash
# 1. Open app
open http://localhost:3003

# 2. Connect as authority wallet
# Address: 9SgoCZCCjqMHTKi5MCyTCze2oonAX4gMXLeUssF7dkbS

# 3. Navigate to admin panel (yellow section)
# 4. Enter yield: 0.5 SOL
# 5. Click "Distribute Yield"
# 6. Check transaction on explorer
# 7. Users can decrypt to see increased balance
```

### Test Transfer (After Upgrade)
```bash
# 1. User A deposits 1 SOL
# 2. User A switches to "Transfer" tab
# 3. Enters User B's address
# 4. Enters amount: 0.3 SOL
# 5. Clicks "Send Transfer"
# 6. User A decrypts: sees 0.7 SOL remaining
# 7. User B decrypts: sees 0.3 SOL received
# 8. Check explorer: amounts are encrypted blobs
```

---

## Troubleshooting

### "Insufficient funds for spend"
**Problem**: Need 2.17 SOL to upgrade program  
**Solution**: Request more devnet SOL from faucet (wait for rate limit reset)

### "Instruction not found" (transfer)
**Problem**: Program hasn't been upgraded yet  
**Solution**: Complete Step 2 above to upgrade program

### "Unauthorized" (yield)
**Problem**: Only vault authority can distribute yield  
**Solution**: Connect with wallet `9SgoCZCCjqMHTKi5MCyTCze2oonAX4gMXLeUssF7dkbS`

---

## File Manifest

### New Files
- `components/AdminPanel.tsx` - Yield distribution UI
- `components/TransferPanel.tsx` - Private transfer UI
- `instructions/transfer.rs` - Transfer instruction implementation
- `DEPLOYMENT_GUIDE.md` - This file

### Modified Files
- `services/vault.ts` - Added `applyYield()` and `transfer()` methods
- `context/VaultContext.tsx` - Exposed new methods in context
- `components/VaultTerminal.tsx` - Integrated new panels
- `components/ActionSuite.tsx` - Added transfer tab
- `instructions/mod.rs` - Added transfer module
- `lib.rs` - Added transfer function
- `LLM_CONTEXT.md` - Documented new features

### Build Artifacts
- `target/deploy/private_alpha_vault.so` - Updated program (277KB)
- `target/idl/private_alpha_vault.json` - Updated IDL with transfer

---

*Generated: January 29, 2026*  
*Program Version: 0.2.0 (pending upgrade)*
