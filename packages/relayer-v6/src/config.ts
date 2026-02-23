/**
 * Configuration for Ika Tensei v6 Relayer
 * 
 * Loads from environment variables with validation
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
    healthPort: parseInt(process.env.HEALTH_PORT || '8080', 10),
    maxRetries: parseInt(process.env.MAX_RETRIES || '3', 10),
    retryDelayMs: parseInt(process.env.RETRY_DELAY_MS || '1000', 10),
  };
}

/**
 * Export config getter for use in other modules
 */
export const config = getConfig();
