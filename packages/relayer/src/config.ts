/**
 * Relayer configuration with validation
 */

import { PublicKey } from '@solana/web3.js';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { readFileSync } from 'fs';
import { homedir } from 'os';

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

function loadDefaultKeystore(): Uint8Array | null {
  try {
    const keystorePath = `${homedir()}/.sui/sui_config/sui.keystore`;
    const content = readFileSync(keystorePath, 'utf8');
    const keystore = JSON.parse(content);
    if (keystore && keystore[0]) {
      const decoded = Buffer.from(keystore[0], 'base64');
      // Sui keystore format: [flag(1) + privkey(32)]
      if (decoded.length >= 33) {
        return new Uint8Array(decoded.slice(1, 33));
      }
    }
  } catch {
    // Ignore - will use env var
  }
  return null;
}

function loadDefaultSolanaKeypair(): Uint8Array | null {
  try {
    const keypath = `${homedir()}/.config/solana/id.json`;
    const content = readFileSync(keypath, 'utf8');
    const keypair = JSON.parse(content);
    // Solana keypair is [privkey(64)]
    if (Array.isArray(keypair) && keypair.length >= 64) {
      const bytes = new Uint8Array(64);
      for (let i = 0; i < 64; i++) {
        bytes[i] = keypair[i];
      }
      return bytes;
    }
  } catch {
    // Ignore - will use env var
  }
  return null;
}

export function loadConfig(): RelayerConfig {
  // Load .env file if exists
  try {
    import('dotenv').then(dotenv => {
      dotenv.config();
    }).catch(() => {});
  } catch {
    // dotenv not available at compile time
  }

  const env = process.env;

  // Parse chain IDs
  const ikaNetwork = parseEnvChainId(env.IKA_NETWORK, 'IKA_NETWORK');
  
  // Parse contract addresses
  const solanaProgramId = parsePublicKey(env.SOLANA_PROGRAM_ID, 'SOLANA_PROGRAM_ID');
  const mplCoreProgramId = env.MPL_CORE_PROGRAM_ID 
    ? parsePublicKey(env.MPL_CORE_PROGRAM_ID, 'MPL_CORE_PROGRAM_ID')
    : new PublicKey('CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d'); // Default

  // Parse IKA dWallet
  const dwalletCapId = env.DWALLET_CAP_ID || '0xae22f56a0c471eb338be0e5103c074a7a76b86271ca0c90a9f6e508d5741d7fa';
  const dwalletId = env.DWALLET_ID || '0x36ada1f568e2f8aa89590d0157db5732d5ade4080dbf34adddb4e52788a39a32';
  const encryptedShareId = env.ENCRYPTED_SHARE_ID || '0x09988d0cc971bf6f47c3d21247e4aa391a22f9d2c21995c87dcfbd0ca34287dc';
  const dwalletPubkeyHex = env.DWALLET_PUBKEY_HEX || '46453f6becb294253dd798a96d86bf62871239aeda8d67d6ea5f788fb0cab756';
  const dwalletPubkey = parseHexBytes(dwalletPubkeyHex, 'DWALLET_PUBKEY_HEX');

  // Parse Sui keypair
  let suiKeypairBytes: Uint8Array;
  if (env.SUI_KEYPAIR_BASE64) {
    suiKeypairBytes = parseKeypairFromBase64(env.SUI_KEYPAIR_BASE64, 'SUI_KEYPAIR_BASE64');
  } else {
    const defaultBytes = loadDefaultKeystore();
    if (!defaultBytes) {
      throw new Error('Sui keypair not configured: set SUI_KEYPAIR_BASE64 or use default keystore');
    }
    suiKeypairBytes = defaultBytes;
  }
  const suiKeypair = Ed25519Keypair.fromSecretKey(suiKeypairBytes);

  // Parse Solana keypair
  let solanaKeypairBytes: Uint8Array;
  if (env.SOLANA_KEYPAIR_BASE64) {
    solanaKeypairBytes = parseKeypairFromBase64(env.SOLANA_KEYPAIR_BASE64, 'SOLANA_KEYPAIR_BASE64');
  } else {
    const defaultBytes = loadDefaultSolanaKeypair();
    if (!defaultBytes) {
      throw new Error('Solana keypair not configured: set SOLANA_KEYPAIR_BASE64 or use default keypair');
    }
    solanaKeypairBytes = defaultBytes;
  }

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

    // Contract Addresses
    suiPackageId: env.SUI_PACKAGE_ID || '0x22a886dfaa15087cbe092b4f7f3135e802c02f8b9fa68d267173de1edc55036e',
    suiRegistryId: env.SUI_REGISTRY_ID || '0xffa3bb04b8cdb11c905900da846cc92f70049654b2d9661269c8ba73c3e71294',
    suiVaultId: env.SUI_VAULT_ID || '0x0fccb85175e9f0a0ad99e445bdde187be2a2967d73b0402cb4ca147c5273b9a0',
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
  };
}
