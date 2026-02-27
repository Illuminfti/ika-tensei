// ─── Sui Test NFT ────────────────────────────────────────────────────────────
// Published standalone test_nft package on Sui testnet.

export const TEST_NFT_PACKAGE_ID =
  process.env.NEXT_PUBLIC_TEST_NFT_PACKAGE_ID ||
  "0x7f08bfe51fa8b7f019857e66f7b6102e2b3e8d50ef887266c3886335a981a70b";

export const MINT_COUNTER_ID =
  process.env.NEXT_PUBLIC_MINT_COUNTER_ID ||
  "0x6f0acb6e0d96c649f27cad25f55c89e80626482031b0f5e0e0054226fb10533a";

export const SUI_NETWORK = "testnet";

// ─── NEAR Test NFT ──────────────────────────────────────────────────────────
// Deploy the test-nft contract from packages/near-contracts/test-nft/ to this account.

export const NEAR_TEST_NFT_CONTRACT =
  process.env.NEXT_PUBLIC_NEAR_TEST_NFT_CONTRACT || "ika-test-nft.testnet";

export const NEAR_NETWORK_ID = "testnet";
