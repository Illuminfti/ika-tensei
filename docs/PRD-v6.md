# Ika Tensei PRD v6 — Sui-Orchestrated Wormhole Architecture

## Overview

Ika Tensei is an NFT reincarnation protocol. Users **seal** (permanently lock) NFTs on any source chain and **reborn** (mint) new versions on Solana.

**Key change from v5:** Sui is the orchestration layer. Two types of dWallets serve different purposes:

1. **Deposit dWallets (many, per-NFT):** Each seal gets its own dWallet as the deposit address where the user sends the NFT. Created via IKA DKG in the frontend. The user submits DKG data to the relayer.
2. **Minting dWallet (one, contract-owned):** A single Ed25519 dWallet owned by the Sui contract that signs ALL mint attestations. The Solana program stores this pubkey and only accepts mints signed by it.

**Flow:** User does DKG in browser → deposits NFT → source chain emits Wormhole VAA → user sends {VAA + DKG data} to relayer API → relayer pre-validates (DKG address == VAA depositor) → relayer submits to Sui → Sui verifies VAA + completes DKG + derives deposit address on-chain + verifies match → signs with shared minting dWallet → relayer delivers signature to Solana → mint.

This is Fesal's architecture. It's cleaner than v5 because:
- Sui handles all the heavy verification (Wormhole VAA + dWallet validation + address derivation)
- Solana only verifies one Ed25519 signature from the known minting dWallet (cheap, native precompile)
- IKA dWallet signing happens natively on Sui (where IKA lives)
- Per-collection creation on Solana (each source collection gets its own reborn collection)
- Relayer pre-validates DKG vs VAA off-chain to avoid wasting gas on mismatches
- The minting dWallet is set once at contract init, never passed as input

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
2. Selects source chain
3. Frontend creates dWallet via IKA SDK in browser:
   - prepareDKGAsync() → requestDWalletDKG() → gets DKG data
   - DKG data includes: session identifier, centralized message, public output
   - Derives deposit address from dWallet pubkey (secp256k1→keccak for EVM, Ed25519 for others)
4. User sees deposit address, sends NFT to it (via MetaMask, Phantom, etc.)
5. User clicks "Verify Deposit"
6. Source chain contract confirms NFT is at dWallet address,
   reads tokenURI, emits Wormhole VAA
7. ~15 min: Wormhole guardians reach consensus, VAA available
8. Frontend sends to Relayer API: { VAA bytes, DKG data }
9. Relayer (off-chain pre-validation):
   a. Parses VAA, extracts depositor address
   b. Parses DKG data, derives expected deposit address
   c. Compares: if mismatch → rejects (no gas wasted)
   d. If match → submits to Sui contract: VAA + DKG data
10. Sui contract:
    a. Verifies Wormhole VAA (13/19 guardian signatures)
    b. Completes DKG for deposit dWallet, stores in table
    c. Derives deposit address on-chain from dWallet pubkey
    d. Verifies derived address matches depositor in VAA
    e. Constructs message: sha256(token_id + token_uri + receiver)
    f. Signs message with the SHARED MINTING dWallet (set at init, not per-NFT)
    g. Emits SealSigned event containing signature + message data
11. Relayer picks up Sui event
12. Relayer submits to Solana program: signature + data
13. Solana program:
    a. Verifies Ed25519 signature against stored minting pubkey (~900 CU)
    b. Creates Metaplex Core collection for this source collection
       (if first NFT from this collection)
    c. Mints reborn NFT to receiver address
    d. Stores provenance on-chain
14. User sees reborn NFT in wallet
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

**Two dWallet types:**
- **Deposit dWallets (per-NFT):** Created by users via DKG in browser. Stored in table after relayer submits DKG data. Used to verify NFT custody.
- **Minting dWallet (singleton):** Set once at contract initialization. Stored in `MintAuthority` shared object. Signs ALL mint attestations. The Solana program stores this pubkey.

```move
module ika_tensei::orchestrator {
    use wormhole::vaa;
    use ika::dwallet;
    use ika::dwallet_cap;
    use sui::hash;
    use sui::event;
    use sui::table;

    /// Shared object holding the minting dWallet (set once at init)
    struct MintAuthority has key {
        id: UID,
        dwallet_id: ID,               // The one minting dWallet
        dwallet_pubkey: vector<u8>,    // Ed25519 pubkey (32 bytes)
    }

    /// Table of deposit dWallets (populated via DKG during seal flow)
    struct DepositRegistry has key {
        id: UID,
        // deposit_address (chain-specific, derived from pubkey) => DKG record
        deposits: Table<vector<u8>, DepositRecord>,
    }

    struct DepositRecord has store {
        dwallet_pubkey: vector<u8>,    // The deposit dWallet's pubkey
        source_chain: u16,             // Which chain this deposit is on
    }

    /// Emitted after successful verification + signing
    struct SealSigned has copy, drop {
        source_chain: u16,
        nft_contract: vector<u8>,
        token_id: vector<u8>,
        token_uri: vector<u8>,
        receiver: vector<u8>,          // Solana wallet (32 bytes)
        deposit_address: vector<u8>,
        message_hash: vector<u8>,      // sha256(token_id + token_uri + receiver)
        signature: vector<u8>,         // Minting dWallet Ed25519 signature
    }

    /// Initialize contract with the shared minting dWallet
    /// Called ONCE at deployment. The minting dWallet is permanent.
    public entry fun initialize(
        dwallet_id: ID,
        dwallet_pubkey: vector<u8>,
        ctx: &mut TxContext,
    ) {
        assert!(vector::length(&dwallet_pubkey) == 32, E_INVALID_PUBKEY);
        transfer::share_object(MintAuthority {
            id: object::new(ctx),
            dwallet_id,
            dwallet_pubkey,
        });
        transfer::share_object(DepositRegistry {
            id: object::new(ctx),
            deposits: table::new(ctx),
        });
    }

    /// Step 1: Relayer registers deposit dWallet from user's DKG data
    /// and verifies it against the Wormhole VAA in one atomic tx.
    public entry fun process_seal(
        mint_auth: &MintAuthority,
        registry: &mut DepositRegistry,
        mint_dwallet: &DWallet,
        mint_cap: &DWalletCap,
        wormhole_state: &WormholeState,
        vaa_bytes: vector<u8>,
        deposit_pubkey: vector<u8>,    // From user's DKG
        clock: &Clock,
    ) {
        // 1. Parse and verify Wormhole VAA (13/19 guardian sigs)
        let verified_vaa = vaa::parse_and_verify(wormhole_state, vaa_bytes, clock);

        // 2. Decode payload
        let (emitter_chain, _emitter_addr, payload_bytes) =
            vaa::take_emitter_info_and_payload(verified_vaa);
        let payload = decode_seal_payload(payload_bytes);

        // 3. Derive expected deposit address from DKG pubkey
        //    EVM: keccak256(secp256k1_pubkey)[12:]
        //    Solana/Sui: Ed25519 pubkey directly
        let derived_address = derive_deposit_address(
            emitter_chain,
            &deposit_pubkey,
        );

        // 4. Verify derived address matches VAA depositor
        assert!(derived_address == payload.deposit_address, E_ADDRESS_MISMATCH);

        // 5. Store deposit record in registry
        table::add(&mut registry.deposits, derived_address, DepositRecord {
            dwallet_pubkey: deposit_pubkey,
            source_chain: emitter_chain,
        });

        // 6. Verify minting dWallet matches authority
        assert!(object::id(mint_dwallet) == mint_auth.dwallet_id, E_WRONG_MINT_DWALLET);

        // 7. Construct message to sign
        let mut data = vector::empty<u8>();
        vector::append(&mut data, payload.token_id);
        vector::append(&mut data, payload.token_uri);
        vector::append(&mut data, payload.receiver);
        let message_hash = hash::sha2_256(data);

        // 8. Sign with the SHARED MINTING dWallet (not the deposit dWallet)
        let signature = dwallet::sign(
            mint_dwallet,
            mint_cap,
            message_hash,
        );

        // 9. Emit event for relayer
        event::emit(SealSigned {
            source_chain: emitter_chain,
            nft_contract: payload.nft_contract,
            token_id: payload.token_id,
            token_uri: payload.token_uri,
            receiver: payload.receiver,
            deposit_address: derived_address,
            message_hash,
            signature,
        });
    }

    /// Derive deposit address from pubkey based on chain type
    fun derive_deposit_address(chain_id: u16, pubkey: &vector<u8>): vector<u8> {
        if (is_evm_chain(chain_id)) {
            // EVM: last 20 bytes of keccak256(uncompressed secp256k1 pubkey)
            let hash = sui::hash::keccak256(*pubkey);
            vector::slice(&hash, 12, 32)
        } else {
            // Solana/Sui/Aptos/NEAR: Ed25519 pubkey IS the address
            *pubkey
        }
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

    /// Initialize the program with the minting dWallet pubkey (once)
    pub fn initialize(
        ctx: Context<Initialize>,
        minting_pubkey: [u8; 32],  // The ONE minting dWallet Ed25519 pubkey
    ) -> Result<()> {
        let config = &mut ctx.accounts.config;
        config.minting_pubkey = minting_pubkey;
        config.authority = ctx.accounts.authority.key();
        Ok(())
    }

    /// Mint a reborn NFT after verifying IKA minting dWallet signature
    pub fn mint_reborn(
        ctx: Context<MintReborn>,
        signature: [u8; 64],       // Ed25519 signature from shared minting dWallet
        source_chain: u16,
        nft_contract: Vec<u8>,
        token_id: Vec<u8>,
        token_uri: String,
        collection_name: String,    // Source collection name
    ) -> Result<()> {
        // 1. Load minting pubkey from on-chain config (NOT from input)
        let minting_pubkey = ctx.accounts.config.minting_pubkey;

        // 2. Reconstruct message hash
        let mut data = Vec::new();
        data.extend_from_slice(&token_id);
        data.extend_from_slice(token_uri.as_bytes());
        data.extend_from_slice(&ctx.accounts.receiver.key().to_bytes());
        let message_hash = anchor_lang::solana_program::hash::hash(&data);

        // 3. Verify Ed25519 signature against stored minting pubkey (~900 CU)
        verify_ed25519_signature(
            &minting_pubkey,
            &message_hash.to_bytes(),
            &signature,
        )?;

        // 4. Check signature hasn't been used (replay protection)
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

Two roles: (1) API server that accepts user submissions, (2) event listener that bridges Sui → Solana.

```typescript
// relayer/src/index.ts
import { SuiClient } from "@mysten/sui/client";
import { Connection, Transaction } from "@solana/web3.js";
import express from "express";

class SealRelayer {
    private sui: SuiClient;
    private solana: Connection;
    private app: express.Application;

    async run() {
        // === Role 1: API server for user submissions ===
        this.app.post("/api/seal", async (req, res) => {
            const { vaaBytes, dkgData } = req.body;
            // dkgData: { sessionIdentifier, centralizedMessage, publicOutput, depositPubkey }

            // Pre-validate: derive address from DKG pubkey
            const derivedAddress = deriveDepositAddress(
                dkgData.depositPubkey,
                parseVAAChainId(vaaBytes),
            );

            // Pre-validate: compare with VAA depositor
            const vaaDepositor = parseVAADepositor(vaaBytes);
            if (!derivedAddress.equals(vaaDepositor)) {
                return res.status(400).json({
                    error: "DKG address does not match VAA depositor",
                });
            }

            // Submit to Sui contract (pays gas)
            const txDigest = await this.submitToSui(vaaBytes, dkgData);
            res.json({ status: "submitted", txDigest });
        });

        // === Role 2: Event listener for Sui → Solana bridge ===
        await this.sui.subscribeEvent({
            filter: {
                MoveEventType: `${PACKAGE_ID}::orchestrator::SealSigned`
            },
            onMessage: (event) => this.relaySeal(event),
        });
    }

    async relaySeal(event: SuiEvent) {
        const data = event.parsedJson as SealSigned;

        // Build Solana transaction (no dwallet_pubkey - it's stored on-chain)
        const tx = new Transaction().add(
            mintRebornInstruction({
                signature: data.signature,
                sourceChain: data.source_chain,
                nftContract: data.nft_contract,
                tokenId: data.token_id,
                tokenUri: data.token_uri,
                collectionName: data.collection_name,
                receiver: new PublicKey(data.receiver),
            })
        );

        await this.solana.sendTransaction(tx, [this.relayerKeypair]);
    }
}
```

**Relayer properties:**
- **Two roles:** API server (receives user DKG + VAA) + event bridge (Sui → Solana)
- **Pre-validates off-chain:** Compares DKG-derived address with VAA depositor before spending gas
- **Stateless bridging:** The Sui→Solana leg just watches events and forwards signed data
- **Incentivizable:** Could add a small tip in the Solana program for relayers
- **Redundant:** Multiple relayers can run the event listener. Replay protection prevents double mints.
- **API is centralized but verifiable:** The relayer API is a convenience; all verification happens on-chain. A user could theoretically submit directly to Sui.

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
| IKA compromise | 2PC-MPC: neither network nor DWalletCap holder can sign alone. Deposit dWallet cap locked after seal. |
| Forged minting pubkey | Minting pubkey stored on-chain at init (Sui + Solana). Never accepted as input. |
| DKG/VAA mismatch | Relayer pre-validates off-chain; Sui contract derives address on-chain and verifies against VAA. |

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

1. **Two types of dWallets.** Deposit dWallets (many, per-NFT, created by user via DKG in browser) hold NFTs. One shared minting dWallet (set at contract init) signs all mint attestations.
2. **Minting pubkey is NEVER an input.** Stored on-chain in both Sui (`MintAuthority`) and Solana (`Config` PDA). Set once at initialization.
3. **User does DKG in browser.** Frontend uses IKA SDK (`@ika.xyz/sdk`) to create deposit dWallet. Sends DKG data + VAA to relayer API.
4. **Relayer pre-validates.** Derives address from DKG pubkey, compares with VAA depositor off-chain. Rejects mismatches before spending gas.
5. **Sui derives deposit address on-chain.** Computes address from pubkey (keccak for EVM, direct for Ed25519 chains) and verifies against VAA. Belt and suspenders with relayer check.
6. **Sui is the orchestrator.** Wormhole VAA verification + DKG completion + address derivation + IKA signing all happen on Sui.
7. **Solana is thin.** Only Ed25519 signature verification against stored minting pubkey + Metaplex Core mint. ~900 CU for sig verify.
8. **Per-collection reborn collections.** Each source collection gets its own Solana collection. Better UX, better marketplace integration.
9. **Deposit dWalletCap locked after signing.** Permanent, atomic.
10. **tokenURI preserved as-is.** Original tokenURI stored in provenance. Arweave re-upload optional.
11. **Source contracts are permissionless.** No admin keys. No upgradability. Deploy and forget.
12. **Ed25519 for minting authority.** IKA minting dWallet signs with Ed25519, Solana verifies natively.
