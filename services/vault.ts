import {
  Connection,
  PublicKey,
  SystemProgram,
  SimulatedTransactionResponse,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js';

// Inco SDK imports
import { encryptValue } from '@inco/solana-sdk/encryption';
import { hexToBuffer } from '@inco/solana-sdk/utils';
// Use browser-compatible decrypt instead of @inco/solana-sdk/attested-decrypt
import { browserDecrypt } from './inco-decrypt';

const DEFAULT_RPC_ENDPOINT = import.meta.env.VITE_RPC_URL ?? 'https://api.devnet.solana.com';
const DEFAULT_CLUSTER = import.meta.env.VITE_CLUSTER ?? 'devnet';

// TODO: Replace with your actual deployed program ID from Anchor build
const PROGRAM_ID = new PublicKey('DmfUVqYJ5DG1iWww8YXt75zsB6RdmMws5qQMBWH4ofvC');

// Inco Lightning Program ID (official)
const INCO_LIGHTNING_ID = new PublicKey('5sjEbPiqgZrYwR31ahR6Uk9wf5awoX61YGg7jExQSwaj');

const SEED_VAULT = new TextEncoder().encode('vault_v2');
const SEED_USER = new TextEncoder().encode('user_v2');

const SEED_STEALTH_NOTE = new TextEncoder().encode('stealth_note');

type InstructionName = 'initialize_vault' | 'deposit' | 'withdraw' | 'apply_yield' | 'transfer' | 'claim_access' | 'claim_yield' | 'create_stealth_note' | 'claim_stealth_note';

// Anchor instruction discriminators (first 8 bytes of sha256("global:<instruction_name>"))
const INSTRUCTION_DISCRIMINATORS: Record<InstructionName, Uint8Array> = {
  initialize_vault: hexToBytes('30bfa32c47813fa4'),
  deposit: hexToBytes('f223c68952e1f2b6'),
  withdraw: hexToBytes('b712469c946da122'),
  apply_yield: hexToBytes('6e7ea020cbc9228f'),
  transfer: hexToBytes('a334c8e78c0345ba'),
  claim_access: hexToBytes('0e67cbb5aa3873da'), // [14, 103, 203, 181, 170, 56, 115, 218]
  claim_yield: hexToBytes('314a6f07ba163da5'), // [49, 74, 111, 7, 186, 22, 61, 165]
  create_stealth_note: hexToBytes('4b5aad640e9e1898'),
  claim_stealth_note: hexToBytes('d3fe1d44d7b68a40'),
};

export interface VaultMetadataSummary {
  authority: string;
  bump: number;
  encryptedBalanceHandle: string; // decimal string (bigint)
  encryptedBalanceHandleHexLE: string; // little-endian 16-byte hex for debugging
  totalEscrowLamports: number;
  yieldIndex: string;
}

export interface DecryptedBalance {
  value: bigint;
}

export interface StealthNoteInfo {
  noteId: string; // hex string of the 32-byte note ID
  encryptedAmountHandle: string;
  lamports: number;
  sender: string;
  createdAt: number;
  claimed: boolean;
}

interface PhantomProvider {
  isPhantom?: boolean;
  publicKey?: PublicKey;
  isConnected?: boolean;
  connect: () => Promise<{ publicKey: PublicKey }>;
  disconnect: () => Promise<void>;
  signTransaction: (transaction: Transaction) => Promise<Transaction>;
  signAllTransactions?: (transactions: Transaction[]) => Promise<Transaction[]>;
  signMessage: (message: Uint8Array) => Promise<{ signature: Uint8Array }>;
}

declare global {
  interface Window {
    solana?: PhantomProvider;
  }
}

class VaultService {
  private connection = new Connection(DEFAULT_RPC_ENDPOINT, 'confirmed');
  private wallet?: PhantomProvider;
  private publicKey?: PublicKey;
  private cluster = DEFAULT_CLUSTER;

  setRpcEndpoint(endpoint: string, cluster: string) {
    this.connection = new Connection(endpoint, 'confirmed');
    this.cluster = cluster;
  }

  async connect(): Promise<PublicKey> {
    if (typeof window === 'undefined') {
      throw new Error('Wallet connection requires a browser environment.');
    }

    const provider = window.solana;
    if (!provider) {
      throw new Error('No Solana wallet is installed.');
    }

    const response = await provider.connect();
    const publicKey = response?.publicKey ?? provider.publicKey;
    if (!publicKey) {
      throw new Error('Wallet connection did not return a public key.');
    }
    this.wallet = provider;
    this.publicKey = publicKey;
    return publicKey;
  }

  /**
   * Connect with a specific wallet provider (Phantom, Solflare, Trust, etc.)
   */
  async connectWithProvider(provider: any): Promise<PublicKey> {
    if (!provider) {
      throw new Error('Wallet provider not available.');
    }

    const response = await provider.connect();
    const publicKey = response?.publicKey ?? provider.publicKey;
    if (!publicKey) {
      throw new Error('Wallet connection did not return a public key.');
    }
    this.wallet = provider;
    this.publicKey = publicKey;
    return publicKey;
  }

  async disconnect(): Promise<void> {
    if (this.wallet) {
      await this.wallet.disconnect();
    }
    this.wallet = undefined;
    this.publicKey = undefined;
  }

  /**
   * Deposit SOL into the confidential vault
   * @param amount Amount in SOL (will be converted to lamports and encrypted)
   */
  async deposit(amount: number): Promise<string> {
    return this.submitEncryptedOperation('deposit', amount);
  }

  /**
   * Withdraw SOL from the confidential vault
   * @param amount Amount in SOL (will be converted to lamports and encrypted)
   */
  async withdraw(amount: number): Promise<string> {
    return this.submitEncryptedOperation('withdraw', amount);
  }

  /**
   * Apply yield to the vault (authority only)
   * @param amount Amount in SOL to add as yield
   */
  async applyYield(amount: number): Promise<string> {
    if (!this.publicKey || !this.wallet) {
      throw new Error('Connect a wallet before applying yield.');
    }

    const lamports = BigInt(Math.round(amount * 1_000_000_000));
    const encryptedHex = await encryptValue(lamports);
    const encryptedBuffer = hexToBuffer(encryptedHex);

    const [vaultPda] = PublicKey.findProgramAddressSync([SEED_VAULT], PROGRAM_ID);

    const payload = this.concatBytes(
      this.serializeVector(encryptedBuffer),
      this.serializeU64(lamports)
    );
    const instructionData = this.buildInstructionData('apply_yield', payload);

    const ix = new TransactionInstruction({
      programId: PROGRAM_ID,
      keys: [
        { pubkey: vaultPda, isSigner: false, isWritable: true },
        { pubkey: this.publicKey, isSigner: true, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: INCO_LIGHTNING_ID, isSigner: false, isWritable: false },
      ],
      data: instructionData,
    });

    return this.sendTransaction(ix);
  }

  /**
   * Transfer SOL to another user within the vault
   * @param amount Amount in SOL to transfer
   * @param recipient Recipient's public key
   */
  async transfer(amount: number, recipient: PublicKey): Promise<string> {
    if (!this.publicKey || !this.wallet) {
      throw new Error('Connect a wallet before transferring.');
    }

    console.log(`[Vault] Starting transfer of ${amount} SOL to ${recipient.toBase58()}`);

    const lamports = BigInt(Math.round(amount * 1_000_000_000));
    console.log(`[Vault] Encrypting ${lamports} lamports...`);
    const encryptedHex = await encryptValue(lamports);
    const encryptedBuffer = hexToBuffer(encryptedHex);
    console.log(`[Vault] Encryption complete, ciphertext length: ${encryptedHex.length}`);

    const [senderPda] = PublicKey.findProgramAddressSync(
      [SEED_USER, this.publicKey.toBuffer()],
      PROGRAM_ID
    );
    const [recipientPda] = PublicKey.findProgramAddressSync(
      [SEED_USER, recipient.toBuffer()],
      PROGRAM_ID
    );
    console.log(`[Vault] Sender PDA: ${senderPda.toBase58()}`);
    console.log(`[Vault] Recipient PDA: ${recipientPda.toBase58()}`);

    const senderEscrowLamports = await this.connection.getBalance(senderPda);
    if (senderEscrowLamports < Number(lamports)) {
      throw new Error('Insufficient vault balance for this transfer.');
    }

    const [vaultPda] = PublicKey.findProgramAddressSync([SEED_VAULT], PROGRAM_ID);

    const payload = this.concatBytes(
      this.serializeVector(encryptedBuffer),
      this.serializeU64(lamports)
    );
    const instructionData = this.buildInstructionData('transfer', payload);

    // 1) Simulate to get the NEW resulting handles for both sender and recipient
    const simulationIx = new TransactionInstruction({
      programId: PROGRAM_ID,
      keys: [
        { pubkey: vaultPda, isSigner: false, isWritable: true },
        { pubkey: senderPda, isSigner: false, isWritable: true },
        { pubkey: recipientPda, isSigner: false, isWritable: true },
        { pubkey: this.publicKey, isSigner: true, isWritable: true },
        { pubkey: recipient, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: INCO_LIGHTNING_ID, isSigner: false, isWritable: false },
      ],
      data: instructionData,
    });

    console.log('[Vault] Simulating transfer to get handles for auto-authorization...');
    const { senderHandle, recipientHandle } = await this.simulateTransferAndGetHandles(
      simulationIx,
      senderPda,
      recipientPda
    );
    console.log(`[Vault] Simulation complete - Sender handle: ${senderHandle}, Recipient handle: ${recipientHandle}`);

    const [allowanceSender] = findAllowancePda(senderHandle, this.publicKey);
    const [allowanceRecipient] = findAllowancePda(recipientHandle, recipient);

    // 2) Send the real tx with remaining accounts
    // IMPORTANT: The remaining_accounts order must match what the program expects:
    // [0] allowance_sender (mut)
    // [1] allowed_address for sender (readonly) - sender pubkey
    // [2] allowance_recipient (mut)
    // [3] allowed_address for recipient (readonly) - recipient pubkey
    const realIx = new TransactionInstruction({
      programId: PROGRAM_ID,
      keys: [
        { pubkey: vaultPda, isSigner: false, isWritable: true },
        { pubkey: senderPda, isSigner: false, isWritable: true },
        { pubkey: recipientPda, isSigner: false, isWritable: true },
        { pubkey: this.publicKey, isSigner: true, isWritable: true },
        { pubkey: recipient, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: INCO_LIGHTNING_ID, isSigner: false, isWritable: false },
        // remaining_accounts for auto-authorize allow() CPIs:
        { pubkey: allowanceSender, isSigner: false, isWritable: true },
        { pubkey: this.publicKey, isSigner: false, isWritable: false },
        { pubkey: allowanceRecipient, isSigner: false, isWritable: true },
        { pubkey: recipient, isSigner: false, isWritable: false },
      ],
      data: instructionData,
    });

    console.log('[Vault] Sending transfer transaction with auto-authorize...');
    const txSig = await this.sendTransaction(realIx);
    console.log(`[Vault] Transfer complete! Signature: ${txSig}`);
    console.log(`[Vault] View on explorer: https://explorer.solana.com/tx/${txSig}?cluster=${this.cluster}`);
    return txSig;
  }

  /**
   * Fetch vault state (authority, bump, encrypted balance handle)
   */
  async fetchVaultState(): Promise<VaultMetadataSummary> {
    const [vaultPda] = PublicKey.findProgramAddressSync(
      [SEED_VAULT],
      PROGRAM_ID
    );
    try {
      const accountInfo = await this.connection.getAccountInfo(vaultPda);
      if (!accountInfo) {
        throw new Error('Vault has not been initialized yet.');
      }

      // Parse vault account data:
      // - 8 bytes: discriminator
      // - 32 bytes: authority pubkey
      // - 16 bytes: Euint128 handle
      // - 8 bytes: total_escrow_lamports (u64 LE)
      // - 16 bytes: yield_index (u128 LE)
      // - 1 byte: bump
      const data = accountInfo.data;
      const authority = new PublicKey(data.slice(8, 40)).toBase58();
      const handle = parseEuint128HandleFromAccountData(data);
      const totalEscrowLamports = new DataView(data.buffer, data.byteOffset + 56, 8).getBigUint64(0, true);
      const yieldIndexBytes = data.slice(64, 80);
      let yieldIndex = 0n;
      for (let i = yieldIndexBytes.length - 1; i >= 0; i--) {
        yieldIndex = yieldIndex * 256n + BigInt(yieldIndexBytes[i]!);
      }
      const bump = data[80] ?? 0;

      return {
        authority,
        bump,
        encryptedBalanceHandle: handle.toString(),
        encryptedBalanceHandleHexLE: bytesToHex(data.slice(40, 56)),
        totalEscrowLamports: Number(totalEscrowLamports),
        yieldIndex: yieldIndex.toString(),
      };
    } catch (err) {
      if (err instanceof TypeError && err.message === 'Failed to fetch') {
        throw new Error('Network error: Unable to connect to Solana RPC. Please check your internet connection or try a different RPC.');
      }
      throw err;
    }
  }

  /**
   * Fetch the user's position account (if created) and return its encrypted balance handle
   */
  async fetchUserPositionHandle(): Promise<string> {
    if (!this.publicKey) {
      throw new Error('Connect a wallet before fetching user position.');
    }
    const [userPda] = PublicKey.findProgramAddressSync(
      [SEED_USER, this.publicKey.toBuffer()],
      PROGRAM_ID
    );
    const accountInfo = await this.connection.getAccountInfo(userPda);
    if (!accountInfo) {
      throw new Error('User position not found (make a deposit first).');
    }
    const handle = parseEuint128HandleFromAccountData(accountInfo.data);
    return handle.toString();
  }

  /**
   * Fetch the user's escrowed SOL balance (lamports) held in the UserPosition PDA.
   */
  async fetchUserEscrowBalance(): Promise<number> {
    if (!this.publicKey) {
      throw new Error('Connect a wallet before fetching escrow balance.');
    }
    const [userPda] = PublicKey.findProgramAddressSync(
      [SEED_USER, this.publicKey.toBuffer()],
      PROGRAM_ID
    );
    try {
      const lamports = await this.connection.getBalance(userPda);
      return lamports / 1_000_000_000;
    } catch (err) {
      if (err instanceof TypeError && err.message === 'Failed to fetch') {
        throw new Error('Network error: Unable to fetch escrow balance.');
      }
      throw err;
    }
  }

  /**
   * Fetch user's last_yield_index from their UserPosition account.
   */
  async fetchUserYieldIndex(): Promise<string> {
    if (!this.publicKey) {
      throw new Error('Connect a wallet before fetching yield index.');
    }
    const [userPda] = PublicKey.findProgramAddressSync(
      [SEED_USER, this.publicKey.toBuffer()],
      PROGRAM_ID
    );
    const accountInfo = await this.connection.getAccountInfo(userPda);
    if (!accountInfo) {
      throw new Error('User position not found.');
    }
    // Layout:
    // 0..8 discriminator
    // 8..40 owner
    // 40..56 encrypted_balance handle
    // 56..72 last_yield_index (u128 LE)
    // 72..73 bump
    const data = accountInfo.data;
    const indexBytes = data.slice(56, 72);
    let yieldIndex = 0n;
    for (let i = indexBytes.length - 1; i >= 0; i--) {
      yieldIndex = yieldIndex * 256n + BigInt(indexBytes[i]!);
    }
    return yieldIndex.toString();
  }

  /**
   * Claim any pending yield for the connected user.
   */
  async claimYield(): Promise<string> {
    if (!this.publicKey || !this.wallet) {
      throw new Error('Connect a wallet before claiming yield.');
    }
    const [vaultPda] = PublicKey.findProgramAddressSync([SEED_VAULT], PROGRAM_ID);
    const [userPda] = PublicKey.findProgramAddressSync(
      [SEED_USER, this.publicKey.toBuffer()],
      PROGRAM_ID
    );
    const instructionData = this.buildInstructionData('claim_yield');
    const ix = new TransactionInstruction({
      programId: PROGRAM_ID,
      keys: [
        { pubkey: vaultPda, isSigner: false, isWritable: true },
        { pubkey: userPda, isSigner: false, isWritable: true },
        { pubkey: this.publicKey, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: INCO_LIGHTNING_ID, isSigner: false, isWritable: false },
      ],
      data: instructionData,
    });
    return this.sendTransaction(ix);
  }

  /**
   * Claim decrypt access to your own balance handle.
   * Call this after receiving a transfer to be able to decrypt your balance.
   */
  async claimAccess(): Promise<string> {
    if (!this.publicKey || !this.wallet) {
      throw new Error('Connect a wallet before claiming access.');
    }

    console.log('[Vault] Claiming decrypt access for user:', this.publicKey.toBase58());

    // Get user's position PDA
    const [userPda] = PublicKey.findProgramAddressSync(
      [SEED_USER, this.publicKey.toBuffer()],
      PROGRAM_ID
    );

    // Fetch the user's current balance handle
    const accountInfo = await this.connection.getAccountInfo(userPda);
    if (!accountInfo) {
      throw new Error('User position not found. You need to receive a transfer or make a deposit first.');
    }
    const handle = parseEuint128HandleFromAccountData(accountInfo.data);
    console.log('[Vault] Current balance handle:', handle.toString());

    // Derive the allowance PDA for this handle and user
    const [allowancePda] = findAllowancePda(handle, this.publicKey);
    console.log('[Vault] Allowance PDA:', allowancePda.toBase58());

    // Build the claim_access instruction (no args, just discriminator)
    const instructionData = this.buildInstructionData('claim_access');

    const ix = new TransactionInstruction({
      programId: PROGRAM_ID,
      keys: [
        { pubkey: userPda, isSigner: false, isWritable: false },
        { pubkey: this.publicKey, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: INCO_LIGHTNING_ID, isSigner: false, isWritable: false },
        // remaining_accounts for allow() CPI:
        { pubkey: allowancePda, isSigner: false, isWritable: true },
        { pubkey: this.publicKey, isSigner: false, isWritable: false },
      ],
      data: instructionData,
    });

    console.log('[Vault] Sending claim_access transaction...');
    const txSig = await this.sendTransaction(ix);
    console.log('[Vault] Claim access complete! Signature:', txSig);
    return txSig;
  }

  /**
   * Generate a note ID from a secret passphrase using SHA256
   */
  async generateNoteId(secret: string): Promise<Uint8Array> {
    const encoder = new TextEncoder();
    const data = encoder.encode(secret);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return new Uint8Array(hashBuffer);
  }

  /**
   * Create a stealth note - send funds to a secret identifier instead of a public address.
   * The recipient can claim by knowing the secret passphrase.
   * @param amount Amount in SOL to send
   * @param secret The secret passphrase (will be hashed to create note ID)
   * @returns Transaction signature and the note ID (hex)
   */
  async createStealthNote(amount: number, secret: string): Promise<{ signature: string; noteId: string }> {
    if (!this.publicKey || !this.wallet) {
      throw new Error('Connect a wallet before creating a stealth note.');
    }

    console.log(`[Vault] Creating stealth note with ${amount} SOL...`);

    // Generate note ID from secret
    const noteId = await this.generateNoteId(secret);
    const noteIdHex = bytesToHex(noteId);
    console.log(`[Vault] Note ID (hash of secret): ${noteIdHex}`);

    // Convert SOL to lamports and encrypt
    const lamports = BigInt(Math.round(amount * 1_000_000_000));
    console.log(`[Vault] Encrypting ${lamports} lamports...`);
    const encryptedHex = await encryptValue(lamports);
    const encryptedBuffer = hexToBuffer(encryptedHex);
    console.log(`[Vault] Encryption complete, ciphertext length: ${encryptedHex.length}`);

    // Check wallet balance
    const walletLamports = await this.connection.getBalance(this.publicKey);
    const feeBuffer = 0.01 * 1_000_000_000;
    if (walletLamports < Number(lamports) + feeBuffer) {
      throw new Error('Insufficient wallet SOL to create this stealth note.');
    }

    // Derive the stealth note PDA
    const [stealthNotePda] = PublicKey.findProgramAddressSync(
      [SEED_STEALTH_NOTE, noteId],
      PROGRAM_ID
    );
    console.log(`[Vault] Stealth Note PDA: ${stealthNotePda.toBase58()}`);

    // Build instruction data: discriminator + note_id (32 bytes) + Vec<u8> encrypted + lamports (u64)
    const payload = this.concatBytes(
      noteId,
      this.serializeVector(encryptedBuffer),
      this.serializeU64(lamports)
    );
    const instructionData = this.buildInstructionData('create_stealth_note', payload);

    const ix = new TransactionInstruction({
      programId: PROGRAM_ID,
      keys: [
        { pubkey: stealthNotePda, isSigner: false, isWritable: true },
        { pubkey: this.publicKey, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: INCO_LIGHTNING_ID, isSigner: false, isWritable: false },
      ],
      data: instructionData,
    });

    console.log('[Vault] Sending create_stealth_note transaction...');
    const signature = await this.sendTransaction(ix);
    console.log(`[Vault] Stealth note created! Signature: ${signature}`);
    console.log(`[Vault] Share this secret with the recipient: "${secret}"`);

    return { signature, noteId: noteIdHex };
  }

  /**
   * Claim a stealth note by providing the secret passphrase.
   * The secret is hashed and matched against the note ID.
   * @param secret The secret passphrase shared by the sender
   */
  async claimStealthNote(secret: string): Promise<string> {
    if (!this.publicKey || !this.wallet) {
      throw new Error('Connect a wallet before claiming a stealth note.');
    }

    console.log(`[Vault] Claiming stealth note with secret...`);

    // Generate note ID from secret
    const noteId = await this.generateNoteId(secret);
    const noteIdHex = bytesToHex(noteId);
    console.log(`[Vault] Note ID (hash of secret): ${noteIdHex}`);

    // Derive PDAs
    const [vaultPda] = PublicKey.findProgramAddressSync([SEED_VAULT], PROGRAM_ID);
    const [stealthNotePda] = PublicKey.findProgramAddressSync(
      [SEED_STEALTH_NOTE, noteId],
      PROGRAM_ID
    );
    const [claimerPda] = PublicKey.findProgramAddressSync(
      [SEED_USER, this.publicKey.toBuffer()],
      PROGRAM_ID
    );

    console.log(`[Vault] Stealth Note PDA: ${stealthNotePda.toBase58()}`);
    console.log(`[Vault] Claimer Position PDA: ${claimerPda.toBase58()}`);

    // Check if the note exists and is not claimed
    const noteInfo = await this.connection.getAccountInfo(stealthNotePda);
    if (!noteInfo) {
      throw new Error('Stealth note not found. Check if the secret is correct.');
    }

    // Parse the note to check if claimed
    const claimed = noteInfo.data[88] === 1; // claimed is at offset 88 (8+32+16+8+32+8+1-1)
    if (claimed) {
      throw new Error('This stealth note has already been claimed.');
    }

    // Build instruction data: discriminator + Vec<u8> secret
    const secretBytes = new TextEncoder().encode(secret);
    const payload = this.serializeVector(secretBytes);
    const instructionData = this.buildInstructionData('claim_stealth_note', payload);

    // First, simulate to get the handles for auto-authorization
    const simulationIx = new TransactionInstruction({
      programId: PROGRAM_ID,
      keys: [
        { pubkey: vaultPda, isSigner: false, isWritable: true },
        { pubkey: stealthNotePda, isSigner: false, isWritable: true },
        { pubkey: claimerPda, isSigner: false, isWritable: true },
        { pubkey: this.publicKey, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: INCO_LIGHTNING_ID, isSigner: false, isWritable: false },
      ],
      data: instructionData,
    });

    console.log('[Vault] Simulating claim to get handles for auto-authorization...');
    let claimerHandle: bigint;
    let vaultHandle: bigint;

    try {
      const handles = await this.simulateClaimAndGetHandles(simulationIx, claimerPda, vaultPda);
      claimerHandle = handles.claimerHandle;
      vaultHandle = handles.vaultHandle;
      console.log(`[Vault] Simulation complete - Claimer handle: ${claimerHandle}, Vault handle: ${vaultHandle}`);
    } catch (simError) {
      console.warn('[Vault] Simulation failed, sending without auto-authorize:', simError);
      // Fall back to direct transaction without auto-authorize
      const ix = new TransactionInstruction({
        programId: PROGRAM_ID,
        keys: [
          { pubkey: vaultPda, isSigner: false, isWritable: true },
          { pubkey: stealthNotePda, isSigner: false, isWritable: true },
          { pubkey: claimerPda, isSigner: false, isWritable: true },
          { pubkey: this.publicKey, isSigner: true, isWritable: true },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
          { pubkey: INCO_LIGHTNING_ID, isSigner: false, isWritable: false },
        ],
        data: instructionData,
      });
      return this.sendTransaction(ix);
    }

    const [allowanceClaimer] = findAllowancePda(claimerHandle, this.publicKey);
    const [allowanceVault] = findAllowancePda(vaultHandle, this.publicKey);

    // Send the real tx with remaining accounts for auto-authorize
    const realIx = new TransactionInstruction({
      programId: PROGRAM_ID,
      keys: [
        { pubkey: vaultPda, isSigner: false, isWritable: true },
        { pubkey: stealthNotePda, isSigner: false, isWritable: true },
        { pubkey: claimerPda, isSigner: false, isWritable: true },
        { pubkey: this.publicKey, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: INCO_LIGHTNING_ID, isSigner: false, isWritable: false },
        // remaining_accounts for auto-authorize allow() CPIs:
        { pubkey: allowanceClaimer, isSigner: false, isWritable: true },
        { pubkey: this.publicKey, isSigner: false, isWritable: false },
        { pubkey: allowanceVault, isSigner: false, isWritable: true },
        { pubkey: this.publicKey, isSigner: false, isWritable: false },
      ],
      data: instructionData,
    });

    console.log('[Vault] Sending claim_stealth_note transaction with auto-authorize...');
    const txSig = await this.sendTransaction(realIx);
    console.log(`[Vault] Stealth note claimed! Signature: ${txSig}`);
    return txSig;
  }

  /**
   * Fetch stealth note information by note ID (hex string)
   */
  async fetchStealthNote(noteIdHex: string): Promise<StealthNoteInfo | null> {
    const noteId = hexToBytes(noteIdHex);
    const [stealthNotePda] = PublicKey.findProgramAddressSync(
      [SEED_STEALTH_NOTE, noteId],
      PROGRAM_ID
    );

    const accountInfo = await this.connection.getAccountInfo(stealthNotePda);
    if (!accountInfo) {
      return null;
    }

    // Parse StealthNote account:
    // 0..8: discriminator
    // 8..40: note_id (32 bytes)
    // 40..56: encrypted_amount handle (16 bytes)
    // 56..64: lamports (u64 LE)
    // 64..96: sender (32 bytes)
    // 96..104: created_at (i64 LE)
    // 104..105: claimed (bool)
    // 105..106: bump
    const data = accountInfo.data;
    const handle = parseEuint128HandleFromStealthNote(data);
    const lamports = new DataView(data.buffer, data.byteOffset + 56, 8).getBigUint64(0, true);
    const sender = new PublicKey(data.slice(64, 96)).toBase58();
    const createdAt = new DataView(data.buffer, data.byteOffset + 96, 8).getBigInt64(0, true);
    const claimed = data[104] === 1;

    return {
      noteId: noteIdHex,
      encryptedAmountHandle: handle.toString(),
      lamports: Number(lamports),
      sender,
      createdAt: Number(createdAt),
      claimed,
    };
  }

  /**
   * Check if a stealth note exists for a given secret
   */
  async checkStealthNote(secret: string): Promise<StealthNoteInfo | null> {
    const noteId = await this.generateNoteId(secret);
    const noteIdHex = bytesToHex(noteId);
    return this.fetchStealthNote(noteIdHex);
  }

  /**
   * Decrypt an encrypted balance handle using Inco's attested reveal
   * Requires wallet signature for authorization
   */
  async decryptBalance(handle: string): Promise<DecryptedBalance> {
    if (!this.wallet || !this.publicKey) {
      throw new Error('Wallet must be connected to decrypt values.');
    }

    console.log('[Vault] Decrypting balance for handle:', handle);
    
    const result = await browserDecrypt([handle], {
      address: this.publicKey,
      signMessage: async (message: Uint8Array) => {
        const { signature } = await this.wallet!.signMessage(message);
        return signature;
      },
    });

    console.log('[Vault] Decryption successful, plaintext:', result.plaintexts[0]);

    return {
      value: result.plaintexts[0] as bigint,
    };
  }

  /**
   * Encrypt a value and submit to the program
   */
  private async submitEncryptedOperation(
    instructionName: 'deposit' | 'withdraw',
    amount: number
  ): Promise<string> {
    if (!this.publicKey || !this.wallet) {
      throw new Error('Connect a wallet before sending transactions.');
    }

    // Convert SOL to lamports
    const lamports = BigInt(Math.round(amount * 1_000_000_000));

    // Encrypt the amount using Inco SDK with timeout
    console.log(`[Vault] Encrypting ${amount} SOL (${lamports} lamports)...`);
    let encryptedHex: string;
    try {
      const encryptPromise = encryptValue(lamports);
      const timeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Encryption timed out after 30s. Inco service may be unavailable.')), 30000)
      );
      encryptedHex = await Promise.race([encryptPromise, timeoutPromise]);
      console.log(`[Vault] Encryption successful, ciphertext length: ${encryptedHex.length}`);
    } catch (err) {
      console.error('[Vault] Encryption failed:', err);
      throw new Error(`Encryption failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
    const encryptedBuffer = hexToBuffer(encryptedHex);

    // Build PDAs
    const [vaultPda] = PublicKey.findProgramAddressSync(
      [SEED_VAULT],
      PROGRAM_ID
    );
    const [userPda] = PublicKey.findProgramAddressSync(
      [SEED_USER, this.publicKey.toBuffer()],
      PROGRAM_ID
    );

    if (instructionName === 'deposit') {
      const walletLamports = await this.connection.getBalance(this.publicKey);
      // Basic fee buffer: ~0.01 SOL to avoid user confusion on low balances
      const feeBuffer = 0.01 * 1_000_000_000;
      if (walletLamports < Number(lamports) + feeBuffer) {
        throw new Error('Insufficient wallet SOL to deposit this amount.');
      }
    } else {
      const escrowLamports = await this.connection.getBalance(userPda);
      if (escrowLamports < Number(lamports)) {
        throw new Error('Insufficient vault balance for this withdrawal.');
      }
    }

    // Build instruction data: discriminator + borsh Vec<u8> + lamports (u64)
    const payload = this.concatBytes(
      this.serializeVector(encryptedBuffer),
      this.serializeU64(lamports)
    );
    const instructionData = this.buildInstructionData(instructionName, payload);

    // For withdrawals, skip simulation and auto-authorize entirely.
    // FHE handles are nondeterministic, so simulation handles differ from actual tx handles.
    // Users must call claimAccess() after withdrawal to get decrypt permissions.
    if (instructionName === 'withdraw') {
      console.log('[Vault] Sending withdrawal transaction (no auto-authorize)...');
      const ix = new TransactionInstruction({
        programId: PROGRAM_ID,
        keys: [
          { pubkey: vaultPda, isSigner: false, isWritable: true },
          { pubkey: userPda, isSigner: false, isWritable: true },
          { pubkey: this.publicKey, isSigner: true, isWritable: true },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
          { pubkey: INCO_LIGHTNING_ID, isSigner: false, isWritable: false },
        ],
        data: instructionData,
      });
      const txSig = await this.sendTransaction(ix);
      console.log(`[Vault] Withdrawal complete! Signature: ${txSig}`);
      console.log('[Vault] Note: Call claimAccess() to decrypt your new balance.');
      return txSig;
    }

    // For deposits, we can still try auto-authorize (simulation handles work for deposits
    // because the user's position is being created/updated, not just read)
    const simulationIx = new TransactionInstruction({
      programId: PROGRAM_ID,
      keys: [
        { pubkey: vaultPda, isSigner: false, isWritable: true },
        { pubkey: userPda, isSigner: false, isWritable: true },
        { pubkey: this.publicKey, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: INCO_LIGHTNING_ID, isSigner: false, isWritable: false },
      ],
      data: instructionData,
    });
    
    console.log('[Vault] Simulating deposit to get handles for auto-authorization...');
    let userHandle: bigint;
    let vaultHandle: bigint;
    
    try {
      const handles = await this.simulateAndGetHandles(simulationIx, userPda, vaultPda);
      userHandle = handles.userHandle;
      vaultHandle = handles.vaultHandle;
      console.log('[Vault] Simulation complete, handles obtained');
    } catch (simError) {
      // If simulation fails, fall back to direct transaction without auto-authorize
      console.warn('[Vault] Simulation failed, falling back to direct transaction without auto-authorize:', simError);
      const ix = new TransactionInstruction({
        programId: PROGRAM_ID,
        keys: [
          { pubkey: vaultPda, isSigner: false, isWritable: true },
          { pubkey: userPda, isSigner: false, isWritable: true },
          { pubkey: this.publicKey, isSigner: true, isWritable: true },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
          { pubkey: INCO_LIGHTNING_ID, isSigner: false, isWritable: false },
        ],
        data: instructionData,
      });
      return this.sendTransaction(ix);
    }

    const [allowanceUser] = findAllowancePda(userHandle, this.publicKey);
    const [allowanceVault] = findAllowancePda(vaultHandle, this.publicKey);

    // Send the real tx with remaining accounts so the program can CPI `allow()`
    const realIx = new TransactionInstruction({
      programId: PROGRAM_ID,
      keys: [
        { pubkey: vaultPda, isSigner: false, isWritable: true },
        { pubkey: userPda, isSigner: false, isWritable: true },
        { pubkey: this.publicKey, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: INCO_LIGHTNING_ID, isSigner: false, isWritable: false },
        // remaining_accounts for auto-authorize allow() CPIs:
        { pubkey: allowanceUser, isSigner: false, isWritable: true },
        { pubkey: this.publicKey, isSigner: false, isWritable: false },
        { pubkey: allowanceVault, isSigner: false, isWritable: true },
        { pubkey: this.publicKey, isSigner: false, isWritable: false },
      ],
      data: instructionData,
    });

    const txSig = await this.sendTransaction(realIx);
    console.log(`[Vault] ${instructionName} complete with auto-authorize! Signature: ${txSig}`);
    return txSig;
  }

  private buildInstructionData(
    name: InstructionName,
    payload?: Uint8Array
  ): Uint8Array {
    const discriminator = INSTRUCTION_DISCRIMINATORS[name];
    if (!discriminator) {
      throw new Error(`Unknown instruction ${name}`);
    }
    if (!payload) {
      return Uint8Array.from(discriminator);
    }
    const data = new Uint8Array(discriminator.length + payload.length);
    data.set(discriminator, 0);
    data.set(payload, discriminator.length);
    return data;
  }

  /**
   * Serialize a byte array as a Borsh vector (4-byte little-endian length prefix)
   */
  private serializeVector(payload: Uint8Array): Uint8Array {
    const lengthBuffer = new Uint8Array(4);
    new DataView(lengthBuffer.buffer).setUint32(0, payload.length, true);
    const vector = new Uint8Array(lengthBuffer.length + payload.length);
    vector.set(lengthBuffer, 0);
    vector.set(payload, lengthBuffer.length);
    return vector;
  }

  /**
   * Serialize a bigint as u64 little-endian.
   */
  private serializeU64(value: bigint): Uint8Array {
    const buffer = new Uint8Array(8);
    let v = value;
    for (let i = 0; i < 8; i += 1) {
      buffer[i] = Number(v & 0xffn);
      v >>= 8n;
    }
    return buffer;
  }

  /**
   * Concatenate multiple Uint8Array values.
   */
  private concatBytes(...arrays: Uint8Array[]): Uint8Array {
    const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const arr of arrays) {
      result.set(arr, offset);
      offset += arr.length;
    }
    return result;
  }

  private async sendTransaction(instruction: TransactionInstruction): Promise<string> {
    if (!this.wallet || !this.publicKey) {
      throw new Error('Wallet must be connected to send transactions.');
    }

    console.log('[Vault] Building transaction...');
    const transaction = new Transaction().add(instruction);
    transaction.feePayer = this.publicKey;
    
    console.log('[Vault] Fetching latest blockhash...');
    const latest = await this.connection.getLatestBlockhash('confirmed');
    transaction.recentBlockhash = latest.blockhash;
    transaction.lastValidBlockHeight = latest.lastValidBlockHeight;
    console.log('[Vault] Blockhash:', latest.blockhash.slice(0, 16) + '...');

    console.log('[Vault] Requesting wallet signature...');
    const signed = await this.wallet.signTransaction(transaction);
    console.log('[Vault] Transaction signed, sending to network...');
    
    const signature = await this.connection.sendRawTransaction(signed.serialize());
    console.log('[Vault] Transaction sent, signature:', signature.slice(0, 16) + '...');
    console.log('[Vault] Waiting for confirmation...');
    
    await this.connection.confirmTransaction(
      {
        signature,
        blockhash: latest.blockhash,
        lastValidBlockHeight: latest.lastValidBlockHeight,
      },
      'confirmed'
    );
    console.log('[Vault] Transaction confirmed!');

    return signature;
  }

  private async simulateAndGetHandles(
    ix: TransactionInstruction,
    userPositionPda: PublicKey,
    vaultPda: PublicKey
  ): Promise<{ userHandle: bigint; vaultHandle: bigint }> {
    const transaction = new Transaction().add(ix);
    transaction.feePayer = this.publicKey!;
    const latest = await this.connection.getLatestBlockhash('confirmed');
    transaction.recentBlockhash = latest.blockhash;

    // We prefer to simulate without prompting the user for a signature.
    // If the RPC rejects the unsigned tx, we fall back to a Phantom-signed simulation.
    let simulation:
      | { value: SimulatedTransactionResponse }
      | null = null;
    try {
      const res = await this.connection.simulateTransaction(
        transaction,
        undefined,
        [userPositionPda, vaultPda]
      );
      simulation = res as any;
    } catch {
      // fall through
    }

    if (!simulation) {
      const signed = await this.wallet!.signTransaction(transaction);
      const res = await this.connection.simulateTransaction(
        signed,
        undefined,
        [userPositionPda, vaultPda]
      );
      simulation = res as any;
    }

    if (simulation.value.err) {
      throw new Error(`Simulation failed: ${JSON.stringify(simulation.value.err)}`);
    }

    const accounts = simulation.value.accounts;
    if (!accounts || accounts.length < 2) {
      throw new Error('Simulation did not return account data for handle extraction.');
    }

    const userDataB64 = (accounts[0] as any)?.data?.[0];
    const vaultDataB64 = (accounts[1] as any)?.data?.[0];
    if (!userDataB64 || !vaultDataB64) {
      throw new Error('Simulation missing account data payloads.');
    }

    const userBuf = Buffer.from(userDataB64, 'base64');
    const vaultBuf = Buffer.from(vaultDataB64, 'base64');

    const userHandle = parseEuint128HandleFromAccountData(userBuf);
    const vaultHandle = parseEuint128HandleFromAccountData(vaultBuf);

    return { userHandle, vaultHandle };
  }

  private async simulateTransferAndGetHandles(
    ix: TransactionInstruction,
    senderPda: PublicKey,
    recipientPda: PublicKey
  ): Promise<{ senderHandle: bigint; recipientHandle: bigint }> {
    const transaction = new Transaction().add(ix);
    transaction.feePayer = this.publicKey!;
    const latest = await this.connection.getLatestBlockhash('confirmed');
    transaction.recentBlockhash = latest.blockhash;

    let simulation:
      | { value: SimulatedTransactionResponse }
      | null = null;
    try {
      const res = await this.connection.simulateTransaction(
        transaction,
        undefined,
        [senderPda, recipientPda]
      );
      simulation = res as any;
    } catch {
      // fall through
    }

    if (!simulation) {
      const signed = await this.wallet!.signTransaction(transaction);
      const res = await this.connection.simulateTransaction(
        signed,
        undefined,
        [senderPda, recipientPda]
      );
      simulation = res as any;
    }

    if (simulation.value.err) {
      throw new Error(`Transfer simulation failed: ${JSON.stringify(simulation.value.err)}`);
    }

    const accounts = simulation.value.accounts;
    if (!accounts || accounts.length < 2) {
      throw new Error('Simulation did not return account data for handle extraction.');
    }

    const senderDataB64 = (accounts[0] as any)?.data?.[0];
    const recipientDataB64 = (accounts[1] as any)?.data?.[0];
    if (!senderDataB64 || !recipientDataB64) {
      throw new Error('Simulation missing account data payloads.');
    }

    const senderBuf = Buffer.from(senderDataB64, 'base64');
    const recipientBuf = Buffer.from(recipientDataB64, 'base64');

    const senderHandle = parseEuint128HandleFromAccountData(senderBuf);
    const recipientHandle = parseEuint128HandleFromAccountData(recipientBuf);

    return { senderHandle, recipientHandle };
  }

  private async simulateClaimAndGetHandles(
    ix: TransactionInstruction,
    claimerPda: PublicKey,
    vaultPda: PublicKey
  ): Promise<{ claimerHandle: bigint; vaultHandle: bigint }> {
    const transaction = new Transaction().add(ix);
    transaction.feePayer = this.publicKey!;
    const latest = await this.connection.getLatestBlockhash('confirmed');
    transaction.recentBlockhash = latest.blockhash;

    let simulation:
      | { value: SimulatedTransactionResponse }
      | null = null;
    try {
      const res = await this.connection.simulateTransaction(
        transaction,
        undefined,
        [claimerPda, vaultPda]
      );
      simulation = res as any;
    } catch {
      // fall through
    }

    if (!simulation) {
      const signed = await this.wallet!.signTransaction(transaction);
      const res = await this.connection.simulateTransaction(
        signed,
        undefined,
        [claimerPda, vaultPda]
      );
      simulation = res as any;
    }

    if (simulation.value.err) {
      throw new Error(`Claim simulation failed: ${JSON.stringify(simulation.value.err)}`);
    }

    const accounts = simulation.value.accounts;
    if (!accounts || accounts.length < 2) {
      throw new Error('Simulation did not return account data for handle extraction.');
    }

    const claimerDataB64 = (accounts[0] as any)?.data?.[0];
    const vaultDataB64 = (accounts[1] as any)?.data?.[0];
    if (!claimerDataB64 || !vaultDataB64) {
      throw new Error('Simulation missing account data payloads.');
    }

    const claimerBuf = Buffer.from(claimerDataB64, 'base64');
    const vaultBuf = Buffer.from(vaultDataB64, 'base64');

    const claimerHandle = parseEuint128HandleFromAccountData(claimerBuf);
    const vaultHandle = parseEuint128HandleFromAccountData(vaultBuf);

    return { claimerHandle, vaultHandle };
  }
}

function hexToBytes(hex: string): Uint8Array {
  const matches = hex.match(/.{1,2}/g);
  return new Uint8Array(
    matches?.map((byte) => parseInt(byte, 16)) ?? []
  );
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function parseEuint128HandleFromAccountData(data: Uint8Array): bigint {
  // Layout:
  // 0..8: discriminator
  // 8..40: pubkey (owner/authority)
  // 40..56: Euint128 handle (little-endian 16 bytes)
  const handleBytes = data.slice(40, 56);
  let handle = 0n;
  for (let i = handleBytes.length - 1; i >= 0; i--) {
    handle = handle * 256n + BigInt(handleBytes[i]!);
  }
  return handle;
}

function parseEuint128HandleFromStealthNote(data: Uint8Array): bigint {
  // StealthNote Layout:
  // 0..8: discriminator
  // 8..40: note_id (32 bytes)
  // 40..56: encrypted_amount handle (16 bytes)
  const handleBytes = data.slice(40, 56);
  let handle = 0n;
  for (let i = handleBytes.length - 1; i >= 0; i--) {
    handle = handle * 256n + BigInt(handleBytes[i]!);
  }
  return handle;
}

function findAllowancePda(handle: bigint, allowedAddress: PublicKey): [PublicKey, number] {
  const handleBuffer = Buffer.alloc(16);
  let h = handle;
  for (let i = 0; i < 16; i++) {
    handleBuffer[i] = Number(h & 0xffn);
    h >>= 8n;
  }
  return PublicKey.findProgramAddressSync(
    [handleBuffer, allowedAddress.toBuffer()],
    INCO_LIGHTNING_ID
  );
}

export default VaultService;
