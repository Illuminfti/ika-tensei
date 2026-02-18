/**
 * Relayer configuration with validation
 */

import { PublicKey } from '@solana/web3.js';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';

export interface RelayerConfig {
  // Chain Configuration
  suiRpcUrl: string;
  solanaRpcUrl: string;
  ikaNetwork: 'mainnet' | 'testnet' | 'devnet';

  // Contract Addresses
  suiPackageId: string;
  suiRegistryId: string;
  suiVaultId: string;
  solanaProgramId: PublicKey;
  mplCoreProgramId: PublicKey;

  // IKA dWallet
  dwalletCapId: string;
  dwalletId: string;
  encryptedShareId: string;
  dwalletPubkey: Uint8Array;

  // Keypairs
  suiKeypair: Ed25519Keypair;
  solanaKeypairBytes: Uint8Array;

  // Relayer Settings
  healthPort: number;
  dbPath: string;
  queueConcurrency: number;
  queuePollIntervalMs: number;
  maxRetries: number;
  retryDelayMs: number;
  logLevel: string;

  // API Server
  apiPort: number;

  // dWallet Pool
  poolTargetSize: number;
  poolReplenishThreshold: number;

  // Deposit Detector
  alchemyApiKey: string;
  alchemyWebhookSecret: string;
  heliusApiKey: string;
  depositPollIntervalMs: number;

  // Metaplex Core Collection (create once, reuse for all reborn NFTs)
  rebornCollectionAddress?: string;
}

function parseEnvChainId(value: string | undefined, key: string): 'mainnet' | 'testnet' | 'devnet' {
  if (!value) throw new Error(`${key} is required`);
  if (!['mainnet', 'testnet', 'devnet'].includes(value)) {
    throw new Error(`${key} must be mainnet, testnet, or devnet`);
  }
  return value as 'mainnet' | 'testnet' | 'devnet';
}

function parsePublicKey(value: string | undefined, key: string): PublicKey {
  if (!value) throw new Error(`${key} is required`);
  try {
    return new PublicKey(value);
  } catch {
    throw new Error(`${key} is not a valid Solana public key`);
  }
}

function parseHexBytes(value: string | undefined, key: string): Uint8Array {
  if (!value) throw new Error(`${key} is required`);
  try {
    const cleaned = value.replace(/^0x/, '');
    if (cleaned.length !== 64) {
      throw new Error(`${key} must be 32 bytes (64 hex chars)`);
    }
    const bytes = new Uint8Array(32);
    for (let i = 0; i < 32; i++) {
      bytes[i] = parseInt(cleaned.slice(i * 2, i * 2 + 2), 16);
    }
    return bytes;
  } catch (e) {
    if (e instanceof Error && e.message.includes('must be 32 bytes')) throw e;
    throw new Error(`${key} must be valid hex (64 characters)`);
  }
}

function parseKeypairFromBase64(value: string | undefined, key: string): Uint8Array {
  if (!value) throw new Error(`${key} is required`);
  try {
    const decoded = Buffer.from(value, 'base64');
    if (decoded.length !== 32 && decoded.length !== 64) {
      throw new Error(`${key} must be 32 or 64 bytes`);
    }
    // For Sui: [flag(1) + privkey(32)] = 33 bytes, or just privkey = 32 bytes
    // We'll store the full 32-byte secret key portion
    // If 64 bytes (Solana keypair), use first 32
    // If 32 bytes, use all
    // If 33 bytes (Sui keystore), skip first byte
    const keyLen: number = decoded.length;
    let startOffset = 0;
    if (keyLen === 64) {
      startOffset = 0;
    } else if (keyLen === 32) {
      startOffset = 0;
    } else if (keyLen === 33) {
      startOffset = 1;
    }
    return new Uint8Array(decoded.slice(startOffset, startOffset + 32));
  } catch (e) {
    if (e instanceof Error) throw e;
    throw new Error(`${key} must be valid base64`);
  }
}

export async function loadConfig(): Promise<RelayerConfig> {
  // Load .env file if exists
  try {
    const dotenv = await import('dotenv');
    dotenv.config();
  } catch {
    // dotenv not available
  }

  const env = process.env;

  // Parse chain IDs
  const ikaNetwork = parseEnvChainId(env.IKA_NETWORK, 'IKA_NETWORK');
  
  // Parse contract addresses
  const solanaProgramId = parsePublicKey(env.SOLANA_PROGRAM_ID, 'SOLANA_PROGRAM_ID');
  const mplCoreProgramId = env.MPL_CORE_PROGRAM_ID 
    ? parsePublicKey(env.MPL_CORE_PROGRAM_ID, 'MPL_CORE_PROGRAM_ID')
    : new PublicKey('CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d'); // Default

  // Parse IKA dWallet - all required, no defaults
  const dwalletCapId = env.DWALLET_CAP_ID;
  if (!dwalletCapId) throw new Error('DWALLET_CAP_ID is required');
  
  const dwalletId = env.DWALLET_ID;
  if (!dwalletId) throw new Error('DWALLET_ID is required');
  
  const encryptedShareId = env.ENCRYPTED_SHARE_ID;
  if (!encryptedShareId) throw new Error('ENCRYPTED_SHARE_ID is required');
  
  const dwalletPubkeyHex = env.DWALLET_PUBKEY_HEX;
  if (!dwalletPubkeyHex) throw new Error('DWALLET_PUBKEY_HEX is required');
  const dwalletPubkey = parseHexBytes(dwalletPubkeyHex, 'DWALLET_PUBKEY_HEX');

  // Parse Sui contract addresses - all required, no defaults
  const suiPackageId = env.SUI_PACKAGE_ID;
  if (!suiPackageId) throw new Error('SUI_PACKAGE_ID is required');
  
  const suiRegistryId = env.SUI_REGISTRY_ID;
  if (!suiRegistryId) throw new Error('SUI_REGISTRY_ID is required');
  
  const suiVaultId = env.SUI_VAULT_ID;
  if (!suiVaultId) throw new Error('SUI_VAULT_ID is required');

  // Parse Sui keypair - REQUIRED
  const suiKeypairBase64 = env.SUI_KEYPAIR_BASE64;
  if (!suiKeypairBase64) throw new Error('SUI_KEYPAIR_BASE64 is required - no fallback to system keystore');
  const suiKeypairBytes = parseKeypairFromBase64(suiKeypairBase64, 'SUI_KEYPAIR_BASE64');
  const suiKeypair = Ed25519Keypair.fromSecretKey(suiKeypairBytes);

  // Parse Solana keypair - REQUIRED
  const solanaKeypairBase64 = env.SOLANA_KEYPAIR_BASE64;
  if (!solanaKeypairBase64) throw new Error('SOLANA_KEYPAIR_BASE64 is required - no fallback to system keypair');
  const solanaKeypairBytes = parseKeypairFromBase64(solanaKeypairBase64, 'SOLANA_KEYPAIR_BASE64');

  // Parse relayer settings
  const healthPort = parseInt(env.HEALTH_PORT || '3470', 10);
  if (isNaN(healthPort) || healthPort < 1 || healthPort > 65535) {
    throw new Error('HEALTH_PORT must be a valid port number');
  }

  const queueConcurrency = parseInt(env.QUEUE_CONCURRENCY || '5', 10);
  const queuePollIntervalMs = parseInt(env.QUEUE_POLL_INTERVAL_MS || '5000', 10);
  const maxRetries = parseInt(env.MAX_RETRIES || '3', 10);
  const retryDelayMs = parseInt(env.RETRY_DELAY_MS || '5000', 10);
  const logLevel = env.LOG_LEVEL || 'info';

  return {
    // Chain Configuration
    suiRpcUrl: env.SUI_RPC_URL || 'https://rpc-testnet.suiscan.xyz:443',
    solanaRpcUrl: env.SOLANA_RPC_URL || 'https://api.devnet.solana.com',
    ikaNetwork,

    // Contract Addresses (required)
    suiPackageId,
    suiRegistryId,
    suiVaultId,
    solanaProgramId,
    mplCoreProgramId,

    // IKA dWallet
    dwalletCapId,
    dwalletId,
    encryptedShareId,
    dwalletPubkey,

    // Keypairs
    suiKeypair,
    solanaKeypairBytes,

    // Relayer Settings
    healthPort,
    dbPath: env.DB_PATH || './data/relayer.db',
    queueConcurrency,
    queuePollIntervalMs,
    maxRetries,
    retryDelayMs,
    logLevel,

    // API Server
    apiPort: parseInt(env.API_PORT || '3471', 10),

    // dWallet Pool
    poolTargetSize: parseInt(env.POOL_TARGET_SIZE || '20', 10),
    poolReplenishThreshold: parseInt(env.POOL_REPLENISH_THRESHOLD || '5', 10),

    // Deposit Detector
    alchemyApiKey: env.ALCHEMY_API_KEY || '',
    alchemyWebhookSecret: env.ALCHEMY_WEBHOOK_SECRET || '',
    heliusApiKey: env.HELIUS_API_KEY || '',
    depositPollIntervalMs: parseInt(env.DEPOSIT_POLL_INTERVAL_MS || '30000', 10),

    // Metaplex Core Collection
    rebornCollectionAddress: env.REBORN_COLLECTION_ADDRESS || undefined,
  };
}
