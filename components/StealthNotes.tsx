import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useVault } from '../context/VaultContext';

type TabType = 'send' | 'claim';

const StealthNotes: React.FC = () => {
  const { state, createStealthNote, claimStealthNote, checkStealthNote, cluster } = useVault();
  const [activeTab, setActiveTab] = useState<TabType>('send');
  const [amount, setAmount] = useState('');
  const [secret, setSecret] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
    signature?: string;
    noteId?: string;
  } | null>(null);
  const [noteInfo, setNoteInfo] = useState<{
    lamports: number;
    sender: string;
    claimed: boolean;
    createdAt: number;
  } | null>(null);

  const isConnected = state.wallet.status === 'connected';

  const handleSendNote = async () => {
    if (!amount || !secret) return;
    
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setResult({ type: 'error', message: 'Please enter a valid amount.' });
      return;
    }

    if (secret.length < 4) {
      setResult({ type: 'error', message: 'Secret passphrase must be at least 4 characters.' });
      return;
    }

    setIsLoading(true);
    setResult(null);
    try {
      const { signature, noteId } = await createStealthNote(numAmount, secret);
      setResult({
        type: 'success',
        message: `Stealth note created! Share this secret with the recipient: "${secret}"`,
        signature,
        noteId,
      });
      setAmount('');
      setSecret('');
    } catch (err) {
      setResult({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to create stealth note.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCheckNote = async () => {
    if (!secret) return;
    
    setIsLoading(true);
    setNoteInfo(null);
    setResult(null);
    try {
      const info = await checkStealthNote(secret);
      if (info) {
        setNoteInfo({
          lamports: info.lamports,
          sender: info.sender,
          claimed: info.claimed,
          createdAt: info.createdAt,
        });
        if (info.claimed) {
          setResult({ type: 'info', message: 'This note has already been claimed.' });
        } else {
          setResult({
            type: 'info',
            message: `Found unclaimed note with ${(info.lamports / 1_000_000_000).toFixed(4)} SOL`,
          });
        }
      } else {
        setResult({ type: 'error', message: 'No stealth note found for this secret.' });
      }
    } catch (err) {
      setResult({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to check stealth note.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClaimNote = async () => {
    if (!secret) return;
    
    setIsLoading(true);
    setResult(null);
    try {
      const signature = await claimStealthNote(secret);
      setResult({
        type: 'success',
        message: 'Stealth note claimed! Funds added to your vault balance.',
        signature,
      });
      setSecret('');
      setNoteInfo(null);
    } catch (err) {
      setResult({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to claim stealth note.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-zinc-900/80 border border-amber-500/20 rounded-xl p-6 backdrop-blur-sm"
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-amber-500/20 rounded-lg flex items-center justify-center">
          <span className="text-xl">🕵️</span>
        </div>
        <div>
          <h3 className="text-lg font-bold text-amber-400">Stealth Notes</h3>
          <p className="text-xs text-zinc-500">Send funds with hidden recipient</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => {
            setActiveTab('send');
            setResult(null);
            setNoteInfo(null);
          }}
          className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'send'
              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
              : 'bg-zinc-800/50 text-zinc-400 border border-zinc-700/50 hover:bg-zinc-800'
          }`}
        >
          Send Note
        </button>
        <button
          onClick={() => {
            setActiveTab('claim');
            setResult(null);
            setNoteInfo(null);
          }}
          className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'claim'
              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
              : 'bg-zinc-800/50 text-zinc-400 border border-zinc-700/50 hover:bg-zinc-800'
          }`}
        >
          Claim Note
        </button>
      </div>

      {/* Info Box */}
      <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-lg p-4 mb-6">
        <div className="flex items-start gap-2">
          <span className="text-amber-400">🔐</span>
          <div className="text-xs text-zinc-400">
            {activeTab === 'send' ? (
              <>
                <strong className="text-amber-400">How it works:</strong> Create a secret passphrase and share it with the recipient off-chain (via message, email, etc.). The recipient's wallet address is <span className="text-green-400">never visible on-chain</span>.
              </>
            ) : (
              <>
                <strong className="text-amber-400">How to claim:</strong> Enter the secret passphrase shared by the sender. If valid, the funds will be added to your encrypted vault balance.
              </>
            )}
          </div>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'send' ? (
          <motion.div
            key="send"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-4"
          >
            {/* Amount Input */}
            <div>
              <label className="block text-xs text-zinc-500 mb-2">Amount (SOL)</label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                step="0.01"
                min="0"
                className="w-full bg-zinc-800/50 border border-zinc-700/50 rounded-lg px-4 py-3 text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500/50 transition-colors"
                disabled={!isConnected || isLoading}
              />
              <p className="text-[10px] text-amber-500/80 mt-2 flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                Min. 0.05 SOL recommended in wallet for fees & rent
              </p>
            </div>

            {/* Secret Input */}
            <div>
              <label className="block text-xs text-zinc-500 mb-2">Secret Passphrase</label>
              <input
                type="text"
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                placeholder="e.g., mission-007-goldeneye"
                className="w-full bg-zinc-800/50 border border-zinc-700/50 rounded-lg px-4 py-3 text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500/50 transition-colors font-mono"
                disabled={!isConnected || isLoading}
              />
              <p className="text-xs text-zinc-600 mt-1">
                Choose a unique, memorable passphrase. Share it securely with the recipient.
              </p>
            </div>

            {/* Send Button */}
            <button
              onClick={handleSendNote}
              disabled={!isConnected || isLoading || !amount || !secret}
              className="w-full py-3 px-4 bg-gradient-to-r from-amber-500 to-yellow-500 text-black font-bold rounded-lg hover:from-amber-400 hover:to-yellow-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <span className="animate-spin">⏳</span>
                  Creating Stealth Note...
                </>
              ) : (
                <>
                  <span>🕵️</span>
                  Create Stealth Note
                </>
              )}
            </button>
          </motion.div>
        ) : (
          <motion.div
            key="claim"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-4"
          >
            {/* Secret Input */}
            <div>
              <label className="block text-xs text-zinc-500 mb-2">Secret Passphrase</label>
              <input
                type="text"
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                placeholder="Enter the secret shared by sender"
                className="w-full bg-zinc-800/50 border border-zinc-700/50 rounded-lg px-4 py-3 text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500/50 transition-colors font-mono"
                disabled={!isConnected || isLoading}
              />
            </div>

            {/* Note Info Display */}
            {noteInfo && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`p-4 rounded-lg border ${
                  noteInfo.claimed
                    ? 'bg-zinc-800/50 border-zinc-700/50'
                    : 'bg-green-900/20 border-green-500/30'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-zinc-500">Amount</span>
                  <span className="text-amber-400 font-mono">
                    {(noteInfo.lamports / 1_000_000_000).toFixed(4)} SOL
                  </span>
                </div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-zinc-500">Status</span>
                  <span className={noteInfo.claimed ? 'text-zinc-400' : 'text-green-400'}>
                    {noteInfo.claimed ? '❌ Claimed' : '✅ Available'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-500">Sender</span>
                  <span className="text-zinc-400 font-mono text-xs">
                    {noteInfo.sender.slice(0, 8)}...{noteInfo.sender.slice(-4)}
                  </span>
                </div>
              </motion.div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={handleCheckNote}
                disabled={!isConnected || isLoading || !secret}
                className="flex-1 py-3 px-4 bg-zinc-800 border border-zinc-700 text-white font-medium rounded-lg hover:bg-zinc-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <span className="animate-spin">⏳</span>
                ) : (
                  <span>🔍</span>
                )}
                Check Note
              </button>
              <button
                onClick={handleClaimNote}
                disabled={!isConnected || isLoading || !secret || (noteInfo && noteInfo.claimed)}
                className="flex-1 py-3 px-4 bg-gradient-to-r from-amber-500 to-yellow-500 text-black font-bold rounded-lg hover:from-amber-400 hover:to-yellow-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <span className="animate-spin">⏳</span>
                    Claiming...
                  </>
                ) : (
                  <>
                    <span>💰</span>
                    Claim Note
                  </>
                )}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Result Message */}
      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`mt-4 p-4 rounded-lg border ${
              result.type === 'success'
                ? 'bg-green-900/20 border-green-500/30 text-green-400'
                : result.type === 'error'
                ? 'bg-red-900/20 border-red-500/30 text-red-400'
                : 'bg-blue-900/20 border-blue-500/30 text-blue-400'
            }`}
          >
            <p className="text-sm">{result.message}</p>
            {result.signature && (
              <a
                href={`https://explorer.solana.com/tx/${result.signature}?cluster=${cluster.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs underline mt-2 block hover:text-white transition-colors"
              >
                View transaction on Solana Explorer →
              </a>
            )}
            {result.noteId && (
              <p className="text-xs text-zinc-500 mt-2 font-mono">
                Note ID: {result.noteId.slice(0, 16)}...
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Not Connected Warning */}
      {!isConnected && (
        <div className="mt-4 p-3 bg-amber-900/20 border border-amber-500/30 rounded-lg">
          <p className="text-xs text-amber-400 text-center">
            Connect your wallet to use Stealth Notes
          </p>
        </div>
      )}
    </motion.div>
  );
};

export default StealthNotes;
