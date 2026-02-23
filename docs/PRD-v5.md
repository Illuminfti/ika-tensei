# Ika Tensei PRD v5 — Zero-Trust Wormhole-Verified Architecture

## Overview

Ika Tensei is an NFT reincarnation protocol. Users **seal** (permanently lock) NFTs on any source chain and **reborn** (mint) new versions on Solana. Unlike v4 (backend-dependent), v5 is fully decentralized from day one: no backend, no server, no single point of failure.

**Key change from v4:** Wormhole guardians verify NFT deposits and metadata on-chain. The entire pipeline runs trustlessly via smart contracts, Wormhole VAAs, and IKA dWallets. The frontend is a static site. Anyone can run it.

## Core Principles

1. **Zero trust.** No backend. No operator. No API keys. Every step is verifiable on-chain.
2. **Users only connect their Solana wallet.** Same as v4.
3. **Wormhole guardians are the oracle.** 19 independent nodes verify source chain state. 13/19 must agree.
4. **IKA dWallets provide custody.** Decentralized 2PC-MPC key management. No single party holds the NFT.
5. **Content-addressed metadata is fully verifiable.** IPFS/Arweave URIs cannot be faked.

## Architecture

### High-Level Flow

```
┌──────────────────────────────────────────────────────────────┐
│  Frontend (Static site, Vercel/IPFS/Arweave — no backend)   │
│  - Connects Solana wallet                                     │
│  - Calls IKA SDK directly (dWallet creation)                  │
│  - Calls source chain contract (seal initiation)              │
│  - Fetches + relays Wormhole VAA                              │
│  - Calls Solana program (mint reborn NFT)                     │
└────────┬──────────────┬──────────────┬───────────────────────┘
         │              │              │
    ┌────▼────┐   ┌─────▼─────┐  ┌────▼──────────────────────┐
    │   IKA   │   │ Wormhole  │  │  Solana Program            │
    │ dWallet │   │ Guardians │  │  (IkaTenseiReborn)          │
    │ Network │   │ (19 nodes)│  │  - Verify VAA (13/19 sigs)  │
    │         │   │           │  │  - Verify dWallet ownership  │
    │ Creates │   │ Observe   │  │  - Mint Metaplex Core NFT   │
    │ deposit │   │ source    │  │  - Store provenance on-chain │
    │ address │   │ chain     │  │                              │
    └─────────┘   └───────────┘  └─────────────────────────────┘
```

### No Backend. Here's What Replaces It.

| v4 (Backend) | v5 (Decentralized) |
|---|---|
| Backend creates dWallets | Frontend calls IKA SDK directly |
| Backend polls for deposits | User triggers verification via source chain contract |
| Backend fetches metadata via Alchemy/Helius APIs | Source chain contract reads `tokenURI()` on-chain, Wormhole guardians attest it |
| Backend uploads to Arweave | User uploads via Irys browser SDK (pays ~$0.02) |
| Backend mints reborn NFT | User submits VAA to Solana program, program mints |
| Backend goes down = sealing stops | Nothing to go down. Contracts are permanent. |

## User Flow

```
1. User visits ika-tensei.io (static site)
2. Connects Solana wallet (Phantom, Backpack, etc.)
3. Clicks "Seal an NFT"
4. Selects source chain (Ethereum, Polygon, Arbitrum, etc.)
5. Frontend calls IKA SDK → creates dWallet → displays deposit address
6. User sends NFT to deposit address (via MetaMask or any wallet)
7. User returns to frontend, clicks "Verify Deposit"
8. Frontend calls SealInitiator contract on source chain:
   - Contract verifies NFT is at deposit address
   - Contract reads tokenURI(tokenId) on-chain
   - Contract emits Wormhole message containing:
     {chainId, contract, tokenId, depositAddress, tokenURI, owner}
9. User waits ~15 min for Wormhole guardian consensus
10. Frontend fetches signed VAA from Wormhole API
11. Frontend resolves metadata from tokenURI:
    - IPFS/Arweave: content-addressed, verifiable by hash
    - HTTP: fetched but flagged as "mutable source"
12. Frontend uploads original + reborn metadata to Arweave via Irys
    (user pays ~$0.02 in SOL)
13. Frontend submits to Solana program:
    - Wormhole VAA (proves deposit + tokenURI)
    - Arweave metadata URI
    - Content hash of metadata
14. Solana program:
    - Verifies VAA signatures (13/19 guardians)
    - Extracts tokenURI from VAA payload
    - For IPFS/Arweave URIs: verifies content hash matches CID/txId
    - For HTTP URIs: stores with "unverified_source" flag
    - Mints Metaplex Core reborn NFT
    - Stores full provenance on-chain
15. User receives reborn NFT in Solana wallet
```

## Smart Contracts

### Source Chain: SealInitiator (EVM)

One contract deployed per EVM chain. Permissionless. Anyone can call it.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "wormhole-solidity-sdk/interfaces/IWormhole.sol";

contract SealInitiator {
    IWormhole public immutable wormhole;
    uint32 public nonce;

    event SealInitiated(
        address indexed nftContract,
        uint256 indexed tokenId,
        address depositAddress,
        string tokenURI,
        address initiator
    );

    constructor(address _wormhole) {
        wormhole = IWormhole(_wormhole);
    }

    /// @notice Verify NFT is at deposit address and emit Wormhole message
    /// @dev Anyone can call this. The contract reads on-chain state only.
    function initiateSeal(
        address nftContract,
        uint256 tokenId,
        address depositAddress,
        address solanaRecipient  // 32 bytes, the user's Solana wallet
    ) external payable returns (uint64 sequence) {
        // Verify the NFT is actually at the deposit address
        require(
            IERC721(nftContract).ownerOf(tokenId) == depositAddress,
            "NFT not at deposit address"
        );

        // Read tokenURI on-chain (deterministic, same for all callers)
        string memory uri = _getTokenURI(nftContract, tokenId);

        // Build Wormhole payload
        bytes memory payload = abi.encode(
            uint8(1),              // payload type: SealAttestation
            nftContract,           // source NFT contract
            tokenId,               // source token ID
            depositAddress,        // dWallet deposit address
            solanaRecipient,       // user's Solana wallet (32 bytes)
            uri                    // tokenURI value (from on-chain read)
        );

        // Emit Wormhole message
        // Cost: ~0.0001 ETH (Wormhole message fee)
        sequence = wormhole.publishMessage{value: msg.value}(
            nonce++,
            payload,
            1  // consistency level: finalized
        );

        emit SealInitiated(nftContract, tokenId, depositAddress, uri, msg.sender);
    }

    function _getTokenURI(address nftContract, uint256 tokenId) 
        internal view returns (string memory) 
    {
        // Try ERC721Metadata interface
        (bool success, bytes memory data) = nftContract.staticcall(
            abi.encodeWithSignature("tokenURI(uint256)", tokenId)
        );
        if (success && data.length > 0) {
            return abi.decode(data, (string));
        }

        // Try ERC1155 uri()
        (success, data) = nftContract.staticcall(
            abi.encodeWithSignature("uri(uint256)", tokenId)
        );
        if (success && data.length > 0) {
            return abi.decode(data, (string));
        }

        return "";  // No metadata URI found
    }
}
```

**Deployment cost:** ~$50-200 per EVM chain (one-time).  
**User cost per seal:** Wormhole message fee (~$0.05) + gas (~$1-5 on L1, pennies on L2s).

### Destination Chain: IkaTenseiReborn (Solana)

Solana program that verifies VAAs and mints reborn NFTs.

```rust
// Pseudocode — actual implementation in Anchor

#[program]
pub mod ika_tensei_reborn {
    use super::*;

    /// Mint a reborn NFT after verifying Wormhole VAA
    pub fn mint_reborn(
        ctx: Context<MintReborn>,
        vaa_data: Vec<u8>,           // Raw signed VAA
        metadata_uri: String,         // Arweave URI for reborn metadata
        original_metadata_hash: [u8; 32],  // SHA-256 of original metadata
        metadata_source: MetadataSource,   // IPFS / Arweave / HTTP
    ) -> Result<()> {
        // 1. Parse and verify VAA (13/19 guardian signatures)
        let vaa = parse_and_verify_vaa(&ctx.accounts.wormhole_bridge, &vaa_data)?;
        
        // 2. Extract payload
        let payload = SealPayload::deserialize(&vaa.payload)?;
        // payload contains: chain_id, nft_contract, token_id, 
        //                   deposit_address, solana_recipient, token_uri
        
        // 3. Verify recipient matches signer
        require!(
            payload.solana_recipient == ctx.accounts.recipient.key(),
            ErrorCode::RecipientMismatch
        );
        
        // 4. Verify metadata integrity
        match metadata_source {
            MetadataSource::IPFS => {
                // tokenURI from VAA is ipfs://QmXYZ...
                // The CID IS the content hash. Verify it matches.
                let cid = extract_ipfs_cid(&payload.token_uri)?;
                require!(
                    verify_cid_hash(&cid, &original_metadata_hash),
                    ErrorCode::MetadataHashMismatch
                );
            },
            MetadataSource::Arweave => {
                // ar://txId — transaction ID is content-addressed
                // Similar verification
                let tx_id = extract_arweave_id(&payload.token_uri)?;
                require!(
                    verify_arweave_hash(&tx_id, &original_metadata_hash),
                    ErrorCode::MetadataHashMismatch
                );
            },
            MetadataSource::HTTP => {
                // Can't verify trustlessly. Store hash for future audit.
                // Flag the reborn NFT as "metadata_source: unverified"
            },
        }
        
        // 5. Check this VAA hasn't been used before (prevent double-mint)
        let vaa_hash = hash_vaa(&vaa_data);
        require!(
            !ctx.accounts.used_vaas.contains(&vaa_hash),
            ErrorCode::VAAAlreadyUsed
        );
        ctx.accounts.used_vaas.mark_used(vaa_hash)?;
        
        // 6. Mint Metaplex Core reborn NFT
        mint_metaplex_core_nft(
            &ctx.accounts.collection,
            &ctx.accounts.recipient,
            &metadata_uri,
            &ctx.accounts.metaplex_program,
        )?;
        
        // 7. Store provenance on-chain (in a PDA)
        let provenance = &mut ctx.accounts.provenance;
        provenance.source_chain = vaa.emitter_chain;
        provenance.source_contract = payload.nft_contract;
        provenance.source_token_id = payload.token_id;
        provenance.deposit_address = payload.deposit_address;
        provenance.token_uri = payload.token_uri;
        provenance.metadata_hash = original_metadata_hash;
        provenance.metadata_source = metadata_source;
        provenance.vaa_hash = vaa_hash;
        provenance.sealed_at = Clock::get()?.unix_timestamp;
        
        Ok(())
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub enum MetadataSource {
    IPFS,      // Fully verifiable (content-addressed)
    Arweave,   // Fully verifiable (content-addressed)
    HTTP,      // NOT verifiable (mutable source, flagged)
    OnChain,   // Fully verifiable (base64 in tokenURI)
}
```

## Metadata Verification: The Three Tiers

### Tier 1: Fully Verified (IPFS + Arweave) — ~80% of NFTs

- `tokenURI()` returns `ipfs://QmXYZ...` or `ar://abc123...`
- The CID/txId IS the content hash. Faking it is cryptographically impossible.
- Wormhole VAA contains the tokenURI (read on-chain by SealInitiator contract)
- Solana program verifies the content hash matches
- **Trust level: ZERO TRUST. Fully decentralized.**

### Tier 2: Guardian-Attested (HTTP URIs) — ~15% of NFTs

- `tokenURI()` returns `https://api.project.com/metadata/42`
- Content is mutable (server can change it)
- Wormhole guardians all see the same tokenURI (from on-chain read)
- But they don't fetch the HTTP content (not their job)
- User fetches content, uploads to Arweave, provides hash
- Solana program stores with `metadata_source: HTTP` flag
- **Trust level: PARTIALLY VERIFIED.** tokenURI is verified, content is user-attested.
- **Mitigation:** Anyone can independently fetch the HTTP URI and compare to the stored hash. If a user lied, it's publicly detectable.

### Tier 3: Metadata Unavailable — ~5% of NFTs

- Dead HTTP servers, custom contracts with no standard interface
- Reborn NFT minted with chain/contract/tokenId only
- Image placeholder or on-chain pixel art generated from tokenId hash
- **Trust level: N/A.** No metadata to verify.

## dWallet Integration

### dWallet Creation (unchanged from v4)

- Frontend calls IKA SDK directly (no backend)
- `prepareDKGAsync(secp256k1)` for EVM chains
- `prepareDKGAsync(ed25519)` for Solana/Sui/Aptos/NEAR
- Returns deposit address for the source chain

### dWallet Permanent Lock

After the reborn NFT is minted, the DWalletCap must be permanently locked to ensure the original NFT can never be moved:

**Option A: Sui SealVault (same as v4)**
- Frontend transfers DWalletCap to SealVault contract on Sui
- Contract has no release function. Permanent.

**Option B: On-chain burn via Wormhole**
- A second Wormhole message from Solana back to Sui
- "Seal complete, lock DWalletCap for dWallet X"
- SealVault on Sui verifies the VAA and locks the cap
- Fully automated, no manual step

**Recommendation:** Option A for v1 (simpler). The frontend handles the lock after mint confirmation.

## Supported Chains

### Phase 1 (Launch)

Every chain where Wormhole has core contracts:

**EVM (deploy SealInitiator on each):**
- Ethereum, Polygon, Arbitrum, Base, Optimism, Avalanche, BSC, Fantom, Moonbeam, Celo, Scroll, Blast, Linea, Gnosis

**Non-EVM (chain-specific SealInitiator equivalents):**
- Solana (native program reads metadata PDA, emits Wormhole message)
- Sui (Move module reads Display fields, emits Wormhole message)
- Aptos (Move module reads Token data, emits Wormhole message)

### Phase 2
- NEAR, Algorand, Cosmos chains
- Bitcoin Ordinals (requires custom attestation, no Wormhole support)

## Fees

| Component | Who Pays | Cost |
|---|---|---|
| dWallet creation (Sui gas) | Protocol (pre-funded pool) | ~$0.01 |
| Source chain gas (SealInitiator call) | User | ~$1-5 L1, ~$0.01 L2 |
| Wormhole message fee | User | ~$0.05 |
| Arweave upload (image + JSON via Irys) | User (browser SDK) | ~$0.02 |
| Solana mint (Metaplex Core) | User | ~$0.30 (0.003 SOL) |
| **Total per seal** | **User** | **~$1.50-6 (L1) or ~$0.40 (L2)** |

**Protocol revenue:** Seal fee in SOL on top of costs. Set by governance (Guild DAO).

## Frontend Architecture

The frontend is a **static site** with no server-side logic:

```
packages/frontend/
├── app/
│   ├── page.tsx          # Landing
│   ├── seal/page.tsx     # Seal flow (calls contracts directly)
│   ├── gallery/page.tsx  # View reborn NFTs (reads Solana on-chain)
│   └── guild/page.tsx    # DAO governance (Realms)
├── lib/
│   ├── ika-sdk.ts        # IKA dWallet creation (browser)
│   ├── wormhole.ts       # VAA fetching + parsing
│   ├── irys-upload.ts    # Arweave upload from browser
│   ├── seal-initiator.ts # Call SealInitiator on source chains
│   ├── solana-program.ts # Call IkaTenseiReborn on Solana
│   └── metadata.ts       # Fetch + resolve metadata from tokenURI
```

**Can be hosted on:** Vercel, IPFS, Arweave, GitHub Pages, anywhere. It's just HTML/JS.

## Reborn NFT Specification

Same as v4 with additions:

**Name:** `"{Original Name} ✦ Reborn"`

**On-chain provenance PDA stores:**
```
source_chain: u16           // Wormhole chain ID
source_contract: [u8; 32]   // NFT contract address
source_token_id: String      // Token ID
deposit_address: [u8; 32]   // dWallet deposit address
token_uri: String            // Original tokenURI (from VAA)
metadata_hash: [u8; 32]     // SHA-256 of original metadata
metadata_source: enum        // IPFS | Arweave | HTTP | OnChain
vaa_hash: [u8; 32]          // Wormhole VAA hash (replay protection)
sealed_at: i64              // Unix timestamp
reborn_mint: Pubkey          // Reborn NFT mint address
```

**Verification by anyone:**
1. Read provenance PDA for any reborn NFT
2. Fetch the Wormhole VAA by hash (public, permanent)
3. Verify 13/19 guardian signatures
4. Extract tokenURI from VAA payload
5. For IPFS/Arweave: fetch content, verify hash matches
6. Check source chain: NFT is at deposit address
7. Check Sui: DWalletCap is locked in SealVault

Every step is independently verifiable. No trust in anyone.

## Edge Cases

### CryptoPunks
No ERC-721 interface. Custom SealInitiator variant that reads `punkIndexToAddress()` and the punk image hash from the CryptoPunks contract. Wormhole guardians attest both.

### On-chain SVGs (Nouns, Art Blocks)
`tokenURI()` returns `data:application/json;base64,...`. The entire metadata is on-chain. SealInitiator reads it, Wormhole attests it. Fully verifiable. No HTTP dependency.

### ERC-1155
SealInitiator reads `uri(tokenId)` and verifies `balanceOf(depositAddress, tokenId) >= 1`.

### Kiosk-locked Sui NFTs
Phase 2. Requires kiosk-aware deposit flow with TransferPolicy compliance.

### Dynamic NFTs
Snapshot at seal time. The Wormhole VAA captures the tokenURI at the moment of attestation. If the NFT changes after sealing, the reborn preserves the sealed-time state.

## Security Model

| Threat | Mitigation |
|---|---|
| User fakes metadata | For IPFS/Arweave: impossible (content-addressed). For HTTP: flagged, publicly auditable. |
| User mints without depositing | SealInitiator verifies `ownerOf() == depositAddress` on-chain. Can't fake. |
| Double mint (same NFT twice) | VAA hash stored in used_vaas PDA. Second attempt rejected. |
| Wormhole guardian compromise | 13/19 must collude. $10B+ TVL secured by same set. |
| dWallet key compromise | 2PC-MPC: neither IKA network nor DWalletCap holder can sign alone. |
| Frontend tampered | Users can run their own frontend. Contracts are the source of truth. |
| Contract bug | Auditable on-chain. Upgradeable via governance multisig (initially), then DAO. |

## Migration from v4

| v4 Component | v5 Status |
|---|---|
| `packages/backend/` | **REMOVED.** No backend needed. |
| `packages/shared/src/wormhole-vaa.ts` | **KEPT.** VAA parsing moves to frontend. |
| `packages/shared/src/wormhole.ts` | **KEPT.** Wormhole chain constants. |
| Alchemy/Helius API integrations | **REMOVED from pipeline.** Optional for frontend UX (preview metadata before sealing). |
| `packages/frontend/` | **EXPANDED.** Now handles entire flow client-side. |
| Sui SealVault contract | **KEPT.** DWalletCap lock unchanged. |
| Solana program | **REWRITTEN.** New program verifies VAAs + mints. |
| EVM contracts | **NEW.** SealInitiator deployed per chain. |

## Implementation Timeline

### Phase 1: Core Contracts (3 weeks)
- [ ] SealInitiator contract (Solidity) + deploy to Ethereum Sepolia
- [ ] IkaTenseiReborn program (Anchor/Solana) + deploy to devnet
- [ ] VAA verification on Solana (integrate wormhole-sdk)
- [ ] Metaplex Core minting from program
- [ ] Provenance PDA storage
- [ ] E2E test: Sepolia deposit → VAA → devnet mint

### Phase 2: Frontend Integration (2 weeks)
- [ ] IKA SDK browser integration (dWallet creation)
- [ ] SealInitiator contract calls from frontend (ethers.js)
- [ ] VAA polling + relay from frontend
- [ ] Irys browser upload (metadata to Arweave)
- [ ] Solana program call from frontend (@solana/web3.js)
- [ ] Full E2E flow in browser on testnet

### Phase 3: Multi-Chain (2 weeks)
- [ ] Deploy SealInitiator to all EVM chains (same bytecode)
- [ ] Sui SealInitiator (Move module)
- [ ] Solana-to-Solana sealing (Wormhole Core on Solana)
- [ ] Aptos SealInitiator (Move module)

### Phase 4: Production (2 weeks)
- [ ] Mainnet deployments (all chains)
- [ ] Audit (Solana program + SealInitiator + Sui contract)
- [ ] Frontend hosted on Arweave (permanent, uncensorable)
- [ ] Rate limiting via Solana program (max seals per slot)
- [ ] Monitoring dashboards (read on-chain state, no backend needed)

## Decisions (v5)

1. **No backend.** Everything runs on-chain or client-side. Unstoppable.
2. **Wormhole for cross-chain verification.** 19 guardians, battle-tested, $10B+ TVL.
3. **Three-tier metadata verification.** Fully verified (IPFS/Arweave), guardian-attested (HTTP), unavailable.
4. **User pays all costs.** No subsidized infrastructure. Protocol revenue = seal fee on top.
5. **HTTP metadata flagged, not rejected.** ~15% of NFTs use HTTP URIs. Accept them with honest "unverified" flag rather than blocking.
6. **Frontend can be hosted anywhere.** Vercel for convenience, Arweave for permanence.
7. **SealInitiator is permissionless.** Anyone can call it for any deposit address. No admin keys.
8. **VAA replay protection on-chain.** PDA tracks used VAA hashes. No double mints.
