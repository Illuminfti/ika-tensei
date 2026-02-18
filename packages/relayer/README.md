# Ika Tensei - Relayer

![TypeScript](https://img.shields.io/badge/Language-TypeScript-blue)
![Node.js](https://img.shields.io/badge/Node.js-22.x-green)
![Lines](https://img.shields.io/badge/Lines-2%2C188-blue)

Event-driven cross-chain NFT reincarnation relayer. Orchestrates the full flow from Sui seal events through IKA signing to Solana minting.

## Overview

The relayer monitors Sui for `NFTSealed` events, signs seal hashes with IKA dWallets, verifies on Solana, and marks reborn status back on Sui. Optionally creates Realms DAO governance for guilds.

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Sui        │────▶│  Relayer    │────▶│  Solana     │
│  Listener   │     │  Pipeline   │     │  Minter     │
└─────────────┘     └─────────────┘     └─────────────┘
       │                   │                   │
       ▼                   ▼                   ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│ NFTSealed   │     │  IKA        │     │  Metaplex   │
│ Event       │     │  Signer     │     │  Core CPI   │
└─────────────┘     └─────────────┘     └─────────────┘
                           │
                           ▼
                    ┌─────────────┐
                    │  Sui       │
                    │  Closer    │
                    └─────────────┘
```

## Services

The relayer comprises 5 core services:

| Service | File | Description |
|---------|------|-------------|
| `sui-listener` | `services/sui-listener.ts` | Monitors Sui for NFTSealed events |
| `ika-signer` | `services/ika-signer.ts` | Signs seal hashes with IKA dWallet |
| `solana-minter` | `services/solana-minter.ts` | Verifies seal + mints Reborn NFT |
| `sui-closer` | `services/sui-closer.ts` | Marks reborn on Sui |
| `realms-creator` | `services/realms-creator.ts` | Creates Realms DAO for guilds |

## Processing Pipeline (6 Steps)

1. **Seal** - Listen for `NFTSealed` events on Sui
2. **Sign** - Sign seal hash with IKA dWallet (2PC-MPC)
3. **Verify** - Verify signature on Solana program
4. **Mint** - Mint reborn NFT via Metaplex Core
5. **Close** - Mark reborn on Sui registry
6. **Guild** - (Optional) Create Realms DAO

## Configuration

Environment variables (see `src/config.ts`):

### Chain Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `IKA_NETWORK` | required | Network: `mainnet`, `testnet`, or `devnet` |
| `SUI_RPC_URL` | `https://rpc-testnet.suiscan.xyz` | Sui RPC endpoint |
| `SOLANA_RPC_URL` | `https://api.devnet.solana.com` | Solana RPC endpoint |

### Contract Addresses

| Variable | Default | Description |
|----------|---------|-------------|
| `SUI_PACKAGE_ID` | `0x22a886...` | Ikatensei package |
| `SUI_REGISTRY_ID` | `0xffa3bb...` | SealRegistry object |
| `SUI_VAULT_ID` | `0x0fccb8...` | SealVault object |
| `SOLANA_PROGRAM_ID` | required | Solana program ID |
| `MPL_CORE_PROGRAM_ID` | `CoREENxT6...` | Metaplex Core program |

### IKA dWallet

| Variable | Default | Description |
|----------|---------|-------------|
| `DWALLET_CAP_ID` | `0xae22f5...` | DWallet capability ID |
| `DWALLET_ID` | `0x36ada1...` | DWallet object ID |
| `ENCRYPTED_SHARE_ID` | `0x09988d...` | Encrypted share ID |
| `DWALLET_PUBKEY_HEX` | required | DWallet public key (hex) |

### Keypairs

| Variable | Default | Description |
|----------|---------|-------------|
| `SUI_KEYPAIR_BASE64` | auto | Sui keypair (base64) |
| `SOLANA_KEYPAIR_BASE64` | auto | Solana keypair (base64) |

### Relayer Settings

| Variable | Default | Description |
|----------|---------|-------------|
| `HEALTH_PORT` | `3470` | Health endpoint port |
| `DB_PATH` | `./relayer.db` | SQLite database path |
| `QUEUE_CONCURRENCY` | `5` | Concurrent processing limit |
| `QUEUE_POLL_INTERVAL_MS` | `5000` | Event poll interval |
| `MAX_RETRIES` | `3` | Max retry attempts |
| `RETRY_DELAY_MS` | `5000` | Retry backoff delay |
| `LOG_LEVEL` | `info` | Log level: `debug`, `info`, `warn`, `error` |

## Database Schema

SQLite for seal tracking:

```sql
CREATE TABLE seals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  seal_hash TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL,  -- 'sealed', 'signing', 'verified', 'minting', 'completed', 'failed'
  source_chain INTEGER NOT NULL,
  dest_chain INTEGER NOT NULL,
  source_contract TEXT NOT NULL,
  token_id TEXT NOT NULL,
  nonce INTEGER NOT NULL,
  nft_name TEXT,
  nft_description TEXT,
  metadata_uri TEXT,
  collection_name TEXT,
  dwallet_pubkey TEXT,
  solana_mint_address TEXT,
  signature TEXT,
  error TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
```

## Health Endpoint

```bash
# Check health
curl http://localhost:3470/health

# Response
{
  "status": "ok",
  "uptime": 3600,
  "seals": {
    "processing": 2,
    "completed": 15,
    "failed": 1
  }
}
```

## Building

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Clean build
npm run clean && npm run build
```

## Running

```bash
# Production
npm start

# Development with hot reload
npm run dev

# With custom config
IKA_NETWORK=testnet npm start
```

## Source Files

### Core

| File | LOC | Description |
|------|-----|-------------|
| `src/index.ts` | ~350 | Main entry, orchestrator |
| `src/config.ts` | ~200 | Configuration loader |
| `src/db.ts` | ~200 | SQLite operations |
| `src/queue.ts` | ~180 | Processing queue |
| `src/health.ts` | ~150 | Health server |

### Services

| File | LOC | Description |
|------|-----|-------------|
| `services/sui-listener.ts` | ~150 | Event listener |
| `services/ika-signer.ts` | ~300 | IKA signing |
| `services/solana-minter.ts` | ~320 | Solana minting |
| `services/sui-closer.ts` | ~80 | Sui closer |
| `services/realms-creator.ts` | ~300 | Realms DAO |
| `services/arweave-mirror.ts` | ~150 | Arweave mirroring |

## Processing Flow

```typescript
// From src/index.ts
async function processSeal(event: NFTSealedEvent) {
  // Step 1: Sign with IKA dWallet
  const signature = await ikaSigner.sign({
    dwalletCapId: config.dwalletCapId,
    message: sealHash,
  });

  // Step 2: Verify on Solana
  await solanaMinter.verifySeal({
    sealHash,
    signature,
    sourceChain: event.source_chain,
    sourceContract: event.source_contract,
    tokenId: event.token_id,
    attestationPubkey: event.dwallet_pubkey,
    recipient: recipientAddress,
  });

  // Step 3: Mint reborn NFT
  const mintResult = await solanaMinter.mintReborn({
    sealHash,
    name: event.nft_name,
    uri: metadataUrl,
  });

  // Step 4: Mark reborn on Sui
  await suiCloser.markReborn({
    sealHash,
    solanaMintAddress: mintResult.mintAddress,
  });

  // Step 5: (Optional) Create guild
  if (createGuild) {
    await realmsCreator.createGuild({
      collectionMint: mintResult.mintAddress,
      owner: recipientAddress,
    });
  }
}
```

## Queue with Retry

The relayer implements exponential backoff:

```typescript
async function processWithRetry(fn: () => Promise<void>) {
  let attempts = 0;
  while (attempts < maxRetries) {
    try {
      await fn();
      return;
    } catch (error) {
      attempts++;
      if (attempts >= maxRetries) throw error;
      await sleep(retryDelayMs * Math.pow(2, attempts));
    }
  }
}
```

## Dependencies

```json
{
  "@ika.xyz/sdk": "^0.2.7",
  "@solana/web3.js": "^1.95.0",
  "@solana/spl-governance": "^0.3.28",
  "better-sqlite3": "^11.7.0",
  "dotenv": "^16.4.0",
  "pino": "^9.6.0"
}
```

## Error Handling

| Error Type | Handling |
|------------|----------|
| Network timeout | Retry with backoff |
| IKA signing failure | Log error, mark as failed |
| Solana verification | Retry, then fail |
| Insufficient balance | Pause processing |

## Logging

Uses Pino for structured logging:

```typescript
const logger = createLogger('info');
logger.info('Processing seal', { sealHash: sealHash.slice(0, 8) });
logger.warn('Retry attempt', { attempt: attempts, error: error.message });
```

## Production Considerations

1. **High availability**: Run multiple relayer instances
2. **Monitoring**: Set up alerts for failed seals
3. **Rate limiting**: Respect RPC rate limits
4. **Key management**: Use HSM for production keypairs
5. **Database**: Use managed SQLite (e.g., Cloud SQL) for scale

## License

MIT
