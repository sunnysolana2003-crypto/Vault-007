
import React, { useState, useEffect, useCallback } from 'react';
import { useVault } from '../context/VaultContext';

interface PrivateValueProps {
  value: string | number;
  label?: string;
  mono?: boolean;
  className?: string;
}

const PrivateValue: React.FC<PrivateValueProps> = ({ 
  value, 
  mono = false, 
  className = "" 
}) => {
  const { state, dispatch } = useVault();
  const [isLocalRevealed, setIsLocalRevealed] = useState(false);
  const [decryptError, setDecryptError] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);

  const isCurrentlyRevealed = state.isRevealed || isLocalRevealed;
  const isConnected = state.wallet.status === 'connected';

  const redact = useCallback(() => {
    setIsLocalRevealed(false);
    setDecryptError(false);
    setIsRetrying(false);
  }, []);

  useEffect(() => {
    if (!isConnected) redact();
  }, [isConnected, redact]);

  useEffect(() => {
    const handleVisibilityChange = () => { if (document.visibilityState === 'hidden') redact(); };
    window.addEventListener('visibilitychange', handleVisibilityChange);
    return () => window.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [redact]);

  const handleToggle = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    if (!isConnected || isRetrying) return;

    if (decryptError) {
      setIsRetrying(true);
      setDecryptError(false);
      setTimeout(() => {
        if (Math.random() > 0.4) {
          setIsLocalRevealed(true);
          setIsRetrying(false);
        } else {
          setDecryptError(true);
          setIsRetrying(false);
        }
      }, 1000);
      return;
    }

    if (!isCurrentlyRevealed) {
      if (Math.random() > 0.98) {
        setDecryptError(true);
        dispatch({ type: 'PUSH_LOG', payload: { level: 'error', code: 'FHE_909', message: 'Decryption cycle failed for enclave index.' } });
        return;
      }
    }
    
    setIsLocalRevealed(!isLocalRevealed);
    setDecryptError(false);
  };

  const placeholder = "••••••••";

  return (
    <div 
      className={`inline-flex items-center group relative ${className}`}
      onClick={handleToggle}
      onKeyDown={(e) => e.key === 'Enter' && handleToggle(e)}
      role="button"
      tabIndex={isConnected ? 0 : -1}
      aria-label={isCurrentlyRevealed ? "Hide session data" : "Decrypt session data"}
    >
      <span className={`
        transition-all duration-300 ease-in-out px-1
        ${mono ? 'mono' : ''}
        ${decryptError ? 'text-red-900 cursor-pointer' : isRetrying ? 'text-[#222222] animate-pulse' : isCurrentlyRevealed ? 'text-white' : 'text-[#151515] select-none cursor-pointer group-hover:text-[#333333]'}
      `}>
        {isRetrying ? '[SYNC]' : decryptError ? '[FAILED]' : isCurrentlyRevealed ? value : placeholder}
      </span>
      
      {/* Structural Hierarchy Hint: Underline for active private enclaves */}
      {isConnected && !isRetrying && (
        <div className={`absolute -bottom-0.5 left-0 h-[1px] transition-all duration-500 ${isCurrentlyRevealed ? 'w-0 bg-transparent' : 'w-full bg-[#111111] group-hover:bg-[#222222]'}`} />
      )}
    </div>
  );
};

export default PrivateValue;
