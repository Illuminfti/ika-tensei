/**
 * Protocol constants for Ika Tensei v3
 * Per PRD §12
 */

// Chain IDs
export const CHAIN_ID_ETHEREUM = 1;
export const CHAIN_ID_SUI = 2;
export const CHAIN_ID_SOLANA = 3;
export const CHAIN_ID_NEAR = 4;
export const CHAIN_ID_BITCOIN = 5;

// Protocol version
export const PROTOCOL_VERSION = 3;

// Fee distribution (basis points)
export const GUILD_SHARE_BPS = 500; // 5%
export const TEAM_SHARE_BPS = 190; // 1.9%

// Mint fee (lamports for Solana)
export const MINT_FEE = 1_000_000; // 0.001 SOL

// Size limits
export const MAX_NAME_LENGTH = 32;
export const MAX_URI_LENGTH = 200;
export const MAX_CONTRACT_LENGTH = 64;
export const MAX_TOKEN_ID_LENGTH = 64;

// Seal flow steps
export const TOTAL_SEAL_STEPS = 9;

// Timeouts (milliseconds)
export const VAA_POLL_TIMEOUT = 60_000; // 1 minute
export const VAA_POLL_INTERVAL = 5_000; // 5 seconds
export const TX_CONFIRM_TIMEOUT = 30_000; // 30 seconds

// Wormhole
export const WORMHOLE_GUARDIAN_THRESHOLD = 13;
export const WORMHOLE_GUARDIAN_COUNT = 19;

// Sui
export const SUI_GAS_BUDGET = 50_000_000; // 0.05 SUI default
export const SUI_MAX_GAS_BUDGET = 100_000_000; // 0.1 SUI max

// Relayer
export const RELAYER_ENDPOINT = '/api/relay';

// Contract addresses (mainnet - to be updated on deployment)
export const SOLANA_PROGRAM_ID = ''; // TBD - new deployment
export const SUI_PACKAGE_ID = ''; // TBD - new deployment

// Wormhole contract addresses
export const WORMHOLE_SUI_MAINNET = '0xaeab97f96cf9877fee2883315d459552b2b921edc16d7ceac6eab944dd88919c';
export const WORMHOLE_SUI_TESTNET = '0x31358d198147da50db32eda2562951d53973a0c0ad5ed738e9b17d88b213d790';

export const WORMHOLE_ETH_MAINNET = '0x98f3c9e6E3fAce36bAAd05FE09d375Ef1464288B';
export const WORMHOLE_ETH_SEPOLIA = '0x4a8bc80Ed5a4067f1CCf107057b8270E0cC11A78';

export const WORMHOLE_SOL_MAINNET = 'worm2ZoG2kUd4vFXhvjh93UUH596ayRfgQ2MgjNMTth';
export const WORMHOLE_SOL_DEVNET = '3u8hJUVTA4jH1wYAyUur7FFZVQ8H635K3tSHHF4ssjQ5';

// API endpoints
export const WORMHOLE_API_BASE = 'https://api.wormholescan.io';
export const WORMHOLE_API_VAA = '/v1/signed_vaa';

// Fee estimation (USD)
export const ESTIMATED_FEE_STANDARD = 3.50; // $2-5 range
export const ESTIMATED_FEE_PREMIUM = 5.00;

// IKA SDK
export const IKA_SDK_VERSION = '0.2.7';
export const IKA_API_ENDPOINT = 'https://api.ika.xyz';

// UI Constants
export const CONFIRMATION_BLOCKS = {
  [CHAIN_ID_ETHEREUM]: 12,
  [CHAIN_ID_SOLANA]: 32,
  [CHAIN_ID_SUI]: 1, // Sui has finality in 1 block
  [CHAIN_ID_NEAR]: 3,
  [CHAIN_ID_BITCOIN]: 6,
};

// Token standards per chain
export const NFT_STANDARDS = {
  [CHAIN_ID_ETHEREUM]: ['ERC-721', 'ERC-1155'],
  [CHAIN_ID_SOLANA]: ['SPL'],
  [CHAIN_ID_SUI]: ['Sui Object'],
  [CHAIN_ID_NEAR]: ['NEP-171'],
  [CHAIN_ID_BITCOIN]: ['Ordinals'],
} as const;

// Error codes
export const ERROR_CODES = {
  // Seal errors
  SEAL_INVALID_SOURCE_CHAIN: 'E001',
  SEAL_CONTRACT_NOT_REGISTERED: 'E002',
  SEAL_ALREADY_EXISTS: 'E003',
  SEAL_VAA_INVALID: 'E004',
  SEAL_VAA_ALREADY_USED: 'E005',
  SEAL_SIGNATURE_INVALID: 'E006',
  SEAL_DWALLET_MISMATCH: 'E007',
  SEAL_NONCE_USED: 'E008',
  
  // Collection errors
  COLLECTION_NOT_FOUND: 'C001',
  COLLECTION_INACTIVE: 'C002',
  COLLECTION_MAX_REACHED: 'C003',
  
  // Transaction errors
  TX_REVERTED: 'T001',
  TX_TIMEOUT: 'T002',
  TX_INSUFFICIENT_GAS: 'T003',
  
  // General errors
  UNKNOWN_CHAIN: 'U001',
  INVALID_ADDRESS: 'U002',
  INVALID_TOKEN_ID: 'U003',
} as const;

// Default values
export const DEFAULTS = {
  SOLANA_COMMITMENT: 'confirmed' as const,
  SUI_GAS_BUDGET: SUI_GAS_BUDGET,
  MAX_RETRIES: 3,
  RETRY_DELAY: 2000,
};
