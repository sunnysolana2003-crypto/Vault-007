import React, { useEffect, useMemo, useState } from 'react';
import { useVault } from '../context/VaultContext';
import ActionSuite from './ActionSuite';
import AdminPanel from './AdminPanel';
import TransferPanel from './TransferPanel';
import StealthNotes from './StealthNotes';
import { motion } from 'framer-motion';

const VaultTerminal: React.FC = () => {
  const {
    state,
    dispatch,
    decryptBalance,
    fetchUserPositionHandle,
    fetchUserEscrowBalance,
    fetchUserYieldIndex,
    refreshVaultMetadata,
    claimAccess,
    claimYield,
  } = useVault();
  const isConnected = state.wallet.status === 'connected';
  const vaultMetadata = state.vault.totals.metadata;

  const [userPlaintextLamports, setUserPlaintextLamports] = useState<bigint | null>(null);
  const [decrypting, setDecrypting] = useState(false);
  const [decryptError, setDecryptError] = useState<string | null>(null);
  const [needsClaimAccess, setNeedsClaimAccess] = useState(false);
  const [claimingAccess, setClaimingAccess] = useState(false);
  const [userEscrowSol, setUserEscrowSol] = useState<number | null>(null);
  const [userYieldIndex, setUserYieldIndex] = useState<string | null>(null);

  const formatSol = (lamports: bigint | null) => {
    if (lamports == null) return null;
    const sign = lamports < 0n ? '-' : '';
    const abs = lamports < 0n ? -lamports : lamports;
    const whole = abs / 1_000_000_000n;
    const frac = abs % 1_000_000_000n;
    return `${sign}${whole.toString()}.${frac.toString().padStart(9, '0').slice(0, 4)}`;
  };

  const formattedUserSol = useMemo(() => formatSol(userPlaintextLamports), [userPlaintextLamports]);
  const formattedEscrowSol = useMemo(
    () => (userEscrowSol == null ? null : userEscrowSol.toFixed(4)),
    [userEscrowSol]
  );

  // Auto-refresh vault metadata on mount and when connected
  useEffect(() => {
    if (isConnected) {
      refreshVaultMetadata();
    }
  }, [isConnected, refreshVaultMetadata]);

  // Handle decryption when reveal is toggled
  useEffect(() => {
    if (!isConnected || !state.isRevealed) {
      setUserPlaintextLamports(null);
      setUserEscrowSol(null);
      setDecrypting(false);
      setDecryptError(null);
      setNeedsClaimAccess(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        setDecrypting(true);
        setDecryptError(null);
        setNeedsClaimAccess(false);
        
        // First, always try to get the escrow balance (this doesn't need decryption)
        try {
          const escrow = await fetchUserEscrowBalance();
          if (!cancelled) setUserEscrowSol(escrow);
        } catch {
          // User position doesn't exist yet
          if (!cancelled) setUserEscrowSol(null);
        }

        // Try to decrypt user's encrypted balance
        try {
          const userHandle = await fetchUserPositionHandle();
          const userLamports = await decryptBalance(userHandle);
          if (!cancelled) setUserPlaintextLamports(userLamports);
          const yIndex = await fetchUserYieldIndex();
          if (!cancelled) setUserYieldIndex(yIndex);
        } catch (userErr) {
          const errMsg = userErr instanceof Error ? userErr.message : '';
          console.log('[Vault] User decryption error details:', errMsg);
          
          // Check if this is a "not allowed to decrypt" error (403 from Inco)
          const isPermissionError = 
            errMsg.includes('not allowed') || 
            errMsg.includes('Address is not allowed') || 
            errMsg.includes('403') ||
            errMsg.includes('Covalidator API request failed');
            
          if (isPermissionError) {
            console.log('[Vault] Permission required for user handle. Showing Claim Access button.');
            if (!cancelled) {
              setNeedsClaimAccess(true);
              setUserPlaintextLamports(null);
              setUserYieldIndex(null);
              setDecryptError(null); // Don't show raw error, show authorization UI instead
            }
          } else if (errMsg.includes('not found') || errMsg.includes('does not exist')) {
            // User position doesn't exist yet - that's okay
            console.log('[Vault] User position does not exist yet.');
            if (!cancelled) {
              setUserPlaintextLamports(null);
              setDecryptError(null);
            }
          } else {
            // Some other error - but don't show technical errors to user
            console.log('[Vault] Other error:', errMsg);
            if (!cancelled) setUserPlaintextLamports(null);
          }
        }
      } catch (err) {
        // Only show user-friendly errors, not technical API errors
        const errMsg = err instanceof Error ? err.message : 'Decryption failed';
        const isPermissionError = 
          errMsg.includes('not allowed') || 
          errMsg.includes('Address is not allowed') || 
          errMsg.includes('Covalidator');
        
        if (!cancelled) {
          if (isPermissionError) {
            setNeedsClaimAccess(true);
            setDecryptError(null);
          } else {
            // Don't show technical errors, just log them
            console.error('[Vault] Decryption error:', errMsg);
          }
        }
      } finally {
        if (!cancelled) setDecrypting(false);
      }
    })();

    return () => { cancelled = true; };
  }, [
    decryptBalance,
    fetchUserPositionHandle,
    fetchUserEscrowBalance,
    fetchUserYieldIndex,
    isConnected,
    state.isRevealed,
  ]);

  const handleClaimYield = async () => {
    try {
      await claimYield();
      // Re-load escrow + yield index
      const escrow = await fetchUserEscrowBalance();
      setUserEscrowSol(escrow);
      const yIndex = await fetchUserYieldIndex();
      setUserYieldIndex(yIndex);
      // Re-decrypt to show updated balance
      const userHandle = await fetchUserPositionHandle();
      const userLamports = await decryptBalance(userHandle);
      setUserPlaintextLamports(userLamports);
    } catch (err) {
      setDecryptError(err instanceof Error ? err.message : 'Yield claim failed');
    }
  };

  // Handle claiming access
  const handleClaimAccess = async () => {
    try {
      setClaimingAccess(true);
      await claimAccess();
      setNeedsClaimAccess(false);
      // Re-trigger decryption after claiming access
      dispatch({ type: 'TOGGLE_REVEAL' });
      setTimeout(() => dispatch({ type: 'TOGGLE_REVEAL' }), 500);
    } catch (err) {
      setDecryptError(err instanceof Error ? err.message : 'Failed to claim access');
    } finally {
      setClaimingAccess(false);
    }
  };

  const truncateAddress = (addr: string) => `${addr.slice(0, 4)}...${addr.slice(-4)}`;
  const truncateHandle = (handle: string) => handle.length > 20 ? `${handle.slice(0, 12)}...` : handle;

  return (
    <section className="bg-black min-h-screen border-t border-[#141414] flex flex-col">
      {/* Header: Network Status */}
      <div className="border-b border-[#141414] bg-[#020202] px-6 md:px-12 py-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-neutral-700'}`} />
          <span className="text-[10px] mono text-[#666] uppercase tracking-wider">
            {isConnected ? 'Connected to Solana Devnet' : 'Wallet Disconnected'}
          </span>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-[9px] mono text-[#444] uppercase">
            Program: <span className="text-[#666]">DmfU...ofvC</span>
          </div>
          <div className="text-[9px] mono text-[#444] uppercase">
            Inco: <span className="text-[#666]">5sjE...Swaj</span>
          </div>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
        {/* Main Vault Display */}
        <div className="lg:col-span-8 p-6 md:p-12 overflow-y-auto border-r border-[#141414]">
          <div className="max-w-4xl mx-auto space-y-8">
            
            {/* Vault State Card */}
            <div className="border border-[#1a1a1a] bg-[#080808] rounded-lg overflow-hidden">
              <div className="px-6 py-4 border-b border-[#1a1a1a] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-500 to-yellow-500 flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-white">Vault-007 Terminal</h2>
                    <p className="text-[11px] text-[#666] mono">FHE-Encrypted Operations</p>
                  </div>
                </div>
                <button 
                  onClick={() => dispatch({ type: 'TOGGLE_REVEAL' })}
                  disabled={!isConnected}
                  className={`px-4 py-2 rounded text-[11px] font-medium uppercase tracking-wider transition-all
                    ${!isConnected 
                      ? 'bg-[#1a1a1a] text-[#444] cursor-not-allowed' 
                      : state.isRevealed 
                        ? 'bg-red-900/20 text-red-400 border border-red-900/30 hover:bg-red-900/30' 
                        : 'bg-emerald-900/20 text-emerald-400 border border-emerald-900/30 hover:bg-emerald-900/30'
                    }
                  `}
                >
                  {decrypting ? 'Decrypting...' : state.isRevealed ? 'Hide Values' : 'Decrypt & Reveal'}
                </button>
              </div>

              <div className="p-6 space-y-6">
                {/* Your Vault Balance - Main Display */}
                <div className="bg-[#0a0a0a] rounded-lg p-8 border border-[#1a1a1a]">
                  <div className="flex items-center justify-between mb-6">
                    <span className="text-[12px] text-[#888] uppercase tracking-wider font-medium">Your Vault Balance</span>
                    <span className={`text-[10px] px-3 py-1.5 rounded-full font-medium ${
                      needsClaimAccess 
                        ? 'bg-amber-900/30 text-amber-400 border border-amber-900/40' 
                        : state.isRevealed && formattedEscrowSol 
                          ? 'bg-emerald-900/30 text-emerald-400 border border-emerald-900/40' 
                          : 'bg-[#1a1a1a] text-[#666] border border-[#222]'
                    }`}>
                      {needsClaimAccess 
                        ? 'NEEDS AUTHORIZATION' 
                        : state.isRevealed && formattedEscrowSol 
                          ? 'ACTIVE' 
                          : !isConnected
                            ? 'CONNECT WALLET'
                            : 'ENCRYPTED'}
                    </span>
                  </div>

                  {!isConnected ? (
                    <div className="text-center py-8">
                      <div className="text-[#333] text-5xl mb-4">🔐</div>
                      <p className="text-[#555] text-sm">Connect your wallet to view your vault</p>
                    </div>
                  ) : needsClaimAccess ? (
                    <div className="space-y-4">
                      <div className="text-center">
                        <div className="text-5xl font-bold text-amber-400 mono mb-2">
                          {formattedEscrowSol ? `${formattedEscrowSol}` : '?.????'}
                          <span className="text-xl text-amber-400/60 ml-2">SOL</span>
                        </div>
                        <p className="text-[11px] text-[#666]">Balance requires authorization to decrypt</p>
                      </div>
                      <div className="flex justify-center">
                        <button
                          onClick={handleClaimAccess}
                          disabled={claimingAccess}
                          className="px-6 py-3 bg-amber-900/20 text-amber-400 border border-amber-900/30 rounded-lg text-[12px] font-medium uppercase tracking-wider hover:bg-amber-900/30 transition-all disabled:opacity-50"
                        >
                          {claimingAccess ? 'Authorizing...' : '🔓 Authorize Decryption'}
                        </button>
                      </div>
                      <div className="bg-amber-900/10 border border-amber-900/20 rounded-lg p-4 mt-4">
                        <p className="text-[11px] text-amber-400/80 leading-relaxed text-center">
                          Your last transaction created a new encrypted balance. Click above to authorize your wallet to decrypt it.
                        </p>
                      </div>
                    </div>
                  ) : state.isRevealed ? (
                    <div className="text-center">
                      {formattedEscrowSol ? (
                        <>
                          <div className="text-5xl font-bold text-white mono mb-2">
                            {formattedEscrowSol}
                            <span className="text-xl text-[#666] ml-2">SOL</span>
                          </div>
                          {formattedUserSol && (
                            <p className="text-[11px] text-emerald-400/80 mb-4">
                              Encrypted balance: {formattedUserSol} SOL ✓
                            </p>
                          )}
                          <div className="flex justify-center gap-3 mt-4">
                            <button
                              onClick={handleClaimYield}
                              className="px-4 py-2 bg-emerald-900/20 text-emerald-400 border border-emerald-900/30 rounded text-[11px] font-medium uppercase tracking-wider hover:bg-emerald-900/30 transition-all"
                            >
                              Claim Yield
                            </button>
                          </div>
                        </>
                      ) : (
                        <div className="py-4">
                          <div className="text-4xl font-bold text-[#444] mono mb-3">0.0000 SOL</div>
                          <p className="text-[#666] text-sm">No deposits yet. Use the panel on the right to deposit SOL.</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <div className="text-5xl font-bold text-[#222] mono mb-2">••••••••</div>
                      <p className="text-[#555] text-sm">Click "Decrypt & Reveal" to view your balance</p>
                    </div>
                  )}

                  {decryptError && state.isRevealed && !needsClaimAccess && (
                    <p className="mt-4 text-[11px] text-red-400 text-center">
                      {decryptError.includes('Covalidator') || decryptError.includes('not allowed') 
                        ? 'Authorization required to view balance' 
                        : decryptError}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Admin Panel - Only visible to vault authority */}
            <AdminPanel />

            {/* Transfer Panel - Send to other users */}
            <TransferPanel />

            {/* Stealth Notes - Hidden recipient transfers */}
            <StealthNotes />

            {/* Security Info Card */}
            <div className="border border-[#1a1a1a] bg-[#080808] rounded-lg overflow-hidden">
              <div className="px-6 py-4 border-b border-[#1a1a1a]">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  Privacy Guaranteed
                </h3>
              </div>

              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-[#0a0a0a] rounded-lg p-4 border border-[#141414] text-center">
                    <div className="text-2xl mb-2">🔒</div>
                    <div className="text-[11px] text-[#888] font-medium mb-1">Encrypted Balance</div>
                    <div className="text-[10px] text-[#555]">Your balance is always encrypted on-chain</div>
                  </div>
                  <div className="bg-[#0a0a0a] rounded-lg p-4 border border-[#141414] text-center">
                    <div className="text-2xl mb-2">👻</div>
                    <div className="text-[11px] text-[#888] font-medium mb-1">Hidden Transfers</div>
                    <div className="text-[10px] text-[#555]">Transfer amounts are never visible</div>
                  </div>
                  <div className="bg-[#0a0a0a] rounded-lg p-4 border border-[#141414] text-center">
                    <div className="text-2xl mb-2">🔑</div>
                    <div className="text-[11px] text-[#888] font-medium mb-1">Only You Can Decrypt</div>
                    <div className="text-[10px] text-[#555]">Wallet signature required to view</div>
                  </div>
                </div>
              </div>
            </div>

            {/* How It Works */}
            <div className="border border-[#1a1a1a] bg-[#080808] rounded-lg overflow-hidden">
              <div className="px-6 py-4 border-b border-[#1a1a1a]">
                <h3 className="text-sm font-semibold text-white">How Vault-007 Works</h3>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center p-4">
                    <div className="w-10 h-10 rounded-full bg-blue-900/20 flex items-center justify-center mx-auto mb-3">
                      <span className="text-blue-400 font-bold">1</span>
                    </div>
                    <h4 className="text-[12px] font-semibold text-white mb-2">Encrypt Client-Side</h4>
                    <p className="text-[11px] text-[#666]">Your deposit amount is encrypted using Inco SDK before sending to Solana</p>
                  </div>
                  <div className="text-center p-4">
                    <div className="w-10 h-10 rounded-full bg-purple-900/20 flex items-center justify-center mx-auto mb-3">
                      <span className="text-purple-400 font-bold">2</span>
                    </div>
                    <h4 className="text-[12px] font-semibold text-white mb-2">FHE Operations</h4>
                    <p className="text-[11px] text-[#666]">Inco Lightning performs encrypted arithmetic on-chain without revealing values</p>
                  </div>
                  <div className="text-center p-4">
                    <div className="w-10 h-10 rounded-full bg-emerald-900/20 flex items-center justify-center mx-auto mb-3">
                      <span className="text-emerald-400 font-bold">3</span>
                    </div>
                    <h4 className="text-[12px] font-semibold text-white mb-2">Attested Reveal</h4>
                    <p className="text-[11px] text-[#666]">Only you can decrypt your balance using wallet signature attestation</p>
                  </div>
                </div>
                <div className="mt-6 text-[11px] text-[#666] border-t border-[#1a1a1a] pt-4">
                  Deposits move real SOL into your user PDA escrow. Withdrawals release SOL back to your wallet.
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Sidebar: Actions */}
        <div className="lg:col-span-4 bg-[#030303] flex flex-col h-full overflow-y-auto">
          <ActionSuite />
        </div>
      </div>
    </section>
  );
};

export default VaultTerminal;
