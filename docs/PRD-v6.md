# Ika Tensei PRD v6 — Sui-Orchestrated Wormhole Architecture

## Overview

Ika Tensei is an NFT reincarnation protocol. Users **seal** (permanently lock) NFTs on any source chain and **reborn** (mint) new versions on Solana.

**Key change from v5:** Sui is the orchestration layer. Source chain contracts emit Wormhole VAAs. The Sui contract verifies VAAs, validates dWallet ownership, and signs a message via IKA. A permissionless relayer delivers that signature to Solana, which verifies it and mints the reborn NFT.

This is Fesal's architecture. It's cleaner than v5 because:
- Sui handles all the heavy verification (Wormhole VAA + dWallet validation)
- Solana only verifies one Ed25519 signature (cheap, native precompile)
- IKA dWallet signing happens natively on Sui (where IKA lives)
- Per-collection creation on Solana (each source collection gets its own reborn collection)

## Architecture

```
 Source Chains                    Sui (Orchestrator)              Solana (Destination)
┌─────────────┐                 ┌─────────────────┐             ┌──────────────────┐
│ EVM Contract│──Wormhole VAA──>│  Sui Contract    │             │ Solana Program   │
│ (Solidity)  │                 │                  │             │                  │
├─────────────┤                 │ 1. Verify VAA    │  Relayer    │ 1. Verify sig    │
│MoveVM Contrt│──Wormhole VAA──>│ 2. Validate      │────────────>│ 2. Create        │
│ (Sui/Aptos) │                 │    dWallet addr  │  (sig+data) │    collection    │
├─────────────┤                 │ 3. Construct msg │             │    (if new)      │
│NEAR Contract│──Wormhole VAA──>│    sha256(       │             │ 3. Mint NFT to   │
│ (Rust)      │                 │     tokenId +    │             │    receiver      │
└─────────────┘                 │     tokenURI +   │             └──────────────────┘
                                │     receiver)    │
  VAA payload:                  │ 4. Sign with IKA │
  - token id                    │    dWallet       │
  - token uri                   │ 5. Emit event    │
  - receiver address            │    (sig + data)  │
  - dWallet deposit addr        └─────────────────┘
```

## Core Principles

1. **Sui is the brain.** All verification happens on Sui where IKA lives natively.
2. **Solana is thin.** It only verifies one Ed25519 signature and mints. Cheap and fast.
3. **Source chain contracts are simple.** Read NFT state, emit Wormhole message. Same template per chain family.
4. **Relayer is permissionless.** Anyone can run it. It just moves signed data from Sui to Solana. Can't tamper.
5. **Users only connect Solana wallet.** Same UX as v4/v5.

## User Flow

```
1. User connects Solana wallet on ika-tensei.io
2. Selects source chain, gets dWallet deposit address
3. Sends NFT to deposit address (via MetaMask, Phantom, etc.)
4. Clicks "Verify Deposit"
5. Source chain contract confirms NFT is at dWallet address,
   reads tokenURI, emits Wormhole VAA
6. ~15 min: Wormhole guardians reach consensus, VAA available
7. VAA delivered to Sui contract (by user, relayer, or anyone)
8. Sui contract:
   a. Verifies Wormhole VAA (13/19 guardian signatures)
   b. Validates dWallet address from VAA is a registered IKA dWallet
   c. Constructs message: sha256(token_id + token_uri + receiver)
   d. Signs message with IKA dWallet (2PC-MPC signing ceremony)
   e. Emits event containing signature + message data
9. Relayer picks up Sui event, fetches IKA signature
10. Relayer submits to Solana program: signature + data
11. Solana program:
    a. Verifies Ed25519 signature (native precompile, ~900 CU)
    b. Creates Metaplex Core collection for this source collection
       (if first NFT from this collection)
    c. Mints reborn NFT to receiver address
    d. Stores provenance on-chain
12. User sees reborn NFT in wallet
```

## Smart Contracts

### Layer 1: Source Chain Contracts

#### EVM SealInitiator (Solidity)

Deployed once per EVM chain. Same bytecode everywhere.

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
        bytes32 solanaReceiver
    );

    constructor(address _wormhole) {
        wormhole = IWormhole(_wormhole);
    }

    /// @notice Verify NFT deposit and emit Wormhole message
    /// @dev Permissionless. Anyone can call for any deposit address.
    function initiateSeal(
        address nftContract,
        uint256 tokenId,
        address depositAddress,
        bytes32 solanaReceiver  // User's Solana wallet (32 bytes)
    ) external payable returns (uint64 sequence) {
        // 1. Verify NFT is at deposit address
        require(
            IERC721(nftContract).ownerOf(tokenId) == depositAddress,
            "NFT not at deposit address"
        );

        // 2. Read tokenURI on-chain (deterministic)
        string memory uri = _getTokenURI(nftContract, tokenId);

        // 3. Build payload
        bytes memory payload = abi.encode(
            uint8(1),              // payload type: SealAttestation
            block.chainid,         // source chain
            nftContract,           // NFT contract
            tokenId,               // token ID
            depositAddress,        // dWallet deposit address
            solanaReceiver,        // destination wallet
            uri                    // tokenURI (on-chain read)
        );

        // 4. Emit Wormhole message
        sequence = wormhole.publishMessage{value: msg.value}(
            nonce++,
            payload,
            1  // finalized
        );

        emit SealInitiated(nftContract, tokenId, depositAddress, uri, solanaReceiver);
    }

    function _getTokenURI(address nftContract, uint256 tokenId)
        internal view returns (string memory)
    {
        // ERC-721
        (bool success, bytes memory data) = nftContract.staticcall(
            abi.encodeWithSignature("tokenURI(uint256)", tokenId)
        );
        if (success && data.length > 0) {
            return abi.decode(data, (string));
        }
        // ERC-1155
        (success, data) = nftContract.staticcall(
            abi.encodeWithSignature("uri(uint256)", tokenId)
        );
        if (success && data.length > 0) {
            return abi.decode(data, (string));
        }
        return "";
    }
}
```

#### MoveVM SealInitiator (Sui/Aptos)

```move
module ika_tensei::seal_initiator {
    use wormhole::publish_message;
    use sui::object;
    use sui::transfer;

    /// Verify NFT is owned by dWallet address and emit Wormhole message
    public entry fun initiate_seal<T: key + store>(
        nft: &T,
        deposit_address: address,
        solana_receiver: vector<u8>,  // 32 bytes
        token_uri: vector<u8>,       // Display<T> resolved URI
        wormhole_state: &mut WormholeState,
        wormhole_fee: Coin<SUI>,
    ) {
        // Verify NFT owner matches deposit address
        assert!(object::owner(nft) == deposit_address, E_NOT_AT_DEPOSIT);

        // Build payload (same format as EVM)
        let payload = build_seal_payload(
            sui::chain_id(),
            object::id_address(nft),
            token_uri,
            deposit_address,
            solana_receiver,
        );

        // Emit Wormhole message
        publish_message::publish_message(
            wormhole_state,
            wormhole_fee,
            payload,
            1, // finalized
        );
    }
}
```

#### NEAR SealInitiator (Rust)

```rust
#[near_bindgen]
impl SealInitiator {
    pub fn initiate_seal(
        &mut self,
        nft_contract: AccountId,
        token_id: String,
        deposit_address: AccountId,
        solana_receiver: [u8; 32],
    ) -> Promise {
        // 1. Cross-contract call to verify NFT ownership
        ext_nft::nft_token(token_id.clone(), nft_contract.clone())
            .then(Self::ext(env::current_account_id())
                .on_nft_verified(
                    nft_contract, token_id, deposit_address,
                    solana_receiver
                ))
    }

    #[private]
    pub fn on_nft_verified(
        &mut self,
        nft_contract: AccountId,
        token_id: String,
        deposit_address: AccountId,
        solana_receiver: [u8; 32],
        #[callback_result] token: Result<Token, PromiseError>,
    ) {
        let token = token.expect("NFT query failed");
        assert_eq!(token.owner_id, deposit_address, "NFT not at deposit");

        let token_uri = token.metadata
            .map(|m| m.reference.unwrap_or_default())
            .unwrap_or_default();

        // Emit Wormhole message
        self.wormhole.publish_message(
            build_seal_payload(token_id, token_uri, deposit_address, solana_receiver)
        );
    }
}
```

### Layer 2: Sui Orchestrator Contract

The brain. Receives Wormhole VAAs from all source chains, verifies everything, signs with IKA.

```move
module ika_tensei::orchestrator {
    use wormhole::vaa;
    use ika::dwallet;
    use ika::dwallet_cap;
    use sui::hash;
    use sui::event;

    /// Registry of valid dWallet deposit addresses
    struct DWalletRegistry has key {
        id: UID,
        // Map: deposit_address => dWallet object ID
        wallets: Table<vector<u8>, ID>,
    }

    /// Emitted after successful verification + signing
    struct SealSigned has copy, drop {
        source_chain: u16,
        nft_contract: vector<u8>,
        token_id: vector<u8>,
        token_uri: vector<u8>,
        receiver: vector<u8>,       // Solana wallet (32 bytes)
        deposit_address: vector<u8>,
        message_hash: vector<u8>,   // sha256(token_id + token_uri + receiver)
        signature: vector<u8>,      // IKA dWallet Ed25519 signature
    }

    /// Process a Wormhole VAA and sign with IKA
    public entry fun process_seal(
        registry: &DWalletRegistry,
        vaa_bytes: vector<u8>,
        dwallet: &DWallet,
        dwallet_cap: &DWalletCap,
        wormhole_state: &WormholeState,
    ) {
        // 1. Parse and verify Wormhole VAA (13/19 guardian sigs)
        let verified_vaa = vaa::parse_and_verify(wormhole_state, vaa_bytes);

        // 2. Decode payload
        let payload = decode_seal_payload(vaa::payload(&verified_vaa));
        // payload: { source_chain, nft_contract, token_id,
        //            deposit_address, receiver, token_uri }

        // 3. Verify dWallet deposit address is registered
        assert!(
            table::contains(&registry.wallets, payload.deposit_address),
            E_INVALID_DWALLET
        );
        let registered_id = table::borrow(&registry.wallets, payload.deposit_address);
        assert!(object::id(dwallet) == *registered_id, E_DWALLET_MISMATCH);

        // 4. Construct message to sign
        // sha256(token_id || token_uri || receiver)
        let mut data = vector::empty<u8>();
        vector::append(&mut data, payload.token_id);
        vector::append(&mut data, payload.token_uri);
        vector::append(&mut data, payload.receiver);
        let message_hash = hash::sha2_256(data);

        // 5. Sign with IKA dWallet (2PC-MPC)
        let signature = dwallet::sign(
            dwallet,
            dwallet_cap,
            message_hash,
        );

        // 6. Emit event for relayer
        event::emit(SealSigned {
            source_chain: payload.source_chain,
            nft_contract: payload.nft_contract,
            token_id: payload.token_id,
            token_uri: payload.token_uri,
            receiver: payload.receiver,
            deposit_address: payload.deposit_address,
            message_hash,
            signature,
        });

        // 7. Lock DWalletCap (permanent seal)
        dwallet_cap::lock(dwallet_cap);
    }
}
```

### Layer 3: Solana Reborn Program

Thin. Verifies signature, creates collection if needed, mints NFT.

```rust
use anchor_lang::prelude::*;
use anchor_lang::solana_program::ed25519_program;

#[program]
pub mod ika_tensei_reborn {
    use super::*;

    /// Mint a reborn NFT after verifying IKA dWallet signature
    pub fn mint_reborn(
        ctx: Context<MintReborn>,
        signature: [u8; 64],       // Ed25519 signature from IKA
        dwallet_pubkey: [u8; 32],  // IKA dWallet Ed25519 public key
        source_chain: u16,
        nft_contract: Vec<u8>,
        token_id: Vec<u8>,
        token_uri: String,
        collection_name: String,    // Source collection name
    ) -> Result<()> {
        // 1. Reconstruct message hash
        let mut data = Vec::new();
        data.extend_from_slice(&token_id);
        data.extend_from_slice(token_uri.as_bytes());
        data.extend_from_slice(&ctx.accounts.receiver.key().to_bytes());
        let message_hash = anchor_lang::solana_program::hash::hash(&data);

        // 2. Verify Ed25519 signature (native precompile, ~900 CU)
        verify_ed25519_signature(
            &dwallet_pubkey,
            &message_hash.to_bytes(),
            &signature,
        )?;

        // 3. Check signature hasn't been used (replay protection)
        let sig_hash = anchor_lang::solana_program::hash::hash(&signature);
        require!(
            !ctx.accounts.used_signatures.is_used(&sig_hash),
            ErrorCode::SignatureAlreadyUsed
        );
        ctx.accounts.used_signatures.mark_used(sig_hash)?;

        // 4. Create collection if this is the first NFT from this source collection
        if !ctx.accounts.collection.is_initialized() {
            create_metaplex_core_collection(
                &ctx.accounts.collection,
                &collection_name,
                &ctx.accounts.metaplex_program,
            )?;
        }

        // 5. Mint Metaplex Core reborn NFT
        mint_metaplex_core_nft(
            &ctx.accounts.collection,
            &ctx.accounts.receiver,
            &token_uri,   // Original tokenURI preserved
            &ctx.accounts.metaplex_program,
        )?;

        // 6. Store provenance in PDA
        let provenance = &mut ctx.accounts.provenance;
        provenance.source_chain = source_chain;
        provenance.nft_contract = nft_contract;
        provenance.token_id = token_id;
        provenance.token_uri = token_uri;
        provenance.dwallet_pubkey = dwallet_pubkey;
        provenance.signature = signature;
        provenance.receiver = ctx.accounts.receiver.key();
        provenance.sealed_at = Clock::get()?.unix_timestamp;

        Ok(())
    }
}
```

### Layer 4: Relayer

Permissionless process that bridges Sui events to Solana. Anyone can run it.

```typescript
// relayer/src/index.ts
import { SuiClient } from "@mysten/sui/client";
import { Connection, Transaction } from "@solana/web3.js";

class SealRelayer {
    private sui: SuiClient;
    private solana: Connection;

    async run() {
        // Subscribe to SealSigned events on Sui
        const unsubscribe = await this.sui.subscribeEvent({
            filter: {
                MoveEventType: `${PACKAGE_ID}::orchestrator::SealSigned`
            },
            onMessage: (event) => this.relaySeal(event),
        });
    }

    async relaySeal(event: SuiEvent) {
        const data = event.parsedJson as SealSigned;

        // Build Solana transaction
        const tx = new Transaction().add(
            // Call mint_reborn on Solana program
            mintRebornInstruction({
                signature: data.signature,
                dwalletPubkey: data.dwallet_pubkey,
                sourceChain: data.source_chain,
                nftContract: data.nft_contract,
                tokenId: data.token_id,
                tokenUri: data.token_uri,
                collectionName: data.collection_name,
                receiver: new PublicKey(data.receiver),
            })
        );

        // Submit to Solana
        await this.solana.sendTransaction(tx, [this.relayerKeypair]);
    }
}
```

**Relayer properties:**
- **Permissionless:** Anyone can run one. The data is signed by IKA, relayer can't modify it.
- **Stateless:** Just watches Sui events and forwards to Solana.
- **Incentivizable:** Could add a small tip in the Solana program for relayers.
- **Redundant:** Multiple relayers can run simultaneously. Replay protection prevents double mints.

## Metadata Verification

Same three-tier model as v5, but verified at the source:

### Tier 1: Fully Verified (IPFS/Arweave) — ~80% of NFTs
- Source chain contract reads `tokenURI()` on-chain
- Returns `ipfs://QmXYZ...` or `ar://abc...`
- Content-addressed: CID/txId IS the content hash
- Wormhole guardians attest this value (19 independent nodes)
- Sui contract includes it in the signed message
- **Cannot be faked. Zero trust.**

### Tier 2: Guardian-Attested (HTTP) — ~15% of NFTs
- `tokenURI()` returns `https://api.project.com/42`
- URI is verified on-chain, but content is mutable
- Stored with `metadata_source: HTTP` flag on the reborn NFT
- Anyone can audit by fetching the URL and comparing

### Tier 3: Unavailable — ~5% of NFTs
- No standard metadata interface, dead servers
- Minted with chain/contract/tokenId only

## Metadata Upload

The `tokenURI` from the source chain is preserved in the reborn NFT. Additionally:

- **For permanent storage:** A separate step (user or service) fetches the content at `tokenURI`, uploads to Arweave via Irys, and updates the reborn NFT's URI to point to Arweave.
- **This is optional but recommended.** The provenance PDA always stores the original `tokenURI` regardless.
- **For IPFS content:** Already permanent (content-addressed). Arweave backup is belt-and-suspenders.
- **For HTTP content:** Arweave snapshot is critical (server could go down).

## Per-Collection Reborn Collections

Unlike v5 (one big collection), Fesal's design creates **per-source-collection Solana collections:**

```
Source: BAYC (Ethereum 0xBC4CA0...)
  → Reborn collection: "BAYC Reborn" on Solana

Source: Azuki (Ethereum 0xED5AF3...)  
  → Reborn collection: "Azuki Reborn" on Solana

Source: Mad Lads (Solana)
  → Reborn collection: "Mad Lads Reborn" on Solana
```

**Why this is better:**
- Preserves collection identity on Solana
- Marketplace UX: reborn BAYCs show up together
- Royalty settings can differ per collection
- Guild can vote on collection-level policies

## Supported Chains

### Phase 1: Wormhole-supported chains

**EVM (deploy SealInitiator per chain):**
Ethereum, Polygon, Arbitrum, Base, Optimism, Avalanche, BSC, Fantom, Moonbeam, Celo, Scroll, Blast, Linea, Gnosis

**MoveVM:**
Sui (native, SealInitiator Move module)
Aptos (SealInitiator Move module)

**NEAR:**
NEAR (SealInitiator Rust contract)

### Phase 2
- Cosmos chains (IBC + Wormhole Gateway)
- Bitcoin Ordinals (custom attestation)
- Algorand

## Fees

| Component | Who Pays | Cost |
|---|---|---|
| dWallet creation (Sui gas) | Protocol pool | ~$0.01 |
| Source chain tx (SealInitiator call + Wormhole fee) | User | $0.05-5 |
| Sui orchestration (VAA verify + IKA sign) | Relayer/Protocol | ~$0.05 |
| Solana mint (Metaplex Core) | Relayer/Protocol | ~$0.30 |
| **Seal fee (protocol revenue)** | **User (SOL)** | **TBD by DAO** |

## Security Model

| Threat | Mitigation |
|---|---|
| Fake deposit | Source contract verifies `ownerOf() == depositAddress` on-chain |
| Fake metadata | tokenURI read on-chain, attested by 19 Wormhole guardians |
| Tampered relay | Relayer only forwards IKA-signed data. Signature is verified on Solana. |
| Double mint | Signature hash tracked in PDA. Second attempt rejected. |
| Rogue relayer | Can't modify signed data. Can only delay (but anyone can run a relayer). |
| Wormhole compromise | 13/19 guardians must collude. Same security as $10B+ TVL. |
| IKA compromise | 2PC-MPC: neither network nor DWalletCap holder can sign alone. Cap is locked after seal. |

## Contracts Summary

| Contract | Chain | Language | Purpose |
|---|---|---|---|
| SealInitiator | Each EVM chain | Solidity | Read NFT state, emit Wormhole VAA |
| SealInitiator | Sui | Move | Read NFT state, emit Wormhole VAA |
| SealInitiator | Aptos | Move | Read NFT state, emit Wormhole VAA |
| SealInitiator | NEAR | Rust | Read NFT state, emit Wormhole VAA |
| Orchestrator | Sui | Move | Verify VAA, validate dWallet, sign with IKA |
| DWalletRegistry | Sui | Move | Track valid deposit addresses |
| IkaTenseiReborn | Solana | Rust/Anchor | Verify sig, create collections, mint NFTs |

## Implementation Timeline

### Phase 1: Core (4 weeks)
- [ ] EVM SealInitiator (Solidity) + deploy to Sepolia
- [ ] Sui Orchestrator (Move) + deploy to testnet
- [ ] DWalletRegistry (Move) + integration with IKA testnet
- [ ] Solana IkaTenseiReborn (Anchor) + deploy to devnet
- [ ] E2E test: Sepolia → Wormhole → Sui → Relayer → Solana devnet

### Phase 2: Multi-chain + Relayer (3 weeks)
- [ ] Relayer service (TypeScript, watches Sui events, submits to Solana)
- [ ] Sui SealInitiator (Move module for Sui-native NFTs)
- [ ] Aptos SealInitiator (Move)
- [ ] NEAR SealInitiator (Rust)
- [ ] Frontend integration (call SealInitiator from browser)

### Phase 3: Production (3 weeks)
- [ ] Mainnet deployments (all chains)
- [ ] Audit (4 contracts: EVM + Sui Orchestrator + Solana + Relayer)
- [ ] Per-collection creation logic on Solana
- [ ] Monitoring dashboard (read on-chain state)
- [ ] Redundant relayer deployment

### Phase 4: Decentralize (2 weeks)
- [ ] Frontend on IPFS/Arweave (permanent hosting)
- [ ] Relayer incentive mechanism
- [ ] Guild DAO controls fee parameters
- [ ] Open-source relayer with Docker image

## Decisions (v6)

1. **Sui is the orchestrator.** Wormhole VAA verification + dWallet validation + IKA signing all happen on Sui.
2. **Solana is thin.** Only Ed25519 signature verification + Metaplex Core mint. ~900 CU for sig verify.
3. **Per-collection reborn collections.** Each source collection gets its own Solana collection. Better UX, better marketplace integration.
4. **Permissionless relayer.** Bridges Sui → Solana. Can't tamper with signed data. Anyone can run one.
5. **DWalletCap locked after signing.** The Sui Orchestrator locks the cap as part of `process_seal`. Permanent, atomic.
6. **tokenURI preserved as-is.** The original tokenURI from the source chain is stored in provenance. Arweave re-upload is a separate optional step.
7. **Source contracts are permissionless.** No admin keys. No upgradability. Deploy and forget.
8. **Ed25519 for everything Solana-facing.** IKA dWallet signs with Ed25519, Solana verifies natively. No secp256k1 complications.
