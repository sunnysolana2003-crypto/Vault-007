# Multi-Wallet Support Guide

## ✅ Supported Wallets

Your Private Alpha Vault now supports **multiple Solana wallets**:

1. **Phantom** 👻 - Most popular Solana wallet
2. **Solflare** 🌟 - Advanced Solana wallet
3. **Trust Wallet** 🛡️ - Multi-chain wallet with Solana support
4. **Backpack** 🎒 - xNFT-enabled Solana wallet

---

## 🚀 How to Use

### Step 1: Install a Wallet

Install any of the supported wallets on your browser:

- **Phantom**: https://phantom.app/download
- **Solflare**: https://solflare.com/download
- **Trust Wallet**: https://trustwallet.com/download (browser extension)
- **Backpack**: https://backpack.app

### Step 2: Switch to Devnet

All supported wallets need to be on **Solana Devnet**:

#### Phantom:
1. Click wallet icon → Settings
2. Click "Change Network"
3. Select "Devnet"

#### Solflare:
1. Click Settings (gear icon)
2. Click "Network"
3. Select "Devnet"

#### Trust Wallet:
1. Go to Settings
2. Select Networks
3. Choose "Solana Devnet"

#### Backpack:
1. Click Settings
2. Select "Preferences"
3. Choose "Devnet" network

### Step 3: Get Devnet SOL

Request free devnet SOL from the faucet:

```bash
# Method 1: Command line
solana airdrop 2 <YOUR_WALLET_ADDRESS> --url devnet

# Method 2: Web faucet
# Visit: https://faucet.solana.com
# Paste your wallet address
# Click "Airdrop 2 SOL"
```

Or use the wallet's built-in faucet feature (some wallets have this).

### Step 4: Connect to the App

1. Open the app: `http://localhost:3003`
2. Click "Connect Wallet" button
3. A wallet selection modal will appear
4. Choose your preferred wallet from the list
5. Approve the connection in your wallet

---

## 🎨 What's New

### Wallet Selection Modal

When you click "Connect Wallet", you'll see:

```
┌────────────────────────────────────────┐
│  Connect Wallet                    [✕]│
│  Choose your preferred wallet          │
├────────────────────────────────────────┤
│  DETECTED (2)                          │
│                                        │
│  [👻] Phantom                     →   │
│      Ready to connect                  │
│                                        │
│  [🌟] Solflare                    →   │
│      Ready to connect                  │
└────────────────────────────────────────┘
```

### Features

- **Auto-Detection**: Automatically detects installed wallets
- **Install Links**: Shows install links for wallets not detected
- **Devnet Reminder**: Warns users to switch to Devnet
- **Multi-Wallet**: Switch between wallets anytime
- **Beautiful UI**: Animated modal with Framer Motion

---

## 💰 Testing Transfers Between Wallets

Now you can test **private transfers** between different wallets:

### Example Flow:

```bash
# Wallet A (Phantom):
1. Connect with Phantom
2. Deposit 1.0 SOL into vault
3. Click "Transfer" tab
4. Enter Wallet B's address
5. Transfer 0.3 SOL
6. Decrypt balance: See ~0.7 SOL

# Wallet B (Solflare):
1. Disconnect Phantom
2. Connect with Solflare
3. Open the app (same browser or different)
4. Click "Decrypt & Reveal"
5. See 0.3 SOL received (encrypted on-chain)

# Verify on Explorer:
- Transaction shows encrypted data blobs
- No plaintext amounts visible
- Full privacy maintained!
```

---

## 🔧 Technical Implementation

### Wallet Detection

The app automatically detects wallets using the `wallet-detector` service:

```typescript
// Detects all installed wallets
const wallets = detectAvailableWallets();
// Returns: [{ name: 'Phantom', adapter: {...}, isInstalled: true }, ...]
```

### Dynamic Connection

The `VaultService` now supports any wallet provider:

```typescript
// Old: Only Phantom
await vaultService.connect();

// New: Any wallet
await vaultService.connectWithProvider(walletAdapter);
```

### Provider Compatibility

Each wallet implements the same interface:

```typescript
interface WalletAdapter {
  connect(): Promise<{ publicKey: PublicKey }>;
  disconnect(): Promise<void>;
  signTransaction(tx: Transaction): Promise<Transaction>;
  signMessage(message: Uint8Array): Promise<{ signature: Uint8Array }>;
}
```

---

## 🐛 Troubleshooting

### "No wallet detected"

**Solution**: Install at least one wallet extension and refresh the page.

### "Connection failed"

**Solutions**:
1. Make sure wallet is unlocked
2. Check if wallet is on Devnet (not Mainnet)
3. Try refreshing the page
4. Check browser console for errors

### "Transaction failed"

**Solutions**:
1. Ensure you have devnet SOL
2. Verify you're on the correct network
3. Check if wallet has sufficient SOL for fees
4. Try reconnecting your wallet

### Wallet not showing in list

**Solutions**:
1. Make sure extension is installed and enabled
2. Refresh the browser page
3. Check if wallet is compatible with your browser
4. Look in browser console for errors

---

## 📊 Wallet Comparison

| Wallet | Speed | Security | Features | Best For |
|--------|-------|----------|----------|----------|
| **Phantom** | ⚡⚡⚡ | 🔒🔒🔒 | Mobile + Browser | Beginners |
| **Solflare** | ⚡⚡ | 🔒🔒🔒 | Hardware wallet | Power users |
| **Trust** | ⚡⚡⚡ | 🔒🔒 | Multi-chain | Cross-chain |
| **Backpack** | ⚡⚡⚡ | 🔒🔒🔒 | xNFT support | Web3 apps |

---

## 🎯 Next Steps

### Test Scenarios

1. **Single Wallet Flow**:
   - Connect → Deposit → Withdraw → Transfer → Decrypt

2. **Multi-Wallet Flow**:
   - Connect with Wallet A → Deposit
   - Transfer to Wallet B
   - Disconnect → Connect with Wallet B
   - Decrypt and see received funds

3. **Yield Distribution**:
   - Connect as authority
   - Distribute yield
   - Verify balance increases for all users

### Advanced Features

- [ ] Transaction signing with hardware wallets (Ledger via Solflare)
- [ ] Multi-signature support
- [ ] Wallet switch without disconnect
- [ ] Remember last connected wallet

---

## 📱 Browser Compatibility

| Browser | Support | Notes |
|---------|---------|-------|
| Chrome | ✅ Full | Best experience |
| Brave | ✅ Full | Built-in Solana wallet support |
| Firefox | ✅ Full | All wallets work |
| Edge | ✅ Full | Chromium-based |
| Safari | ⚠️ Limited | Some wallets unavailable |

---

## 🔐 Security Notes

1. **Never share your seed phrase** - The app never asks for it
2. **Always verify addresses** - Double-check before sending
3. **Use Devnet only** - This is a testnet app
4. **Transaction approval** - Always review before signing
5. **Hardware wallets** - Consider using for large amounts (mainnet)

---

## 📚 Resources

- [Phantom Docs](https://docs.phantom.app/)
- [Solflare Guide](https://docs.solflare.com/)
- [Trust Wallet Solana](https://trustwallet.com/solana-wallet)
- [Backpack xNFTs](https://docs.backpack.app/)
- [Solana Devnet Faucet](https://faucet.solana.com/)

---

## ✨ Features Summary

✅ **Multi-wallet support** - Connect with any Solana wallet  
✅ **Auto-detection** - Automatically finds installed wallets  
✅ **Beautiful modal** - Sleek wallet selection UI  
✅ **Devnet ready** - All wallets work on Solana Devnet  
✅ **Private transfers** - Send encrypted SOL between any wallets  
✅ **Universal signing** - Works with all wallet message signing  
✅ **Seamless UX** - No configuration needed  

---

*Generated: January 29, 2026*  
*App Version: 0.2.0*  
*Multi-Wallet Integration: v1.0*
