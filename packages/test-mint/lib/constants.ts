// ─── Sui Test NFT ────────────────────────────────────────────────────────────
// Published standalone test_nft package on Sui testnet.

export const TEST_NFT_PACKAGE_ID =
  process.env.NEXT_PUBLIC_TEST_NFT_PACKAGE_ID ||
  "0x4757a80fc0031ef038b96c7818be891f95f67000d127acbdb85cfa2697ef16af";

export const MINT_COUNTER_ID =
  process.env.NEXT_PUBLIC_MINT_COUNTER_ID ||
  "0x3cf1b494daa7ace0edef4052658c2da743d0284abff9bc144bff151346ad74d7";

export const SUI_NETWORK = "testnet";

// ─── NEAR Test NFT ──────────────────────────────────────────────────────────
// Deploy the test-nft contract from packages/near-contracts/test-nft/ to this account.

export const NEAR_TEST_NFT_CONTRACT =
  process.env.NEXT_PUBLIC_NEAR_TEST_NFT_CONTRACT || "ika-test-nft.testnet";

export const NEAR_NETWORK_ID = "testnet";
