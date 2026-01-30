import React, { useState } from 'react';
import { useVault } from '../context/VaultContext';
import { motion, AnimatePresence } from 'framer-motion';

const AdminPanel: React.FC = () => {
  const { state, applyYield, refreshVaultMetadata } = useVault();
  const vaultMetadata = state.vault.totals.metadata;
  const isAuthority = vaultMetadata && state.wallet.address === vaultMetadata.authority;
  
  const [yieldAmount, setYieldAmount] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txSignature, setTxSignature] = useState<string | null>(null);

  if (!isAuthority) {
    return null; // Only show to vault authority
  }

  const handleApplyYield = async () => {
    setError(null);
    setTxSignature(null);
    
    const amount = Number(yieldAmount);
    if (!amount || amount <= 0) {
      setError('Enter a positive yield amount');
      return;
    }

    setIsProcessing(true);
    try {
      const signature = await applyYield(amount);
      setTxSignature(signature);
      setYieldAmount('');
      await refreshVaultMetadata();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Yield distribution failed');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="border border-amber-900/30 bg-amber-900/5 rounded-lg overflow-hidden mb-8"
    >
      {/* Header */}
      <div className="px-6 py-4 border-b border-amber-900/30 bg-amber-900/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center">
              <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-amber-400">Admin Panel</h3>
              <p className="text-[11px] text-amber-400/70">You are the vault authority</p>
            </div>
          </div>
          <span className="text-[10px] text-amber-400/50 uppercase tracking-wider">Authority Only</span>
        </div>
      </div>

      {/* Content */}
      <div className="p-6 space-y-4">
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
                  <span className="text-[11px] text-emerald-400 font-semibold">Yield Applied Successfully</span>
                  <p className="text-[10px] text-[#888] mt-1 mono">{txSignature.slice(0, 16)}...</p>
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

        {/* Yield Distribution Form */}
        <div>
          <label className="text-[11px] text-amber-400/80 uppercase tracking-wider block mb-2">
            Yield Amount
          </label>
          <div className="relative">
            <input 
              type="text" 
              inputMode="decimal"
              placeholder="0.00"
              value={yieldAmount}
              onChange={(e) => setYieldAmount(e.target.value)}
              className="w-full p-3 pr-16 bg-[#0a0a0a] border border-amber-900/30 rounded-lg text-white text-lg font-medium focus:outline-none focus:border-amber-500/50 transition-colors"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-[#555] font-medium">SOL</span>
          </div>
          <p className="text-[10px] text-amber-400/60 mt-2">
            This amount will be added to the vault's total encrypted balance
          </p>
        </div>

        {/* Submit Button */}
        <button 
          onClick={handleApplyYield}
          disabled={isProcessing}
          className={`w-full py-4 rounded-lg text-[12px] font-semibold uppercase tracking-wider transition-all flex items-center justify-center gap-2
            ${isProcessing 
              ? 'bg-[#1a1a1a] text-[#555] cursor-wait' 
              : 'bg-amber-600 text-white hover:bg-amber-500'
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
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Distribute Yield</span>
            </>
          )}
        </button>

        {/* Info */}
        <div className="flex items-start gap-2 p-3 bg-amber-900/5 rounded border border-amber-900/20">
          <svg className="w-4 h-4 text-amber-400/70 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-[11px] text-amber-400/70 leading-relaxed">
            As vault authority, you can add encrypted yield to the vault. The amount is encrypted and added to the total vault balance.
          </p>
        </div>
      </div>
    </motion.div>
  );
};

export default AdminPanel;
