/**
 * Solana Test Helpers
 * 
 * Provides utilities for Solana connection and Anchor program interaction
 */

import { 
  Connection, 
  PublicKey, 
  Transaction, 
  SystemProgram, 
  Keypair,
  TransactionInstruction 
} from '@solana/web3.js';
import { readFileSync } from 'fs';
import { Ed25519Program } from '@solana/web3.js';

export const SOLANA_DEVNET = 'https://api.devnet.solana.com';

// Program addresses
export const PROGRAM_ADDRESSES = {
  PROGRAM: 'mbEQvaiUYdc65Qz4rd67oBY1LbSCBq1Da8Y1MciwtPa',
  MPL_CORE: 'CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d',
};

// Seed constants
export const SEEDS = {
  CONFIG: 'ika_config',
  RECORD: 'reincarnation',
  MINT: 'reincarnation_mint',
  COLLECTION: 'collection',
  ONCHAIN_COLLECTION: 'onchain_collection',
};

/**
 * Create Solana connection
 */
export function createSolanaConnection() {
  return new Connection(SOLANA_DEVNET, 'confirmed');
}

/**
 * Load Solana keypair from default location
 */
export function loadSolanaKeypair() {
  const keypairPath = process.env.HOME + '/.config/solana/id.json';
  const keypairData = JSON.parse(readFileSync(keypairPath, 'utf8'));
  return Keypair.fromSecretKey(Buffer.from(keypairData));
}

/**
 * Get program address from seed
 */
export async function getProgramAddress(connection, seeds, programId, bump = null) {
  if (bump !== null) {
    seeds.push(bump);
  }
  const [address] = await PublicKey.findProgramAddress(
    seeds.map(s => typeof s === 'string' ? Buffer.from(s) : s),
    programId
  );
  return address;
}

/**
 * Get config PDA
 */
export async function getConfigPDA(programId = new PublicKey(PROGRAM_ADDRESSES.PROGRAM)) {
  return getProgramAddress(
    SOLANA_DEVNET, 
    [Buffer.from(SEEDS.CONFIG)], 
    programId
  );
}

/**
 * Get record PDA for seal hash
 */
export async function getRecordPDA(sealHash, programId = new PublicKey(PROGRAM_ADDRESSES.PROGRAM)) {
  return getProgramAddress(
    SOLANA_DEVNET,
    [Buffer.from(SEEDS.RECORD), Buffer.from(sealHash)],
    programId
  );
}

/**
 * Get collection PDA
 */
export async function getCollectionPDA(sourceChain, sourceContract, programId = new PublicKey(PROGRAM_ADDRESSES.PROGRAM)) {
  const chainBytes = Buffer.alloc(2);
  chainBytes.writeUInt16LE(sourceChain, 0);
  return getProgramAddress(
    SOLANA_DEVNET,
    [Buffer.from(SEEDS.COLLECTION), chainBytes, Buffer.from(sourceContract.replace('0x',''), 'hex')],
    programId
  );
}

/**
 * Get mint authority PDA
 */
export async function getMintAuthorityPDA(sealHash, programId = new PublicKey(PROGRAM_ADDRESSES.PROGRAM)) {
  return getProgramAddress(
    SOLANA_DEVNET,
    [Buffer.from(SEEDS.MINT), Buffer.from(sealHash)],
    programId
  );
}

/**
 * Retry RPC call with exponential backoff
 */
export async function retrySolanaRpc(fn, label, maxRetries = 8) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (e) {
      const isRateLimit = 
        e.message?.includes('429') || 
        e.message?.includes('rate limit') ||
        e.message?.includes('Too Many') ||
        e.message?.includes('Service Unavailable');
      
      if (isRateLimit && i < maxRetries - 1) {
        const waitMs = 3000 * (i + 1);
        console.log(`  ⚠️ ${label}: rate limited, waiting ${waitMs}ms...`);
        await new Promise(r => setTimeout(r, waitMs));
      } else {
        throw e;
      }
    }
  }
}

/**
 * Send and confirm transaction
 */
export async function sendAndConfirm(connection, keypair, tx, extraSigners = []) {
  const signers = [keypair, ...extraSigners];
  
  const { blockhash } = await retrySolanaRpc(
    () => connection.getLatestBlockhash(),
    'getLatestBlockhash'
  );
  
  tx.recentBlockhash = blockhash;
  tx.feePayer = keypair.publicKey;
  
  tx.sign(...signers);
  
  const signature = await retrySolanaRpc(
    () => connection.sendRawTransaction(tx.serialize(), { skipPreflight: false }),
    'sendRawTransaction'
  );
  
  await retrySolanaRpc(
    () => connection.confirmTransaction(signature, 'confirmed'),
    'confirmTransaction'
  );
  
  return signature;
}

/**
 * Create Ed25519 instruction using the precompile
 */
export function createEd25519Instruction(publicKey, message, signer) {
  // Using the Ed25519 program directly
  const { Ed25519Program } = require('@solana/web3.js');
  return Ed25519Program.createInstructionWithPublicKey({
    publicKey: publicKey.toBytes(),
    message: Buffer.from(message),
    signature: signer(message),
  });
}

/**
 * Check if account exists
 */
export async function accountExists(connection, address) {
  try {
    const info = await retrySolanaRpc(
      () => connection.getAccountInfo(address),
      'getAccountInfo'
    );
    return info !== null;
  } catch {
    return false;
  }
}

/**
 * Get account data
 */
export async function getAccountData(connection, address) {
  return retrySolanaRpc(
    () => connection.getAccountInfo(address),
    'getAccountInfo'
  );
}

/**
 * Derive chain ID constant
 */
export const CHAIN_IDS = {
  ETHEREUM: 1,
  SUI: 2,
  SOLANA: 3,
  NEAR: 4,
  BITCOIN: 5,
};
