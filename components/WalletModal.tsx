import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { detectAvailableWallets, type WalletProvider } from '../services/wallet-detector';

interface WalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectWallet: (wallet: WalletProvider) => void;
}

const WalletModal: React.FC<WalletModalProps> = ({ isOpen, onClose, onSelectWallet }) => {
  const availableWallets = detectAvailableWallets();

  const installLinks: Record<string, string> = {
    'Phantom': 'https://phantom.app/download',
    'Solflare': 'https://solflare.com/download',
    'Trust Wallet': 'https://trustwallet.com/download',
    'Backpack': 'https://backpack.app',
  };

  // Popular wallets to show even if not installed
  const popularWallets = [
    { name: 'Phantom', icon: 'https://phantom.app/img/phantom-logo.svg' },
    { name: 'Solflare', icon: 'https://solflare.com/favicon.ico' },
    { name: 'Trust Wallet', icon: 'https://trustwallet.com/assets/images/favicon.png' },
    { name: 'Backpack', icon: 'https://backpack.app/favicon.ico' },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/80 z-50"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md"
          >
            <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-2xl overflow-hidden">
              {/* Header */}
              <div className="px-6 py-5 border-b border-[#1a1a1a] flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-white">Connect Wallet</h2>
                  <p className="text-[11px] text-[#666] mt-1">Choose your preferred wallet</p>
                </div>
                <button
                  onClick={onClose}
                  className="w-8 h-8 rounded-lg bg-[#141414] hover:bg-[#1a1a1a] flex items-center justify-center transition-colors"
                >
                  <svg className="w-4 h-4 text-[#888]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Wallet List */}
              <div className="p-4 space-y-2 max-h-[400px] overflow-y-auto">
                {availableWallets.length > 0 ? (
                  <>
                    <p className="text-[10px] uppercase tracking-wider text-[#555] px-2 mb-3">
                      Detected ({availableWallets.length})
                    </p>
                    {availableWallets.map((wallet) => (
                      <button
                        key={wallet.name}
                        onClick={() => {
                          onSelectWallet(wallet);
                          onClose();
                        }}
                        className="w-full p-4 rounded-xl bg-[#0f0f0f] border border-[#1a1a1a] hover:border-[#333] hover:bg-[#141414] transition-all flex items-center gap-4 group"
                      >
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500/20 to-blue-500/20 flex items-center justify-center">
                          {wallet.icon ? (
                            <img src={wallet.icon} alt={wallet.name} className="w-6 h-6" />
                          ) : (
                            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                            </svg>
                          )}
                        </div>
                        <div className="flex-1 text-left">
                          <div className="text-sm font-semibold text-white group-hover:text-blue-400 transition-colors">
                            {wallet.name}
                          </div>
                          <div className="text-[11px] text-[#666] mt-0.5">Ready to connect</div>
                        </div>
                        <svg className="w-5 h-5 text-[#333] group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    ))}
                  </>
                ) : (
                  <div className="text-center py-8">
                    <svg className="w-12 h-12 text-[#333] mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    <p className="text-sm text-[#666] mb-4">No wallet detected</p>
                    <p className="text-[11px] text-[#555] px-6">
                      Install a Solana wallet extension to continue
                    </p>
                  </div>
                )}

                {/* Install Options */}
                {availableWallets.length === 0 && (
                  <>
                    <p className="text-[10px] uppercase tracking-wider text-[#555] px-2 mt-6 mb-3">
                      Popular Wallets
                    </p>
                    {popularWallets.map((wallet) => (
                      <a
                        key={wallet.name}
                        href={installLinks[wallet.name]}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full p-4 rounded-xl bg-[#0f0f0f] border border-[#1a1a1a] hover:border-[#333] hover:bg-[#141414] transition-all flex items-center gap-4 group"
                      >
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-gray-500/20 to-gray-600/20 flex items-center justify-center">
                          <img src={wallet.icon} alt={wallet.name} className="w-6 h-6 opacity-50 group-hover:opacity-100 transition-opacity" />
                        </div>
                        <div className="flex-1 text-left">
                          <div className="text-sm font-semibold text-[#888] group-hover:text-white transition-colors">
                            {wallet.name}
                          </div>
                          <div className="text-[11px] text-[#555]">Not installed</div>
                        </div>
                        <div className="text-[10px] uppercase tracking-wider text-blue-400 font-semibold">
                          Install
                        </div>
                      </a>
                    ))}
                  </>
                )}
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-[#1a1a1a] bg-[#0f0f0f]">
                <div className="flex items-start gap-2">
                  <svg className="w-4 h-4 text-blue-400/70 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-[10px] text-[#666] leading-relaxed">
                    Make sure you're on <span className="text-blue-400">Solana Devnet</span> to use this app. Switch networks in your wallet settings.
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default WalletModal;
