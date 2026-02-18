# Ika Tensei PRD v4 — Deposit Address Architecture

## Overview

Ika Tensei is an NFT reincarnation protocol. Users **seal** (permanently lock) NFTs on any source chain and **reborn** (mint) new versions on Solana. The sealed original and reborn copy are cryptographically linked forever via IKA dWallet.

## Core UX Principle

**Users only ever connect their Solana wallet.**

No multi-chain wallet connect. No MetaMask popups. No chain switching. The user connects Solana, picks their source chain, gets a deposit address, sends their NFT there. Done.

## Architecture

### The dWallet-Per-NFT Model

Every sealed NFT gets its own dedicated dWallet on IKA:

- **1 dWallet = 1 NFT = 1 deposit address = 1 reborn NFT on Solana**
- The dWallet derives a native address on the source chain (secp256k1 for EVM, Ed25519 for Solana/Sui/Aptos/NEAR)
- When the user sends their NFT to this address, it's held by the dWallet
- The DWalletCap is transferred to the SealVault contract on Sui = permanent lock
- Nobody can ever move the original NFT again
- The reborn NFT on Solana stores the dWallet address as provable link to the sealed original

### User Flow

```
1. User visits ika-tensei.io
2. Connects Solana wallet (Phantom, Backpack, etc.)
3. Clicks "Seal an NFT"
4. Selects source chain (Ethereum, Polygon, Arbitrum, Sui, etc.)
5. Optionally: enters NFT contract address + token ID (or we auto-detect after deposit)
6. We create a dWallet → display deposit address for that chain
7. User opens their source chain wallet (MetaMask, whatever) 
   and sends the NFT to the deposit address
8. We detect the deposit (indexer + Wormhole VAA confirmation)
9. DWalletCap locked on Sui (SealVault contract)
10. Reborn NFT minted to user's Solana wallet
11. User sees their reborn NFT with link to original on source chain
```

### Why This Is Better

| Aspect | Old (Multi-Wallet) | New (Deposit Address) |
|--------|--------------------|-----------------------|
| Wallets needed | 1 per chain | Solana only |
| Source chain interaction | dApp connect + approve + transfer | Just send NFT to address |
| Hardware wallet support | Partial (dApp compat issues) | Full (just send a transfer) |
| Chain coverage | Limited by wallet SDK support | Any chain dWallet supports |
| UX complexity | High (switch chains, approve, sign) | Minimal (copy address, send) |
| Mobile support | Painful (deep links, WalletConnect) | Easy (copy address in any app) |

## Supported Chains

### Phase 1 (Launch)
All chains where Wormhole has core contracts + dWallet can derive addresses:

**EVM (secp256k1) — one address works on all:**
- Ethereum, BSC, Polygon, Avalanche, Arbitrum, Optimism, Base, Fantom, Moonbeam, Celo, Klaytn, Scroll, Mantle, Blast, Linea, Gnosis, Aurora, Berachain

**Non-EVM:**
- Solana (Ed25519)
- Sui (Ed25519)
- Aptos (Ed25519)
- NEAR (Ed25519)

### Phase 2
- Algorand (requires opt-in mechanics)
- Bitcoin Ordinals (no Wormhole, needs custom attestation)
- Cosmos chains (IBC-based verification)

## Technical Architecture

### Components

```
┌─────────────────────────────────────────────────┐
│                   Frontend                       │
│  (Next.js on Vercel — Solana wallet only)        │
└────────────────────┬────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────┐
│              Backend / Relayer                    │
│  - Creates dWallets (DKG ceremony)               │
│  - Monitors deposit addresses (Moralis/indexer)  │
│  - Fetches Wormhole VAAs                         │
│  - Orchestrates seal + mint flow                 │
└────┬──────────┬──────────┬──────────────────────┘
     │          │          │
┌────▼───┐ ┌───▼────┐ ┌───▼──────────────────────┐
│  IKA   │ │  Sui   │ │  Solana                   │
│ dWallet│ │Contract│ │  Program                   │
│ Network│ │(Seal   │ │  (Verify seal + mint       │
│        │ │ Vault) │ │   reborn NFT)              │
└────────┘ └────────┘ └──────────────────────────┘
```

### dWallet Creation Flow

1. Backend calls IKA SDK: `prepareDKGAsync(curve)` 
   - secp256k1 for EVM source chains
   - Ed25519 for Solana/Sui/Aptos/NEAR source chains
2. DKG completes → dWallet created with derived public key
3. Public key → deposit address on source chain
4. Address displayed to user
5. DWalletCap held by relayer until seal completes, then transferred to SealVault (permanent lock)

### EVM Deposit Detection

Two approaches (can use both):

**A. Direct NFT Transfer Detection (simpler)**
- User sends ERC-721 `safeTransferFrom` to dWallet-derived EOA
- Moralis/Alchemy webhook detects the transfer
- Backend verifies via RPC that NFT is at the deposit address
- Backend creates Wormhole attestation (or uses our own dWallet signature as proof)

**B. DepositVault Contract (Wormhole-native)**
- Deploy minimal contract on each EVM chain
- Contract has `onERC721Received` → emits Wormhole message
- Wormhole VAA delivered to Sui for on-chain verification
- Adds 7-day timelock reclaim for user protection
- Cost: ~$100-300 total gas to deploy on all EVM chains

**Recommendation:** Start with Option A (direct transfer to dWallet EOA). The dWallet IS the vault. No smart contract needed on source chains. The dWallet signature itself is the proof. Add DepositVault contracts later if we want Wormhole-native verification.

### For secp256k1 Chains (EVM)
Need TWO dWallets per seal:
1. **secp256k1 dWallet** — holds the NFT on the EVM chain (deposit address)
2. **Ed25519 dWallet** — signs the seal attestation for Solana (Ed25519 precompile verification)

Both DWalletCaps get locked in SealVault on Sui.

### For Ed25519 Chains (Solana, Sui, NEAR, Aptos)
Need ONE dWallet per seal:
- Ed25519 dWallet holds the NFT AND signs the attestation
- Single DWalletCap locked in SealVault

### Seal Verification on Solana

Same as v3: Ed25519 precompile verifies the dWallet's signature over the seal hash. The seal hash includes:
- Source chain ID
- Source NFT contract address
- Source NFT token ID
- Destination chain ID (Solana)
- Reborn NFT mint address

### On-Chain Provable Link

For any reborn NFT on Solana, anyone can verify:
1. Read the seal record → get dWallet public key + source chain info
2. Derive the deposit address from the public key
3. Check the source chain: is the original NFT at that address? ✓
4. Check Sui: is the DWalletCap locked in SealVault? ✓ (nobody can move it)
5. Verify the Ed25519 signature matches → cryptographic proof of link

## Fees

- **Seal fee:** Flat fee in SOL (paid from connected Solana wallet)
- **Gas on source chain:** User pays (they're sending a normal NFT transfer)
- **DKG cost:** Sui gas for dWallet creation (absorbed by protocol or included in seal fee)
- **No gas abstraction needed:** User handles source chain gas themselves (just a transfer)

## Frontend Changes

The frontend simplifies dramatically:

- Remove: all source chain wallet connect UI
- Remove: chain switching, approval flows, multi-wallet state management
- Add: "Select source chain" dropdown
- Add: deposit address display with QR code + copy button
- Add: deposit detection status (waiting → detected → confirming → sealed → minting → done)
- Keep: Solana wallet connect (Dynamic.xyz or Phantom adapter)

## Security Model

- **dWallet 2PC-MPC:** Network cannot sign without DWalletCap holder. DWalletCap holder cannot sign without network. Neither party can unilaterally move the NFT.
- **DWalletCap in SealVault:** Once transferred to the Sui contract, the cap is locked. The contract has no function to release it. The NFT is permanently sealed.
- **Wormhole VAA (optional layer):** Additional cross-chain verification that the deposit occurred.
- **Timelock reclaim (Phase 2):** Before DWalletCap is locked, user has X days to reclaim if something goes wrong. After lock, it's permanent.

## Implementation Timeline

### Phase 1: Core Flow (4 weeks)
- [ ] dWallet creation + deposit address derivation for EVM (secp256k1)
- [ ] Deposit detection (Moralis webhooks or RPC polling)
- [ ] Seal flow: detect → verify → lock DWalletCap → mint on Solana
- [ ] Frontend: deposit address UX (chain select, address display, status tracking)
- [ ] Test E2E on Ethereum Sepolia → Solana devnet

### Phase 2: Multi-Chain (3 weeks)
- [ ] Ed25519 chains: Solana-to-Solana sealing, Sui, Aptos, NEAR
- [ ] All EVM L2s (same address, just add chain detection)
- [ ] DepositVault contracts for Wormhole-native verification (optional)
- [ ] QR code generation for deposit addresses

### Phase 3: Production (3 weeks)
- [ ] Mainnet deployment (Sui mainnet, Solana mainnet, EVM mainnets)
- [ ] Monitoring + alerting for deposit detection
- [ ] Rate limiting, abuse prevention
- [ ] Audit prep

## Decisions

1. **Pre-creation pool: YES.** Pre-create dWallets in batches so users don't wait for DKG. Pool replenishes automatically. Separate pools for secp256k1 (EVM) and Ed25519 (non-EVM).

2. **Same EVM address, all chains: YES, per-seal.** One secp256k1 dWallet = one address across all EVM chains. User can deposit from any EVM chain. But the NEXT seal gets a NEW dWallet/address. 1 dWallet = 1 NFT, always.

3. **Auto-detection + manual hint.** Auto-detect any NFT arriving at the deposit address. User CAN optionally specify contract+tokenID upfront (helps us start metadata fetch early and triggers detection if auto-detect is slow). We NEVER trust the user's word alone — always verify on-chain.

4. **Fee model: Flat fee in SOL per seal.** Simple, predictable. Paid from connected Solana wallet before or after deposit.

5. **Expiry: No expiry.** Deposit addresses persist indefinitely. No compelling reason to expire them — the dWallet exists on IKA regardless.

## Cross-Chain NFT Metadata Pipeline

The hardest engineering challenge: fetching NFT metadata from 30+ chains, normalizing it, re-uploading to permanent storage, and minting a proper reborn NFT on Solana.

### Metadata API Stack

**⚠️ Landscape has shifted.** SimpleHash (acquired by Phantom, dead), Reservoir (pivoted, dead), NFTPort (shut down). Here's what works in 2026:

| Chain(s) | Primary API | Fallback | Cost |
|----------|-----------|----------|------|
| EVM (18 chains) | **Alchemy NFT API** | NFTScan ($1/1M CU) | Free tier = 600K lookups/mo |
| Solana | **Helius DAS API** | Direct RPC | Free tier = 1M credits/mo |
| Sui | **No API exists** — custom RPC resolver required | — | RPC costs only |
| Aptos, BTC Ordinals, TON | **NFTScan** | Rarible API | $1/1M CU |
| Berachain, Monad, novel L2s | **Rarible Protocol API** | Covalent | Enterprise pricing |
| 100+ tail chains | **Covalent GoldRush** | Direct RPC | $10/mo |

**Total API cost at scale:** 10K seals/mo = basically free. 100K = ~$25/mo. 1M = ~$100/mo.

### Per-Chain Metadata Standards

**EVM (ERC-721 / ERC-1155):**
- `tokenURI(tokenId)` → URI (IPFS, Arweave, HTTP, on-chain base64)
- URI → JSON: `{ name, description, image, attributes: [{trait_type, value}] }`
- OpenSea extensions: `animation_url`, `external_url`, `background_color`
- ERC-1155: `uri(tokenId)` with `{id}` hex substitution pattern
- Variations: some use `properties` not `attributes`, some nest differently
- **CryptoPunks:** Custom contract, no ERC-721. Need special handling (punkIndex → imageHash → Larva Labs API)
- **On-chain SVGs** (Art Blocks, Nouns): base64-encoded in tokenURI data, decode + re-upload
- **Lazy-minted / unrevealed:** tokenURI may return placeholder. Detect and warn user.

**Solana (Metaplex):**
- Token Metadata: on-chain account with name, symbol, URI field
- Metaplex Core (newer): single-account design, different account structure
- Compressed NFTs (cNFTs): metadata in Merkle tree, requires DAS-compatible RPC (Helius)
- Images typically on Arweave already (can reference directly)

**Sui:**
- `Display<T>` standard: fields set per collection type
- No universal tokenURI — must know the Move type to query display fields
- Read via `sui_getObject` + display resolution
- **Kiosk-locked NFTs:** Popular collections enforce TransferPolicy. May not be transferable to deposit address. Restrict to non-kiosk NFTs initially.

**Aptos:**
- Token v1 (legacy): `TokenDataId { creator, collection, name }` → on-chain PropertyMap
- Token v2 / Digital Asset Standard: objects with URI property
- Must detect which standard a given NFT uses (check account structure)

**NEAR (NEP-171/177):**
- `nft_metadata()` for collection-level, `nft_token(token_id)` for per-token
- Returns `media` (direct image URL) + `reference` (full metadata JSON URL)
- Images typically on IPFS or Arweave

### Metadata Resolution Pipeline

```
Step 1: DETECT
  NFT arrives at deposit address → get chain + contract + tokenID

Step 2: FETCH (tiered)
  Try Tier 1 API (Alchemy/Helius) → normalized metadata + cached image URL
  ↓ fail
  Try Tier 2 API (NFTScan/Rarible) → metadata
  ↓ fail  
  Try Tier 3 Direct RPC (tokenURI / getObject / nft_token) → raw URI
  ↓ fail
  Try Tier 4 Marketplace API (OpenSea / Magic Eden) → metadata
  ↓ fail
  Mark as "metadata unavailable" → mint with minimal info (chain, contract, tokenID only)

Step 3: RESOLVE IMAGE
  Parse image field from metadata:
  - ipfs:// → try gateways in order: nftstorage.link → cloudflare-ipfs.com → ipfs.io → pinata gateway → w3s.link
  - ar:// → arweave.net/{txId}
  - https:// → fetch directly (with timeout + retry)
  - data:image/svg+xml;base64,... → decode base64
  - data:application/json;base64,... → decode, extract image, recurse

Step 4: NORMALIZE
  Map to universal schema:
  {
    name: string,                    // Original NFT name
    description: string,             // Original description  
    image: Buffer,                   // Downloaded image binary
    image_mime: string,              // image/png, image/svg+xml, video/mp4, etc.
    animation_url?: string,          // Video/audio if present
    attributes: [{                   // Traits
      trait_type: string,
      value: string | number
    }],
    source_chain: string,            // "ethereum", "polygon", "sui", etc.
    source_chain_id: number,         // Wormhole chain ID
    source_contract: string,         // Contract/program address
    source_token_id: string,         // Token ID
    original_metadata_uri: string,   // Original tokenURI for reference
    fetched_at: string               // ISO timestamp (snapshot time)
  }

Step 5: UPLOAD TO ARWEAVE (via Irys)
  a. Upload image → get Arweave image URI
  b. Build reborn metadata JSON (see schema below)
  c. Upload metadata JSON → get Arweave metadata URI
  
Step 6: MINT ON SOLANA
  Mint Metaplex Core NFT with Arweave metadata URI
```

### Reborn NFT Specification

**Minting Standard: Metaplex Core** (not Token Metadata, not cNFTs)
- Official Metaplex recommendation for all new projects (2026)
- ~0.003 SOL per mint (80% cheaper than Token Metadata)
- ~17,000 compute units (vs 205,000 for TM)
- Single account per NFT, enforced royalties, DAS-compatible
- Program ID: `CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d`
- SDKs: `@metaplex-foundation/mpl-core`, `@metaplex-foundation/umi`

**Collection:** Single "Ika Tensei Reborn" collection for all reborn NFTs.
```typescript
// One-time collection creation (~0.002 SOL)
await createCollection(umi, {
  collection: collectionSigner,
  name: 'Ika Tensei Reborn',
  uri: collectionMetadataUri,
  plugins: [{
    type: 'Royalties',
    basisPoints: 500, // 5%
    creators: [{ address: protocolTreasury, percentage: 100 }],
    ruleSet: ruleSet('None'), // Permissive initially, can enforce later
  }]
});
```

**Reborn NFT Name:** `"{Original Name} ✦ Reborn"`

**Reborn NFT Metadata JSON** (uploaded to Arweave):
```json
{
  "name": "Cosmic Squid #42 ✦ Reborn",
  "symbol": "REBORN",
  "description": "Originally Cosmic Squid #42 from the Cosmic Creatures collection on Ethereum. Sealed and reborn on Solana through Ika Tensei — the NFT reincarnation protocol.",
  "image": "https://gateway.irys.xyz/{image-tx-id}",
  "animation_url": "https://gateway.irys.xyz/{video-tx-id}",
  "external_url": "https://etherscan.io/nft/{contract}/{tokenId}",
  "attributes": [
    {"trait_type": "Background", "value": "Nebula"},
    {"trait_type": "Body", "value": "Cosmic"},
    {"trait_type": "Eyes", "value": "Stargazer"},
    {"trait_type": "Source Chain", "value": "Ethereum"},
    {"trait_type": "Source Collection", "value": "Cosmic Creatures"},
    {"trait_type": "Source Token ID", "value": "42"},
    {"trait_type": "Seal Date", "value": "2026-03-15"},
    {"trait_type": "dWallet Address", "value": "0x1a2b3c..."},
    {"trait_type": "Provenance", "value": "Ika Tensei Reborn"}
  ],
  "properties": {
    "files": [
      {"uri": "https://gateway.irys.xyz/{image-tx-id}", "type": "image/png"}
    ],
    "category": "image",
    "provenance": {
      "source_chain": "ethereum",
      "source_chain_id": 2,
      "source_contract": "0xAbCdEf...",
      "source_token_id": "42",
      "dwallet_address": "0x1a2b3c...",
      "seal_tx": "J2ScVXNczDhwE8v7ZcnDaRoaxVryxQpaj3PmoSS6aG3M",
      "original_metadata_uri": "ipfs://QmXyz..."
    }
  }
}
```

**Royalties:** 5% advisory initially (`ruleSet('None')`). Can upgrade to enforced allowlist via `updateCollectionPlugin` later for marketplace compliance.

### Storage: Arweave via Irys

- **Irys (formerly Bundlr):** Upload SDK that pays Arweave in SOL/ETH/other tokens
- **Permanent storage:** Pay once, stored forever. No pinning, no expiry.
- **Cost:** ~$0.015 per MB. Typical NFT (1MB image + 2KB JSON) = ~$0.02
- **Speed:** 7000x faster than direct Arweave uploads
- **Integration:** `@irys/sdk` — Node.js, pays with Solana keypair

```typescript
import Irys from "@irys/sdk";

const irys = new Irys({ url: "https://node2.irys.xyz", token: "solana", key: walletKeypair });
await irys.fund(irys.utils.toAtomic(0.1)); // Fund with 0.1 SOL

// Upload image
const imageReceipt = await irys.uploadFile("./image.png");
const imageUri = `https://gateway.irys.xyz/${imageReceipt.id}`;

// Upload metadata JSON
const metadataReceipt = await irys.upload(JSON.stringify(metadata));
const metadataUri = `https://gateway.irys.xyz/${metadataReceipt.id}`;
```

### Cost Per Reborn NFT

| Component | Cost |
|-----------|------|
| Arweave upload (image + JSON via Irys) | ~$0.02 |
| Solana mint (Metaplex Core) | ~0.003 SOL (~$0.30) |
| Metadata API lookup | Free (within tier limits) |
| **Total per reborn NFT** | **~$0.30-0.50** |

### Edge Cases

- **On-chain SVGs** (Nouns, Art Blocks): Decode base64, re-upload as-is to Arweave
- **IPFS failures:** 5-gateway rotation with 10s timeout each, then cache miss = retry queue
- **Dead metadata URIs:** Some old collections have dead HTTP servers. Try marketplace APIs as fallback. If truly dead, mint with chain/contract/tokenID only + "metadata unavailable" flag
- **Dynamic NFTs:** We snapshot at seal time. The reborn NFT preserves the state at moment of sealing.
- **Unrevealed / lazy-minted:** Detect placeholder metadata (common patterns: "unrevealed", "hidden"). Warn user to reveal before sealing.
- **Soulbound tokens (SBTs):** Cannot be transferred to deposit address. Detect and reject with explanation.
- **CryptoPunks:** No ERC-721. Custom resolver using Larva Labs contract + punk image generation.
- **Wrapped NFTs:** Detect wrapper (WNFT, Wrapped Punks) and resolve underlying metadata.
- **Video/audio NFTs:** Upload media to Arweave, set `animation_url` in reborn metadata.
- **ERC-1155 semi-fungibles:** Verify user sent exactly 1 token (not a batch). Handle `{id}` substitution in URI.
- **Kiosk-locked Sui NFTs:** Cannot transfer to deposit address. Phase 2: build kiosk-aware deposit flow.

### Implementation: Modular Metadata Resolver

```typescript
interface ChainResolver {
  // Detect if NFT exists at address
  detectDeposit(address: string): Promise<DepositedNFT | null>;
  // Fetch metadata for a specific NFT
  resolveMetadata(contract: string, tokenId: string): Promise<RawMetadata>;
}

// Tier 1: API-backed resolvers (fast, cached, normalized)
class AlchemyEVMResolver implements ChainResolver { ... }    // 18 EVM chains
class HeliusSolanaResolver implements ChainResolver { ... }   // Solana + cNFTs

// Tier 2: API fallback
class NFTScanResolver implements ChainResolver { ... }        // Aptos, BTC, gaps
class RaribleResolver implements ChainResolver { ... }        // Novel L2s

// Tier 3: Direct RPC (always available, slower)
class EVMDirectResolver implements ChainResolver { ... }      // tokenURI() + fetch
class SuiDirectResolver implements ChainResolver { ... }      // sui_getObject + Display
class AptosDirectResolver implements ChainResolver { ... }    // Token v1/v2 detection
class NEARDirectResolver implements ChainResolver { ... }     // nft_token() view call

// Normalizer: any raw metadata → universal schema
class MetadataNormalizer {
  normalize(raw: RawMetadata, chain: Chain): NormalizedMetadata;
}

// Image resolver: any URI → downloaded binary
class ImageResolver {
  resolve(uri: string): Promise<{ buffer: Buffer; mime: string }>;
  // Handles: ipfs://, ar://, https://, data:base64, SVG decode
  // IPFS gateway rotation: nftstorage → cloudflare → ipfs.io → pinata → w3s
}

// Uploader: normalized metadata + image → Arweave URIs
class ArweaveUploader {
  upload(metadata: NormalizedMetadata, image: Buffer): Promise<{ imageUri: string; metadataUri: string }>;
  // Uses Irys SDK, pays in SOL
}

// Minter: Arweave URI → Metaplex Core NFT on Solana
class RebornMinter {
  mint(metadataUri: string, recipient: PublicKey, collection: PublicKey): Promise<string>;
  // Uses @metaplex-foundation/mpl-core + umi
}
```

### IPFS Gateway Rotation Strategy

```typescript
const IPFS_GATEWAYS = [
  "https://nftstorage.link/ipfs/",      // Most reliable for NFTs
  "https://cloudflare-ipfs.com/ipfs/",   // Fast CDN
  "https://ipfs.io/ipfs/",              // Official, sometimes slow
  "https://gateway.pinata.cloud/ipfs/",  // Pinata
  "https://w3s.link/ipfs/",             // Web3.Storage
];

async function resolveIPFS(cid: string): Promise<Buffer> {
  for (const gateway of IPFS_GATEWAYS) {
    try {
      const res = await fetch(gateway + cid, { signal: AbortSignal.timeout(10000) });
      if (res.ok) return Buffer.from(await res.arrayBuffer());
    } catch { continue; }
  }
  throw new Error(`IPFS resolution failed for ${cid} across all gateways`);
}
```
