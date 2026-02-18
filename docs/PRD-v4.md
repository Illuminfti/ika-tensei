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

## Critical Technical Challenge: Cross-Chain NFT Metadata

To mint a proper reborn NFT on Solana, we need the original NFT's metadata (name, description, image, attributes/traits) from the source chain. This is a MASSIVE consideration because every chain and every NFT standard stores metadata differently.

### Metadata Standards by Chain

**EVM (ERC-721 / ERC-1155):**
- `tokenURI(tokenId)` returns a URI (HTTP, IPFS, Arweave, on-chain base64)
- URI points to JSON: `{ name, description, image, attributes: [{trait_type, value}] }`
- Image can be: IPFS hash, HTTP URL, on-chain SVG (base64), Arweave
- Some collections use centralized APIs that may go down
- ERC-1155 uses `uri(tokenId)` with `{id}` substitution

**Solana (Metaplex):**
- Token Metadata program: on-chain name + symbol + URI
- URI → JSON with same structure as EVM but Metaplex-specific fields
- Metaplex Core (newer): different account structure

**Sui:**
- Objects with `display` standard (Display<T>)
- Fields defined per collection — no universal tokenURI equivalent
- Need to know the Move type to read display fields
- Kiosk-locked NFTs add complexity

**Aptos:**
- Token v1: `TokenDataId { creator, collection, name }` → on-chain metadata
- Token v2 (Digital Asset Standard): objects with URI property
- Two incompatible standards active

**NEAR (NEP-171/177):**
- `nft_metadata()` for collection, `nft_token(token_id)` for token
- Returns JSON with `media` (image URL) and `reference` (metadata URL)

### Metadata Fetching Strategy

```
1. Detect NFT at deposit address → get contract + tokenID + chain
2. Call chain-specific metadata resolver:
   - EVM: call tokenURI(), fetch JSON, resolve image
   - Solana: read Metaplex account, fetch JSON
   - Sui: read Display<T> fields
   - Aptos: read token data (v1 or v2)
   - NEAR: call nft_token() view function
3. Normalize to universal schema:
   {
     name: string,
     description: string,
     image: string (IPFS/HTTP URL),
     attributes: [{trait_type, value}][],
     source_chain: string,
     source_contract: string,
     source_token_id: string,
     original_metadata_uri: string
   }
4. Upload image + metadata to Walrus (decentralized storage on Sui)
5. Mint reborn NFT on Solana with Walrus URI
```

### Edge Cases
- **On-chain SVGs:** Decode base64, re-upload as PNG or keep as SVG
- **IPFS gateway failures:** Try multiple gateways (ipfs.io, cloudflare-ipfs, pinata, nftstorage)
- **Dead metadata:** Some old collections have dead HTTP URLs. Cache aggressively.
- **Dynamic NFTs:** Metadata changes over time. We snapshot at seal time.
- **No metadata:** Some NFTs are purely on-chain with no URI. Extract what we can.
- **Large media:** Video NFTs, music NFTs. Size limits on Walrus?

### Implementation: Modular Metadata Resolver

Build a chain-agnostic metadata resolver with per-chain adapters:

```typescript
interface MetadataResolver {
  resolve(chain: Chain, contract: string, tokenId: string): Promise<NormalizedMetadata>;
}

// Per-chain implementations
class EVMResolver implements MetadataResolver { ... }
class SolanaResolver implements MetadataResolver { ... }
class SuiResolver implements MetadataResolver { ... }
class AptosResolver implements MetadataResolver { ... }
class NEARResolver implements MetadataResolver { ... }
```

This is one of the hardest parts of the whole system — reliable cross-chain metadata resolution at scale.
