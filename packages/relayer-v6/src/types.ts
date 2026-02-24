/**
 * Types for Ika Tensei v7 Relayer
 *
 * Shared types matching the Sui contract events, Solana program instructions,
 * and the relayer API for dWallet creation.
 *
 * All binary data from Sui events arrives as hex strings; ProcessedSeal converts
 * them to Uint8Array for use in Solana transactions.
 */

// ─── Sui Events ──────────────────────────────────────────────────────────────

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
 * SealPending event emitted by the Sui Orchestrator contract.
 * The relayer subscribes to these events and triggers the signing flow.
 */
export interface SealPendingEvent {
  /** Hex-encoded VAA hash */
  vaa_hash: string;
  /** Source chain ID */
  source_chain: number;
  /** Hex-encoded deposit address */
  deposit_address: string;
  /** Hex-encoded 32-byte Solana public key of the NFT receiver */
  receiver: string;
  /** Hex-encoded 32-byte SHA256 message hash to be signed */
  message_hash: string;
  /** Unix timestamp */
  timestamp: number;
}

// ─── Processed Data ──────────────────────────────────────────────────────────

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

// ─── API Types (v7: dWallet creation with SOL payment gate) ─────────────────

/**
 * Request to start a seal — initiates a payment session.
 */
export interface StartSealRequest {
  /** User's Solana wallet address (receiver of the reborn NFT) */
  solanaWallet: string;
  /** Source chain identifier (e.g. "ethereum", "polygon", "sui", "near") */
  sourceChain: string;
}

/**
 * Response from seal start — session ID and payment details.
 */
export interface StartSealResponse {
  /** Unique session ID (UUID) for this seal request */
  sessionId: string;
  /** Solana address to send SOL payment to */
  paymentAddress: string;
  /** Required payment amount in lamports */
  feeAmountLamports: number;
}

/**
 * Request to confirm payment and trigger dWallet creation.
 */
export interface ConfirmPaymentRequest {
  /** Session ID from /api/seal/start */
  sessionId: string;
  /** Solana transaction signature of the SOL payment */
  paymentTxSignature: string;
}

/**
 * Result of verifying a SOL payment transaction on-chain.
 */
export interface PaymentVerificationResult {
  /** Whether the payment was verified successfully */
  verified: boolean;
  /** Error message if verification failed */
  error?: string;
  /** Actual lamports transferred (for logging/debugging) */
  actualLamports?: number;
}

/**
 * Status of a seal in progress.
 */
export type SealStatusValue =
  | 'awaiting_payment'
  | 'payment_confirmed'
  | 'creating_dwallet'
  | 'waiting_deposit'
  | 'detected'
  | 'verifying_vaa'
  | 'signing'
  | 'minting'
  | 'complete'
  | 'error';

/**
 * Response from seal status polling.
 */
export interface SealStatusResponse {
  sessionId: string;
  dwalletId?: string;
  status: SealStatusValue;
  depositAddress?: string;
  rebornNFT?: {
    mint: string;
    name: string;
    image: string;
  };
  error?: string;
}

/**
 * Internal tracking of a seal session (stored in-memory by the relayer).
 */
export interface SealSession {
  sessionId: string;
  solanaWallet: string;
  sourceChain: string;
  status: SealStatusValue;
  createdAt: number;
  /** Set after dWallet creation */
  dwalletId?: string;
  /** Set after dWallet creation */
  depositAddress?: string;
  /** Set after dWallet creation */
  dwalletPubkey?: Uint8Array;
  /** SOL payment tx signature (set after confirm-payment) */
  paymentTxSignature?: string;
  /** Timestamp when payment was verified */
  paymentVerifiedAt?: number;
  rebornNFT?: { mint: string; name: string; image: string };
  error?: string;
}

/**
 * Created dWallet from IKA SDK.
 */
export interface CreatedDWallet {
  /** dWallet ID on Sui */
  id: string;
  /** Ed25519 public key (32 bytes) */
  pubkey: Uint8Array;
  /** Chain-specific deposit address */
  depositAddress: string;
  /** DKG user secret key share (needed for createUserSignMessageWithPublicOutput) */
  userSecretKeyShare: Uint8Array;
  /** DKG user public output (needed for createUserSignMessageWithPublicOutput) */
  userPublicOutput: Uint8Array;
}

// ─── Presign Pool ────────────────────────────────────────────────────────────

/**
 * A presign cap entry in the in-memory pool.
 */
export interface PresignEntry {
  /** Sui object ID of the UnverifiedPresignCap */
  objectId: string;
  /** IKA presign ID (for polling completion) */
  presignId: string;
  /** BCS bytes of the presign (needed for createUserSignMessage) */
  presignBcs: Uint8Array;
  /** Current status */
  status: 'AVAILABLE' | 'ALLOCATED' | 'USED';
  /** Timestamp when allocated */
  allocatedAt?: number;
  /** VAA hash this presign is allocated for */
  allocatedFor?: string;
}

/**
 * Presign pool statistics.
 */
export interface PresignPoolStats {
  available: number;
  allocated: number;
  used: number;
  total: number;
}

// ─── Config ──────────────────────────────────────────────────────────────────

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

  // Sui keypair for transactions (dWallet creation, VAA submission)
  suiKeypairPath: string;

  // IKA network ('testnet' | 'mainnet')
  ikaNetwork: 'testnet' | 'mainnet';

  // 32-byte hex seed for IKA UserShareEncryptionKeys (keep secret!)
  ikaEncryptionSeed: string;

  // API server
  apiPort: number;

  // Payment gate
  sealFeeLamports: number;

  // Sui DWalletRegistry object IDs (optional — validated at call time)
  suiRegistryObjectId: string;
  suiRegistryCapObjectId: string;

  // Sui shared object IDs for signing flow
  suiOrchestratorStateId: string;
  suiSigningStateId: string;
  suiMintingAuthorityId: string;
  suiAdminCapId: string;

  // Treasury minimum balances (in MIST)
  minIkaBalanceMist: bigint;
  minSuiBalanceMist: bigint;

  // Presign pool tuning
  presignPoolMinAvailable: number;
  presignPoolReplenishBatch: number;

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
