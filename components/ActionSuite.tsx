import React, { useState } from 'react';
import { useVault } from '../context/VaultContext';
import { motion, AnimatePresence } from 'framer-motion';

const ActionSuite: React.FC = () => {
  const { state, deposit, withdraw, transfer, connectWallet, refreshVaultMetadata } = useVault();
  const isConnected = state.wallet.status === 'connected';
  const [tab, setTab] = useState<'deposit' | 'withdraw' | 'transfer'>('deposit');
  const [localError, setLocalError] = useState<{ code: string; msg: string } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [amountInput, setAmountInput] = useState('');
  const [recipientInput, setRecipientInput] = useState('');
  const [txSignature, setTxSignature] = useState<string | null>(null);

  const executeAction = async () => {
    setLocalError(null);
    setTxSignature(null);
    const parsedAmount = Number(amountInput);
    if (!parsedAmount || parsedAmount <= 0) {
      setLocalError({ code: 'INVALID_INPUT', msg: 'Enter a positive amount in SOL' });
      return;
    }

    if (tab === 'transfer' && !recipientInput.trim()) {
      setLocalError({ code: 'INVALID_RECIPIENT', msg: 'Enter recipient address' });
      return;
    }

    setIsProcessing(true);
    try {
      let signature: string;
      if (tab === 'deposit') {
        signature = await deposit(parsedAmount);
      } else if (tab === 'withdraw') {
        signature = await withdraw(parsedAmount);
      } else {
        signature = await transfer(parsedAmount, recipientInput);
      }
      setTxSignature(signature);
      setAmountInput('');
      setRecipientInput('');
      await refreshVaultMetadata();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Transaction failed';
      setLocalError({ code: 'TX_FAILED', msg: message });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="p-6 md:p-8 relative overflow-hidden bg-[#030303]">
      {/* Overlay when not connected */}
      {!isConnected && (
        <div className="absolute inset-0 z-20 backdrop-blur-sm bg-black/70 flex flex-col items-center justify-center p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-[#1a1a1a] flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-[#444]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h3 className="text-white font-semibold mb-2">Connect Wallet</h3>
          <p className="text-[12px] text-[#666] mb-6 max-w-[200px]">
            Connect your Phantom wallet to deposit or withdraw from the confidential vault
          </p>
          <button 
            onClick={() => {
              setLocalError(null);
              void connectWallet();
            }}
            className="w-full max-w-[200px] py-3 bg-white text-black text-[11px] font-semibold uppercase tracking-wider rounded hover:bg-neutral-200 transition-colors"
          >
            Connect Phantom
          </button>
        </div>
      )}

      <div className={`transition-all duration-300 ${!isConnected ? 'opacity-20 pointer-events-none blur-[2px]' : 'opacity-100'}`}>
        {/* Header */}
        <div className="flex items-center gap-2 mb-6">
          <svg className="w-5 h-5 text-[#666]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="text-white font-semibold">Vault Operations</h3>
        </div>
        
        {/* Tab Switcher */}
        <div className="flex bg-[#0a0a0a] rounded-lg p-1 mb-6">
          {(['deposit', 'withdraw', 'transfer'] as const).map((t) => (
            <button 
              key={t}
              onClick={() => { setTab(t); setLocalError(null); setTxSignature(null); }}
              className={`flex-1 py-2.5 text-[10px] font-medium uppercase tracking-wider rounded transition-all
                ${tab === t 
                  ? 'bg-white text-black' 
                  : 'text-[#666] hover:text-white'
                }
              `}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Error Display */}
        <AnimatePresence mode="wait">
          {localError && (
            <motion.div 
              key="error"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-4 p-3 bg-red-900/10 border border-red-900/20 rounded-lg"
            >
              <div className="flex items-start gap-2">
                <svg className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <span className="text-[10px] text-red-400 font-semibold">{localError.code}</span>
                  <p className="text-[11px] text-[#888] mt-1">{localError.msg}</p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Success Display */}
        <AnimatePresence mode="wait">
          {txSignature && (
            <motion.div 
              key="success"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-4 p-3 bg-emerald-900/10 border border-emerald-900/20 rounded-lg"
            >
              <div className="flex items-start gap-2">
                <svg className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <div>
                  <span className="text-[10px] text-emerald-400 font-semibold">Transaction Confirmed</span>
                  <p className="text-[11px] text-[#888] mt-1 mono break-all">{txSignature.slice(0, 20)}...</p>
                  <a 
                    href={`https://explorer.solana.com/tx/${txSignature}?cluster=devnet`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] text-blue-400 hover:underline mt-1 inline-block"
                  >
                    View on Explorer →
                  </a>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Form */}
        <div className="space-y-4">
          {/* Asset Selection */}
          <div>
            <label className="text-[10px] text-[#555] uppercase tracking-wider block mb-2">Asset</label>
            <div className="w-full p-3 bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg text-white text-[12px] flex items-center gap-3">
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                <span className="text-[10px] font-bold">S</span>
              </div>
              <span className="font-medium">SOL</span>
              <span className="text-[#555] text-[10px] ml-auto">Solana Native</span>
            </div>
          </div>

          {/* Recipient Address Input (Transfer only) */}
          {tab === 'transfer' && (
            <div>
              <label className="text-[10px] text-[#555] uppercase tracking-wider block mb-2">
                Recipient Address
              </label>
              <input 
                type="text" 
                placeholder="Enter Solana address"
                value={recipientInput}
                onChange={(e) => setRecipientInput(e.target.value)}
                className="w-full p-3 bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg text-white text-[12px] mono focus:outline-none focus:border-[#333] transition-colors"
              />
            </div>
          )}

          {/* Amount Input */}
          <div>
            <label className="text-[10px] text-[#555] uppercase tracking-wider block mb-2">
              {tab === 'transfer' ? 'Amount to Send' : `Amount to ${tab}`}
            </label>
            <div className="relative">
              <input 
                type="text" 
                inputMode="decimal"
                placeholder="0.00"
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
                className="w-full p-3 pr-16 bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg text-white text-lg font-medium focus:outline-none focus:border-[#333] transition-colors"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-[#555] font-medium">SOL</span>
            </div>
            <p className="text-[10px] text-[#444] mt-2">
              {tab === 'deposit' 
                ? 'Amount will be encrypted before sending to the vault'
                : tab === 'withdraw'
                  ? 'Withdrawal amount is encrypted during processing'
                  : 'Transfer amount is encrypted - only you and recipient can see it'
              }
            </p>
          </div>

          {/* Submit Button */}
          <button 
            onClick={executeAction}
            disabled={isProcessing}
            className={`w-full py-4 rounded-lg text-[12px] font-semibold uppercase tracking-wider transition-all flex items-center justify-center gap-2
              ${isProcessing 
                ? 'bg-[#1a1a1a] text-[#555] cursor-wait' 
                : tab === 'deposit'
                  ? 'bg-emerald-600 text-white hover:bg-emerald-500'
                  : tab === 'withdraw'
                    ? 'bg-blue-600 text-white hover:bg-blue-500'
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
                  {tab === 'deposit' ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  ) : tab === 'withdraw' ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 9l3 3m0 0l-3 3m3-3H8m13 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  )}
                </svg>
                <span>
                  {tab === 'deposit' ? 'Encrypt & Deposit' : tab === 'withdraw' ? 'Withdraw' : 'Send Transfer'}
                </span>
              </>
            )}
          </button>
        </div>

        {/* Info Box */}
        <div className="mt-6 p-4 bg-[#0a0a0a] rounded-lg border border-[#141414]">
          <div className="flex items-start gap-3">
            <svg className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="text-[11px] text-[#666] leading-relaxed">
              <p className="font-medium text-[#888] mb-1">Fully Homomorphic Encryption</p>
              <p>
                {tab === 'transfer'
                  ? 'Transfer amounts are encrypted. Only you and the recipient can decrypt your respective balances.'
                  : 'Your balance is encrypted using Inco Lightning. Only you can decrypt it using your wallet signature.'
                }
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ActionSuite;
