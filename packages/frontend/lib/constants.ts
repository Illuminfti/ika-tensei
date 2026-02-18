// Contract addresses
export const CONTRACTS = {
  sui: {
    package: "0x22a886a6e93e385216b24e0bddee3c8b4df6ef2c86db45ee7ddb9b4e5a3a5f42",
    registry: "0x22a886a6e93e385216b24e0bddee3c8b4df6ef2c86db45ee7ddb9b4e5a3a5f42",
  },
  solana: {
    program: "mbEQvaiUYdc65Qz4rd67oBY1LbSCBq1Da8Y1MciwtPa",
  },
  ethereum: {
    deposit: "0x0000000000000000000000000000000000000000", // TODO: deploy to Sepolia
  },
} as const;

// Chain IDs for seal hash
export const CHAIN_IDS = {
  ETHEREUM: 1,
  SUI: 2,
  SOLANA: 3,
} as const;

// Backend API
export const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

// Explorer URLs
export const EXPLORERS = {
  ethereum: "https://sepolia.etherscan.io",
  solana: "https://explorer.solana.com/?cluster=devnet",
  sui: "https://suiscan.xyz/testnet",
} as const;

// Dynamic.xyz environment ID
export const DYNAMIC_ENV_ID = process.env.NEXT_PUBLIC_DYNAMIC_ENV_ID || "";
