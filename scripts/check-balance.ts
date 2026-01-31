import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';

const PROGRAM_ID = new PublicKey('DmfUVqYJ5DG1iWww8YXt75zsB6RdmMws5qQMBWH4ofvC');
const SEED_USER = new TextEncoder().encode('user_v2');
const SEED_VAULT = new TextEncoder().encode('vault_v2');

async function main() {
  const walletAddress = process.argv[2];
  if (!walletAddress) {
    console.log('Usage: npx tsx scripts/check-balance.ts <WALLET_ADDRESS>');
    process.exit(1);
  }

  const rpcUrl = process.env.SOLANA_RPC_URL ?? 'https://devnet.helius-rpc.com/?api-key=89e87d93-4a49-4769-bc03-360e68d5748b';
  const connection = new Connection(rpcUrl, 'confirmed');
  
  const userPubkey = new PublicKey(walletAddress);
  
  // Derive user position PDA
  const [userPda] = PublicKey.findProgramAddressSync(
    [SEED_USER, userPubkey.toBuffer()],
    PROGRAM_ID
  );
  
  // Derive vault PDA
  const [vaultPda] = PublicKey.findProgramAddressSync(
    [SEED_VAULT],
    PROGRAM_ID
  );

  console.log('Wallet:', walletAddress);
  console.log('User Position PDA:', userPda.toBase58());
  console.log('Vault PDA:', vaultPda.toBase58());
  console.log('---');

  // Check wallet balance
  const walletBalance = await connection.getBalance(userPubkey);
  console.log('Wallet Balance:', walletBalance / LAMPORTS_PER_SOL, 'SOL');

  // Check user position PDA balance (escrow)
  const userPdaBalance = await connection.getBalance(userPda);
  console.log('User Escrow (PDA) Balance:', userPdaBalance / LAMPORTS_PER_SOL, 'SOL');

  // Check if user position account exists
  const userPdaInfo = await connection.getAccountInfo(userPda);
  if (userPdaInfo) {
    console.log('User Position Account: EXISTS (data size:', userPdaInfo.data.length, 'bytes)');
    // Parse owner from account data (offset 8-40)
    const owner = new PublicKey(userPdaInfo.data.slice(8, 40));
    console.log('Position Owner:', owner.toBase58());
  } else {
    console.log('User Position Account: DOES NOT EXIST');
  }

  // Check vault balance
  const vaultBalance = await connection.getBalance(vaultPda);
  console.log('Vault Balance:', vaultBalance / LAMPORTS_PER_SOL, 'SOL');
}

main().catch(console.error);
