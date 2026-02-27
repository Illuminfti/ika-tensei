// ─── Sui Test NFT ────────────────────────────────────────────────────────────
// NOTE: The test_nft module was NOT included in the original ika_nft package publish.
// You need to re-publish or upgrade the package to include it.
// After publishing, update MINT_COUNTER_ID with the shared MintCounter object ID.

export const TEST_NFT_PACKAGE_ID =
  process.env.NEXT_PUBLIC_TEST_NFT_PACKAGE_ID ||
  "0xfd39b11f25362af7b8655d98190d285b889f35d81b9367b1ddaa822bb3412fe7";

export const MINT_COUNTER_ID =
  process.env.NEXT_PUBLIC_MINT_COUNTER_ID || "";

export const SUI_NETWORK = "testnet";

// ─── NEAR Test NFT ──────────────────────────────────────────────────────────
// Deploy the test-nft contract from packages/near-contracts/test-nft/ to this account.

export const NEAR_TEST_NFT_CONTRACT =
  process.env.NEXT_PUBLIC_NEAR_TEST_NFT_CONTRACT || "ika-test-nft.testnet";

export const NEAR_NETWORK_ID = "testnet";
