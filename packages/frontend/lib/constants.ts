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
    deposit: "0x0000000000000000000000000000000000000000",
  },
} as const;

// Wormhole chain IDs (canonical)
export const WORMHOLE_CHAIN_IDS = {
  ETHEREUM: 2,
  BSC: 4,
  POLYGON: 5,
  AVALANCHE: 6,
  FANTOM: 10,
  CELO: 14,
  NEAR: 15,
  MOONBEAM: 16,
  SUI: 21,
  APTOS: 22,
  ARBITRUM: 23,
  OPTIMISM: 24,
  GNOSIS: 25,
  BASE: 30,
  SCROLL: 34,
  BLAST: 36,
  LINEA: 38,
  SOLANA: 1,
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

// ─── Supported chains for deposit ─────────────────────────────────────────────

export interface SupportedChain {
  id: string;
  name: string;
  abbreviation: string;
  color: string;
  textColor: string;
  chainType: "evm" | "solana" | "sui" | "aptos" | "near";
  wormholeChainId: number;
  category: "evm" | "other";
  explorerUrl: string;
}

export const SUPPORTED_CHAINS: SupportedChain[] = [
  // ── EVM Chains (secp256k1 — one address works on all) ──
  {
    id: "ethereum",
    name: "Ethereum",
    abbreviation: "ETH",
    color: "#627eea",
    textColor: "#ffffff",
    chainType: "evm",
    wormholeChainId: 2,
    category: "evm",
    explorerUrl: "https://etherscan.io",
  },
  {
    id: "polygon",
    name: "Polygon",
    abbreviation: "POL",
    color: "#8247e5",
    textColor: "#ffffff",
    chainType: "evm",
    wormholeChainId: 5,
    category: "evm",
    explorerUrl: "https://polygonscan.com",
  },
  {
    id: "arbitrum",
    name: "Arbitrum",
    abbreviation: "ARB",
    color: "#2d374b",
    textColor: "#28a0f0",
    chainType: "evm",
    wormholeChainId: 23,
    category: "evm",
    explorerUrl: "https://arbiscan.io",
  },
  {
    id: "base",
    name: "Base",
    abbreviation: "BASE",
    color: "#0052ff",
    textColor: "#ffffff",
    chainType: "evm",
    wormholeChainId: 30,
    category: "evm",
    explorerUrl: "https://basescan.org",
  },
  {
    id: "optimism",
    name: "Optimism",
    abbreviation: "OP",
    color: "#ff0420",
    textColor: "#ffffff",
    chainType: "evm",
    wormholeChainId: 24,
    category: "evm",
    explorerUrl: "https://optimistic.etherscan.io",
  },
  {
    id: "bsc",
    name: "BNB Chain",
    abbreviation: "BNB",
    color: "#f0b90b",
    textColor: "#000000",
    chainType: "evm",
    wormholeChainId: 4,
    category: "evm",
    explorerUrl: "https://bscscan.com",
  },
  {
    id: "avalanche",
    name: "Avalanche",
    abbreviation: "AVAX",
    color: "#e84142",
    textColor: "#ffffff",
    chainType: "evm",
    wormholeChainId: 6,
    category: "evm",
    explorerUrl: "https://snowtrace.io",
  },
  {
    id: "fantom",
    name: "Fantom",
    abbreviation: "FTM",
    color: "#1969ff",
    textColor: "#ffffff",
    chainType: "evm",
    wormholeChainId: 10,
    category: "evm",
    explorerUrl: "https://ftmscan.com",
  },
  {
    id: "moonbeam",
    name: "Moonbeam",
    abbreviation: "GLMR",
    color: "#53cbc9",
    textColor: "#000000",
    chainType: "evm",
    wormholeChainId: 16,
    category: "evm",
    explorerUrl: "https://moonscan.io",
  },
  {
    id: "celo",
    name: "Celo",
    abbreviation: "CELO",
    color: "#35d07f",
    textColor: "#000000",
    chainType: "evm",
    wormholeChainId: 14,
    category: "evm",
    explorerUrl: "https://celoscan.io",
  },
  {
    id: "scroll",
    name: "Scroll",
    abbreviation: "SCR",
    color: "#c39b78",
    textColor: "#000000",
    chainType: "evm",
    wormholeChainId: 34,
    category: "evm",
    explorerUrl: "https://scrollscan.com",
  },
  {
    id: "blast",
    name: "Blast",
    abbreviation: "BLAST",
    color: "#fcfc03",
    textColor: "#000000",
    chainType: "evm",
    wormholeChainId: 36,
    category: "evm",
    explorerUrl: "https://blastscan.io",
  },
  {
    id: "linea",
    name: "Linea",
    abbreviation: "LINEA",
    color: "#61dfff",
    textColor: "#000000",
    chainType: "evm",
    wormholeChainId: 38,
    category: "evm",
    explorerUrl: "https://lineascan.build",
  },
  {
    id: "gnosis",
    name: "Gnosis",
    abbreviation: "GNO",
    color: "#048a81",
    textColor: "#ffffff",
    chainType: "evm",
    wormholeChainId: 25,
    category: "evm",
    explorerUrl: "https://gnosisscan.io",
  },
  // ── Non-EVM Chains (Ed25519) ──
  {
    id: "sui",
    name: "Sui",
    abbreviation: "SUI",
    color: "#6fb8ff",
    textColor: "#000000",
    chainType: "sui",
    wormholeChainId: 21,
    category: "other",
    explorerUrl: "https://suiexplorer.com",
  },
  {
    id: "aptos",
    name: "Aptos",
    abbreviation: "APT",
    color: "#00d4c2",
    textColor: "#000000",
    chainType: "aptos",
    wormholeChainId: 22,
    category: "other",
    explorerUrl: "https://explorer.aptoslabs.com",
  },
  {
    id: "near",
    name: "NEAR",
    abbreviation: "NEAR",
    color: "#00c08b",
    textColor: "#000000",
    chainType: "near",
    wormholeChainId: 15,
    category: "other",
    explorerUrl: "https://nearblocks.io",
  },
];

export const EVM_CHAINS = SUPPORTED_CHAINS.filter((c) => c.category === "evm");
export const OTHER_CHAINS = SUPPORTED_CHAINS.filter((c) => c.category === "other");

export function getChainById(id: string): SupportedChain | undefined {
  return SUPPORTED_CHAINS.find((c) => c.id === id);
}
