# Ika Tensei - Shared Package

![TypeScript](https://img.shields.io/badge/Language-TypeScript-blue)
![Node.js](https://img.shields.io/badge/Node.js-22.x-green)

Shared types, constants, and utilities for Ika Tensei v3. Provides cross-chain functionality including IKA dWallet integration, SPL Governance (Realms) integration, Wormhole VAA handling, and decentralized storage.

## Installation

```bash
npm install @ika-tensei/shared
```

## Modules

### Core Modules

| Module | LOC | Description |
|--------|-----|-------------|
| `ika-dwallet.ts` | ~650 | IKA SDK integration, DKG flow, signing |
| `realms-dao.ts` | ~795 | SPL Governance integration, guild creation |
| `wormhole-vaa.ts` | ~588 | VAA parsing and verification |
| `walrus-storage.ts` | ~180 | Decentralized storage uploads |
| `seal-hash.ts` | ~260 | Seal hash computation |
| `chains.ts` | ~130 | Chain ID mappings |
| `metadata/` | ~400 | Cross-chain metadata resolution |

## Key Exports

```typescript
// Chain definitions
import { ChainId, WormholeChainId, CurveType, NFTStandard, CHAIN_METADATA } from '@ika-tensei/shared';

// Seal hash utilities
import { constructSealHashBytes, hashSealData, hashSealDataSync } from '@ika-tensei/shared';

// Wormhole VAA
import { fetchVAA, parseVAA, verifyVAA } from '@ika-tensei/shared';

// Walrus storage
import { uploadBlob, downloadBlob, uploadMetadataJson, mirrorImage } from '@ika-tensei/shared';

// IKA dWallet
import { IkaDWalletService } from '@ika-tensei/shared';

// Realms DAO
import { createGuild, depositNft, createProposal, castVote } from '@ika-tensei/shared';
```

## Module: chains.ts

Chain definitions and metadata for the protocol.

```typescript
// Supported chains
enum ChainId {
  ETHEREUM = 1,
  SUI = 2,
  SOLANA = 3,
  NEAR = 4,
  BITCOIN = 5,
}

// Wormhole chain IDs
enum WormholeChainId {
  ETHEREUM = 2,
  SOLANA = 1,
  SUI = 21,
  NEAR = 15,
}

// Cryptographic curves
enum CurveType {
  ED25519 = 'ed25519',
  SECP256K1 = 'secp256k1',
}

// Chain curve mapping
const CHAIN_CURVE_MAP: Record<ChainId, CurveType> = {
  [ChainId.ETHEREUM]: CurveType.SECP256K1,
  [ChainId.SUI]: CurveType.ED25519,
  [ChainId.SOLANA]: CurveType.ED25519,
  [ChainId.NEAR]: CurveType.ED25519,
  [ChainId.BITCOIN]: CurveType.SECP256K1,
};
```

**Chain Metadata:**

| Chain | ID | NFT Standard | Address Format | Native Token |
|-------|-----|-------------|---------------|--------------|
| Ethereum | 1 | ERC-721 | hex | ETH |
| Sui | 2 | Sui Object | hex | SUI |
| Solana | 3 | SPL | base58 | SOL |
| Near | 4 | NEP-171 | base58 | NEAR |
| Bitcoin | 5 | Ordinals | bech32 | BTC |

## Module: seal-hash.ts

Seal hash construction matching the Sui contract implementation (PRD §6.1).

```typescript
// Byte layout per PRD §6.1:
// Offset  Size   Field                      Encoding
// 0       2      source_chain_id            u16 big-endian
// 2       2      destination_chain_id       u16 big-endian (always 3)
// 4       1      source_contract_length     u8
// 5       N      source_contract_address    raw bytes
// 5+N     1      token_id_length            u8
// 6+N     M      token_id                   raw bytes
// 6+N+M   32     attestation_pubkey         Ed25519 pubkey
// 38+N+M  8      nonce                      u64 big-endian

const sealBytes = constructSealHashBytes(
  sourceChainId: ChainId,     // Source chain
  sourceContract: Uint8Array, // Contract address bytes
  tokenId: Uint8Array,        // Token ID bytes
  attestationPubkey: Uint8Array, // 32-byte Ed25519 pubkey
  nonce: bigint               // Nonce
);

// Hash to get 32-byte seal hash
const sealHash = await hashSealData(sealBytes);
```

## Module: wormhole-vaa.ts

Wormhole VAA fetching and parsing.

```typescript
// Fetch VAA from Wormhole testnet API
const vaaBytes = await fetchVAA(
  emitterChain: number,    // Wormhole chain ID
  emitterAddress: string,  // Emitter hex string
  sequence: bigint,        // Message sequence
  maxRetries?: number,
  retryDelayMs?: number
);

// Parse VAA structure
const vaa = parseVAA(vaaBytes);
// vaa.version, vaa.emitterChain, vaa.emitterAddress, vaa.sequence, vaa.payload

// Verify guardian signatures
const isValid = await verifyVAA(vaaBytes);
```

## Module: walrus-storage.ts

Decentralized storage via Walrus.

```typescript
import { uploadBlob, downloadBlob, uploadMetadataJson, mirrorImage, WalrusUploadResult } from '@ika-tensei/shared';

// Upload arbitrary data
const result: WalrusUploadResult = await uploadBlob(
  data: Uint8Array | string,
  options?: { epochs?: number; network?: 'testnet' | 'mainnet' }
);
// result.blobId, result.url

// Upload metadata JSON
const metadataResult = await uploadMetadataJson(
  metadata: MetaplexMetadataJson,
  options
);

// Mirror image from any URL to Walrus
const imageResult = await mirrorImage(
  imageUrl: string,
  options
);
```

## Module: ika-dwallet.ts

IKA dWallet integration for signing seal hashes.

```typescript
import { IkaDWalletService, type IkaDWalletConfig, type DWalletRef } from '@ika-tensei/shared';

// Initialize service
const service = new IkaDWalletService({
  suiRpcUrl: 'https://rpc-testnet.suiscan.xyz',
  ikaNetwork: 'testnet',
  suiKeypairBytes: Uint8Array,
  logger: console,
});

// Create dWallet via DKG
const dwallet: DWalletRef = await service.createDWallet({
  curve: 'ED25519',  // or 'SECP256K1'
  recipient: '0x...', // Sui address
});

// Sign message with dWallet
const signature = await service.sign({
  dwalletCapId: '0x...',
  message: sealHashBytes,
});
```

### IkaDWalletService API

```typescript
class IkaDWalletService {
  // Create dWallet via DKG
  createDWallet(params: CreateDWalletParams): Promise<DWalletRef>
  
  // Get dWallet info
  getDWallet(dwalletId: string): Promise<DWalletRef>
  
  // Sign message
  sign(params: SignParams): Promise<Uint8Array>
  
  // Complete DKG (if multi-round)
  completeDKG(dwalletCapId: string): Promise<DKGOutput>
}
```

## Module: realms-dao.ts

SPL Governance (Realms) integration for Adventurer's Guild DAOs.

```typescript
import { 
  createGuild, 
  depositNft, 
  createProposal, 
  castVote,
  type GuildConfig,
  type CreateGuildResult,
  type DepositNftResult 
} from '@ika-tensei/shared';

// Create Adventurer's Guild (Realms DAO)
const guild: CreateGuildResult = await createGuild(
  connection: Connection,
  config: GuildConfig,
  payer: Keypair
);
// guild.realmAddress, guild.governanceAddress, guild.txSignature

// Deposit reborn NFT to get voting power
const deposit: DepositNftResult = await depositNft(
  connection,
  realmAddress: PublicKey,
  mint: PublicKey,  // Reborn NFT mint
  owner: Keypair
);

// Create proposal
const proposal: CreateProposalResult = await createProposal(
  connection,
  realmAddress: PublicKey,
  governanceAddress: PublicKey,
  title: string,
  description: string,
  proposer: Keypair
);

// Cast vote
const vote: CastVoteResult = await castVote(
  connection,
  proposalAddress: PublicKey,
  voter: Keypair,
  voteKind: 'approve' | 'reject' | 'abstain'
);
```

### GuildConfig

```typescript
interface GuildConfig {
  name: string;                    // Realm name (max 32 chars)
  communityTokenMint: PublicKey;   // Collection mint as community token
  minCommunityTokensToCreateGovernance?: number;
  councilTokenMint?: PublicKey;    // Optional council for team
  votingCoolOffTime?: number;      // Default: 43200 (12h)
  maxVotingTime?: number;          // Default: 259200 (3 days)
  voteThresholdPercentage?: number; // Default: 60
}
```

## Metadata Resolution

The `metadata/` directory contains chain-specific resolvers:

```typescript
import { resolveMetadata } from '@ika-tensei/shared/metadata';

// Resolve metadata for any chain
const metadata = await resolveMetadata(
  chainId: ChainId,
  contract: string,
  tokenId: string
);
// Returns: { name, description, image, attributes }
```

### Supported Chains
- `ethereum.ts` - ERC-721 metadata fetching
- `sui.ts` - Sui object metadata
- `solana.ts` - Metaplex JSON metadata
- `near.ts` - NEP-171 metadata

## Building

```bash
# Type check
npx tsc --noEmit

# Build
npm run build
```

## Dependencies

```json
{
  "@solana/spl-governance": "^0.3.28",
  "@solana/web3.js": "^1.98.4",
  "@mysten/sui": "1.21.0",
  "@ika.xyz/sdk": "^0.2.7",
  "bn.js": "^5.2.2"
}
```

## Usage Examples

### Full Seal Flow

```typescript
import { 
  ChainId, 
  constructSealHashBytes, 
  hashSealData,
  fetchVAA,
  IkaDWalletService 
} from '@ika-tensei/shared';

// 1. Construct seal hash
const sealBytes = constructSealHashBytes(
  ChainId.ETHEREUM,
  new TextEncoder().encode(nftContract),
  new TextEncoder().encode(tokenId),
  attestationPubkey,
  nonce
);
const sealHash = await hashSealData(sealBytes);

// 2. Sign with dWallet
const service = new IkaDWalletService(config);
const signature = await service.sign({ dwalletCapId, message: sealHash });

// 3. Verify on Solana
await verifySealOnSolana(program, sealHash, signature, recipient);
```

### Upload Metadata to Walrus

```typescript
import { uploadMetadataJson } from '@ika-tensei/shared';

const metadata = {
  name: "Reborn #1",
  description: "Ika Tensei reborn NFT",
  image: "https://...",
  attributes: [{ trait_type: "Origin", value: "Ethereum" }]
};

const result = await uploadMetadataJson(metadata, { network: 'testnet' });
console.log(result.url); // Walrus URL for metadata
```

## License

MIT
