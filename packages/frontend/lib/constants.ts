// ─── Contract Addresses (Testnet) ──────────────────────────────────────────────

export const CONTRACTS = {
  sui: {
    package:
      "0x3f7407c823149a6923e25314546b973ea95bec788958b0c1d6cb78b1896fe177",
    originalPackage:
      "0x97840fdad11094201bdcc7298b0caa3627bc9822ec388e4b309ffa2dd7373811",
  },
  solana: {
    program: "2bW2SFSuiBMCef2xNk892uVfSTqjkRGmv6jD9PHKqzW4",
    coreVoter: "E5thJCWofTMbmyhUhCai3hZiruFtYmmscDio6GwFCGaW",
  },
  baseSepolia: {
    sealInitiator: "0xC3f5B155ce06c7cBC470B4e8603AB00a65f1fDc7",
    testNft: "0x993C47d2a7cBf2575076c239d03adcf4480dA141",
  },
  ethereumSepolia: {
    sealInitiator: "0x986458C2f51e52342C1ca28E55D9bc64789D5075",
    testNft: "0xC3f5B155ce06c7cBC470B4e8603AB00a65f1fDc7",
  },
} as const;

// ─── Backend API ──────────────────────────────────────────────────────────────

export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "";

// ─── Explorer URLs (Testnet) ────────────────────────────────────────────────

export const EXPLORERS = {
  ethereum: "https://sepolia.etherscan.io",
  base: "https://sepolia.basescan.org",
  solana: "https://explorer.solana.com/?cluster=devnet",
} as const;

// ─── Dynamic.xyz ──────────────────────────────────────────────────────────────

export const DYNAMIC_ENV_ID =
  process.env.NEXT_PUBLIC_DYNAMIC_ENV_ID || "";

// ─── Supported Chains ─────────────────────────────────────────────────────────

export interface SupportedChain {
  id: string;
  name: string;
  abbreviation: string;
  color: string;
  textColor: string;
  chainType: "evm";
  wormholeChainId: number;
  category: "evm" | "other";
  explorerUrl: string;
  /** Whether this chain is testnet-ready (has contracts deployed + relayer support) */
  testnetReady: boolean;
  /** Testnet faucet URL for native tokens */
  faucetUrl?: string;
  /** Test NFT contract address (for the faucet page) */
  testNftContract?: string;
}

export const SUPPORTED_CHAINS: SupportedChain[] = [
  // ── EVM Chains ──
  {
    id: "base-sepolia",
    name: "Base Sepolia",
    abbreviation: "BASE",
    color: "#0052ff",
    textColor: "#ffffff",
    chainType: "evm",
    wormholeChainId: 10004,
    category: "evm",
    explorerUrl: "https://sepolia.basescan.org",
    testnetReady: true,
    faucetUrl: "https://www.alchemy.com/faucets/base-sepolia",
    testNftContract: CONTRACTS.baseSepolia.testNft,
  },
  {
    id: "ethereum-sepolia",
    name: "Ethereum Sepolia",
    abbreviation: "ETH",
    color: "#627eea",
    textColor: "#ffffff",
    chainType: "evm",
    wormholeChainId: 10002,
    category: "evm",
    explorerUrl: "https://sepolia.etherscan.io",
    testnetReady: true,
    faucetUrl: "https://www.alchemy.com/faucets/ethereum-sepolia",
    testNftContract: CONTRACTS.ethereumSepolia.testNft,
  },
];

export const EVM_CHAINS = SUPPORTED_CHAINS.filter((c) => c.category === "evm");

// Only chains that are testnet-ready
export const TESTNET_CHAINS = SUPPORTED_CHAINS.filter((c) => c.testnetReady);

export function getChainById(id: string): SupportedChain | undefined {
  return SUPPORTED_CHAINS.find((c) => c.id === id);
}
