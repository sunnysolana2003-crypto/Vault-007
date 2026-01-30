/**
 * Detects available Solana wallet extensions
 */

export interface WalletProvider {
  name: string;
  icon: string;
  adapter: any;
  isInstalled: boolean;
}

export function detectAvailableWallets(): WalletProvider[] {
  const wallets: WalletProvider[] = [];

  // Phantom Wallet
  if ('phantom' in window) {
    const phantom = (window as any).phantom?.solana;
    if (phantom?.isPhantom) {
      wallets.push({
        name: 'Phantom',
        icon: 'https://phantom.app/img/phantom-logo.svg',
        adapter: phantom,
        isInstalled: true,
      });
    }
  }

  // Solflare Wallet
  if ('solflare' in window) {
    const solflare = (window as any).solflare;
    if (solflare?.isSolflare) {
      wallets.push({
        name: 'Solflare',
        icon: 'https://solflare.com/favicon.ico',
        adapter: solflare,
        isInstalled: true,
      });
    }
  }

  // Trust Wallet
  if ('trustwallet' in window) {
    const trust = (window as any).trustwallet?.solana;
    if (trust) {
      wallets.push({
        name: 'Trust Wallet',
        icon: 'https://trustwallet.com/assets/images/favicon.png',
        adapter: trust,
        isInstalled: true,
      });
    }
  }

  // Backpack Wallet
  if ('backpack' in window) {
    const backpack = (window as any).backpack;
    if (backpack) {
      wallets.push({
        name: 'Backpack',
        icon: 'https://backpack.app/favicon.ico',
        adapter: backpack,
        isInstalled: true,
      });
    }
  }

  // Solana standard wallet (fallback)
  if ('solana' in window && wallets.length === 0) {
    const solana = (window as any).solana;
    wallets.push({
      name: 'Solana Wallet',
      icon: '',
      adapter: solana,
      isInstalled: true,
    });
  }

  return wallets;
}

export function getWalletByName(name: string): WalletProvider | null {
  const wallets = detectAvailableWallets();
  return wallets.find(w => w.name === name) || null;
}

export function hasAnyWallet(): boolean {
  return detectAvailableWallets().length > 0;
}
