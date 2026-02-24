/**
 * Configuration for Ika Tensei v7 Relayer
 *
 * Loads from environment variables with validation.
 * v7 adds: SUI_KEYPAIR_PATH (for Sui txs), API_PORT (for HTTP API).
 */

import { RelayerConfig } from './types.js';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Required environment variables
 */
const REQUIRED_ENV_VARS = [
  'SUI_RPC_URL',
  'SUI_WS_URL',
  'SUI_PACKAGE_ID',
  'SOLANA_RPC_URL',
  'SOLANA_PROGRAM_ID',
  'RELAYER_KEYPAIR_PATH',
  'SUI_KEYPAIR_PATH',
] as const;

/**
 * Validate all required environment variables are set
 */
function validateEnv(): void {
  const missing = REQUIRED_ENV_VARS.filter(
    (varName) => !process.env[varName]
  );

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}`
    );
  }
}

/**
 * Get relayer configuration from environment
 */
export function getConfig(): RelayerConfig {
  validateEnv();

  return {
    suiRpcUrl: process.env.SUI_RPC_URL!,
    suiWsUrl: process.env.SUI_WS_URL!,
    suiPackageId: process.env.SUI_PACKAGE_ID!,
    solanaRpcUrl: process.env.SOLANA_RPC_URL!,
    solanaProgramId: process.env.SOLANA_PROGRAM_ID!,
    relayerKeypairPath: process.env.RELAYER_KEYPAIR_PATH!,
    suiKeypairPath: process.env.SUI_KEYPAIR_PATH!,
    ikaNetwork: (process.env.IKA_NETWORK || 'testnet') as 'testnet' | 'mainnet',
    ikaEncryptionSeed: process.env.IKA_ENCRYPTION_SEED || '',
    apiPort: parseInt(process.env.API_PORT || '3001', 10),
    sealFeeLamports: parseInt(process.env.SEAL_FEE_LAMPORTS || '10000000', 10), // 0.01 SOL default
    suiRegistryObjectId: process.env.SUI_REGISTRY_OBJECT_ID || '',
    suiRegistryCapObjectId: process.env.SUI_REGISTRY_CAP_OBJECT_ID || '',
    suiOrchestratorStateId: process.env.SUI_ORCHESTRATOR_STATE_ID || '',
    suiSigningStateId: process.env.SUI_SIGNING_STATE_ID || '',
    suiMintingAuthorityId: process.env.SUI_MINTING_AUTHORITY_ID || '',
    suiAdminCapId: process.env.SUI_ADMIN_CAP_ID || '',
    minIkaBalanceMist: BigInt(process.env.MIN_IKA_BALANCE_MIST || '50000000000'), // 50 IKA default
    minSuiBalanceMist: BigInt(process.env.MIN_SUI_BALANCE_MIST || '5000000000'),  // 5 SUI default
    presignPoolMinAvailable: parseInt(process.env.PRESIGN_POOL_MIN_AVAILABLE || '5', 10),
    presignPoolReplenishBatch: parseInt(process.env.PRESIGN_POOL_REPLENISH_BATCH || '5', 10),
    healthPort: parseInt(process.env.HEALTH_PORT || '8080', 10),
    maxRetries: parseInt(process.env.MAX_RETRIES || '3', 10),
    retryDelayMs: parseInt(process.env.RETRY_DELAY_MS || '1000', 10),
  };
}

/**
 * Export config getter for use in other modules
 */
export const config = getConfig();
