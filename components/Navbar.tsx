import React from 'react';
import { useVault } from '../context/VaultContext';

const Navbar: React.FC = () => {
  const { state, connectWallet, disconnectWallet, cluster, clusters, setCluster } = useVault();
  const isConnected = state.wallet.status === 'connected';

  const handleConnect = () => {
    if (isConnected) {
      void disconnectWallet();
    } else {
      void connectWallet();
    }
  };

  const truncateAddress = (addr: string) => `${addr.slice(0, 4)}...${addr.slice(-4)}`;

  return (
    <nav className="sticky top-0 w-full z-50 border-b border-[#1a1a1a] bg-black/95 backdrop-blur-sm">
      {cluster.id !== 'devnet' && (
        <div className="w-full bg-amber-900/20 border-b border-amber-900/30 text-amber-300 text-[11px] px-4 md:px-12 py-2">
          You are on {cluster.label}. This app is configured for devnet by default.
        </div>
      )}
      <div className="max-w-[1280px] mx-auto px-4 md:px-12 h-16 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-yellow-500 flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <span className="font-bold text-white text-[14px] tracking-[0.2em]">VAULT-007</span>
        </div>

        {/* Navigation Links */}
        <div className="hidden md:flex items-center gap-8">
          <a href="#terminal" className="text-[12px] text-[#666] hover:text-white transition-colors">Vault</a>
          <a href="#features" className="text-[12px] text-[#666] hover:text-white transition-colors">Features</a>
          <a href="#specs" className="text-[12px] text-[#666] hover:text-white transition-colors">Specs</a>
          <a 
            href={`https://explorer.solana.com/address/DmfUVqYJ5DG1iWww8YXt75zsB6RdmMws5qQMBWH4ofvC?cluster=${cluster.id}`} 
            target="_blank"
            rel="noopener noreferrer"
            className="text-[12px] text-[#666] hover:text-white transition-colors flex items-center gap-1"
          >
            Explorer
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        </div>

        {/* Wallet Connection */}
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-2">
            <span className="text-[10px] text-[#555] uppercase tracking-wider">Network</span>
            <select
              value={cluster.id}
              onChange={(event) => {
                const next = clusters.find((item) => item.id === event.target.value);
                if (next) setCluster(next);
              }}
              className="bg-[#0a0a0a] border border-[#1a1a1a] text-[11px] text-[#aaa] rounded px-2 py-1"
            >
              {clusters.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
          {isConnected && (
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg">
              <div className="w-2 h-2 rounded-full bg-emerald-400" />
              <span className="text-[11px] text-[#888] mono">
                {truncateAddress(state.wallet.address || '')}
              </span>
            </div>
          )}
          <button 
            onClick={handleConnect}
            className={`px-4 py-2 rounded-lg text-[11px] font-semibold transition-all flex items-center gap-2
              ${isConnected 
                ? 'bg-[#1a1a1a] text-[#888] hover:bg-[#222] hover:text-white border border-[#333]' 
                : 'bg-white text-black hover:bg-neutral-200'}
            `}
          >
            {isConnected ? (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Disconnect
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Connect
              </>
            )}
          </button>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
