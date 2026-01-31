import React from 'react';
import { useVault } from '../context/VaultContext';

const Hero: React.FC = () => {
  const { connectWallet, state, cluster } = useVault();
  const isConnected = state.wallet.status === 'connected';
  const clusterLabel = cluster.label.toUpperCase();

  return (
    <section className="relative pt-16 pb-24 px-6 md:px-12">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-blue-950/20 via-transparent to-transparent pointer-events-none" />
      
      <div className="relative max-w-4xl">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-900/20 border border-amber-900/30 rounded-full mb-8">
          <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          <span className="text-[11px] text-amber-300 font-medium">Live on Solana {clusterLabel}</span>
        </div>

        <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-white mb-6 leading-[1.1]">
          Vault-007
          <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-300 to-yellow-500">
            Licensed for Encrypted Finance
          </span>
        </h1>

        <p className="max-w-xl text-lg text-[#888] mb-10 leading-relaxed">
          Vault-007 is the ultimate confidential banking protocol on Solana. 
          Encrypt your wealth, send stealth transfers, and earn private yield 
          using state-of-the-art FHE — all within a single, secure vault.
        </p>

        <div className="flex flex-col sm:flex-row items-start gap-4 mb-16">
          {!isConnected ? (
            <button 
              onClick={() => connectWallet()}
              className="px-8 py-4 bg-white text-black text-[12px] font-semibold uppercase tracking-wider rounded-lg hover:bg-neutral-200 transition-colors flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Connect Wallet
            </button>
          ) : (
            <a 
              href="#terminal"
              className="px-8 py-4 bg-white text-black text-[12px] font-semibold uppercase tracking-wider rounded-lg hover:bg-neutral-200 transition-colors flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              Open Vault Terminal
            </a>
          )}
          <a 
            href="https://docs.inco.org" 
            target="_blank"
            rel="noopener noreferrer"
            className="px-8 py-4 border border-[#333] text-white text-[12px] font-semibold uppercase tracking-wider rounded-lg hover:border-[#555] transition-colors flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            Inco Docs
          </a>
        </div>
        
        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 border-t border-[#1a1a1a] pt-10">
          {[
            { label: 'Network', value: 'Solana', icon: '⚡' },
            { label: 'Privacy Layer', value: 'Inco Lightning', icon: '🔐' },
            { label: 'Encryption', value: 'FHE (Euint128)', icon: '🛡️' },
            { label: 'Status', value: 'Live', icon: '✓' }
          ].map((item, i) => (
            <div key={i} className="bg-[#0a0a0a] rounded-lg p-4 border border-[#1a1a1a]">
              <div className="text-[10px] text-[#555] uppercase tracking-wider mb-2">{item.label}</div>
              <div className="text-[15px] font-semibold text-white flex items-center gap-2">
                <span>{item.icon}</span>
                <span>{item.value}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Tech Stack */}
        <div className="mt-10 flex flex-wrap items-center gap-4">
          <span className="text-[11px] text-[#444] uppercase tracking-wider">Built with:</span>
          <div className="flex flex-wrap gap-2">
            {['Solana', 'Anchor', 'Inco Lightning', 'React', 'TypeScript'].map((tech) => (
              <span key={tech} className="px-3 py-1 bg-[#0a0a0a] border border-[#1a1a1a] rounded text-[11px] text-[#666]">
                {tech}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
