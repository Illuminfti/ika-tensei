/**
 * Types for Ika Tensei v6 Relayer
 *
 * Shared types matching the Sui contract events and Solana program instructions.
 * All binary data from Sui events arrives as hex strings; ProcessedSeal converts
 * them to Uint8Array for use in Solana transactions.
 */

/**
 * SealSigned event emitted by the Sui Orchestrator contract.
 * The relayer subscribes to these events and bridges them to Solana.
 *
 * All binary fields (nft_contract, token_id, receiver, etc.) are hex-encoded.
 * token_uri is hex-encoded UTF-8 bytes (decode with Buffer.from(hex,'hex').toString('utf8')).
 */
export interface SealSignedEvent {
  /** Source chain ID (e.g. 1 = Ethereum, 2 = BNB Chain) */
  source_chain: number;
  /** Hex-encoded NFT contract address on the source chain */
  nft_contract: string;
  /** Hex-encoded token ID */
  token_id: string;
  /** Hex-encoded UTF-8 token URI */
  token_uri: string;
  /** Hex-encoded 32-byte Solana public key of the NFT receiver */
  receiver: string;
  /** Hex-encoded deposit address (NOT the dWallet pubkey) */
  deposit_address: string;
  /** Hex-encoded 32-byte SHA256 message hash that was signed */
  message_hash: string;
  /** Hex-encoded 64-byte Ed25519 signature from the IKA dWallet */
  signature: string;
  /** Hex-encoded 32-byte Ed25519 public key of the IKA dWallet that produced the signature */
  dwallet_pubkey: string;
  /** Hex-encoded VAA hash from Wormhole (for verification) */
  vaa_hash: string;
  /** Unix timestamp of the seal event */
  timestamp: number;
}

/**
 * Parsed and processed seal data, ready for Solana submission.
 * All binary data is decoded from hex into Uint8Array/number.
 */
export interface ProcessedSeal {
  /** 64-byte Ed25519 signature from the IKA dWallet */
  signature: Uint8Array;
  /** 32-byte Ed25519 public key of the IKA dWallet (NOT deposit_address) */
  dwalletPubkey: Uint8Array;
  /** Source chain ID */
  sourceChain: number;
  /** Raw NFT contract bytes */
  nftContract: Uint8Array;
  /** Raw token ID bytes */
  tokenId: Uint8Array;
  /** Decoded UTF-8 token URI string */
  tokenUri: string;
  /** 32-byte Solana public key of the NFT receiver */
  receiver: Uint8Array;
  /** Reborn collection name derived on-chain */
  collectionName: string;
  /** 32-byte SHA256 message hash */
  messageHash: Uint8Array;
}

/**
 * Relayer configuration (loaded from environment variables).
 */
export interface RelayerConfig {
  // Sui
  suiRpcUrl: string;
  suiWsUrl: string;
  suiPackageId: string;

  // Solana
  solanaRpcUrl: string;
  solanaProgramId: string;

  // Relayer keypair file path
  relayerKeypairPath: string;

  // Optional tuning
  healthPort: number;
  maxRetries: number;
  retryDelayMs: number;
}

/**
 * Result of a Solana transaction submission attempt.
 */
export interface SubmissionResult {
  success: boolean;
  txHash?: string;
  error?: string;
  retries: number;
}

/**
 * Health check response shape.
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

/**
 * Persisted event cursor so the relayer can replay missed events on restart.
 */
export interface EventCursor {
  txDigest: string;
  eventSeq: string;
}
