/**
 * Types for Ika Tensei v6 Relayer
 * 
 * Shared types matching the Sui contract events and Solana program instructions
 */

/**
 * SealSigned event emitted by Sui Orchestrator contract
 * This is the event the relayer subscribes to on Sui
 */
export interface SealSignedEvent {
  source_chain: number;
  nft_contract: string;
  token_id: string;
  token_uri: string;
  receiver: string;
  deposit_address: string;
  message_hash: string;
  signature: string;
}

/**
 * Parsed and processed seal data ready for Solana submission
 */
export interface ProcessedSeal {
  signature: Uint8Array;
  dwalletPubkey: Uint8Array;
  sourceChain: number;
  nftContract: string;
  tokenId: string;
  tokenUri: string;
  receiver: string;
  collectionName: string;
  messageHash: string;
  originalEvent: SealSignedEvent;
}

/**
 * Relayer configuration
 */
export interface RelayerConfig {
  // Sui configuration
  suiRpcUrl: string;
  suiWsUrl: string;
  suiPackageId: string;
  
  // Solana configuration
  solanaRpcUrl: string;
  solanaProgramId: string;
  
  // Relayer keypair
  relayerKeypairPath: string;
  
  // Optional: Health check port
  healthPort: number;
  
  // Optional: Retry configuration
  maxRetries: number;
  retryDelayMs: number;
}

/**
 * Result of a Solana transaction submission
 */
export interface SubmissionResult {
  success: boolean;
  txHash?: string;
  error?: string;
  retries: number;
}

/**
 * Health check response
 */
export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'down';
  timestamp: number;
  suiConnected: boolean;
  solanaConnected: boolean;
  lastProcessedEvent?: string;
  eventsProcessed: number;
  eventsFailed: number;
}
