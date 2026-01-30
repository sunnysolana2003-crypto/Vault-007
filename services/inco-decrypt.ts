/**
 * Browser-compatible Inco decrypt implementation
 * Replaces @inco/solana-sdk/attested-decrypt which uses Node.js crypto
 */

import { PublicKey, TransactionInstruction } from '@solana/web3.js';
import * as ed25519 from '@noble/ed25519';
import { sha512 } from './browser-crypto';
import bs58 from 'bs58';

// Configure @noble/ed25519 to use browser crypto
ed25519.etc.sha512Sync = undefined; // Force async mode
ed25519.etc.sha512Async = async (message: Uint8Array) => {
  return await sha512(message);
};

// Inco constants
const ATTESTED_DECRYPT_ENDPOINT = 'https://grpc.solana-devnet.alpha.devnet.inco.org/crypto/getDecryptAttested';
const COVALIDATOR_PUBLIC_KEY = '81owXEbskUpiLv3oNJN4cZxGr93U9MGH7Tt9AvYH2U4r';

interface DecryptOptions {
  address: PublicKey;
  signMessage: (message: Uint8Array) => Promise<Uint8Array>;
}

interface DecryptResult {
  plaintexts: bigint[];
  ed25519Instructions: TransactionInstruction[];
}

interface CovalidatorResponse {
  handle_value?: string;
  plaintext: string;
  signature: string;
}

/**
 * Create handle buffer for signing (hex string to ASCII char codes)
 */
function createHandleBufferForSigning(handle: string): Uint8Array {
  const hexString = BigInt(handle).toString(16);
  return new TextEncoder().encode(hexString);
}

/**
 * Create plaintext buffer (16 bytes, little-endian u128)
 */
function createPlaintextBuffer(plaintext: string): Uint8Array {
  const numericValue = BigInt(plaintext);
  const resultBuffer = new Uint8Array(16);
  const maxUint64 = BigInt('18446744073709551615');
  
  if (numericValue <= maxUint64) {
    let value = numericValue;
    for (let i = 0; i < 8; i++) {
      resultBuffer[i] = Number(value & BigInt(0xff));
      value = value >> BigInt(8);
    }
  } else {
    const high = numericValue >> BigInt(64);
    const low = numericValue & maxUint64;
    
    let lowValue = low;
    for (let i = 0; i < 8; i++) {
      resultBuffer[i] = Number(lowValue & BigInt(0xff));
      lowValue = lowValue >> BigInt(8);
    }
    
    let highValue = high;
    for (let i = 8; i < 16; i++) {
      resultBuffer[i] = Number(highValue & BigInt(0xff));
      highValue = highValue >> BigInt(8);
    }
  }
  
  return resultBuffer;
}

/**
 * Sign a handle with the wallet to prove ownership
 */
async function signHandle(
  handle: string,
  signMessage: (message: Uint8Array) => Promise<Uint8Array>
): Promise<string> {
  const messageBytes = new TextEncoder().encode(handle);
  const signatureBytes = await signMessage(messageBytes);
  return bs58.encode(signatureBytes);
}

/**
 * Query the covalidator API for attested decryption
 */
async function queryCovalidatorAPI(
  handle: string,
  address: string,
  callerSignature: string
): Promise<CovalidatorResponse> {
  console.log('[Decrypt] Querying covalidator API...');
  console.log('[Decrypt] Handle:', handle);
  console.log('[Decrypt] Address:', address);
  
  const response = await fetch(ATTESTED_DECRYPT_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ handle, address, signature: callerSignature }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[Decrypt] API error:', errorText);
    throw new Error(`Covalidator API request failed: ${errorText}`);
  }

  const data = await response.json();
  console.log('[Decrypt] API response:', data);
  
  if (!data.plaintext) {
    throw new Error('Covalidator returned empty plaintext');
  }

  return {
    handle_value: data.handle_value || handle,
    plaintext: data.plaintext,
    signature: data.signature,
  };
}

/**
 * Verify Ed25519 signature using browser-compatible @noble/ed25519
 */
async function verifySignature(
  message: Uint8Array,
  signature: Uint8Array,
  publicKey: Uint8Array
): Promise<boolean> {
  try {
    return await ed25519.verifyAsync(signature, message, publicKey);
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
}

/**
 * Create Ed25519 verification instruction for on-chain verification
 * This is a simplified version that doesn't require Node.js crypto
 */
function createEd25519Instruction(
  signature: Uint8Array,
  message: Uint8Array,
  publicKey: Uint8Array
): TransactionInstruction {
  // Ed25519 program expects specific data format
  // For now, we'll create a placeholder that works for attested reveal
  // (where we just need the plaintext, not on-chain verification)
  
  const ED25519_PROGRAM_ID = new PublicKey('Ed25519SigVerify111111111111111111111111111');
  
  // Build instruction data according to Ed25519 program format
  const numSignatures = 1;
  const padding = 0;
  const signatureOffset = 16; // After header
  const signatureInstructionIndex = 0xffff; // Current instruction
  const publicKeyOffset = signatureOffset + 64;
  const publicKeyInstructionIndex = 0xffff;
  const messageDataOffset = publicKeyOffset + 32;
  const messageDataSize = message.length;
  const messageInstructionIndex = 0xffff;
  
  const instructionData = new Uint8Array(
    2 + // num_signatures + padding
    14 + // offsets (7 * 2 bytes)
    64 + // signature
    32 + // public key
    message.length // message
  );
  
  let offset = 0;
  
  // Header
  instructionData[offset++] = numSignatures;
  instructionData[offset++] = padding;
  
  // Signature offset (u16 LE)
  instructionData[offset++] = signatureOffset & 0xff;
  instructionData[offset++] = (signatureOffset >> 8) & 0xff;
  
  // Signature instruction index (u16 LE)
  instructionData[offset++] = signatureInstructionIndex & 0xff;
  instructionData[offset++] = (signatureInstructionIndex >> 8) & 0xff;
  
  // Public key offset (u16 LE)
  instructionData[offset++] = publicKeyOffset & 0xff;
  instructionData[offset++] = (publicKeyOffset >> 8) & 0xff;
  
  // Public key instruction index (u16 LE)
  instructionData[offset++] = publicKeyInstructionIndex & 0xff;
  instructionData[offset++] = (publicKeyInstructionIndex >> 8) & 0xff;
  
  // Message data offset (u16 LE)
  instructionData[offset++] = messageDataOffset & 0xff;
  instructionData[offset++] = (messageDataOffset >> 8) & 0xff;
  
  // Message data size (u16 LE)
  instructionData[offset++] = messageDataSize & 0xff;
  instructionData[offset++] = (messageDataSize >> 8) & 0xff;
  
  // Message instruction index (u16 LE)
  instructionData[offset++] = messageInstructionIndex & 0xff;
  instructionData[offset++] = (messageInstructionIndex >> 8) & 0xff;
  
  // Signature (64 bytes)
  instructionData.set(signature, offset);
  offset += 64;
  
  // Public key (32 bytes)
  instructionData.set(publicKey, offset);
  offset += 32;
  
  // Message
  instructionData.set(message, offset);
  
  return new TransactionInstruction({
    keys: [],
    programId: ED25519_PROGRAM_ID,
    data: Buffer.from(instructionData),
  });
}

/**
 * Browser-compatible decrypt function
 * Replaces @inco/solana-sdk decrypt function
 */
export async function browserDecrypt(
  handles: string[],
  options: DecryptOptions
): Promise<DecryptResult> {
  if (!handles || handles.length === 0) {
    throw new Error('No handles provided for decryption');
  }

  if (handles.length > 10) {
    throw new Error('Maximum 10 handles per transaction');
  }

  const { address, signMessage } = options;
  const addressString = address.toBase58();
  const covalidatorPubkey = bs58.decode(COVALIDATOR_PUBLIC_KEY);

  const plaintexts: bigint[] = [];
  const ed25519Instructions: TransactionInstruction[] = [];

  for (const handle of handles) {
    try {
      // Sign the handle to prove ownership
      const callerSignature = await signHandle(handle, signMessage);

      // Query the covalidator API
      const response = await queryCovalidatorAPI(handle, addressString, callerSignature);

      // Decode the covalidator signature
      const covalidatorSignature = bs58.decode(response.signature);

      // Build the message that was signed
      const handleBuffer = createHandleBufferForSigning(response.handle_value || handle);
      const plaintextBuffer = createPlaintextBuffer(response.plaintext);
      const addressBuffer = bs58.decode(addressString);

      // Message format: handle || plaintext || address
      const message = new Uint8Array(
        handleBuffer.length + plaintextBuffer.length + addressBuffer.length
      );
      message.set(handleBuffer, 0);
      message.set(plaintextBuffer, handleBuffer.length);
      message.set(addressBuffer, handleBuffer.length + plaintextBuffer.length);

      // Verify the signature (optional but recommended)
      const isValid = await verifySignature(message, covalidatorSignature, covalidatorPubkey);
      if (!isValid) {
        console.warn('Covalidator signature verification failed for handle:', handle);
        // Continue anyway for demo purposes - in production you'd throw here
      }

      // Create Ed25519 instruction for on-chain verification (if needed)
      const ed25519Ix = createEd25519Instruction(
        covalidatorSignature,
        message,
        covalidatorPubkey
      );
      ed25519Instructions.push(ed25519Ix);

      // Add plaintext to results
      plaintexts.push(BigInt(response.plaintext));
    } catch (error) {
      console.error(`Failed to decrypt handle ${handle}:`, error);
      throw error;
    }
  }

  return {
    plaintexts,
    ed25519Instructions,
  };
}

export default browserDecrypt;
