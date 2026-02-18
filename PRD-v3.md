# Ika Tensei v3 — Product Requirements Document

**Version:** 3.1
**Date:** 2026-02-17
**Status:** ACTIVE — Build Spec (Updated: Wormhole VAA deposit verification)
**Author:** Ika Tensei Team

---

## 1. Vision

**Ika Tensei** is a fully permissionless, decentralized NFT reincarnation protocol. Users seal NFTs from any supported chain into IKA dWallets, permanently locking them. A reborn NFT is minted on Solana, permanently linked to the sealed original. The dWallet IS the cross-chain bridge.

**Core thesis: 1 NFT = 1 dWallet.**

---

## 2. Architecture Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                        USER (Frontend)                           │
│  Connects: Source chain wallet + Solana wallet                   │
│  No Sui wallet needed (gas abstracted via relayer)               │
└──────────────────┬───────────────────────────────────────────────┘
                   │
    ┌──────────────┼──────────────────────────────────┐
    ▼              ▼                                   ▼
┌────────┐  ┌───────────┐  ┌──────────────────────────────────┐
│ Source  │  │ IKA       │  │ Solana (Destination)             │
│ Chain   │  │ Network   │  │                                  │
│         │  │           │  │  verify_seal (ed25519 precompile)│
│ ETH     │  │ dWallet   │  │  record_mint (link NFT → seal)  │
│ SOL     │  │ DKG       │  │  Metaplex Core mint              │
│ SUI     │  │ 2PC-MPC   │  │                                  │
│ BTC     │  │ signing   │  └──────────────────────────────────┘
│ NEAR    │  │           │
│         │  └─────┬─────┘
│ NFT ──────────►  │ dWallet holds NFT on source chain
│ Fee ──────────►  │ DWalletCap transferred to seal contract
│         │        │ = permanently locked, can never sign out
└────────┘        │
                   ▼
           ┌─────────────┐
           │ Sui         │
           │ (Settlement)│
           │             │
           │ SealRegistry│
           │ SealVault   │
           │ (holds      │
           │  DWalletCap)│
           └─────────────┘
```

### 2.1 Key Architectural Decisions

| Decision | Rationale |
|----------|-----------|
| **dWallet IS the vault** | NFT transferred to dWallet address on source chain. dWallet = escrow. |
| **DWalletCap → SealVault contract** | Permanently disables signing. Contract never calls `approve_message`. |
| **No backend** | Frontend + relayer edge function only. Fully permissionless. |
| **Fee on source chain** | User pays once in native token. Protocol covers Sui + IKA + Solana gas. |
| **1 NFT = 1 dWallet** | Each sealed NFT gets its own dWallet. Maximizes IKA network usage. |
| **Ed25519 for Solana-bound chains** | SOL, SUI, NEAR use Ed25519 dWallets. |
| **secp256k1 for EVM/BTC chains** | ETH, BTC use secp256k1 dWallets. |
| **Hybrid Solana program** | On-chain: verify seal + anti-replay PDA. Off-chain: Metaplex Core mint. |
| **Wormhole VAA deposit verification** | Source chain contract emits Wormhole message on NFT deposit. VAA verified on Sui before seal proceeds. Trustless, 13/19 guardian threshold. |
| **Source chain deposit contracts** | Each supported chain gets a deposit contract that atomically: transfers NFT to dWallet, collects fee, emits Wormhole message. |

---

## 3. Supported Chains

| Chain | Curve | dWallet Type | NFT Standard | Address Derivation |
|-------|-------|-------------|--------------|-------------------|
| Ethereum | secp256k1 | ECDSA | ERC-721, ERC-1155 | keccak256(pubkey[1:])[12:] |
| Solana | Ed25519 | EdDSA | SPL Token + Metaplex | Base58(pubkey) — direct |
| Sui | Ed25519 | EdDSA | Sui Object (Move) | blake2b(pubkey)[0:32] |
| Bitcoin | secp256k1 | Schnorr/ECDSA | Ordinals (Taproot) | bech32m(x-only pubkey) |
| Near | Ed25519 | EdDSA | NEP-171 | Base58(pubkey) — implicit account |

---

## 4. User Flow (Step by Step)

### 4.1 Seal Flow (New NFT, Never Sealed Before)

```
Step 1: Connect Source Wallet
  └─ User connects wallet for their NFT's chain (MetaMask, Phantom, Sui Wallet, etc.)
  └─ Frontend detects chain, shows user's NFTs

Step 2: Select NFT to Seal
  └─ User picks NFT
  └─ Frontend checks: is this collection registered? If not → Step 2a
  └─ Frontend shows fee breakdown (source chain native token)

Step 2a: Register New Collection (if needed)
  └─ Frontend submits collection registration to Sui via relayer
  └─ Collection config created on Sui + Solana (via relayer)

Step 3: Create dWallet (IKA)
  └─ Frontend calls IKA SDK: createDWallet(curve based on source chain)
  └─ DKG ceremony: user share generated client-side
  └─ dWallet created on IKA/Sui network
  └─ Frontend derives source-chain address from dWallet pubkey
  └─ Frontend derives Solana address from Ed25519 pubkey (for Ed25519 chains)
     OR from a SECOND Ed25519 dWallet (for secp256k1 chains — see §4.3)

Step 4: Deposit NFT via Source Chain Contract
  └─ User calls IkaTenseiDeposit contract on source chain
  └─ Contract atomically:
     (a) Transfers NFT from user to dWallet address
     (b) Collects fee in native token (ETH/SOL/SUI/NEAR)
     (c) Calls Wormhole publishMessage() with deposit attestation payload:
         { payloadId=1, sourceChainId, nftContract, tokenId, depositor, dwalletAddress, depositBlock }
  └─ Wormhole guardians observe the message (13/19 threshold)
  └─ VAA produced within 1-15 seconds (depends on source chain finality)

Step 5: Fetch Wormhole VAA
  └─ Frontend polls Wormhole API for signed VAA:
     GET https://api.wormholescan.io/v1/signed_vaa/{chain}/{emitter}/{sequence}
  └─ Receives guardian-signed VAA bytes (cryptographic proof of deposit)

Step 6: Verify Deposit + Register Seal on Sui (via relayer)
  └─ Relayer submits tx to Sui calling register_seal():
     (a) Calls wormhole::vaa::parse_and_verify(vaa_bytes) — verifies guardian sigs
     (b) Extracts payload: confirms NFT contract, token ID, dWallet address match
     (c) Verifies emitter is our registered deposit contract on source chain
     (d) Records SealRecord in SealRegistry
     (e) Transfers DWalletCap to SealVault (PERMANENT LOCK)
  └─ dWallet can NEVER sign again → NFT is sealed forever
  └─ This is TRUSTLESS: Wormhole guardians + Sui on-chain verification

Step 7: Construct & Sign Seal Hash
  └─ Frontend constructs seal_hash bytes (see §6 for format)
  └─ Frontend calls IKA SDK: signWithDWallet(dwalletId, sealHashBytes)
  └─ 2PC-MPC signing: user share + IKA network → Ed25519 signature
  └─ NOTE: This signing MUST happen BEFORE Step 6 (DWalletCap lock)
  └─ Actual ordering: Steps 4→5→7→6 (sign before locking cap)

Step 8: Verify Seal on Solana
  └─ Frontend builds Solana tx:
     ix[0]: Ed25519 precompile (pubkey + signature + seal_hash)
     ix[1]: verify_seal instruction (creates ReincarnationRecord PDA)
  └─ User signs with Solana wallet
  └─ Anti-replay: PDA seeds = ["reincarnation", hash(seal_data)]

Step 9: Mint Reborn NFT on Solana
  └─ Frontend uses Metaplex Core SDK to mint reborn NFT
  └─ NFT minted to user's Solana wallet address
  └─ Metadata includes: original chain, collection, token ID, seal proof

Step 10: Record Mint + Mark Reborn
  └─ Frontend calls record_mint on Solana (links mint → seal)
  └─ Relayer calls mark_reborn on Sui (sets reborn=true, stores Solana mint address)
  └─ DONE. Permanent link: dWallet (holds original) ↔ Solana NFT (reborn)
```

### 4.2 Permanent NFT-dWallet Link (PDA Mint Authority + Immutable Metadata)

The reborn Solana NFT is permanently, cryptographically linked to the sealed dWallet via two mechanisms:

**Mechanism 1: PDA Mint Authority**
The Solana program's PDA is the mint authority for every reborn NFT. PDA seeds include the seal_hash, which binds to the dWallet pubkey.

```
Mint Authority = PDA["reincarnation_mint", seal_hash]

Chain of proof:
  Solana NFT → minted by PDA["reincarnation_mint", seal_hash]
    → seal_hash contains attestation_pubkey (dWallet Ed25519)
      → dWallet holds original NFT on source chain
        → DWalletCap locked in SealVault (permanent)
```

The program mints the NFT via CPI using this PDA as signer. No one else can mint with this authority. The NFT could ONLY have been created by the protocol after verifying the dWallet's signature.

**Mechanism 2: Immutable On-Chain Metadata (Metaplex Core)**
The reborn NFT carries immutable metadata fields baked into Metaplex Core's on-chain data:

```
Metaplex Core Asset:
  name: "Reborn: {original_name}"
  uri: "{metadata_uri}"  // Off-chain JSON with full seal proof
  plugins:
    ImmutableMetadata:
      seal_hash: bytes32
      source_chain_id: u16
      source_contract: bytes
      original_token_id: bytes
      dwallet_pubkey: bytes32      // Ed25519 pubkey = Solana address of dWallet
      attestation_signature: bytes64  // dWallet's Ed25519 sig on seal_hash
      wormhole_vaa_hash: bytes32   // Hash of deposit verification VAA
    Royalties:
      basis_points: 690  // 6.9% (5% guild + 1.9% team)
      creators: [guild_treasury, team_treasury]
```

These fields are set at mint time and CANNOT be changed. Anyone can verify:
1. Look at the NFT's immutable metadata → get `dwallet_pubkey`
2. Derive the dWallet's address on the source chain
3. Check the source chain: NFT is at that address
4. Check Sui: DWalletCap is in SealVault (permanently locked)

### 4.3 Ownership Model

```
Original NFT (source chain)
  └─ Owned by: dWallet address (permanently locked)
  └─ dWallet signing disabled (DWalletCap in SealVault)

Reborn NFT (Solana)
  └─ Owned by: User's Solana wallet
  └─ Transferable, tradeable on Solana marketplaces
  └─ Metadata links back to sealed original

Whoever owns the Solana NFT = the recognized owner of the sealed original.
```

### 4.4 secp256k1 Chains (ETH, BTC) — Dual dWallet

For secp256k1 source chains, we need TWO keys:
1. **secp256k1 dWallet** — holds the NFT on source chain (ETH/BTC address)
2. **Ed25519 signature** — needed for Solana's Ed25519 precompile verification

**Options:**
- **Option A (Recommended):** Create one secp256k1 dWallet to hold NFT. The seal_hash is signed by a SEPARATE Ed25519 dWallet created for attestation. Both DWalletCaps go to SealVault.
- **Option B:** Use ECDSA verification on Solana (Secp256k1Program). Avoids second dWallet but uses different precompile.

**Decision: Option A.** Two dWallets for secp256k1 chains. One holds NFT (secp256k1), one signs attestation (Ed25519). Both permanently sealed. The Ed25519 dWallet's pubkey is the Solana address stored in ReincarnationRecord.

---

## 5. Smart Contract Architecture

### 5.1 Sui Contracts

#### Module: `seal_vault.move`
**Purpose:** Permanently holds DWalletCaps. No function to release them.

```
SealVault (shared object)
  ├─ sealed_caps: Table<ID, DWalletCap>  // dWallet ID → cap
  └─ total_sealed: u64

Functions:
  seal(dwallet_cap: DWalletCap)  // Takes cap, stores permanently
  // NO release/unseal function. Intentional.
```

#### Module: `registry.move`
**Purpose:** Tracks all seals, collections, and reborn status.

```
SealRegistry (shared object)
  ├─ collections: Table<vector<u8>, CollectionConfig>
  ├─ seals: Table<vector<u8>, SealRecord>  // seal_hash → record
  ├─ guild_treasury: address
  ├─ team_treasury: address
  ├─ guild_share_bps: u16  // 500 = 5%
  ├─ team_share_bps: u16   // 190 = 1.9%
  ├─ paused: bool
  └─ version: u64

SealRecord:
  ├─ source_chain_id: u16
  ├─ source_contract: vector<u8>
  ├─ token_id: vector<u8>
  ├─ dwallet_id: ID              // dWallet that holds the NFT
  ├─ dwallet_pubkey: vector<u8>  // 32 or 33 bytes
  ├─ attestation_dwallet_id: ID  // Ed25519 dWallet for Solana attestation
  ├─ attestation_pubkey: vector<u8>  // 32 bytes Ed25519
  ├─ sealer: address             // Original sealer (or relayer)
  ├─ sealed_at: u64
  ├─ reborn: bool
  ├─ solana_mint_address: vector<u8>  // 32 bytes, set on mark_reborn
  └─ nonce: u64

CollectionConfig:
  ├─ collection_id: vector<u8>
  ├─ source_chain_id: u16
  ├─ name: String
  ├─ seal_fee: u64  // In source chain native units (informational)
  ├─ max_seals: u64
  ├─ current_seals: u64
  └─ active: bool

Entry Functions:
  register_collection(admin, registry, ...)
  register_seal(registry, vault, seal_data, dwallet_cap, attestation_dwallet_cap, ...)
    → Validates seal data
    → Stores SealRecord
    → Transfers BOTH DWalletCaps to SealVault (permanent lock)
    → Emits NFTSealed event
  mark_reborn(registry, seal_hash, solana_mint_address)
    → Permissionless (anyone can call)
    → Requires: seal exists + not already reborn
    → Sets reborn=true, stores solana_mint_address
    → Emits NFTReborn event
```

#### Module: `admin.move`
**Purpose:** Protocol admin operations.

```
Functions:
  init() → Creates SealRegistry + SealVault + AdminCap
  pause_protocol / unpause_protocol
  update_treasuries / update_shares
  register_collection / deregister_collection
  propose_admin_transfer / accept_admin_transfer
```

#### Module: `events.move`
**Purpose:** Event definitions.

```
Events:
  NFTSealed { seal_hash, source_chain, source_contract, token_id, dwallet_pubkey, attestation_pubkey, sealer, vaa_hash }
  NFTReborn { seal_hash, solana_mint_address, caller }
  CollectionRegistered { collection_id, source_chain, name }
  DWalletSealed { dwallet_id, attestation_dwallet_id, seal_hash }
  EmitterRegistered { chain_id, emitter_address }
  DepositVerified { vaa_hash, source_chain, nft_contract, token_id, dwallet_address }
```

#### Module: `emitters.move`
**Purpose:** Manages trusted Wormhole emitter addresses per chain.

```
EmitterRegistry (stored in SealRegistry or separate shared object)
  ├─ trusted_emitters: Table<u16, vector<u8>>  // Wormhole chain ID → emitter address (32 bytes)
  └─ consumed_vaas: Table<vector<u8>, bool>     // VAA hash → consumed

Admin Functions:
  register_emitter(admin, registry, chain_id, emitter_address)
  remove_emitter(admin, registry, chain_id)

Internal Functions:
  is_registered_emitter(registry, chain_id, address) → bool
  is_vaa_consumed(registry, vaa_hash) → bool
  mark_vaa_consumed(registry, vaa_hash)
```

#### Move.toml Dependencies
```toml
[dependencies]
Sui = { git = "https://github.com/MystenLabs/sui.git", subdir = "crates/sui-framework/packages/sui-framework", rev = "..." }
Wormhole = { git = "https://github.com/wormhole-foundation/wormhole.git", subdir = "sui/wormhole", rev = "..." }
IkaDwallet = { ... }  # For DWalletCap type
```

### 5.2 Solana Program

#### Program: `ika_tensei`

```
Instructions:
  initialize(authority, guild_treasury, team_treasury, guild_share_bps, mint_fee)
    → Creates ProtocolConfig PDA ["ika_config"]

  register_collection(source_chain, source_contract, name, max_supply)
    → Creates CollectionConfig PDA ["collection", chain_u16_le, contract_bytes]

  verify_seal(seal_hash_data, attestation_pubkey, signature)
    → Checks Ed25519 precompile (previous ix)
    → Creates ReincarnationRecord PDA ["reincarnation", hash(seal_data)]
    → Creates ReincarnationMint PDA ["reincarnation_mint", hash(seal_data)] (mint authority for NFT)
    → Stores: seal data + attestation_pubkey + recipient
    → Emits SealVerified

  mint_reborn(seal_hash, name, uri, immutable_metadata)
    → Uses ReincarnationMint PDA as mint authority to create Metaplex Core NFT
    → Sets immutable metadata plugin (seal_hash, source_chain, dwallet_pubkey, attestation_sig, vaa_hash)
    → Sets royalties plugin (690 bps, guild + team creators)
    → Transfers NFT to recipient (user's Solana wallet)
    → Links mint address to ReincarnationRecord
    → Can only be called once per seal (minted=false → minted=true)
    → Emits MintRecorded

  pause / unpause / update_config / transfer_authority

Accounts:
  ProtocolConfig:
    authority, guild_treasury, team_treasury, guild_share_bps, mint_fee, paused, bump

  CollectionConfig:
    source_chain, source_contract, name, max_supply, total_minted, active, bump

  ReincarnationRecord:
    seal_hash: [u8; 32]       // hash of seal_data for PDA
    source_chain: u16
    source_token_id: Vec<u8>  // variable length (normalized)
    original_name: String
    metadata_uri: String
    attestation_pubkey: Pubkey  // Ed25519 dWallet that signed
    recipient: Pubkey           // User's Solana wallet
    mint: Pubkey                // Metaplex mint address (set by record_mint)
    minted: bool
    verified_at: i64
    bump: u8
```

### 5.3 Source Chain Contracts (Phase 2+)

For non-Sui source chains, we need fee collection contracts:

#### Ethereum: `IkaTenseiFeeCollector.sol`
```solidity
// Collects ETH fee when user transfers NFT to dWallet
// Emits event for frontend tracking
// No custody — NFT goes directly to dWallet address, fee goes to treasury
```

#### Bitcoin: PSBT-based
```
// User constructs PSBT:
//   Input 1: NFT UTXO (ordinal)
//   Input 2: Fee UTXO
//   Output 1: NFT to dWallet taproot address
//   Output 2: Fee to protocol treasury address
//   Output 3: Change
```

#### Solana (source): SPL instruction
```
// Same tx: transfer NFT to dWallet + transfer fee to treasury
```

#### Near: NEP-141 + NEP-171
```
// nft_transfer_call to protocol contract, attaches NEAR for fee
```

---

## 6. Seal Hash Specification

### 6.1 Byte Layout

```
Offset  Size   Field                      Encoding
0       2      source_chain_id            u16 big-endian
2       2      destination_chain_id       u16 big-endian (always 3 = Solana)
4       1      source_contract_length     u8
5       N      source_contract_address    raw bytes (N = length)
5+N     1      token_id_length            u8
6+N     M      token_id                   raw bytes (M = length, chain-specific)
6+N+M   32     attestation_pubkey         Ed25519 pubkey (always 32 bytes)
38+N+M  8      nonce                      u64 big-endian (monotonic per seal)
```

### 6.2 Chain-Specific Token ID Encoding

| Chain | Token ID Format | Encoded Bytes |
|-------|----------------|---------------|
| Ethereum | uint256 | 32 bytes, big-endian |
| Solana | Mint Pubkey | 32 bytes, raw |
| Sui | Object ID | 32 bytes, raw |
| Bitcoin | txid:index | 34 bytes (txid 32 + index u16 BE) |
| Near | String | UTF-8 bytes, variable |

### 6.3 Signing

- **What gets signed:** Raw seal_hash bytes (the serialized byte layout above)
- **Who signs:** The attestation dWallet (Ed25519)
- **How:** IKA SDK `signWithDWallet(dwalletId, sealHashBytes, EdDSA, SHA512)`
- **Verification:** Solana Ed25519 precompile verifies signature
- **PDA seed:** `hash(seal_data)` truncated to 32 bytes for PDA derivation

---

## 7. Fee Model

### 7.1 Fee Collection

**Where:** Source chain (user pays in native token)
**When:** Same transaction as NFT transfer to dWallet
**Covers:** All downstream costs (Sui gas, IKA fees, Solana gas, Metaplex mint)

### 7.2 Fee Tiers

| Tier | Condition | Fee (USD equivalent) |
|------|-----------|---------------------|
| Standard | All NFTs | $2.00 - $5.00 |
| Premium | NFT value > $1,000 | $5.00 + 1% of value |

### 7.3 Fee Distribution

| Recipient | Share | Purpose |
|-----------|-------|---------|
| Guild Treasury | 5.0% (500 bps) | DAO / community |
| Team Treasury | 1.9% (190 bps) | Operations |
| Gas Fund | Remainder | Covers Sui + IKA + Solana gas |

### 7.4 Gas Abstraction

```
User pays fee on source chain
          │
          ▼
Protocol Treasury (multi-chain)
          │
    ┌─────┴──────┐
    ▼            ▼
Gas Fund      Revenue
    │
    ├─ Sui Relayer (protocol-owned keypair, submits Sui txs)
    ├─ IKA Fees (dWallet DKG + signing)
    └─ Solana (verify_seal, mint costs)
```

**Relayer:** Vercel Edge Function with protocol Sui keypair. Submits Sui transactions on user's behalf. User never needs SUI tokens.

---

## 8. Wormhole Deposit Verification

### 8.1 Why Wormhole VAA

The protocol requires cryptographic proof that an NFT was deposited into the dWallet address on the source chain BEFORE allowing the seal to proceed on Sui. Without this, a user could fake a deposit and mint a reborn NFT linked to an empty dWallet.

Wormhole VAAs provide:
- **Trustless verification:** 13/19 guardian threshold (institutional validators: Jump, Certus One, etc.)
- **Production ready:** Live on Sui mainnet + testnet
- **Multi-chain:** Supports ETH, Solana, Sui, Near (not Bitcoin — see §8.5)
- **Low latency:** 1-15 seconds depending on source chain finality
- **Permissionless relay:** Anyone can fetch and submit VAAs

### 8.2 Deposit Attestation Payload

```
Byte Layout (Wormhole message payload):
Offset  Size   Field
0       1      payload_id          (always 1 = NFT_DEPOSIT)
1       2      source_chain_id     (Wormhole chain ID, u16 BE)
3       32     nft_contract        (contract address, 0-padded to 32 bytes)
35      32     token_id            (token ID, 0-padded to 32 bytes)
67      32     depositor           (original owner address, 0-padded to 32 bytes)
99      32     dwallet_address     (dWallet address on source chain, 0-padded to 32 bytes)
131     8      deposit_block       (block number, u64 BE)
139     32     seal_nonce          (unique nonce, prevents replay)
Total: 171 bytes
```

### 8.3 Source Chain Deposit Contracts

Each supported chain gets a deposit contract that atomically handles NFT transfer + fee + Wormhole message.

#### Ethereum: `IkaTenseiDeposit.sol`
```solidity
contract IkaTenseiDeposit {
    IWormhole public wormhole;
    address public feeRecipient;
    uint256 public depositFee;
    mapping(bytes32 => bool) public usedNonces;

    function depositNft(
        address nftContract,
        uint256 tokenId,
        address dwalletAddress,  // dWallet's ETH address (secp256k1 derived)
        bytes32 sealNonce
    ) external payable returns (uint64 sequence) {
        require(msg.value >= depositFee + wormhole.messageFee(), "Insufficient fee");
        require(!usedNonces[sealNonce], "Nonce used");
        usedNonces[sealNonce] = true;

        // 1. Transfer NFT to dWallet address
        IERC721(nftContract).transferFrom(msg.sender, dwalletAddress, tokenId);

        // 2. Collect protocol fee
        payable(feeRecipient).transfer(depositFee);

        // 3. Emit Wormhole message
        bytes memory payload = abi.encodePacked(
            uint8(1),                              // payload_id
            wormhole.chainId(),                     // source_chain_id
            bytes32(uint256(uint160(nftContract))), // nft_contract
            bytes32(tokenId),                       // token_id
            bytes32(uint256(uint160(msg.sender))),  // depositor
            bytes32(uint256(uint160(dwalletAddress))), // dwallet_address
            uint64(block.number),                   // deposit_block
            sealNonce                               // seal_nonce
        );

        sequence = wormhole.publishMessage{value: wormhole.messageFee()}(
            0,        // nonce (batch)
            payload,
            1         // consistency_level (finalized)
        );
    }
}
```

#### Solana: `ika_tensei_deposit` program
```
Instructions:
  deposit_nft(nft_mint, dwallet_address, seal_nonce)
    → CPI: Transfer SPL token to dWallet address
    → CPI: Transfer fee lamports to treasury
    → CPI: Wormhole post_message with deposit attestation payload
    → Returns: Wormhole sequence number
```

#### Near: `ika_tensei_deposit.near`
```
Methods:
  deposit_nft(nft_contract, token_id, dwallet_address, seal_nonce)
    → Cross-contract call: nft_transfer to dWallet address
    → Collect fee in attached NEAR
    → Call Wormhole publish_message
```

#### Sui: Native (no separate contract needed)
For Sui-native NFTs, the seal transaction itself is on Sui. The Sui contract can directly verify object ownership without Wormhole. The NFT is transferred to the dWallet's Sui address within the same PTB.

### 8.4 Sui-Side VAA Verification

```move
/// In registry.move
public entry fun register_seal_with_vaa<T>(
    registry: &mut SealRegistry,
    vault: &mut SealVault,
    wormhole_state: &WormholeState,
    vaa_bytes: vector<u8>,
    dwallet_cap: DWalletCap,
    attestation_dwallet_cap: DWalletCap,  // Ed25519 for Solana attestation
    seal_signature: vector<u8>,           // dWallet sig on seal_hash
    clock: &Clock,
    ctx: &mut TxContext,
) {
    // 1. Verify Wormhole VAA (guardian signatures)
    let verified_vaa = wormhole::vaa::parse_and_verify(wormhole_state, vaa_bytes, clock);

    // 2. Extract and validate payload
    let payload = wormhole::vaa::payload(&verified_vaa);
    let payload_id = *vector::borrow(&payload, 0);
    assert!(payload_id == 1, E_INVALID_PAYLOAD); // Must be NFT_DEPOSIT

    // 3. Verify emitter is our registered deposit contract
    let emitter_chain = wormhole::vaa::emitter_chain(&verified_vaa);
    let emitter_address = wormhole::vaa::emitter_address(&verified_vaa);
    assert!(is_registered_emitter(registry, emitter_chain, emitter_address), E_UNKNOWN_EMITTER);

    // 4. Decode payload fields
    let source_chain = decode_u16(&payload, 1);
    let nft_contract = decode_bytes32(&payload, 3);
    let token_id = decode_bytes32(&payload, 35);
    let depositor = decode_bytes32(&payload, 67);
    let dwallet_address = decode_bytes32(&payload, 99);

    // 5. Verify dWallet address matches the DWalletCap's dWallet pubkey
    // (ensures the VAA is for THIS specific dWallet)
    assert!(dwallet_address_matches(&dwallet_cap, &dwallet_address), E_DWALLET_MISMATCH);

    // 6. Check VAA hasn't been consumed (anti-replay)
    let vaa_hash = wormhole::vaa::hash(&verified_vaa);
    assert!(!is_vaa_consumed(registry, vaa_hash), E_VAA_ALREADY_CONSUMED);
    mark_vaa_consumed(registry, vaa_hash);

    // 7. Store SealRecord
    // ... (same as before)

    // 8. Lock BOTH DWalletCaps permanently
    seal_vault::seal(vault, dwallet_cap);
    seal_vault::seal(vault, attestation_dwallet_cap);
}
```

### 8.5 Bitcoin Ordinals — No Wormhole Support

**Wormhole does NOT support Bitcoin.** For Ordinals, the options are:

1. **Phase 1 (launch):** Bitcoin Ordinals NOT supported. Ship with ETH, SOL, SUI, NEAR.
2. **Phase 2:** Use a trusted Ordinals indexer with multi-sig attestation (3/5 threshold). The attestation is submitted to Sui as a "trusted oracle" path, clearly marked as different trust model.
3. **Phase 3:** Build or adopt a Bitcoin SPV light client on Sui Move for fully trustless verification.

The protocol is designed to be extensible. The `register_seal_with_vaa` function handles Wormhole-supported chains. A separate `register_seal_with_btc_attestation` can be added for Bitcoin without changing the core architecture.

### 8.6 Wormhole Chain IDs (Our Mapping)

| Chain | Our Chain ID | Wormhole Chain ID | Supported |
|-------|-------------|-------------------|-----------|
| Ethereum | 1 | 2 | ✅ Via Wormhole VAA |
| Sui | 2 | 21 | ✅ Native (no VAA needed) |
| Solana | 3 | 1 | ✅ Via Wormhole VAA |
| Near | 4 | 15 | ✅ Via Wormhole VAA |
| Bitcoin | 5 | N/A | ❌ Phase 2+ |

### 8.7 Wormhole Contract Addresses

| Network | Sui Core (State Object) |
|---------|------------------------|
| Mainnet | `0xaeab97f96cf9877fee2883315d459552b2b921edc16d7ceac6eab944dd88919c` |
| Testnet | `0x31358d198147da50db32eda2562951d53973a0c0ad5ed738e9b17d88b213d790` |

| Network | Ethereum Core |
|---------|--------------|
| Mainnet | `0x98f3c9e6E3fAce36bAAd05FE09d375Ef1464288B` |
| Sepolia | `0x4a8bc80Ed5a4067f1CCf107057b8270E0cC11A78` |

| Network | Solana Core |
|---------|------------|
| Mainnet | `worm2ZoG2kUd4vFXhvjh93UUH596ayRfgQ2MgjNMTth` |
| Devnet | `3u8hJUVTA4jH1wYAyUur7FFZVQ8H635K3tSHHF4ssjQ5` |

### 8.8 Step Ordering (Critical)

The deposit verification changes the step ordering. The correct sequence is:

```
1. Create dWallet (IKA DKG)
2. Deposit NFT via source chain contract (emits Wormhole message)
3. Fetch Wormhole VAA (frontend polls)
4. Sign seal_hash with dWallet (MUST happen before cap lock)
5. Register seal on Sui (verify VAA + lock DWalletCaps)
6. Verify seal on Solana (Ed25519 precompile)
7. Mint reborn NFT (Metaplex)
8. Record mint + mark reborn
```

Steps 4 and 5 are the critical ordering: sign THEN lock. Once DWalletCap is in SealVault, no more signing is possible.

---

## 9. Permanent Sealing Mechanism

### 8.1 How It Works

1. dWallet created → user gets `DWalletCap` (controls signing)
2. NFT transferred to dWallet address on source chain
3. `register_seal()` on Sui:
   - Takes `DWalletCap` as argument
   - Transfers it to `SealVault` contract
   - `SealVault` has NO function to release caps
   - `SealVault` NEVER calls `approve_message`
4. Without `DWalletCap`, nobody can call `approve_message`
5. Without `approve_message`, IKA network CANNOT produce signatures
6. Without signatures, NFT cannot be transferred from dWallet address
7. **NFT is sealed forever.**

### 8.2 Security Properties

- **Irreversible:** No contract upgrade can release DWalletCap (use non-upgradeable module)
- **Trustless:** Doesn't rely on IKA validators behaving honestly
- **Verifiable:** Anyone can check DWalletCap is owned by SealVault on-chain
- **No race condition:** `register_seal` atomically takes DWalletCap and records seal

---

## 9. Build Packages

### 9.1 Package Structure

```
ika-tensei/
├── packages/
│   ├── sui-contracts/          # Sui Move modules
│   │   └── ikatensei/
│   │       ├── sources/
│   │       │   ├── seal_vault.move
│   │       │   ├── registry.move
│   │       │   ├── admin.move
│   │       │   ├── events.move
│   │       │   └── emitters.move
│   │       ├── tests/
│   │       └── Move.toml
│   │
│   ├── eth-contracts/          # Solidity deposit contract
│   │   ├── src/
│   │   │   └── IkaTenseiDeposit.sol
│   │   ├── test/
│   │   └── foundry.toml
│   │
│   ├── sol-deposit/            # Solana deposit program (Wormhole CPI)
│   │   ├── programs/ika_tensei_deposit/src/
│   │   └── Anchor.toml
│   │
│   ├── solana-program/         # Anchor program
│   │   └── ika_tensei/
│   │       ├── programs/ika_tensei/src/
│   │       │   ├── lib.rs
│   │       │   ├── instructions/
│   │       │   ├── state/
│   │       │   ├── errors.rs
│   │       │   └── constants.rs
│   │       ├── tests/
│   │       └── Anchor.toml
│   │
│   ├── frontend/               # Next.js 14 app
│   │   ├── src/
│   │   │   ├── app/            # Pages
│   │   │   ├── components/     # UI components
│   │   │   ├── hooks/          # React hooks (useIKA, useSeal, etc.)
│   │   │   ├── lib/
│   │   │   │   ├── ika/        # IKA SDK wrappers
│   │   │   │   ├── solana/     # Solana client
│   │   │   │   ├── chains/     # Source chain adapters
│   │   │   │   ├── seal-hash/  # Seal hash construction
│   │   │   │   └── fee/        # Fee calculation
│   │   │   └── types/          # Shared types
│   │   ├── api/
│   │   │   └── relay/          # Sui relayer edge function
│   │   └── package.json
│   │
│   └── shared/                 # Shared types & constants
│       ├── src/
│       │   ├── chains.ts       # Chain definitions
│       │   ├── seal-hash.ts    # Seal hash builder (shared frontend + tests)
│       │   └── types.ts
│       └── package.json
│
├── PRD-v3.md                   # This document
└── .archive/                   # Previous versions
```

---

## 10. Build Order (Swarm Execution Plan)

### Phase 1: Core Contracts (Parallel)

| Agent | Task | Dependencies | Est. Time |
|-------|------|-------------|-----------|
| **sui-contracts** | Build seal_vault.move, registry.move, admin.move, events.move, emitters.move (with Wormhole VAA verification) | None | 45 min |
| **solana-program** | Build ika_tensei program (verify_seal, record_mint, state) | None | 30 min |
| **eth-deposit** | Build IkaTenseiDeposit.sol (ERC-721 transfer + Wormhole publishMessage) | None | 20 min |
| **sol-deposit** | Build ika_tensei_deposit Solana program (SPL transfer + Wormhole CPI) | None | 30 min |
| **shared-types** | Build shared package (chains, seal-hash, types, Wormhole chain IDs) | None | 15 min |

**Gate 1:** All compile clean. Sui `sui move build -e devnet`, Solana `cargo build-sbf`, Ethereum `forge build`, shared `tsc --noEmit`.

### Phase 2: Tests (Parallel, after Gate 1)

| Agent | Task | Dependencies | Est. Time |
|-------|------|-------------|-----------|
| **sui-tests** | Move unit tests for all modules | sui-contracts | 20 min |
| **solana-tests** | Anchor integration tests | solana-program | 20 min |

**Gate 2:** All tests pass.

### Phase 3: Deploy (Sequential, after Gate 2)

| Step | Task | Dependencies |
|------|------|-------------|
| 1 | Deploy Sui contracts to devnet | Gate 2 |
| 2 | Deploy Solana program to devnet | Gate 2 |
| 3 | Run cross-chain e2e test script | Steps 1 + 2 |

### Phase 4: Frontend (after Gate 2, parallel with Phase 3)

| Agent | Task | Dependencies | Est. Time |
|-------|------|-------------|-----------|
| **frontend-core** | Next.js app shell, wallet connectors, routing | shared-types | 30 min |
| **frontend-ika** | IKA SDK integration (createDWallet, signWithDWallet) | shared-types | 30 min |
| **frontend-seal** | Seal flow orchestration (steps 1-9) | frontend-core, frontend-ika | 45 min |
| **frontend-ui** | UI/UX (collection browser, seal wizard, status page) | frontend-core | 30 min |
| **relayer** | Sui relayer edge function (api/relay) | sui-contracts deployed | 20 min |

**Gate 4:** Frontend connects to devnet, full seal flow works end-to-end.

### Phase 5: Polish

- Fee calculation UI
- Error handling + retry logic
- Loading states + progress indicators
- Collection discovery (show available collections)
- Mobile responsive

---

## 11. Agent Specifications

Each swarm agent gets:
1. This PRD section relevant to their task
2. The relevant research doc(s) from `/ika-tensei-research/v3-*.md`
3. Clear input/output contract
4. Compilation/test command to verify

### Agent: sui-contracts
```
Input: PRD §5.1, §8 (Wormhole), v3-01-dwallet-signing-policy.md, v3-10-wormhole-sui-verification.md
Output: packages/sui-contracts/ikatensei/sources/*.move
Verify: sui move build -e devnet (warnings OK, no errors)
Key: DWalletCap type from ika_dwallet_2pc_mpc::coordinator
     Must import: ika_dwallet_2pc_mpc::coordinator::DWalletCap
     Must import: wormhole::vaa for parse_and_verify
     register_seal_with_vaa verifies Wormhole VAA before accepting seal
     emitters.move tracks trusted source chain contract addresses
```

### Agent: eth-deposit
```
Input: PRD §8.3 (Ethereum contract), v3-09-wormhole-source-contracts.md
Output: packages/eth-contracts/src/IkaTenseiDeposit.sol
Verify: forge build (no errors)
Key: Wormhole IWormhole interface, publishMessage, ERC-721 transferFrom
     Mainnet core: 0x98f3c9e6E3fAce36bAAd05FE09d375Ef1464288B
     Payload format: §8.2 (171 bytes)
```

### Agent: sol-deposit
```
Input: PRD §8.3 (Solana program), v3-09-wormhole-source-contracts.md
Output: packages/sol-deposit/programs/ika_tensei_deposit/src/**
Verify: cargo build-sbf (no errors)
Key: Wormhole CPI for post_message, SPL token transfer CPI
     Wormhole program: worm2ZoG2kUd4vFXhvjh93UUH596ayRfgQ2MgjNMTth
```

### Agent: solana-program
```
Input: PRD §4.2 (PDA mint authority + immutable metadata), §5.2, §6 (seal hash), v3-03-seal-hash-attestation.md
Output: packages/solana-program/ika_tensei/programs/ika_tensei/src/**
Verify: cargo build-sbf (warnings OK, no errors)
Key: Ed25519 precompile verification via instructions sysvar
     Variable-length token IDs (Vec<u8> not u64)
     PDA["reincarnation_mint", seal_hash] as mint authority for Metaplex Core CPI
     Immutable metadata plugin with seal proof fields
     mint_reborn instruction uses PDA signer to create NFT
```

### Agent: shared-types
```
Input: PRD §3 (chains), §6 (seal hash)
Output: packages/shared/src/**
Verify: tsc --noEmit
Key: Seal hash construction must match EXACTLY between TypeScript and Rust
```

### Agent: frontend-ika
```
Input: PRD §4.1 (steps 3, 5), v3-02-dwallet-cross-chain-vault.md, ika-sdk-deep-dive.md
Output: packages/frontend/src/lib/ika/**
Verify: tsc --noEmit
Key: @ika.xyz/sdk v0.2.7, createDWallet, signWithDWallet, address derivation per chain
```

---

## 12. Chain IDs & Constants

```
ETHEREUM = 1
SUI      = 2
SOLANA   = 3
NEAR     = 4
BITCOIN  = 5

PROTOCOL_VERSION = 3
GUILD_SHARE_BPS  = 500   // 5%
TEAM_SHARE_BPS   = 190   // 1.9%
MINT_FEE         = 1_000_000  // lamports (0.001 SOL)

MAX_NAME_LENGTH    = 32
MAX_URI_LENGTH     = 200
MAX_CONTRACT_LENGTH = 64
MAX_TOKEN_ID_LENGTH = 64

SOLANA_PROGRAM_ID = TBD (new deployment)
SUI_PACKAGE_ID    = TBD (new deployment)
```

---

## 13. Open Questions

1. **IKA DWalletCap import:** Need exact package address for `ika_dwallet_2pc_mpc::coordinator::DWalletCap` on devnet/testnet. Research doc has `0x6573a6c13daf26a64eb8a37d3c7a4391b353031e223072ca45b1ff9366f59293`.

2. **IKA network fees:** Exact cost for DKG + signing TBD. Need to test on testnet.

3. **Bitcoin Ordinals:** No Wormhole support. Phase 2 will use trusted oracle with multi-sig attestation. Phase 3 targets Bitcoin SPV light client on Sui.

4. **record_mint permissionless:** Should `record_mint` be authority-only or permissionless? If permissionless, how to verify the caller actually minted? Could check mint authority matches.

5. **Sui contract upgradeability:** SealVault MUST be non-upgradeable. Use `sui move publish --skip-dependency-verification` with immutable package? Or publish as immutable object?

6. **Wormhole Move.toml dependency:** Need to confirm exact git rev for Wormhole Sui contracts that matches testnet deployment. May need to use local path dependency instead.

7. **Wormhole message fee on each chain:** ETH (~0.0001 ETH), SOL (~5000 lamports). Need to confirm and factor into fee calculation.

8. **Near Wormhole integration:** Wormhole chain ID 15 for Near. Need to verify Wormhole core contract exists on Near and supports publishMessage.

9. **Step ordering enforcement:** How to ensure user signs seal_hash (step 7) BEFORE register_seal locks the DWalletCap (step 6)? Frontend enforces ordering, but is there an on-chain guarantee needed?

---

## 14. Success Criteria

- [ ] Seal an NFT on Sui devnet → mint reborn on Solana devnet (full e2e)
- [ ] Seal an ERC-721 on Ethereum testnet → Wormhole VAA → verify on Sui → mint on Solana (full cross-chain e2e)
- [ ] Wormhole VAA verified on Sui before seal proceeds (deposit proof)
- [ ] DWalletCap confirmed in SealVault (cannot sign)
- [ ] Ed25519 signature verified on Solana via precompile
- [ ] Anti-replay: same seal_hash rejected on second attempt
- [ ] Anti-replay: same Wormhole VAA rejected on second attempt
- [ ] Emitter registry: only registered deposit contracts accepted
- [ ] Frontend completes full flow with no manual steps
- [ ] Fee collected on source chain, relayer submits Sui txs
- [ ] Bitcoin explicitly excluded with clear "Phase 2" messaging in UI

---

*This is a living document. Updated as research and implementation progress.*
