# Ika Tensei - Tests

![TypeScript](https://img.shields.io/badge/Language-TypeScript-blue)
![Tests](https://img.shields.io/badge/Tests-10%2B-green)

Integration and E2E tests for the Ika Tensei protocol. Tests cross-chain flows across Sui, Solana, and IKA dWallets.

## Test Files

| File | Description | Coverage |
|------|-------------|----------|
| `test-sui-contracts.mjs` | Sui Move contract tests | Contract functions |
| `test-solana-program.mjs` | Solana program tests | Instructions |
| `test-ika-dwallet.mjs` | IKA dWallet tests | DKG + signing |
| `test-e2e.mjs` | Full E2E flow | 10-step cross-chain |

## Test Structure

```
tests/
├── test-e2e.mjs           # Main E2E test
├── test-sui-contracts.mjs  # Sui contract tests
├── test-solana-program.mjs # Solana program tests
├── test-ika-dwallet.mjs   # dWallet integration
├── helpers/
│   ├── sui.mjs            # Sui test helpers
│   ├── solana.mjs         # Solana test helpers
│   └── ika.mjs            # IKA test helpers
└── package.json
```

## Running Tests

```bash
# Run Sui contract tests
npm run test

# Run Solana program tests
npm run test:solana

# Run IKA dWallet tests
npm run test:ika

# Run E2E tests
npm run test:e2e

# Run all tests
npm run test:all
```

## Prerequisites

### Required Resources

| Resource | Testnet | Mainnet |
|----------|---------|---------|
| SUI tokens | ~100 SUI | N/A |
| IKA tokens | ~10 IKA | N/A |
| SOL tokens | ~2 SOL | N/A |

### Deployed Contracts

Ensure the following are deployed before running tests:

**Sui Testnet:**
- Ikatensei package
- SealRegistry object
- SealVault object
- IkaNFT package (demo)

**Solana Devnet:**
- IkaTensei program
- Metaplex Core program

**Ethereum Sepolia:**
- IkaTenseiDeposit contract

## Test Suites

### test-sui-contracts.mjs

Tests Sui Move contracts:

```javascript
import { setupSuiTest, getSealRegistry, registerSeal, markReborn } from './helpers/sui.mjs';

// Test: Register seal
await registerSeal({
  registry,
  vault,
  dwalletId,
  dwalletCapId,
  sourceChain: ChainId.ETHEREUM,
  sourceContract: nftContract,
  tokenId: tokenId,
});

// Test: Mark reborn
await markReborn({
  registry,
  sealHash,
  solanaMintAddress,
});
```

**Coverage:**
- Seal registration (VAA + native)
- Seal querying
- Mark reborn (permissionless)
- Collection management
- Admin functions (pause, config)

### test-solana-program.mjs

Tests Solana program instructions:

```javascript
import { setupSolanaTest, initialize, registerCollection, verifySeal, mintReborn } from './helpers/solana.mjs';

// Test: Initialize protocol
await initialize({
  guildTreasury,
  teamTreasury,
  guildShareBps: 500,
  mintFee: 1_000_000,
});

// Test: Register collection
await registerCollection({
  sourceChain: ChainId.ETHEREUM,
  sourceContract: nftContract,
  name: 'Test Collection',
  maxSupply: 1000,
});

// Test: Verify seal
await verifySeal({
  sealHash,
  sourceChain: ChainId.ETHEREUM,
  sourceContract,
  tokenId,
  attestationPubkey,
  recipient,
});

// Test: Mint reborn
await mintReborn({
  sealHash,
  name: 'Reborn NFT #1',
  uri: 'https://arweave.net/...',
});
```

**Coverage:**
- Initialize
- Register collection
- Verify seal (Ed25519 sig)
- Mint reborn (Metaplex Core CPI)
- Admin functions

### test-ika-dwallet.mjs

Tests IKA dWallet creation and signing:

```javascript
import { setupIkaTest, createDWallet, signMessage } from './helpers/ika.mjs';

// Test: Create dWallet via DKG
const dwallet = await createDWallet({
  curve: 'ED25519',
  recipient: suiAddress,
});

// Test: Sign message
const signature = await signMessage({
  dwalletCapId: dwallet.capId,
  message: sealHashBytes,
});

// Test: Verify signature
const isValid = await verifySignature({
  message: sealHashBytes,
  signature,
  publicKey: dwallet.publicKey,
});
```

**Coverage:**
- DKG flow (key generation)
- dWallet creation
- Message signing
- Signature verification

### test-e2e.mjs (10-Step Flow)

Full end-to-end test:

```
1. Setup: Initialize test accounts and load contracts
2. Create dWallet: DKG setup for signing
3. Deposit: Transfer NFT to dWallet on source chain
4. Emit VAA: Wormhole message for cross-chain
5. Listen: Relayer picks up NFTSealed event
6. Sign: IKA dWallet signs seal hash
7. Verify: Solana program verifies signature
8. Mint: Metaplex Core mints reborn NFT
9. Close: Mark reborn on Sui registry
10. Guild: (Optional) Create Realms DAO
```

```javascript
import { runE2ETest } from './test-e2e.mjs';

await runE2ETest({
  sourceChain: 'ethereum',
  nftContract: '0x...',
  tokenId: '1',
  metadata: {
    name: 'Test NFT',
    description: 'E2E Test',
    image: 'ipfs://...',
  },
});
```

## Helper Modules

### helpers/sui.mjs

Sui test utilities:

```javascript
// Setup test environment
const { client, registry, vault, adminCap } = await setupSuiTest(keypair);

// Get registry object
const reg = await getSealRegistry(registryId);

// Register seal
const sealHash = await registerSeal({
  registry,
  vault,
  dwalletId,
  dwalletCapId,
  sourceChain,
  sourceContract,
  tokenId,
});

// Check seal exists
const exists = await sealExists(registry, sealHash);

// Mark reborn
await markReborn(registry, sealHash, solanaMint);
```

### helpers/solana.mjs

Solana test utilities:

```javascript
// Setup Solana test
const { connection, program, payer } = await setupSolanaTest();

// Initialize protocol
await initialize(program, {
  guildTreasury: guildKey,
  teamTreasury: teamKey,
  guildShareBps: 500,
  mintFee: 1_000_000,
});

// Register collection
await registerCollection(program, {
  sourceChain: ChainId.ETHEREUM,
  sourceContract: '0x...',
  name: 'Test',
  maxSupply: 100,
});

// Verify seal
await verifySeal(program, {
  sealHash,
  sourceChain,
  sourceContract,
  tokenId,
  attestationPubkey,
  recipient,
});

// Mint reborn
await mintReborn(program, {
  sealHash,
  name: 'Reborn #1',
  uri: 'https://...',
});
```

### helpers/ika.mjs

IKA test utilities:

```javascript
// Setup IKA
const { service, keypair } = await setupIkaTest();

// Create dWallet
const dwallet = await createDWallet(service, {
  curve: 'ED25519',
  recipient: suiAddress,
});

// Sign
const signature = await signMessage(service, {
  dwalletCapId: dwallet.capId,
  message: messageBytes,
});

// Verify
await verifySignature(service, {
  message: messageBytes,
  signature,
  publicKey: dwallet.publicKey,
});
```

## Configuration

Tests use environment variables:

```bash
# Sui
export SUI_RPC_URL="https://rpc-testnet.suiscan.xyz"
export SUI_KEYPAIR_PATH="~/.sui/sui_config/sui.keystore"

# Solana
export SOLANA_RPC_URL="https://api.devnet.solana.com"
export SOLANA_KEYPAIR_PATH="~/.config/solana/id.json"

# IKA
export IKA_NETWORK="testnet"
```

## Expected Results

| Test | Status | Duration |
|------|--------|----------|
| Sui contracts | ✅ Pass | ~30s |
| Solana program | ✅ Pass | ~45s |
| IKA dWallet | ✅ Pass | ~60s |
| E2E flow | ✅ Pass | ~3-5min |

## Troubleshooting

### Common Issues

| Error | Solution |
|-------|----------|
| `Insufficient funds` | Get testnet tokens from faucet |
| `Contract not deployed` | Deploy contracts first |
| `Signature verification failed` | Check dWallet pubkey matches |
| `VAA not found` | Wait for Wormhole finality (~60s) |

### Debug Mode

```bash
# Enable debug logging
export LOG_LEVEL=debug
npm run test:e2e
```

## CI/CD Integration

```yaml
# .github/workflows/test.yml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
      - run: npm install
      - run: npm run test:all
        env:
          SUI_RPC_URL: ${{ secrets.SUI_RPC_URL }}
          SOLANA_RPC_URL: ${{ secrets.SOLANA_RPC_URL }}
```

## License

MIT
