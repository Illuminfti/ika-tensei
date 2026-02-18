/**
 * Test Solana verify_seal with a REAL dWallet signature
 * 
 * Uses the signature from the latest E2E test sign session.
 * Steps: initialize → register_collection → verify_seal (Ed25519 precompile)
 */

import { Connection, PublicKey, Transaction, SystemProgram, Keypair, Ed25519Program, SYSVAR_INSTRUCTIONS_PUBKEY, TransactionInstruction, sendAndConfirmTransaction } from '@solana/web3.js';
import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import { homedir } from 'os';

const SOLANA_DEVNET = 'https://api.devnet.solana.com';
const PROGRAM_ID = new PublicKey('mbEQvaiUYdc65Qz4rd67oBY1LbSCBq1Da8Y1MciwtPa');

// Use the EXACT seal hash that was signed, and its signature
// Instead of recomputing, we pass the pre-computed seal hash directly
const SIGNATURE_HEX = 'db90362423fe7a5641e9c29a99ab43e4cb0ae8a73f4d02b9297927a535708a417d33be87f5a88058c1484465e9ec2b2b8acb6d46bcafa6b53cabd54a075bb204';
const DWALLET_PUBKEY_HEX = '46453f6becb294253dd798a96d86bf62871239aeda8d67d6ea5f788fb0cab756';
const PRECOMPUTED_SEAL_HASH = '23972832872df72ea6311462b666e4fa79120772d1251620028486f63fe811a5';

const CHAIN_SUI = 2;
const CHAIN_SOLANA = 3;
const SOURCE_CONTRACT = '0x8474586628dcdfede81d428532b1f1f769835856f2746bfc040e977f7a6b15bf';
const TOKEN_ID = '42';
const NONCE = 1771357714979n;

function disc(name) {
  return createHash('sha256').update(`global:${name}`).digest().subarray(0, 8);
}

function computeSealHash() {
  const contractBuf = Buffer.from(SOURCE_CONTRACT.slice(2), 'hex');
  const tokenBuf = Buffer.from(TOKEN_ID);
  const pubkeyBuf = Buffer.from(DWALLET_PUBKEY_HEX, 'hex');
  
  const totalLen = 2 + 2 + 1 + contractBuf.length + 1 + tokenBuf.length + 32 + 8;
  const buf = Buffer.alloc(totalLen);
  let off = 0;
  
  buf.writeUInt16BE(CHAIN_SUI, off); off += 2;
  buf.writeUInt16BE(CHAIN_SOLANA, off); off += 2;
  buf.writeUInt8(contractBuf.length, off); off += 1;
  contractBuf.copy(buf, off); off += contractBuf.length;
  buf.writeUInt8(tokenBuf.length, off); off += 1;
  tokenBuf.copy(buf, off); off += tokenBuf.length;
  pubkeyBuf.copy(buf, off); off += 32;
  buf.writeBigUInt64BE(NONCE, off);
  
  return createHash('sha256').update(buf).digest();
}

async function main() {
  const conn = new Connection(SOLANA_DEVNET, 'confirmed');
  const keyData = JSON.parse(readFileSync(homedir() + '/.config/solana/id.json', 'utf8'));
  const wallet = Keypair.fromSecretKey(Buffer.from(keyData));
  const payer = wallet.publicKey;
  
  console.log(`Wallet: ${payer.toBase58()}`);
  console.log(`Balance: ${(await conn.getBalance(payer)) / 1e9} SOL`);
  
  const sealHash = Buffer.from(PRECOMPUTED_SEAL_HASH, 'hex');
  console.log(`Seal hash (precomputed): ${sealHash.toString('hex')}`);
  
  const [configPda] = PublicKey.findProgramAddressSync([Buffer.from('ika_config')], PROGRAM_ID);
  
  // ===== STEP 1: Initialize (if needed) =====
  console.log('\n=== Step 1: Initialize ===');
  const configInfo = await conn.getAccountInfo(configPda);
  if (configInfo) {
    console.log('Already initialized');
  } else {
    console.log('Initializing...');
    const initData = Buffer.alloc(8 + 32 + 32 + 2 + 8);
    let off = 0;
    disc('initialize').copy(initData, off); off += 8;
    payer.toBuffer().copy(initData, off); off += 32; // guild_treasury
    payer.toBuffer().copy(initData, off); off += 32; // team_treasury
    initData.writeUInt16LE(500, off); off += 2; // guild_share_bps
    initData.writeBigUInt64LE(1000000n, off); // mint_fee (0.001 SOL)
    
    const initIx = new TransactionInstruction({
      programId: PROGRAM_ID,
      keys: [
        { pubkey: configPda, isSigner: false, isWritable: true },
        { pubkey: payer, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data: initData,
    });
    
    const tx = new Transaction().add(initIx);
    const sig = await sendAndConfirmTransaction(conn, tx, [wallet]);
    console.log(`Init TX: ${sig}`);
  }

  // ===== STEP 2: Register collection (if needed) =====
  console.log('\n=== Step 2: Register Collection ===');
  const contractBytes = Buffer.from(SOURCE_CONTRACT.slice(2), 'hex');
  const chainLE = Buffer.alloc(2);
  chainLE.writeUInt16LE(CHAIN_SUI);
  
  const [collectionPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('collection'), chainLE, contractBytes],
    PROGRAM_ID
  );
  
  const collInfo = await conn.getAccountInfo(collectionPda);
  if (collInfo) {
    console.log('Collection already registered');
  } else {
    console.log('Registering collection...');
    // register_collection(source_chain: u16, source_contract: Vec<u8>, name: String, max_supply: u64)
    const name = 'Ika Tensei Test';
    const nameBytes = Buffer.from(name);
    
    // Anchor serialization: disc + u16 + Vec<u8>(4-byte len + data) + String(4-byte len + data) + u64
    const regData = Buffer.alloc(8 + 2 + 4 + contractBytes.length + 4 + nameBytes.length + 8);
    let off = 0;
    disc('register_collection').copy(regData, off); off += 8;
    regData.writeUInt16LE(CHAIN_SUI, off); off += 2;
    regData.writeUInt32LE(contractBytes.length, off); off += 4;
    contractBytes.copy(regData, off); off += contractBytes.length;
    regData.writeUInt32LE(nameBytes.length, off); off += 4;
    nameBytes.copy(regData, off); off += nameBytes.length;
    regData.writeBigUInt64LE(0n, off); // max_supply = 0 (unlimited)
    
    const regIx = new TransactionInstruction({
      programId: PROGRAM_ID,
      keys: [
        { pubkey: configPda, isSigner: false, isWritable: false },
        { pubkey: collectionPda, isSigner: false, isWritable: true },
        { pubkey: payer, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data: regData,
    });
    
    const tx = new Transaction().add(regIx);
    const sig = await sendAndConfirmTransaction(conn, tx, [wallet]);
    console.log(`Register TX: ${sig}`);
  }

  // ===== STEP 3: Verify Seal (Ed25519 precompile + verify_seal) =====
  console.log('\n=== Step 3: Verify Seal ===');
  const [recordPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('reincarnation'), sealHash],
    PROGRAM_ID
  );
  
  const recordInfo = await conn.getAccountInfo(recordPda);
  if (recordInfo) {
    console.log('Record already exists! Seal was already verified.');
    return;
  }
  
  console.log(`Record PDA: ${recordPda.toBase58()}`);
  
  const signatureBytes = Buffer.from(SIGNATURE_HEX, 'hex');
  const pubkeyBytes = Buffer.from(DWALLET_PUBKEY_HEX, 'hex');
  
  // Ed25519 precompile instruction: verify the dWallet signature over the seal hash
  const ed25519Ix = Ed25519Program.createInstructionWithPublicKey({
    publicKey: pubkeyBytes,
    message: sealHash,
    signature: signatureBytes,
  });
  
  // verify_seal instruction data:
  // disc + seal_hash(32) + source_chain(u16) + source_contract(Vec) + token_id(Vec) + attestation_pubkey(Pubkey) + recipient(Pubkey)
  const tokenIdBytes = Buffer.from(TOKEN_ID);
  const attestationPubkey = new PublicKey(pubkeyBytes);
  
  const vsDataLen = 8 + 32 + 2 + 4 + contractBytes.length + 4 + tokenIdBytes.length + 32 + 32;
  const vsData = Buffer.alloc(vsDataLen);
  let off = 0;
  disc('verify_seal').copy(vsData, off); off += 8;
  sealHash.copy(vsData, off); off += 32;
  vsData.writeUInt16LE(CHAIN_SUI, off); off += 2;
  vsData.writeUInt32LE(contractBytes.length, off); off += 4;
  contractBytes.copy(vsData, off); off += contractBytes.length;
  vsData.writeUInt32LE(tokenIdBytes.length, off); off += 4;
  tokenIdBytes.copy(vsData, off); off += tokenIdBytes.length;
  attestationPubkey.toBuffer().copy(vsData, off); off += 32;
  payer.toBuffer().copy(vsData, off); off += 32; // recipient = payer
  
  const verifySealIx = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: configPda, isSigner: false, isWritable: false },
      { pubkey: collectionPda, isSigner: false, isWritable: true },
      { pubkey: recordPda, isSigner: false, isWritable: true },
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: payer, isSigner: false, isWritable: false }, // recipient
      { pubkey: SYSVAR_INSTRUCTIONS_PUBKEY, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: vsData,
  });
  
  // Ed25519 precompile MUST be the instruction immediately before verify_seal
  const tx = new Transaction().add(ed25519Ix).add(verifySealIx);
  
  console.log('Submitting Ed25519 precompile + verify_seal...');
  try {
    const sig = await sendAndConfirmTransaction(conn, tx, [wallet], { skipPreflight: false });
    console.log(`\n🎉🎉🎉 VERIFY SEAL TX: ${sig} 🎉🎉🎉`);
    
    // Verify the record was created
    const record = await conn.getAccountInfo(recordPda);
    if (record) {
      console.log(`\n✅ ReincarnationRecord created! Size: ${record.data.length} bytes`);
      console.log(`   Account: ${recordPda.toBase58()}`);
    }
  } catch (e) {
    console.error(`\n❌ Verify seal failed: ${e.message}`);
    if (e.logs) {
      console.error('Program logs:');
      e.logs.forEach(l => console.error(`  ${l}`));
    }
  }
}

main().catch(e => { console.error(e); process.exit(1); });
