# Ika Tensei PRD v7 — Relayer-Managed dWallet Architecture

## Overview

Ika Tensei is an NFT reincarnation protocol. Users **seal** (permanently lock) NFTs on any source chain and **reborn** (mint) new versions on Solana.

**Key change from v6:** dWallet creation moves from browser-side DKG to the relayer. Users pay a fee and receive a deposit address — no IKA SDK in the frontend.

**Two dWallet types (unchanged):**

1. **Deposit dWallets (many, per-NFT):** Each seal gets its own dWallet as the deposit address. Created by the relayer via IKA SDK on Sui when the user pays the seal fee.
2. **Minting dWallet (one, shared):** A single Ed25519 dWallet that signs ALL mint attestations. The Solana program stores this pubkey and only accepts mints signed by it.

**New: Solana-to-Solana path.** Users can seal and mint Solana-native NFTs directly via a smart contract call — no Wormhole VAA or IKA signing needed.

**New: One dWallet = one NFT.** After a seal is verified, the deposit dWallet is permanently retired and can never be used again.

## Architecture

```
 Source Chains                    Sui (Orchestrator)              Solana (Destination)
┌─────────────┐                 ┌─────────────────┐             ┌──────────────────┐
│ EVM Contract│──Wormhole VAA──>│  Sui Contract    │             │ Solana Program   │
│ (Solidity)  │                 │                  │             │                  │
├─────────────┤                 │ 1. Verify VAA    │  Relayer    │ 1. Verify sig    │
│NEAR Contract│──Wormhole VAA──>│ 2. Validate      │────────────>│ 2. Create        │
│ (Rust)      │                 │    dWallet addr  │  (sig+data) │    collection    │
├─────────────┤                 │ 3. Construct msg │             │    (if new)      │
│Sui Contract │──(no VAA)──────>│    sha256(       │             │ 3. Mint NFT to   │
│ (Move)      │                 │     tokenURI +   │             │    receiver      │
└─────────────┘                 │     tokenId +    │             ├──────────────────┤
                                │     receiver)    │             │ Native Seal Path │
┌─────────────┐                 │ 4. Sign with IKA │             │ (Solana→Solana)  │
│   Solana    │─────────────────┼─────────────────>│             │ No VAA/IKA       │
│   (Native)  │  Direct smart   │                  │             │ Direct lock+mint │
└─────────────┘  contract call  └─────────────────┘             └──────────────────┘

  Relayer:
  - Creates deposit dWallets via IKA SDK
  - Verifies VAAs on Sui
  - Gets IKA signatures via IKA SDK
  - Submits mint txs to Solana
```

## Core Principles

1. **Sui is the brain.** All cross-chain verification happens on Sui where IKA lives natively.
2. **Solana is thin.** It only verifies one Ed25519 signature and mints. Cheap and fast.
3. **Source chain contracts are simple.** Read NFT state, emit Wormhole message. Same template per chain family.
4. **Relayer is the service operator.** It creates dWallets, verifies VAAs, gets IKA signatures, and submits to Solana.
5. **One dWallet = one NFT.** Each deposit dWallet is permanently retired after use.
6. **Users only connect Solana wallet.** No IKA SDK in the frontend.

## User Flow

### Cross-Chain (EVM/NEAR/Sui → Solana)

```
1. User connects Solana wallet on ika-tensei.io
2. Selects source chain + provides receiver Solana address
3. Frontend calls relayer API: POST /api/seal/start { solanaWallet, sourceChain }
4. Relayer:
   a. Collects fee
   b. Creates a new deposit dWallet on Sui via IKA SDK
   c. Derives deposit address from dWallet pubkey
      (keccak256 for EVM chains, Ed25519 pubkey for others)
   d. Registers dWallet in Sui DWalletRegistry
   e. Returns { dwalletId, depositAddress } to frontend
5. User sees deposit address, sends NFT to it (via MetaMask, NEAR wallet, Sui wallet, etc.)
6. User clicks "Verify Deposit"
7. Source chain contract confirms NFT is at dWallet address,
   reads tokenURI, emits Wormhole VAA
   (Sui-native NFTs skip Wormhole — ownership proven on-chain)
8. ~15 min: Wormhole guardians reach consensus, VAA available
   (instant for Sui-native NFTs)
9. Relayer detects deposit and:
   a. Submits VAA to Sui contract for verification (13/19 guardian signatures)
   b. Sui contract validates deposit dWallet, checks it hasn't been used
   c. Sui contract constructs message: sha256(token_uri || token_id || receiver)
   d. Sui contract stores pending seal
10. Relayer signs the message using IKA SDK with the shared minting dWallet
11. Relayer calls complete_seal on Sui with the Ed25519 signature
12. Sui contract verifies signature, emits SealSigned event
13. Sui contract marks the deposit dWallet as permanently used (one-use)
14. Relayer picks up SealSigned event
15. Relayer submits to Solana program:
    a. Verifies Ed25519 signature against stored minting pubkey (~900 CU)
    b. Creates Metaplex Core collection for this source collection (if first NFT)
    c. Mints reborn NFT to receiver address
    d. Stores provenance on-chain
16. User sees reborn NFT in wallet
```

### Solana-to-Solana (Native Path)

```
1. User connects Solana wallet
2. Selects "Solana" as source chain
3. User calls seal_and_mint_native instruction directly:
   a. Passes their NFT token account
   b. Contract verifies user owns the NFT
   c. Transfers NFT to a program-owned PDA (permanent lock)
   d. Mints reborn NFT directly to user — no IKA signature needed
   e. Stores provenance on-chain
4. User sees reborn NFT in wallet (single transaction)
```

## Smart Contracts

### Layer 1: Source Chain Contracts (UNCHANGED from v6)

EVM `SealInitiator.sol`, Sui `seal_initiator.move`, NEAR `SealInitiator` — all unchanged.
They read NFT ownership, read tokenURI, and emit Wormhole VAA.

Sui-native NFTs don't need Wormhole — ownership is proven on Sui directly.

### Layer 2: Sui Orchestrator Contract

The brain. Receives Wormhole VAAs, verifies everything, signs with IKA.

**Changes from v6:**
- dWallet creation is done by the relayer (not browser DKG)
- Deposit dWallets are marked as permanently used after seal verification
- Message format: `sha256(token_uri || token_id || receiver)`
- `used_dwallets` table tracks one-use lifecycle

```move
module ikatensei::orchestrator {
    // ... (existing imports)

    struct OrchestratorState has key {
        id: UID,
        processed_vaas: Table<vector<u8>, bool>,
        known_emitters: Table<u16, vector<u8>>,
        pending_seals: Table<vector<u8>, PendingSeal>,
        /// Tracks permanently retired deposit dWallets (one-use)
        used_dwallets: Table<vector<u8>, bool>,
        total_processed: u64,
    }

    /// Shared object storing the minting dWallet's Ed25519 pubkey.
    /// Set once at init by admin. Verified in complete_seal.
    struct MintingAuthority has key {
        id: UID,
        minting_pubkey: vector<u8>,  // 32-byte Ed25519 pubkey
    }

    /// Phase 1: process_vaa
    /// - Verify Wormhole VAA
    /// - Check deposit dWallet hasn't been used before
    /// - Construct message: sha256(token_uri || token_id || receiver)
    /// - Store pending seal
    public entry fun process_vaa(
        state: &mut OrchestratorState,
        wormhole_state: &WormholeState,
        registry: &DWalletRegistry,
        vaa_bytes: vector<u8>,
        dwallet_id: ID,
        clock: &Clock,
        _ctx: &mut TxContext,
    ) {
        // ... verify VAA, decode payload ...

        // CHECK: deposit dWallet hasn't been used before
        let deposit_address = payload.deposit_address;
        assert!(!table::contains(&state.used_dwallets, deposit_address),
                E_DWALLET_ALREADY_USED);

        // Construct message: sha256(token_uri || token_id || receiver)
        let message_hash = payload::construct_signing_message(
            payload::get_token_uri(&seal_payload),   // token_uri FIRST
            payload::get_token_id(&seal_payload),     // then token_id
            payload::get_receiver(&seal_payload),     // then receiver
        );

        // Store pending seal...
    }

    /// Phase 2: complete_seal
    /// - Verify signature against SHARED MINTING dWallet (MintingAuthority)
    /// - Mark deposit dWallet as permanently used
    /// - Emit SealSigned event (with minting pubkey, not deposit pubkey)
    public entry fun complete_seal(
        state: &mut OrchestratorState,
        registry: &mut DWalletRegistry,
        minting_authority: &MintingAuthority,
        vault: &SealVault,
        vaa_hash: vector<u8>,
        signature: vector<u8>,
        dwallet_cap: DWalletCap,
        clock: &Clock,
        _ctx: &mut TxContext,
    ) {
        // Verify against the SHARED MINTING pubkey (not deposit dWallet)
        let valid = ed25519_verify(&signature,
            &minting_authority.minting_pubkey,  // shared minting key
            &pending.message_hash);
        assert!(valid, E_SIGNATURE_FAILED);

        // Mark deposit dWallet as permanently used
        table::add(&mut state.used_dwallets, pending.deposit_address, true);
        dwallet_registry::mark_dwallet_used(registry, &pending.deposit_address);

        // Lock DWalletCap permanently
        lock_dwallet_cap(vault, dwallet_cap);

        // Emit SealSigned event (dwallet_pubkey = minting pubkey)...
    }
}
```

### Layer 3: Solana Reborn Program

Thin. Verifies signature, creates collection if needed, mints NFT.

**Changes from v6:**
- Message hash order: `sha256(token_uri || token_id || receiver)`
- New `seal_and_mint_native` instruction for Solana-to-Solana

```rust
/// Initialize once — stores the shared minting pubkey on-chain
pub fn initialize_mint_config(ctx, minting_pubkey: [u8; 32]) -> Result<()> {
    // Stored in MintConfig PDA. Never accepted as instruction input.
}

/// Cross-chain mint (EVM/NEAR/Sui → Solana)
pub fn mint_reborn(ctx, signature, ...) -> Result<()> {
    // Load minting pubkey from MintConfig PDA (never from instruction args)
    let dwallet_pubkey = ctx.accounts.config.minting_pubkey;

    // Message = sha256(token_uri || token_id || receiver)
    let mut hasher = Sha256::new();
    hasher.update(token_uri.as_bytes());       // token_uri first
    hasher.update(&token_id);                   // then token_id
    hasher.update(receiver_pubkey.as_ref());     // then receiver
    let message_hash = hasher.finalize();

    // Verify Ed25519 precompile matches (pubkey from config, not input)
    verify_ed25519_signature(&dwallet_pubkey, &message_hash, &signature)?;
    // ... create collection, mint NFT ...
}

/// Solana-to-Solana native seal (no VAA/IKA)
pub fn seal_and_mint_native(ctx, token_uri, collection_name) -> Result<()> {
    // 1. Verify user owns the NFT (token account authority check)
    // 2. Transfer NFT to program PDA (permanent lock)
    // 3. Create collection if needed
    // 4. Mint reborn NFT directly
    // 5. Store provenance
}
```

### Layer 4: Relayer

Three roles: (1) API server for dWallet creation, (2) VAA processor + IKA signer, (3) Solana submitter.

**Changes from v6:**
- Now an Express API server (was event-listener only)
- Creates dWallets via IKA SDK
- Gets IKA signatures via IKA SDK
- Full service operator (not just a forwarder)

```typescript
class SealRelayer {
    // === Role 1: API server for dWallet creation ===
    app.post("/api/seal/start", async (req, res) => {
        const { solanaWallet, sourceChain } = req.body;

        // 1. Collect fee
        // 2. Create dWallet on Sui via IKA SDK
        const dwallet = await this.dwalletCreator.create(sourceChain);

        // 3. Register in Sui DWalletRegistry
        await this.registerDWallet(dwallet);

        // 4. Return deposit address
        res.json({ dwalletId: dwallet.id, depositAddress: dwallet.address });
    });

    // === Role 2: Event listener + IKA signer ===
    // Watches for SealPending events, signs with IKA SDK, calls complete_seal

    // === Role 3: Solana submitter ===
    // Watches for SealSigned events, submits mint_reborn to Solana
}
```

## Message Format

```
message = sha256(token_uri || token_id || receiver)
```

Where:
- token_uri: variable bytes (from payload, may be empty)
- token_id: 32 bytes (from payload)
- receiver: 32 bytes (Solana pubkey from payload)

Result: 32-byte SHA256 hash, signed with Ed25519 via IKA 2PC-MPC.

**This order differs from v6** which used `sha256(token_id || token_uri || receiver)`.

## dWallet Lifecycle

```
1. CREATE:   Relayer creates dWallet on Sui via IKA SDK (user paid fee)
2. REGISTER: Relayer registers dWallet in DWalletRegistry (active=true, used=false)
3. DEPOSIT:  User sends NFT to the dWallet's derived deposit address
4. VERIFY:   Wormhole VAA proves deposit (or Sui on-chain ownership for Sui-native)
5. SIGN:     Relayer signs seal message with shared minting dWallet via IKA SDK
6. RETIRE:   dWallet marked as used=true, active=false (PERMANENT, one-use)
7. LOCK:     DWalletCap transferred to SealVault (can never sign again)
```

One dWallet can only ever hold one NFT. After verification, it is permanently retired.

## Per-Collection Reborn Collections (UNCHANGED from v6)

Each source collection gets its own Solana collection:
```
Source: BAYC (Ethereum 0xBC4CA0...)    → "BAYC Reborn" on Solana
Source: Azuki (Ethereum 0xED5AF3...)   → "Azuki Reborn" on Solana
Source: Mad Lads (Solana native)        → "Mad Lads Reborn" on Solana
```

## Supported Chains

### Cross-Chain (via Wormhole)
- **EVM:** Ethereum, Polygon, Arbitrum, Base, Optimism, Avalanche, BSC, Fantom, Moonbeam, Celo, Scroll, Blast, Linea, Gnosis
- **MoveVM:** Sui (no VAA needed — on-chain ownership), Aptos
- **NEAR:** NEAR

### Native (Solana-to-Solana)
- **Solana:** Direct seal_and_mint_native instruction. No Wormhole, no IKA.

## Fees

| Component | Who Pays | Cost |
|---|---|---|
| Seal fee (includes dWallet creation) | User | TBD by DAO |
| Source chain tx (SealInitiator + Wormhole fee) | User | $0.05-5 |
| Sui orchestration (VAA verify + IKA sign) | Relayer/Protocol | ~$0.05 |
| Solana mint (Metaplex Core) | Relayer/Protocol | ~$0.30 |

## Security Model

| Threat | Mitigation |
|---|---|
| Fake deposit | Source contract verifies `ownerOf() == depositAddress` on-chain |
| Fake metadata | tokenURI read on-chain, attested by 19 Wormhole guardians |
| Tampered relay | Relayer only forwards IKA-signed data. Signature verified on Solana. |
| Double mint | Signature hash tracked in PDA. Second attempt rejected. |
| Double-use dWallet | `used_dwallets` table + `used` flag in DWalletRegistry. Checked before processing. |
| Rogue relayer | Can't modify signed data. Can only delay. |
| Wormhole compromise | 13/19 guardians must collude. Same security as $10B+ TVL. |
| IKA compromise | 2PC-MPC: neither network nor DWalletCap holder can sign alone. |
| Forged minting pubkey | Stored on-chain at init: MintingAuthority (Sui) + MintConfig PDA (Solana). Never accepted as input. |
| Solana native path abuse | User must own the NFT (token account authority). NFT locked in PDA permanently. |

## Decisions (v7)

1. **dWallet creation by relayer.** User pays fee, relayer creates dWallet via IKA SDK. No IKA SDK in frontend.
2. **Message format: sha256(token_uri || token_id || receiver).** token_uri first.
3. **One dWallet = one NFT.** Permanently retired after seal verification. Tracked in `used_dwallets` table and `DWalletRecord.used` flag.
4. **Solana-to-Solana native path.** Direct smart contract call, no Wormhole/IKA overhead. User calls `seal_and_mint_native`.
5. **Sui-native NFTs skip Wormhole.** Ownership proven on-chain, no VAA needed.
6. **Relayer is service operator.** Creates dWallets, verifies VAAs, gets IKA signatures, submits to Solana. API server + event bridge.
7. **Minting pubkey stored on-chain, never input.** Sui: `MintingAuthority` shared object (set via `set_minting_pubkey`). Solana: `MintConfig` PDA (set via `initialize_mint_config`). Ed25519 signatures verified against these stored keys.
8. All other v6 decisions remain (Ed25519 for minting authority, per-collection reborn collections, etc.).
