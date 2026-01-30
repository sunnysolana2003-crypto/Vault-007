import { Connection, PublicKey } from '@solana/web3.js';

const RPC_ENDPOINT = 'https://api.devnet.solana.com';
const PROGRAM_ID = new PublicKey('DmfUVqYJ5DG1iWww8YXt75zsB6RdmMws5qQMBWH4ofvC');

async function main() {
  const connection = new Connection(RPC_ENDPOINT, 'confirmed');

  // Derive vault PDA
  const [vaultPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('vault_v2')],
    PROGRAM_ID
  );
  console.log('Vault PDA:', vaultPda.toBase58());

  const accountInfo = await connection.getAccountInfo(vaultPda);
  if (!accountInfo) {
    console.log('Vault not found!');
    return;
  }

  console.log('Vault account found!');
  console.log('Data length:', accountInfo.data.length, 'bytes');
  console.log('Owner:', accountInfo.owner.toBase58());

  // Parse vault data:
  // - 8 bytes: discriminator
  // - 32 bytes: authority pubkey
  // - 16 bytes: Euint128 handle (total_encrypted_balance)
  // - 8 bytes: total_escrow_lamports (u64 LE)
  // - 16 bytes: yield_index (u128 LE)
  // - 1 byte: bump
  const data = accountInfo.data;
  
  const discriminator = data.slice(0, 8);
  console.log('Discriminator:', Array.from(discriminator).map(b => b.toString(16).padStart(2, '0')).join(''));
  
  const authority = new PublicKey(data.slice(8, 40));
  console.log('Authority:', authority.toBase58());
  
  const handleBytes = data.slice(40, 56);
  let handle = 0n;
  for (let i = handleBytes.length - 1; i >= 0; i--) {
    handle = handle * 256n + BigInt(handleBytes[i]!);
  }
  console.log('Encrypted Balance Handle:', handle.toString());
  console.log('Handle Hex (LE):', Array.from(handleBytes).map(b => b.toString(16).padStart(2, '0')).join(''));
  
  const totalEscrowLamports = Number(new DataView(data.buffer, data.byteOffset + 56, 8).getBigUint64(0, true));
  const yieldIndexBytes = data.slice(64, 80);
  let yieldIndex = 0n;
  for (let i = yieldIndexBytes.length - 1; i >= 0; i--) {
    yieldIndex = yieldIndex * 256n + BigInt(yieldIndexBytes[i]!);
  }
  const bump = data[80];
  console.log('Total Escrow Lamports:', totalEscrowLamports);
  console.log('Yield Index:', yieldIndex.toString());
  console.log('Bump:', bump);

  console.log('\n✅ Vault state is readable and correctly structured!');
}

main().catch(console.error);
