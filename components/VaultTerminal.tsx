import React, { useEffect, useMemo, useState } from 'react';
import { useVault } from '../context/VaultContext';
import ActionSuite from './ActionSuite';
import StatusMonitor from './StatusMonitor';
import AdminPanel from './AdminPanel';
import TransferPanel from './TransferPanel';
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

  const [vaultPlaintextLamports, setVaultPlaintextLamports] = useState<bigint | null>(null);
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

  const formattedVaultSol = useMemo(() => formatSol(vaultPlaintextLamports), [vaultPlaintextLamports]);
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
      setVaultPlaintextLamports(null);
      setUserPlaintextLamports(null);
      setUserEscrowSol(null);
      setDecrypting(false);
      setDecryptError(null);
      setNeedsClaimAccess(false);
      return;
    }
    if (!vaultMetadata?.encryptedBalanceHandle) return;

    let cancelled = false;
    (async () => {
      try {
        setDecrypting(true);
        setDecryptError(null);
        setNeedsClaimAccess(false);
        
        // Decrypt vault balance
        const vaultLamports = await decryptBalance(vaultMetadata.encryptedBalanceHandle);
        if (!cancelled) setVaultPlaintextLamports(vaultLamports);

        // Try to decrypt user's position (may not exist yet)
        try {
          const userHandle = await fetchUserPositionHandle();
          const userLamports = await decryptBalance(userHandle);
          if (!cancelled) setUserPlaintextLamports(userLamports);
          const escrow = await fetchUserEscrowBalance();
          if (!cancelled) setUserEscrowSol(escrow);
          const yIndex = await fetchUserYieldIndex();
          if (!cancelled) setUserYieldIndex(yIndex);
        } catch (userErr) {
          const errMsg = userErr instanceof Error ? userErr.message : '';
          // Check if this is a "not allowed to decrypt" error
          if (errMsg.includes('not allowed') || errMsg.includes('Address is not allowed')) {
            if (!cancelled) {
              setNeedsClaimAccess(true);
              setUserPlaintextLamports(null);
              setUserEscrowSol(null);
              setUserYieldIndex(null);
            }
          } else {
            // User position doesn't exist yet - that's okay
            if (!cancelled) setUserPlaintextLamports(null);
          }
        }
      } catch (err) {
        if (!cancelled) {
          setDecryptError(err instanceof Error ? err.message : 'Decryption failed');
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
    vaultMetadata?.encryptedBalanceHandle,
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
                {/* Total Vault Balance */}
                <div className="bg-[#0a0a0a] rounded-lg p-6 border border-[#1a1a1a]">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-[11px] text-[#666] uppercase tracking-wider">Total Vault Balance</span>
                    <span className={`text-[10px] px-2 py-1 rounded ${state.isRevealed && formattedVaultSol ? 'bg-emerald-900/20 text-emerald-400' : 'bg-[#1a1a1a] text-[#666]'}`}>
                      {state.isRevealed && formattedVaultSol ? 'DECRYPTED' : 'ENCRYPTED'}
                    </span>
                  </div>
                  <div className="text-4xl font-bold text-white mono">
                    {state.isRevealed && formattedVaultSol ? (
                      <span>{formattedVaultSol} <span className="text-lg text-[#666]">SOL</span></span>
                    ) : (
                      <span className="text-[#333]">••••••••</span>
                    )}
                  </div>
                  {decryptError && state.isRevealed && (
                    <p className="mt-2 text-[11px] text-red-400">{decryptError}</p>
                  )}
                </div>

                {/* Your Position */}
                {isConnected && (
                  <div className="bg-[#0a0a0a] rounded-lg p-6 border border-[#1a1a1a]">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-[11px] text-[#666] uppercase tracking-wider">Your Position</span>
                      <span className={`text-[10px] px-2 py-1 rounded ${
                        needsClaimAccess 
                          ? 'bg-yellow-900/20 text-yellow-400' 
                          : state.isRevealed && formattedUserSol 
                            ? 'bg-blue-900/20 text-blue-400' 
                            : 'bg-[#1a1a1a] text-[#666]'
                      }`}>
                        {needsClaimAccess 
                          ? 'DEPOSIT REQUIRED' 
                          : state.isRevealed && formattedUserSol 
                            ? 'DECRYPTED' 
                            : userPlaintextLamports === null && state.isRevealed 
                              ? 'NO POSITION' 
                              : 'ENCRYPTED'}
                      </span>
                    </div>
                    <div className="text-3xl font-bold text-white mono">
                      {needsClaimAccess ? (
                        <div className="space-y-3">
                          <span className="text-[#555] text-lg block">You have received funds! Make a deposit to view your balance.</span>
                          <div className="bg-yellow-900/10 border border-yellow-900/20 rounded p-4 text-left">
                            <p className="text-[11px] text-yellow-400 font-medium mb-2">To view your balance:</p>
                            <ol className="text-[10px] text-[#666] space-y-1 list-decimal list-inside">
                              <li>Go to the Deposit tab on the right</li>
                              <li>Deposit any amount (even 0.001 SOL)</li>
                              <li>This creates a new encrypted handle you can decrypt</li>
                              <li>Your full balance (including transfers) will be visible</li>
                            </ol>
                          </div>
                          <p className="text-[10px] text-[#444]">
                            This is required because FHE handles are owned by whoever created them. A deposit creates a new handle you own.
                          </p>
                        </div>
                      ) : state.isRevealed ? (
                        formattedUserSol ? (
                          <span>{formattedUserSol} <span className="text-lg text-[#666]">SOL</span></span>
                        ) : (
                          <span className="text-[#555] text-xl">No deposits yet</span>
                        )
                      ) : (
                        <span className="text-[#333]">••••••••</span>
                      )}
                    </div>
                    {formattedEscrowSol && (
                      <div className="mt-3 text-[11px] text-[#666]">
                        Escrowed SOL in vault: <span className="text-[#aaa]">{formattedEscrowSol} SOL</span>
                      </div>
                    )}
                    {userYieldIndex && (
                      <div className="mt-1 text-[11px] text-[#666]">
                        Your yield index: <span className="text-[#aaa]">{userYieldIndex}</span>
                      </div>
                    )}
                    {state.isRevealed && !needsClaimAccess && (
                      <div className="mt-3">
                        <button
                          onClick={handleClaimYield}
                          className="px-3 py-2 bg-emerald-900/20 text-emerald-400 border border-emerald-900/30 rounded text-[10px] font-medium uppercase tracking-wider hover:bg-emerald-900/30 transition-all"
                        >
                          Claim Yield
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Admin Panel - Only visible to vault authority */}
            <AdminPanel />

            {/* Transfer Panel - Send to other users */}
            <TransferPanel />

            {/* On-Chain Data Card */}
            <div className="border border-[#1a1a1a] bg-[#080808] rounded-lg overflow-hidden">
              <div className="px-6 py-4 border-b border-[#1a1a1a]">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <svg className="w-4 h-4 text-[#666]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                  On-Chain State
                </h3>
              </div>

              <div className="p-6">
                {vaultMetadata ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-[#0a0a0a] rounded p-4 border border-[#141414]">
                        <div className="text-[10px] text-[#555] uppercase tracking-wider mb-2">Vault Authority</div>
                        <div className="text-[13px] mono text-[#888] break-all">{vaultMetadata.authority}</div>
                      </div>
                      <div className="bg-[#0a0a0a] rounded p-4 border border-[#141414]">
                        <div className="text-[10px] text-[#555] uppercase tracking-wider mb-2">PDA Bump</div>
                        <div className="text-[13px] mono text-[#888]">{vaultMetadata.bump}</div>
                      </div>
                    </div>

                    <div className="bg-[#0a0a0a] rounded p-4 border border-[#141414]">
                      <div className="text-[10px] text-[#555] uppercase tracking-wider mb-2">Total Escrowed SOL</div>
                      <div className="text-[13px] mono text-[#888]">
                        {(vaultMetadata.totalEscrowLamports / 1_000_000_000).toFixed(4)} SOL
                      </div>
                      <div className="mt-1 text-[10px] text-[#555] uppercase tracking-wider mb-1">Yield Index</div>
                      <div className="text-[12px] mono text-[#777]">
                        {vaultMetadata.yieldIndex}
                      </div>
                    </div>

                    <div className="bg-[#0a0a0a] rounded p-4 border border-[#141414]">
                      <div className="text-[10px] text-[#555] uppercase tracking-wider mb-2">Encrypted Balance Handle (Euint128)</div>
                      <div className="text-[12px] mono text-[#666] break-all leading-relaxed">
                        {truncateHandle(vaultMetadata.encryptedBalanceHandle)}
                      </div>
                      <div className="mt-2 text-[10px] mono text-[#444] break-all">
                        Hex: {vaultMetadata.encryptedBalanceHandleHexLE}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-[10px] text-[#555]">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>The handle is a reference to encrypted data stored off-chain by Inco Network</span>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <div className="text-[#444] mb-2">
                      <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    </div>
                    <p className="text-[#555] text-sm">Connect wallet to view vault state</p>
                  </div>
                )}
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

        {/* Sidebar: Actions & Logs */}
        <div className="lg:col-span-4 bg-[#030303] flex flex-col h-full divide-y divide-[#141414] overflow-y-auto">
          <ActionSuite />
          <div className="flex-1">
            <StatusMonitor />
          </div>
        </div>
      </div>
    </section>
  );
};

export default VaultTerminal;
