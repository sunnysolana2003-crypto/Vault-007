import { Connection, PublicKey } from '@solana/web3.js';

const PROGRAM_ID = new PublicKey('DmfUVqYJ5DG1iWww8YXt75zsB6RdmMws5qQMBWH4ofvC');
const SEED_VAULT = new TextEncoder().encode('vault_v2');

async function main() {
  const rpcUrl = 'https://devnet.helius-rpc.com/?api-key=89e87d93-4a49-4769-bc03-360e68d5748b';
  const connection = new Connection(rpcUrl, 'confirmed');
  
  const [vaultPda] = PublicKey.findProgramAddressSync([SEED_VAULT], PROGRAM_ID);
  
  const vaultInfo = await connection.getAccountInfo(vaultPda);
  if (!vaultInfo) {
    console.log('Vault not initialized');
    return;
  }
  
  // Parse vault data
  // Layout: 8 (discriminator) + 32 (authority) + 16 (encrypted_balance) + 8 (total_escrow) + 16 (yield_index) + 1 (bump)
  const authority = new PublicKey(vaultInfo.data.slice(8, 40));
  const totalEscrow = vaultInfo.data.readBigUInt64LE(56);
  
  // Read yield_index as u128 (16 bytes little-endian)
  const yieldIndexBytes = vaultInfo.data.slice(64, 80);
  let yieldIndex = 0n;
  for (let i = 15; i >= 0; i--) {
    yieldIndex = yieldIndex * 256n + BigInt(yieldIndexBytes[i]);
  }
  
  console.log('Vault PDA:', vaultPda.toBase58());
  console.log('Authority:', authority.toBase58());
  console.log('Total Escrow:', Number(totalEscrow) / 1e9, 'SOL');
  console.log('Yield Index:', yieldIndex.toString());
  console.log('---');
  console.log('To apply yield, connect with the authority wallet.');
}

main().catch(console.error);
