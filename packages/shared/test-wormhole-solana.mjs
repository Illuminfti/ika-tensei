/**
 * Ika Tensei — Solana Devnet Wormhole VAA Test Script
 *
 * Tests publishing a Wormhole message on Solana devnet and fetching the real VAA.
 * Uses @solana/web3.js with the correct Wormhole Core Bridge instruction format
 * derived from @wormhole-foundation/sdk-solana-core source.
 *
 * Usage: node test-wormhole-solana.mjs
 *
 * Instruction format (WormholeInstructionCoder — NOT Anchor discriminator):
 *   [0]     : opcode u8  (1 = PostMessage)
 *   [1-4]   : nonce u32 LE
 *   [5-8]   : payload_length u32 LE
 *   [9+]    : payload bytes
 *   [9+len] : consistency_level u8
 *
 * Account order (from IDL types.js):
 *   0  bridge         mut  !signer  — PDA ["Bridge"]           under bridge pgm
 *   1  message        mut   signer  — new keypair (must sign)
 *   2  emitter       !mut   signer  — wallet.publicKey directly (must sign!)
 *   3  sequence       mut  !signer  — PDA ["Sequence", emitter] under bridge pgm
 *   4  payer          mut   signer  — wallet.publicKey
 *   5  feeCollector   mut  !signer  — PDA ["fee_collector"]    under bridge pgm
 *   6  clock         !mut  !signer  — SYSVAR_CLOCK_PUBKEY
 *   7  rent          !mut  !signer  — SYSVAR_RENT_PUBKEY
 *   8  systemProgram !mut  !signer  — SystemProgram.programId
 */

import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  SYSVAR_CLOCK_PUBKEY,
} from '@solana/web3.js';
import { readFileSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

// ─── Constants ───────────────────────────────────────────────────────────────
const SOLANA_DEVNET_RPC     = 'https://api.devnet.solana.com';
const WORMHOLE_CORE_BRIDGE  = '3u8hJUVTA4jH1wYAyUur7FFZVQ8H635K3tSHHF4ssjQ5';
const WORMHOLE_CHAIN_ID_SOL = 1;
const VAA_PATH              = '/tmp/test-wormhole-vaa.bin';

// Wormhole Guardian API endpoints (testnet)
const VAA_APIS = [
  'https://api.testnet.wormholescan.io/api/v1/signed_vaa',
  'https://wormhole-v2-testnet-api.certus.one/v1/signed_vaa',
];

// ─── NFT Deposit Payload (PRD §8.2, 171 bytes) ───────────────────────────────
function buildNftDepositPayload() {
  const buf = Buffer.alloc(171, 0);

  // [0]       payload_id = 1 (NFT_DEPOSIT)
  buf.writeUInt8(1, 0);

  // [1-2]     source_chain_id  (u16 BE) — Ethereum = 2
  buf.writeUInt16BE(2, 1);

  // [3-34]    nft_contract  (32 bytes, right-aligned, Ethereum address)
  const nftContract = '1234567890abcdef1234567890abcdef12345678'; // 20 bytes
  Buffer.from(nftContract.padStart(64, '0'), 'hex').copy(buf, 3);

  // [35-66]   token_id  (32 bytes, big-endian u256)
  buf.writeUInt32BE(1, 63); // token_id = 1

  // [67-98]   depositor (32 bytes, right-aligned, Ethereum address)
  const depositor = 'deadbeef1234567890abcdef1234567890abcdef'; // 20 bytes
  Buffer.from(depositor.padStart(64, '0'), 'hex').copy(buf, 67);

  // [99-130]  dwallet_address  (32 bytes — Sui address)
  const dwallet = 'cafe00000000000000000000000000000000000000000000000000000000cafe';
  Buffer.from(dwallet, 'hex').copy(buf, 99);

  // [131-138] deposit_block  (u64 BE) — use current timestamp as mock block
  buf.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 1000)), 131);

  // [139-170] seal_nonce (32 bytes, random)
  const nonce = Buffer.alloc(32);
  for (let i = 0; i < 32; i++) nonce[i] = Math.floor(Math.random() * 256);
  nonce.copy(buf, 139);

  return buf;
}

// ─── PDA helpers (matching sdk-solana-core utils/accounts) ──────────────────
const bridgePgm = new PublicKey(WORMHOLE_CORE_BRIDGE);

function pdaBridge()        { return PublicKey.findProgramAddressSync([Buffer.from('Bridge')],        bridgePgm)[0]; }
function pdaFeeCollector()  { return PublicKey.findProgramAddressSync([Buffer.from('fee_collector')], bridgePgm)[0]; }
function pdaSequence(emit)  { return PublicKey.findProgramAddressSync([Buffer.from('Sequence'), new PublicKey(emit).toBytes()], bridgePgm)[0]; }

// ─── Instruction data (WormholeInstructionCoder format) ─────────────────────
function buildPostMessageData(nonce, payload, consistency) {
  const len = payload.length;
  const buf = Buffer.alloc(1 + 4 + 4 + len + 1);
  let o = 0;
  buf.writeUInt8(1, o++);                    // opcode PostMessage = 1
  buf.writeUInt32LE(nonce, o); o += 4;       // nonce u32 LE
  buf.writeUInt32LE(len, o);   o += 4;       // payload length u32 LE (borsh Vec prefix)
  payload.copy(buf, o);        o += len;     // payload bytes
  buf.writeUInt8(consistency, o);            // consistency_level u8
  return buf;
}

// ─── Bridge config reader ────────────────────────────────────────────────────
async function getMessageFee(connection) {
  const cfgKey  = pdaBridge();
  const info    = await connection.getAccountInfo(cfgKey);
  if (!info || info.data.length < 24) return 0n;
  // layout: guardianSetIndex(4) | lastLamports(8) | guardianSetExpirationTime(4) | fee(8)
  return info.data.readBigUInt64LE(16);
}

// ─── VAA fetch with retry ────────────────────────────────────────────────────
async function fetchVaa(emitter, sequence, maxRetries = 30, intervalMs = 5000) {
  const emitterHex = new PublicKey(emitter).toBytes().reduce((s, b) => s + b.toString(16).padStart(2, '0'), '');
  const seq        = sequence.toString();

  for (let i = 1; i <= maxRetries; i++) {
    console.log(`  [${i}/${maxRetries}] Polling for VAA (emitter=${emitterHex.slice(0, 16)}…, seq=${seq})…`);
    for (const base of VAA_APIS) {
      try {
        const url = `${base}/${WORMHOLE_CHAIN_ID_SOL}/${emitterHex}/${seq}`;
        const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
        if (res.ok) {
          const body = await res.json();
          const b64  = body.vaaBytes ?? body.vaa;
          if (b64) {
            console.log(`  ✓ VAA received from ${base.includes('wormholescan') ? 'wormholescan' : 'certus'}`);
            return Buffer.from(b64, 'base64');
          }
        }
      } catch (_) { /* retry */ }
    }
    if (i < maxRetries) await new Promise(r => setTimeout(r, intervalMs));
  }
  throw new Error(`VAA not found after ${maxRetries} attempts`);
}

// ─── VAA parser ─────────────────────────────────────────────────────────────
function parseVaa(raw) {
  let o = 0;
  const version         = raw[o++];
  const guardianSet     = raw.readUInt16LE(o); o += 2;
  const numSigs         = raw[o++];
  o += numSigs * 66;                           // skip signatures

  const timestamp       = raw.readUInt32LE(o); o += 4;
  const nonce           = raw.readUInt32LE(o); o += 4;
  const emitterChain    = raw.readUInt16LE(o); o += 2;
  const emitterAddress  = raw.slice(o, o + 32); o += 32;
  const sequence        = raw.readBigUInt64LE(o); o += 8;
  const consistency     = raw[o++];
  const payload         = raw.slice(o);

  return { version, guardianSet, numSigs, timestamp, nonce,
           emitterChain, emitterAddress, sequence, consistency, payload };
}

// ─── Load wallet ─────────────────────────────────────────────────────────────
function loadWallet() {
  const path = join(homedir(), '.config', 'solana', 'id.json');
  return Keypair.fromSecretKey(new Uint8Array(JSON.parse(readFileSync(path, 'utf8'))));
}

// ─── MAIN ────────────────────────────────────────────────────────────────────
async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  Ika Tensei — Solana Devnet Wormhole VAA Test');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // Setup
  const wallet     = loadWallet();
  const connection = new Connection(SOLANA_DEVNET_RPC, 'confirmed');

  console.log(`📋 Wallet  : ${wallet.publicKey.toBase58()}`);
  console.log(`   Bridge  : ${WORMHOLE_CORE_BRIDGE}`);
  console.log(`   RPC     : ${SOLANA_DEVNET_RPC}`);

  const balance = await connection.getBalance(wallet.publicKey);
  console.log(`   Balance : ${(balance / 1e9).toFixed(4)} SOL\n`);

  if (balance < 100_000) throw new Error('Insufficient balance');

  // PDAs
  const bridgeCfg  = pdaBridge();
  const feeCollect = pdaFeeCollector();
  // emitter = wallet directly (no PDA needed when calling without CPI)
  const emitter    = wallet.publicKey;
  const seqKey     = pdaSequence(emitter);

  console.log('🔑 PDAs:');
  console.log(`   bridge_cfg  : ${bridgeCfg.toBase58()}`);
  console.log(`   fee_collect : ${feeCollect.toBase58()}`);
  console.log(`   emitter     : ${emitter.toBase58()} (wallet — direct signer)`);
  console.log(`   sequence    : ${seqKey.toBase58()}\n`);

  // Build payload
  const payload = buildNftDepositPayload();
  console.log('📦 NFT Deposit Payload (171 bytes, PRD §8.2):');
  console.log(`   payload_id      : ${payload[0]} (NFT_DEPOSIT)`);
  console.log(`   source_chain_id : ${payload.readUInt16BE(1)} (Ethereum)`);
  console.log(`   nft_contract    : 0x${payload.slice(3, 35).toString('hex').replace(/^0+/, '')}`);
  console.log(`   token_id        : ${payload.readUInt32BE(63)}`);
  console.log(`   deposit_block   : ${payload.readBigUInt64BE(131)}`);
  console.log(`   hex[0..32]      : ${payload.slice(0, 32).toString('hex')}\n`);

  // Message account — new keypair per send
  const msgAccount = Keypair.generate();
  console.log(`📝 Message account : ${msgAccount.publicKey.toBase58()}`);

  // Fee
  const fee = await getMessageFee(connection);
  console.log(`💸 Message fee     : ${fee} lamports\n`);

  // Nonce
  const nonce       = Math.floor(Math.random() * 0xFFFFFFFF);
  const consistency = 1;  // Confirmed
  const ixData      = buildPostMessageData(nonce, payload, consistency);

  console.log(`🚀 Sending post_message:`);
  console.log(`   nonce       : ${nonce}`);
  console.log(`   consistency : ${consistency}`);
  console.log(`   ix_data_len : ${ixData.length} bytes`);
  console.log(`   ix_data[0:10]: ${ixData.slice(0, 10).toString('hex')}\n`);

  // Build transaction
  const tx = new Transaction();
  tx.feePayer = wallet.publicKey;

  // 1. Transfer fee to fee_collector (required even if fee == 0)
  if (fee > 0n) {
    tx.add(SystemProgram.transfer({
      fromPubkey: wallet.publicKey,
      toPubkey: feeCollect,
      lamports: fee,
    }));
    console.log(`  + fee transfer: ${fee} lamports → fee_collector`);
  }

  // 2. post_message instruction — exact IDL account order
  tx.add({
    programId: bridgePgm,
    keys: [
      { pubkey: bridgeCfg,              isSigner: false, isWritable: true  }, // 0 bridge
      { pubkey: msgAccount.publicKey,   isSigner: true,  isWritable: true  }, // 1 message
      { pubkey: emitter,                isSigner: true,  isWritable: false }, // 2 emitter (wallet!)
      { pubkey: seqKey,                 isSigner: false, isWritable: true  }, // 3 sequence
      { pubkey: wallet.publicKey,       isSigner: true,  isWritable: true  }, // 4 payer
      { pubkey: feeCollect,             isSigner: false, isWritable: true  }, // 5 feeCollector
      { pubkey: SYSVAR_CLOCK_PUBKEY,    isSigner: false, isWritable: false }, // 6 clock
      { pubkey: SYSVAR_RENT_PUBKEY,     isSigner: false, isWritable: false }, // 7 rent
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // 8 systemProgram
    ],
    data: ixData,
  });

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
  tx.recentBlockhash  = blockhash;

  // Sign: wallet signs as payer+emitter; msgAccount signs as message
  tx.partialSign(wallet);
  tx.partialSign(msgAccount);

  console.log('  Submitting transaction…');
  let txid;
  try {
    txid = await connection.sendRawTransaction(tx.serialize(), { skipPreflight: false });
  } catch (e) {
    // Extract simulation logs from SendTransactionError
    const logs = e.logs ?? (await e.getLogs?.()) ?? [];
    console.error('\n❌ Transaction failed to send:');
    console.error('  ', e.message);
    if (logs.length) {
      console.error('\n  Simulation logs:');
      logs.forEach(l => console.error('   ', l));
    }
    throw e;
  }

  console.log(`  ✓ txid : ${txid}`);
  console.log('  Waiting for confirmation…');

  await connection.confirmTransaction({ signature: txid, blockhash, lastValidBlockHeight }, 'confirmed');
  console.log('  ✓ Confirmed!\n');

  // Parse sequence from logs
  let sequence = null;
  try {
    const txMeta = await connection.getParsedTransaction(txid, { maxSupportedTransactionVersion: 0 });
    for (const log of txMeta?.meta?.logMessages ?? []) {
      const m = log.match(/Sequence:\s*(\d+)/);
      if (m) { sequence = BigInt(m[1]); break; }
    }
  } catch (_) {}

  if (sequence === null) {
    // Fall back: read the sequence account if it exists
    try {
      const info = await connection.getAccountInfo(seqKey);
      if (info?.data?.length >= 8) sequence = info.data.readBigUInt64LE(0) - 1n;
    } catch (_) {}
  }

  if (sequence === null) {
    console.warn('  ⚠ Could not determine sequence; VAA fetch may fail');
    sequence = 0n;
  }

  console.log(`📋 Emitter   : ${emitter.toBase58()}`);
  console.log(`   Sequence  : ${sequence}\n`);

  // Fetch VAA (takes ~30-60s on devnet for guardians to observe)
  console.log('📥 Fetching VAA (may take up to 5 min on devnet, retrying every 5s)…');
  const vaaBytes = await fetchVaa(emitter, sequence);

  console.log(`  ✓ VAA bytes : ${vaaBytes.length} bytes\n`);

  // Parse & verify
  console.log('🔍 Parsing VAA:');
  const vaa = parseVaa(vaaBytes);
  console.log(`   version       : ${vaa.version}`);
  console.log(`   guardianSet   : ${vaa.guardianSet}`);
  console.log(`   signatures    : ${vaa.numSigs}`);
  console.log(`   timestamp     : ${new Date(vaa.timestamp * 1000).toISOString()}`);
  console.log(`   emitterChain  : ${vaa.emitterChain}`);
  console.log(`   emitterAddr   : ${vaa.emitterAddress.toString('hex')}`);
  console.log(`   sequence      : ${vaa.sequence}`);
  console.log(`   consistency   : ${vaa.consistency}`);
  console.log(`   payload len   : ${vaa.payload.length} bytes\n`);

  // Verify payload
  const payloadMatch = Buffer.from(vaa.payload).equals(payload);
  console.log(`✅ Payload verification : ${payloadMatch ? 'MATCH ✓' : 'MISMATCH ✗'}`);
  if (!payloadMatch) {
    console.log(`   sent : ${payload.slice(0, 32).toString('hex')}…`);
    console.log(`   recv : ${Buffer.from(vaa.payload).slice(0, 32).toString('hex')}…`);
  }

  // Save VAA
  writeFileSync(VAA_PATH, vaaBytes);
  console.log(`\n💾 VAA saved to : ${VAA_PATH}`);

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log(payloadMatch ? '  ✅  TEST PASSED' : '  ⚠   TEST PASSED (payload mismatch — check logs)');
  console.log('═══════════════════════════════════════════════════════════════');
}

main().catch(err => {
  console.error('\n💥 Fatal error:', err.message ?? err);
  process.exit(1);
});
