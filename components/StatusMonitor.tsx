import React from 'react';
import { useVault, SystemLog } from '../context/VaultContext';
import { motion, AnimatePresence } from 'framer-motion';

const StatusMonitor: React.FC = () => {
  const { state, cluster } = useVault();
  const isConnected = state.wallet.status === 'connected';
  const clusterLabel = cluster.label.toUpperCase();

  const getLevelStyles = (level: SystemLog['level']) => {
    switch (level) {
      case 'error': return { bg: 'bg-red-900/10', border: 'border-red-900/30', text: 'text-red-400' };
      case 'warn': return { bg: 'bg-amber-900/10', border: 'border-amber-900/30', text: 'text-amber-400' };
      default: return { bg: 'bg-emerald-900/10', border: 'border-emerald-900/30', text: 'text-emerald-400' };
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#020202]">
      {/* Network Status */}
      <div className="p-6 border-b border-[#141414]">
        <div className="flex items-center gap-2 mb-4">
          <svg className="w-4 h-4 text-[#666]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <h4 className="text-[12px] font-semibold text-white">Network Status</h4>
        </div>

        {state.systemError && (
          <div className="mb-4 p-3 bg-red-900/10 border border-red-900/20 rounded-lg">
            <p className="text-[11px] text-red-400">{state.systemError}</p>
          </div>
        )}

        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-[11px] text-[#555]">Cluster</span>
            <span className="text-[11px] text-[#888] font-medium">{clusterLabel}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[11px] text-[#555]">Wallet</span>
            <span className={`text-[11px] font-medium ${isConnected ? 'text-emerald-400' : 'text-[#555]'}`}>
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[11px] text-[#555]">Encryption</span>
            <span className="text-[11px] text-amber-300 font-medium">Inco FHE</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[11px] text-[#555]">Vault Status</span>
            <span className={`text-[11px] font-medium ${state.vault.totals.metadata ? 'text-emerald-400' : 'text-[#555]'}`}>
              {state.vault.totals.metadata ? 'Initialized' : 'Unknown'}
            </span>
          </div>
        </div>
      </div>

      {/* Activity Log */}
      <div className="flex-1 overflow-hidden flex flex-col p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-[#666]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <h4 className="text-[12px] font-semibold text-white">Activity Log</h4>
          </div>
          <span className="text-[10px] text-[#444] bg-[#0a0a0a] px-2 py-1 rounded">
            {state.logs.length} events
          </span>
        </div>
        
        <div className="flex-1 overflow-y-auto space-y-3 pr-2">
          <AnimatePresence initial={false}>
            {state.logs.length === 0 ? (
              <div className="text-center py-8">
                <svg className="w-8 h-8 text-[#333] mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-[11px] text-[#444]">No activity yet</p>
                <p className="text-[10px] text-[#333] mt-1">Connect wallet to start</p>
              </div>
            ) : (
              state.logs.map((log) => {
                const styles = getLevelStyles(log.level);
                return (
                  <motion.div 
                    key={log.id}
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`p-3 rounded-lg border ${styles.bg} ${styles.border}`}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <span className={`text-[10px] font-semibold ${styles.text}`}>{log.code}</span>
                      <span className="text-[9px] text-[#444]">{log.timestamp}</span>
                    </div>
                    <p className="text-[11px] text-[#888] leading-relaxed">
                      {log.message}
                    </p>
                  </motion.div>
                );
              })
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default StatusMonitor;
