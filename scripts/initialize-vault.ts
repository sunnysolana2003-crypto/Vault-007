import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import * as fs from 'fs';
import * as path from 'path';

const RPC_ENDPOINT = 'https://api.devnet.solana.com';
const PROGRAM_ID = new PublicKey('DmfUVqYJ5DG1iWww8YXt75zsB6RdmMws5qQMBWH4ofvC');
const INCO_LIGHTNING_ID = new PublicKey('5sjEbPiqgZrYwR31ahR6Uk9wf5awoX61YGg7jExQSwaj');

// Anchor discriminator for initialize_vault from IDL
const INITIALIZE_VAULT_DISCRIMINATOR = Buffer.from([48, 191, 163, 44, 71, 129, 63, 164]);

async function main() {
  // Load keypair from default Solana config
  const keypairPath = path.join(process.env.HOME!, '.config/solana/id.json');
  const keypairData = JSON.parse(fs.readFileSync(keypairPath, 'utf-8'));
  const payer = Keypair.fromSecretKey(Uint8Array.from(keypairData));

  console.log('Payer:', payer.publicKey.toBase58());

  const connection = new Connection(RPC_ENDPOINT, 'confirmed');

  // Derive vault PDA
  const [vaultPda, vaultBump] = PublicKey.findProgramAddressSync(
    [Buffer.from('vault_v2')],
    PROGRAM_ID
  );
  console.log('Vault PDA:', vaultPda.toBase58());

  // Check if vault already exists
  const vaultAccount = await connection.getAccountInfo(vaultPda);
  if (vaultAccount) {
    console.log('Vault already initialized!');
    console.log('Account data length:', vaultAccount.data.length);
    return;
  }

  // Build initialize_vault instruction
  const ix = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: vaultPda, isSigner: false, isWritable: true },
      { pubkey: payer.publicKey, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: INCO_LIGHTNING_ID, isSigner: false, isWritable: false },
    ],
    data: INITIALIZE_VAULT_DISCRIMINATOR,
  });

  const tx = new Transaction().add(ix);

  console.log('Sending initialize_vault transaction...');
  const signature = await sendAndConfirmTransaction(connection, tx, [payer], {
    commitment: 'confirmed',
  });

  console.log('Vault initialized!');
  console.log('Signature:', signature);
  console.log('Explorer: https://explorer.solana.com/tx/' + signature + '?cluster=devnet');
}

main().catch(console.error);
