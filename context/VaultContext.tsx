
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useReducer,
  useRef,
  useState,
  ReactNode,
} from 'react';
import VaultService, { VaultMetadataSummary, StealthNoteInfo } from '../services/vault';
import { type WalletProvider } from '../services/wallet-detector';

type WalletStatus = 'disconnected' | 'connecting' | 'connected';
type VaultStatus = 'idle' | 'loading' | 'ready' | 'error';
type OperationType = 'deposit' | 'withdraw' | 'reveal' | null;

type ClusterId = 'devnet' | 'testnet' | 'mainnet-beta';
interface ClusterOption {
  id: ClusterId;
  label: string;
  rpcUrl: string;
}

export interface SystemLog {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  code: string;
  message: string;
}

interface VaultMetadata {
  totalBalance: number;
  metadata: VaultMetadataSummary | null;
}

interface VaultState {
  wallet: {
    address: string | null;
    status: WalletStatus;
  };
  vault: {
    status: VaultStatus;
    lastUpdated: string | null;
    totals: VaultMetadata;
  };
  isRevealed: boolean;
  activeOperation: OperationType;
  logs: SystemLog[];
  systemError: string | null;
}

type VaultAction =
  | { type: 'CONNECT_WALLET'; payload: string }
  | { type: 'DISCONNECT_WALLET' }
  | { type: 'SET_VAULT_STATUS'; payload: VaultStatus }
  | { type: 'SET_VAULT_METADATA'; payload: VaultMetadataSummary }
  | { type: 'ADJUST_TOTAL_BALANCE'; payload: number }
  | { type: 'TOGGLE_REVEAL' }
  | { type: 'START_OPERATION'; payload: OperationType }
  | { type: 'END_OPERATION' }
  | { type: 'PUSH_LOG'; payload: Omit<SystemLog, 'id' | 'timestamp'> }
  | { type: 'SET_SYSTEM_ERROR'; payload: string | null }
  | { type: 'CLEAR_LOGS' };

const initialState: VaultState = {
  wallet: {
    address: null,
    status: 'disconnected',
  },
  vault: {
    status: 'idle',
    lastUpdated: null,
    totals: {
      totalBalance: 0,
      metadata: null,
    },
  },
  isRevealed: false,
  activeOperation: null,
  logs: [],
  systemError: null,
};

function formatOperationError(err: unknown, operation: OperationType | 'transfer' | 'yield'): string {
  const message = err instanceof Error ? err.message : 'Operation failed.';
  const lower = message.toLowerCase();
  const isInsufficientFunds =
    lower.includes('insufficient funds') ||
    lower.includes('attempt to debit an account') ||
    lower.includes('no record of a prior credit');

  if (isInsufficientFunds) {
    if (operation === 'deposit' || operation === 'yield') {
      return 'Insufficient wallet SOL to complete this transaction.';
    }
    return 'Insufficient vault balance for this operation.';
  }

  return message;
}

type VaultContextValue = {
  state: VaultState;
  dispatch: React.Dispatch<VaultAction>;
  cluster: ClusterOption;
  setCluster: (cluster: ClusterOption) => void;
  clusters: ClusterOption[];
  connectWallet: () => Promise<void>;
  disconnectWallet: () => Promise<void>;
  deposit: (amount: number) => Promise<string>;
  withdraw: (amount: number) => Promise<string>;
  applyYield: (amount: number) => Promise<string>;
  transfer: (amount: number, recipient: string) => Promise<string>;
  refreshVaultMetadata: () => Promise<void>;
  decryptBalance: (handle: string) => Promise<bigint>;
  fetchUserPositionHandle: () => Promise<string>;
  fetchUserEscrowBalance: () => Promise<number>;
  fetchUserYieldIndex: () => Promise<string>;
  claimAccess: () => Promise<string>;
  claimYield: () => Promise<string>;
  createStealthNote: (amount: number, secret: string) => Promise<{ signature: string; noteId: string }>;
  claimStealthNote: (secret: string) => Promise<string>;
  checkStealthNote: (secret: string) => Promise<StealthNoteInfo | null>;
  showWalletModal: boolean;
  setShowWalletModal: (show: boolean) => void;
  handleWalletSelect: (wallet: WalletProvider) => Promise<void>;
};

const VaultContext = createContext<VaultContextValue | undefined>(undefined);

function vaultReducer(state: VaultState, action: VaultAction): VaultState {
  switch (action.type) {
    case 'CONNECT_WALLET':
      return {
        ...state,
        wallet: { address: action.payload, status: 'connected' },
        systemError: null,
      };
    case 'DISCONNECT_WALLET':
      return {
        ...state,
        wallet: { address: null, status: 'disconnected' },
        isRevealed: false,
        vault: {
          ...state.vault,
          totals: { ...state.vault.totals, totalBalance: 0 },
        },
      };
    case 'SET_VAULT_STATUS':
      return {
        ...state,
        vault: {
          ...state.vault,
          status: action.payload,
          lastUpdated: new Date().toISOString(),
        },
      };
    case 'SET_VAULT_METADATA':
      return {
        ...state,
        vault: {
          ...state.vault,
          totals: {
            ...state.vault.totals,
            metadata: action.payload,
          },
          lastUpdated: new Date().toISOString(),
        },
      };
    case 'ADJUST_TOTAL_BALANCE':
      return {
        ...state,
        vault: {
          ...state.vault,
          totals: {
            ...state.vault.totals,
            totalBalance: Math.max(
              state.vault.totals.totalBalance + action.payload,
              0
            ),
          },
          lastUpdated: new Date().toISOString(),
        },
      };
    case 'TOGGLE_REVEAL':
      return {
        ...state,
        isRevealed: !state.isRevealed,
      };
    case 'START_OPERATION':
      return {
        ...state,
        activeOperation: action.payload,
      };
    case 'END_OPERATION':
      return {
        ...state,
        activeOperation: null,
      };
    case 'PUSH_LOG':
      const newLog: SystemLog = {
        ...action.payload,
        id: Math.random().toString(36).substr(2, 9),
        timestamp: new Date().toLocaleTimeString(),
      };
      return {
        ...state,
        logs: [newLog, ...state.logs].slice(0, 50),
      };
    case 'SET_SYSTEM_ERROR':
      return {
        ...state,
        systemError: action.payload,
      };
    case 'CLEAR_LOGS':
      return {
        ...state,
        logs: [],
      };
    default:
      return state;
  }
}

export const VaultProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [state, dispatch] = useReducer(vaultReducer, initialState);
  const vaultServiceRef = useRef<VaultService>(new VaultService());
  const [showWalletModal, setShowWalletModal] = useState(false);
  const clusters: ClusterOption[] = [
    {
      id: 'devnet',
      label: 'Devnet',
      rpcUrl:
        import.meta.env.VITE_RPC_URL ??
        import.meta.env.VITE_DEVNET_RPC_URL ??
        'https://api.devnet.solana.com',
    },
    {
      id: 'testnet',
      label: 'Testnet',
      rpcUrl: import.meta.env.VITE_TESTNET_RPC_URL ?? 'https://api.testnet.solana.com',
    },
    {
      id: 'mainnet-beta',
      label: 'Mainnet',
      rpcUrl: import.meta.env.VITE_MAINNET_RPC_URL ?? 'https://api.mainnet-beta.solana.com',
    },
  ];
  const defaultClusterId = (import.meta.env.VITE_CLUSTER ?? 'devnet') as ClusterId;
  const defaultCluster =
    clusters.find((item) => item.id === defaultClusterId) ?? clusters[0]!;
  const [cluster, setClusterState] = useState<ClusterOption>(defaultCluster);

  const refreshVaultMetadata = useCallback(async () => {
    try {
      const metadata = await vaultServiceRef.current.fetchVaultState();
      dispatch({ type: 'SET_VAULT_METADATA', payload: metadata });
    } catch (err) {
      dispatch({
        type: 'PUSH_LOG',
        payload: {
          level: 'warn',
          code: 'VAULT_META',
          message:
            err instanceof Error
              ? err.message
              : 'Unable to load vault metadata.',
        },
      });
    }
  }, []);

  useEffect(() => {
    vaultServiceRef.current.setRpcEndpoint(cluster.rpcUrl, cluster.id);
  }, [cluster]);

  const setCluster = useCallback((nextCluster: ClusterOption) => {
    setClusterState(nextCluster);
    vaultServiceRef.current.setRpcEndpoint(nextCluster.rpcUrl, nextCluster.id);
    dispatch({ type: 'SET_VAULT_STATUS', payload: 'loading' });
    void refreshVaultMetadata().finally(() =>
      dispatch({ type: 'SET_VAULT_STATUS', payload: 'ready' })
    );
  }, [refreshVaultMetadata]);

  const connectWallet = useCallback(async () => {
    setShowWalletModal(true);
  }, []);

  const handleWalletSelect = useCallback(async (walletProvider: WalletProvider) => {
    dispatch({ type: 'SET_VAULT_STATUS', payload: 'loading' });
    try {
      const address = await vaultServiceRef.current.connectWithProvider(walletProvider.adapter);
      dispatch({ type: 'CONNECT_WALLET', payload: address.toBase58() });
      dispatch({
        type: 'PUSH_LOG',
        payload: {
          level: 'info',
          code: 'WALLET_CONNECTED',
          message: `Connected ${walletProvider.name}: ${address.toBase58().slice(0, 8)}...`,
        },
      });
      await refreshVaultMetadata();
      dispatch({ type: 'SET_VAULT_STATUS', payload: 'ready' });
    } catch (err) {
      dispatch({ type: 'SET_VAULT_STATUS', payload: 'error' });
      dispatch({
        type: 'PUSH_LOG',
        payload: {
          level: 'error',
          code: 'WALLET_FAILURE',
          message: err instanceof Error ? err.message : 'Wallet connection failed.',
        },
      });
      dispatch({
        type: 'SET_SYSTEM_ERROR',
        payload: err instanceof Error ? err.message : 'Wallet connection failed.',
      });
    }
  }, [refreshVaultMetadata]);

  const disconnectWallet = useCallback(async () => {
    await vaultServiceRef.current.disconnect();
    dispatch({ type: 'DISCONNECT_WALLET' });
    dispatch({ type: 'SET_VAULT_STATUS', payload: 'idle' });
    dispatch({
      type: 'PUSH_LOG',
      payload: {
        level: 'info',
        code: 'WALLET_DISCONNECT',
        message: 'Wallet session terminated.',
      },
    });
  }, []);

  const handleOperation = useCallback(
    async (type: OperationType, amount: number) => {
      dispatch({ type: 'START_OPERATION', payload: type });
      try {
        const signature =
          type === 'deposit'
            ? await vaultServiceRef.current.deposit(amount)
            : await vaultServiceRef.current.withdraw(amount);

        dispatch({
          type: 'PUSH_LOG',
          payload: {
            level: 'info',
            code: type === 'deposit' ? 'TX_DEPOSIT' : 'TX_WITHDRAW',
            message: `${type === 'deposit' ? 'Deposit' : 'Withdrawal'} confirmed (${signature.slice(
              0,
              8
            )})`,
          },
        });

        dispatch({
          type: 'ADJUST_TOTAL_BALANCE',
          payload: type === 'deposit' ? amount : -amount,
        });

        await refreshVaultMetadata();
        return signature;
      } catch (err) {
        dispatch({
          type: 'PUSH_LOG',
          payload: {
            level: 'error',
            code: type === 'deposit' ? 'DEPOSIT_FAIL' : 'WITHDRAW_FAIL',
            message: formatOperationError(err, type),
          },
        });
        throw err;
      } finally {
        dispatch({ type: 'END_OPERATION' });
      }
    },
    [refreshVaultMetadata]
  );

  const deposit = useCallback(
    async (amount: number) => handleOperation('deposit', amount),
    [handleOperation]
  );

  const withdraw = useCallback(
    async (amount: number) => handleOperation('withdraw', amount),
    [handleOperation]
  );

  const applyYield = useCallback(async (amount: number): Promise<string> => {
    dispatch({ type: 'START_OPERATION', payload: 'deposit' });
    try {
      const signature = await vaultServiceRef.current.applyYield(amount);
      dispatch({
        type: 'PUSH_LOG',
        payload: {
          level: 'info',
          code: 'YIELD_APPLIED',
          message: `Yield applied successfully (${signature.slice(0, 8)})`,
        },
      });
      await refreshVaultMetadata();
      return signature;
    } catch (err) {
      dispatch({
        type: 'PUSH_LOG',
        payload: {
          level: 'error',
          code: 'YIELD_FAIL',
          message: formatOperationError(err, 'yield'),
        },
      });
      throw err;
    } finally {
      dispatch({ type: 'END_OPERATION' });
    }
  }, [refreshVaultMetadata]);

  const transfer = useCallback(async (amount: number, recipient: string): Promise<string> => {
    dispatch({ type: 'START_OPERATION', payload: 'deposit' });
    try {
      const recipientPubkey = new (await import('@solana/web3.js')).PublicKey(recipient);
      const signature = await vaultServiceRef.current.transfer(amount, recipientPubkey);
      dispatch({
        type: 'PUSH_LOG',
        payload: {
          level: 'info',
          code: 'TRANSFER_SUCCESS',
          message: `Transfer completed (${signature.slice(0, 8)})`,
        },
      });
      await refreshVaultMetadata();
      return signature;
    } catch (err) {
      dispatch({
        type: 'PUSH_LOG',
        payload: {
          level: 'error',
          code: 'TRANSFER_FAIL',
          message: formatOperationError(err, 'transfer'),
        },
      });
      throw err;
    } finally {
      dispatch({ type: 'END_OPERATION' });
    }
  }, [refreshVaultMetadata]);

  const decryptBalance = useCallback(async (handle: string): Promise<bigint> => {
    dispatch({ type: 'START_OPERATION', payload: 'reveal' });
    try {
      const result = await vaultServiceRef.current.decryptBalance(handle);
      dispatch({
        type: 'PUSH_LOG',
        payload: {
          level: 'info',
          code: 'DECRYPT_SUCCESS',
          message: 'Encrypted balance decrypted via Inco attested reveal.',
        },
      });
      return result.value;
    } catch (err) {
      dispatch({
        type: 'PUSH_LOG',
        payload: {
          level: 'error',
          code: 'DECRYPT_FAIL',
          message: err instanceof Error ? err.message : 'Decryption failed.',
        },
      });
      throw err;
    } finally {
      dispatch({ type: 'END_OPERATION' });
    }
  }, []);

  const fetchUserPositionHandle = useCallback(async (): Promise<string> => {
    try {
      const handle = await vaultServiceRef.current.fetchUserPositionHandle();
      return handle;
    } catch (err) {
      dispatch({
        type: 'PUSH_LOG',
        payload: {
          level: 'warn',
          code: 'USER_POSITION',
          message: err instanceof Error ? err.message : 'Unable to load user position.',
        },
      });
      throw err;
    }
  }, []);

  const fetchUserEscrowBalance = useCallback(async (): Promise<number> => {
    try {
      return await vaultServiceRef.current.fetchUserEscrowBalance();
    } catch (err) {
      dispatch({
        type: 'PUSH_LOG',
        payload: {
          level: 'warn',
          code: 'ESCROW_BALANCE',
          message: err instanceof Error ? err.message : 'Unable to load escrow balance.',
        },
      });
      throw err;
    }
  }, []);

  const fetchUserYieldIndex = useCallback(async (): Promise<string> => {
    try {
      return await vaultServiceRef.current.fetchUserYieldIndex();
    } catch (err) {
      dispatch({
        type: 'PUSH_LOG',
        payload: {
          level: 'warn',
          code: 'YIELD_INDEX',
          message: err instanceof Error ? err.message : 'Unable to load yield index.',
        },
      });
      throw err;
    }
  }, []);

  const claimYield = useCallback(async (): Promise<string> => {
    dispatch({ type: 'START_OPERATION', payload: 'reveal' });
    try {
      const signature = await vaultServiceRef.current.claimYield();
      dispatch({
        type: 'PUSH_LOG',
        payload: {
          level: 'info',
          code: 'YIELD_CLAIMED',
          message: `Yield claimed (${signature.slice(0, 8)})`,
        },
      });
      await refreshVaultMetadata();
      return signature;
    } catch (err) {
      dispatch({
        type: 'PUSH_LOG',
        payload: {
          level: 'error',
          code: 'YIELD_CLAIM_FAIL',
          message: err instanceof Error ? err.message : 'Yield claim failed.',
        },
      });
      throw err;
    } finally {
      dispatch({ type: 'END_OPERATION' });
    }
  }, [refreshVaultMetadata]);

  const claimAccess = useCallback(async (): Promise<string> => {
    dispatch({ type: 'START_OPERATION', payload: 'reveal' });
    try {
      const signature = await vaultServiceRef.current.claimAccess();
      dispatch({
        type: 'PUSH_LOG',
        payload: {
          level: 'info',
          code: 'CLAIM_SUCCESS',
          message: `Decrypt access claimed (${signature.slice(0, 8)})`,
        },
      });
      return signature;
    } catch (err) {
      dispatch({
        type: 'PUSH_LOG',
        payload: {
          level: 'error',
          code: 'CLAIM_FAIL',
          message: err instanceof Error ? err.message : 'Failed to claim access.',
        },
      });
      throw err;
    } finally {
      dispatch({ type: 'END_OPERATION' });
    }
  }, []);

  const createStealthNote = useCallback(async (amount: number, secret: string): Promise<{ signature: string; noteId: string }> => {
    dispatch({ type: 'START_OPERATION', payload: 'deposit' });
    try {
      const result = await vaultServiceRef.current.createStealthNote(amount, secret);
      dispatch({
        type: 'PUSH_LOG',
        payload: {
          level: 'info',
          code: 'STEALTH_NOTE_CREATED',
          message: `Stealth note created (${result.signature.slice(0, 8)})`,
        },
      });
      await refreshVaultMetadata();
      return result;
    } catch (err) {
      dispatch({
        type: 'PUSH_LOG',
        payload: {
          level: 'error',
          code: 'STEALTH_NOTE_FAIL',
          message: err instanceof Error ? err.message : 'Failed to create stealth note.',
        },
      });
      throw err;
    } finally {
      dispatch({ type: 'END_OPERATION' });
    }
  }, [refreshVaultMetadata]);

  const claimStealthNote = useCallback(async (secret: string): Promise<string> => {
    dispatch({ type: 'START_OPERATION', payload: 'deposit' });
    try {
      const signature = await vaultServiceRef.current.claimStealthNote(secret);
      dispatch({
        type: 'PUSH_LOG',
        payload: {
          level: 'info',
          code: 'STEALTH_NOTE_CLAIMED',
          message: `Stealth note claimed (${signature.slice(0, 8)})`,
        },
      });
      await refreshVaultMetadata();
      return signature;
    } catch (err) {
      dispatch({
        type: 'PUSH_LOG',
        payload: {
          level: 'error',
          code: 'STEALTH_CLAIM_FAIL',
          message: err instanceof Error ? err.message : 'Failed to claim stealth note.',
        },
      });
      throw err;
    } finally {
      dispatch({ type: 'END_OPERATION' });
    }
  }, [refreshVaultMetadata]);

  const checkStealthNote = useCallback(async (secret: string): Promise<StealthNoteInfo | null> => {
    try {
      return await vaultServiceRef.current.checkStealthNote(secret);
    } catch (err) {
      dispatch({
        type: 'PUSH_LOG',
        payload: {
          level: 'warn',
          code: 'STEALTH_CHECK',
          message: err instanceof Error ? err.message : 'Unable to check stealth note.',
        },
      });
      return null;
    }
  }, []);

  return (
    <VaultContext.Provider
      value={{
        state,
        dispatch,
        cluster,
        setCluster,
        clusters,
        connectWallet,
        disconnectWallet,
        deposit,
        withdraw,
        applyYield,
        transfer,
        refreshVaultMetadata,
        decryptBalance,
        fetchUserPositionHandle,
        fetchUserEscrowBalance,
        fetchUserYieldIndex,
        claimAccess,
        claimYield,
        createStealthNote,
        claimStealthNote,
        checkStealthNote,
        showWalletModal,
        setShowWalletModal,
        handleWalletSelect,
      }}
    >
      {children}
    </VaultContext.Provider>
  );
};

export const useVault = () => {
  const context = useContext(VaultContext);
  if (context === undefined) {
    throw new Error('useVault must be used within a VaultProvider');
  }
  return context;
};
