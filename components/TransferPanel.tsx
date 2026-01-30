import React, { useState } from 'react';
import { useVault } from '../context/VaultContext';
import { motion, AnimatePresence } from 'framer-motion';
import { PublicKey } from '@solana/web3.js';

const TransferPanel: React.FC = () => {
  const { state, transfer, refreshVaultMetadata } = useVault();
  const isConnected = state.wallet.status === 'connected';
  
  const [recipientAddress, setRecipientAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txSignature, setTxSignature] = useState<string | null>(null);

  const validateAddress = (addr: string): boolean => {
    try {
      new PublicKey(addr);
      return true;
    } catch {
      return false;
    }
  };

  const handleTransfer = async () => {
    setError(null);
    setTxSignature(null);

    // Validate recipient address
    if (!recipientAddress.trim()) {
      setError('Enter recipient address');
      return;
    }

    if (!validateAddress(recipientAddress)) {
      setError('Invalid Solana address');
      return;
    }

    // Validate amount
    const parsedAmount = Number(amount);
    if (!parsedAmount || parsedAmount <= 0) {
      setError('Enter a positive amount');
      return;
    }

    // Prevent self-transfer
    if (recipientAddress === state.wallet.address) {
      setError('Cannot transfer to yourself');
      return;
    }

    setIsProcessing(true);
    try {
      const signature = await transfer(parsedAmount, recipientAddress);
      setTxSignature(signature);
      setRecipientAddress('');
      setAmount('');
      await refreshVaultMetadata();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Transfer failed');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="border border-[#1a1a1a] bg-[#080808] rounded-lg overflow-hidden mb-8"
    >
      {/* Header */}
      <div className="px-6 py-4 border-b border-[#1a1a1a]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-purple-900/20 flex items-center justify-center">
            <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Private Transfer</h3>
            <p className="text-[11px] text-[#666]">Send encrypted amount to another user</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {!isConnected ? (
          <div className="text-center py-8">
            <svg className="w-12 h-12 text-[#333] mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <p className="text-[#555] text-sm">Connect wallet to transfer</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Success Message */}
            <AnimatePresence mode="wait">
              {txSignature && (
                <motion.div 
                  key="success"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="p-3 bg-emerald-900/10 border border-emerald-900/20 rounded-lg"
                >
                  <div className="flex items-start gap-2">
                    <svg className="w-4 h-4 text-emerald-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <div>
                      <span className="text-[11px] text-emerald-400 font-semibold">Transfer Completed</span>
                      <p className="text-[10px] text-[#888] mt-1 mono break-all">{txSignature.slice(0, 20)}...</p>
                      <a 
                        href={`https://explorer.solana.com/tx/${txSignature}?cluster=devnet`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] text-blue-400 hover:underline inline-block mt-1"
                      >
                        View on Explorer →
                      </a>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Error Message */}
            <AnimatePresence mode="wait">
              {error && (
                <motion.div 
                  key="error"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="p-3 bg-red-900/10 border border-red-900/20 rounded-lg"
                >
                  <div className="flex items-start gap-2">
                    <svg className="w-4 h-4 text-red-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-[11px] text-red-400">{error}</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Recipient Address Input */}
            <div>
              <label className="text-[11px] text-[#555] uppercase tracking-wider block mb-2">
                Recipient Address
              </label>
              <input 
                type="text" 
                placeholder="Enter Solana address"
                value={recipientAddress}
                onChange={(e) => setRecipientAddress(e.target.value)}
                className="w-full p-3 bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg text-white text-[13px] mono focus:outline-none focus:border-[#333] transition-colors"
              />
              {recipientAddress && !validateAddress(recipientAddress) && (
                <p className="text-[10px] text-red-400 mt-1">Invalid address format</p>
              )}
            </div>

            {/* Amount Input */}
            <div>
              <label className="text-[11px] text-[#555] uppercase tracking-wider block mb-2">
                Amount to Transfer
              </label>
              <div className="relative">
                <input 
                  type="text" 
                  inputMode="decimal"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full p-3 pr-16 bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg text-white text-lg font-medium focus:outline-none focus:border-[#333] transition-colors"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-[#555] font-medium">SOL</span>
              </div>
              <p className="text-[10px] text-[#444] mt-2">
                Amount will be encrypted - only you and recipient can see it
              </p>
            </div>

            {/* Submit Button */}
            <button 
              onClick={handleTransfer}
              disabled={isProcessing || !recipientAddress || !amount}
              className={`w-full py-4 rounded-lg text-[12px] font-semibold uppercase tracking-wider transition-all flex items-center justify-center gap-2
                ${isProcessing || !recipientAddress || !amount
                  ? 'bg-[#1a1a1a] text-[#555] cursor-not-allowed' 
                  : 'bg-purple-600 text-white hover:bg-purple-500'
                }
              `}
            >
              {isProcessing ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 9l3 3m0 0l-3 3m3-3H8m13 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Send Transfer</span>
                </>
              )}
            </button>

            {/* Info Box */}
            <div className="flex items-start gap-2 p-3 bg-purple-900/5 rounded border border-purple-900/20">
              <svg className="w-4 h-4 text-purple-400/70 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="text-[11px] text-[#666] leading-relaxed">
                <p className="font-medium text-[#888] mb-1">Fully Private Transfer</p>
                <p>The transfer amount is encrypted. Only you and the recipient can decrypt your respective balances.</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default TransferPanel;
