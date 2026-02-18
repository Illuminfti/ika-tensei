# Ika Tensei Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              Ika Tensei Protocol v3                                 │
│                         Cross-Chain NFT Reincarnation                               │
└─────────────────────────────────────────────────────────────────────────────────────┘

                              ┌──────────────────┐
                              │    User/Frontend │
                              └────────┬─────────┘
                                       │
              ┌────────────────────────┼────────────────────────┐
              │                        │                        │
              ▼                        ▼                        ▼
   ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐
   │      Sui         │    │    Solana        │    │    Ethereum      │
   │   (Source)       │    │   (Destination)  │    │   (Source)       │
   └────────┬─────────┘    └────────┬─────────┘    └────────┬─────────┘
            │                        │                        │
            │  ┌────────────┐        │                        │  ┌────────────┐
            │  │ SealRegistry│       │                        │  │ ETH NFT   │
            │  │  (shared)  │        │                        │  │ Contract  │
            │  └────────────┘        │                        │  └────────────┘
            │                        │                        │
            │  ┌────────────┐        │    ┌──────────────┐   │
            │  │ SealVault │        │    │ IkaTensei    │   │
            │  │  (shared) │        │    │   Program    │   │
            │  └────────────┘        │    │ (Solana)     │   │
            │                        │    └──────────────┘   │
            │                        │                        │
            │  ┌────────────┐        │    ┌──────────────┐   │
            │  │ IKA dWallet│        │    │ Metaplex     │   │
            │  │ (2PC-MPC)  │        │    │ Core Assets  │   │
            │  └────────────┘        │    └──────────────┘   │
            │                        │                        │
            └────────────────────────┼────────────────────────┘
                                     │
                              ┌──────▼──────┐
                              │   Relayer   │
                              │ (Node.js)   │
                              └──────┬──────┘
                                     │
                              ┌──────▼──────┐
                              │  Wormhole   │
                              │  (Bridge)   │
                              └─────────────┘

┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              Supported Chains                                       │
├──────────┬──────────┬──────────┬──────────┬───────────────────────────────────────┤
│  Chain   │  ID      │  dWallet │  Attest  │  Contract                             │
├──────────┼──────────┼──────────┼──────────┼───────────────────────────────────────┤
│  Sui     │    2     │ Ed25519  │  Ed25519 │  ikatensei::registry                  │
│  Solana  │    3     │    -     │  Ed25519 │  ika_tensei (mbEQv...)                │
│  Ethereum│    1     │Secp256k1 │  Ed25519 │  (deposit contract TBD)               │
│  NEAR    │    4     │ Ed25519  │  Ed25519 │  (Phase 2)                           │
│  Bitcoin │    5     │    -     │    -     │  (Phase 2+)                           │
└──────────┴──────────┴──────────┴──────────┴───────────────────────────────────────┘
```

## Core Concepts

### 1. dWallet Model

A **dWallet** is a 2PC-MPC (Two-Party Computation Multi-Party Computation) threshold signature wallet created via IKA's Distributed Key Generation (DKG) protocol.

#### Key Properties

- **1 NFT = 1 dWallet**: Each sealed NFT gets its own dedicated dWallet
- **DWalletCap Ownership**: The `DWalletCap` object represents ownership/control of the dWallet
- **Permanent Lock**: Once sealed, the DWalletCap is transferred to `SealVault`, making the dWallet **irrevocably inactive**

#### Dual dWallet Model (secp256k1 chains: ETH/BTC)

For chains requiring secp256k1 signatures (Ethereum, Bitcoin), two dWallets are created:

| dWallet | Curve | Purpose |
|---------|-------|---------|
| Primary | Secp256k1 | Hold and transfer the original NFT on source chain |
| Attestation | Ed25519 | Sign the seal hash for verification on Solana |

#### Single dWallet Model (Ed25519 chains: SUI/SOL/NEAR)

For chains that natively support Ed25519 (Sui, Solana, NEAR), only one dWallet is needed - the attestation dWallet serves double duty.

```
┌────────────────────────────────────────────────────────────────┐
│                      Single dWallet (Sui/Solana/NEAR)          │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│    NFT ─────► dWallet (Ed25519) ─────► SealVault (locked)     │
│                         │                                      │
│                         └──── sign(seal_hash) ───► verify     │
│                                                                │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│                    Dual dWallet (Ethereum/Bitcoin)            │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│    NFT ─────► dWallet (Secp256k1) ─────► SealVault (locked)  │
│                         │                                      │
│                         ▼                                      │
│              dWallet (Ed25519) ─────► SealVault (locked)      │
│                         │                                      │
│                         └──── sign(seal_hash) ───► verify     │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

### 2. Seal Hash Computation

The canonical seal hash uniquely identifies a sealed NFT. It is computed using the following byte layout:

```
┌────────────────────────────────────────────────────────────────────────────────┐
│                        Seal Hash Byte Layout                                  │
├──────────┬──────────┬────────────┬────────────┬────────────────┬─────────────┤
│ Offset   │ Size     │ Field      │ Value      │ Notes         │
├──────────┼──────────┼────────────┼────────────┼───────────────┤
│ 0        │ 2 bytes  │ source_chain_id │ u16 BE │ Chain ID      │
│ 2        │ 2 bytes  │ dest_chain_id   │ 3 (Solana) | Always 3  │
│ 4        │ 1 byte   │ contract_len    │ N         │ Length prefix│
│ 5        │ N bytes  │ source_contract │ var       │ Contract addr │
│ 5+N      │ 1 byte   │ token_len       │ M         │ Length prefix│
│ 6+N      │ M bytes  │ token_id        │ var       │ Token ID      │
│ 6+N+M    │ 32 bytes │ attest_pubkey   │ 32        │ Ed25519 pubkey│
│ 38+N+M   │ 8 bytes  │ nonce          │ u64 BE    │ Seal nonce    │
├──────────┴──────────┴────────────┴────────────┴───────────────┤
│ Total: 43 + N + M bytes (before SHA2-256 hashing)            │
│ Output: 32 bytes (SHA2-256)                                  │
└────────────────────────────────────────────────────────────────┘
```

**Implementation** (Move/Sui):
```move
fun compute_seal_hash(
    source_chain_id: u16,
    source_contract: vector<u8>,
    token_id: vector<u8>,
    attestation_pubkey: &vector<u8>,
    nonce: u64,
): vector<u8> {
    let mut data = vector[];
    // source chain (2 bytes BE)
    vector::push_back(&mut data, ((source_chain_id >> 8) & 0xFF) as u8);
    vector::push_back(&mut data, (source_chain_id & 0xFF) as u8);
    // dest chain = 3 = Solana (2 bytes BE)
    vector::push_back(&mut data, 0u8);
    vector::push_back(&mut data, 3u8);
    // source contract (length-prefixed)
    vector::push_back(&mut data, vector::length(&source_contract) as u8);
    vector::append(&mut data, source_contract);
    // token id (length-prefixed)
    vector::push_back(&mut data, vector::length(&token_id) as u8);
    vector::append(&mut data, token_id);
    // attestation pubkey (32 bytes Ed25519)
    vector::append(&mut data, *attestation_pubkey);
    // nonce (8 bytes BE)
    vector::push_back(&mut data, ((nonce >> 56) & 0xFF) as u8);
    // ... serialize remaining 7 bytes
    std::hash::sha2_256(data)
}
```

### 3. PDA Derivation on Solana

The Solana program uses 5 PDAs (Program Derived Addresses):

```
┌────────────────────────────────────────────────────────────────────────────────┐
│                         Solana PDAs                                             │
├─────────────────────────────┬──────────────────────────────────────────────────┤
│ PDA Name                    │ Seeds                                             │
├─────────────────────────────┼──────────────────────────────────────────────────┤
│ Config                      │ [b"ika_config"]                                   │
│ Collection                  │ [b"collection", chain_id_le, source_contract]     │
│ ReincarnationRecord         │ [b"reincarnation", seal_hash[0..32]]            │
│ MintAuthority               │ [b"reincarnation_mint", seal_hash[0..32]]         │
│ OnchainCollection           │ [b"onchain_collection", config_key]              │
└─────────────────────────────┴──────────────────────────────────────────────────┘
```

**Derivation in Rust:**
```rust
pub fn derive_config_pda(bump: u8) -> Pubkey {
    Pubkey::find_program_address(&[constants::CONFIG_SEED], &PROGRAM_ID).0
}

pub fn derive_mint_authority_pda(seal_hash: &[u8; 32], bump: u8) -> Pubkey {
    Pubkey::find_program_address(
        &[constants::MINT_SEED, seal_hash],
        &PROGRAM_ID,
    ).0
}
```

### 4. Wormhole VAA Verification Flow

VAA (Verified Action Approval) verification ensures the NFT was actually deposited before sealing.

```
┌────────────────────────────────────────────────────────────────────────────────┐
│                      Wormhole VAA Verification Flow                             │
├────────────────────────────────────────────────────────────────────────────────┤
│                                                                                │
│  Step 1: User deposits NFT into dWallet on source chain                        │
│          + publishes Wormhole message (NFT deposit payload)                  │
│                                                                                │
│  Step 2: Guardian network (13/19 threshold) signs the VAA                     │
│                                                                                │
│  Step 3: Relayer fetches VAA from Wormhole Guardians                          │
│                                                                                │
│  Step 4: Sui contract verifies:                                               │
│          ├── VAA parse & hash                                                 │
│          ├── Guardian signature threshold (13/19)                              │
│          ├── Emitter is registered trusted emitter                            │
│          ├── VAA not already consumed (anti-replay)                           │
│          └── Payload matches expected deposit                                   │
│                                                                                │
│  Step 5: If verified: register seal, lock DWalletCaps in SealVault            │
│                                                                                │
└────────────────────────────────────────────────────────────────────────────────┘
```

**VAA Payload Structure** (171 bytes per PRD §8.2):
```
Offset  Size   Field
0       1      payload_id          (always 1 = NFT_DEPOSIT)
1       2      source_chain_id    (Wormhole chain ID, u16 BE)
3       32     nft_contract       (contract address, 0-padded)
35      32     token_id           (token ID, 0-padded)
67      32     depositor          (original owner, 0-padded)
99      32     dwallet_address    (dWallet on source chain)
131     8      deposit_block       (u64 BE)
139     32     seal_nonce         (unique nonce)
```

### 5. Event-Driven Relayer Pipeline

The relayer orchestrates cross-chain communication through a 6-step state machine:

```
┌────────────────────────────────────────────────────────────────────────────────┐
│                         Relayer Pipeline                                         │
├────────────────────────────────────────────────────────────────────────────────┤
│                                                                                │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐              │
│  │  PENDING │───►│VERIFYING │───►│ SIGNING  │───►│ BROADCAST│              │
│  └──────────┘    └──────────┘    └──────────┘    └──────────┘              │
│       │                                              │                        │
│       │                                              ▼                        │
│       │                                       ┌────────────┐                   │
│       │                                       │ COMPLETED │                   │
│       │                                       └────────────┘                   │
│       │                                              │                        │
│       │                                              ▼                        │
│       │                                       ┌────────────┐                   │
│       └─────────────── ERROR ─────────────────│  FAILED   │                   │
│                                             └────────────┘                   │
│                                                                                │
│  Step 1 (PENDING):    Seal request queued                                      │
│  Step 2 (VERIFYING):  VAA verification on Sui                                │
│  Step 3 (SIGNING):    IKA 2PC-MPC signing for seal_hash                      │
│  Step 4 (BROADCAST):  Submit signed transaction to Solana                     │
│  Step 5 (COMPLETED):  NFT reborn, mark_reborn() called on Sui                │
│  Step 6 (FAILED):     Error, retry or abort                                   │
│                                                                                │
└────────────────────────────────────────────────────────────────────────────────┘
```

**Database Schema:**
```sql
CREATE TABLE seal_records (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    seal_hash       TEXT NOT NULL UNIQUE,
    source_chain    INTEGER NOT NULL,
    source_contract TEXT NOT NULL,
    token_id        TEXT NOT NULL,
    dwallet_pubkey  TEXT NOT NULL,
    attestation_pubkey TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'PENDING',
    solana_mint     TEXT,
    sui_tx_digest   TEXT,
    solana_tx_sig   TEXT,
    error_message   TEXT,
    created_at      INTEGER NOT NULL,
    updated_at      INTEGER NOT NULL
);

CREATE INDEX idx_seal_hash ON seal_records(seal_hash);
CREATE INDEX idx_status ON seal_records(status);
CREATE INDEX idx_created_at ON seal_records(created_at);
```

### 6. Fee Flow

```
┌────────────────────────────────────────────────────────────────────────────────┐
│                              Fee Flow                                          │
├────────────────────────────────────────────────────────────────────────────────┤
│                                                                                │
│  User pays:                                                                    │
│                                                                                │
│  Source Chain (Sui):                                                           │
│  ┌─────────────────────────────────────────────────────────────┐             │
│  │  Gas (gas) ──► Sui network                                  │             │
│  │  Seal Fee ──► Protocol Wallet ──► Distribution             │             │
│  └─────────────────────────────────────────────────────────────┘             │
│                                                                                │
│  Distribution (per PRD):                                                       │
│  ┌─────────────────────────────────────────────────────────────┐             │
│  │  Guild Treasury:  5%   (500 bps)                            │             │
│  │  Team Treasury:    1.9% (190 bps)                            │             │
│  │  Sui Gas:          ~0.01 SUI (variable)                      │             │
│  │  IKA Gas:          ~0.001 IKA (network fee)                  │             │
│  └─────────────────────────────────────────────────────────────┘             │
│                                                                                │
│  Destination Chain (Solana):                                                   │
│  ┌─────────────────────────────────────────────────────────────┐             │
│  │  Mint Fee (configurable): ──► Guild + Team treasuries       │             │
│  │  Rent (minimal):           ──► Solana network              │             │
│  └─────────────────────────────────────────────────────────────┘             │
│                                                                                │
│  Royalties on Secondary Sales:                                                │
│  ┌─────────────────────────────────────────────────────────────┐             │
│  │  Total: 6.9% (690 bps)                                      │             │
│  │  - Guild (72%):  ~4.97%                                     │             │
│  │  - Team (28%):   ~1.93%                                     │             │
│  └─────────────────────────────────────────────────────────────┘             │
│                                                                                │
└────────────────────────────────────────────────────────────────────────────────┘
```

### 7. Security Model

```
┌────────────────────────────────────────────────────────────────────────────────┐
│                           Security Model                                       │
├────────────────────────────────────────────────────────────────────────────────┤
│                                                                                │
│  1. IMMUTABLE VAULT (SealVault)                                               │
│     ├── No release/unseal function ever exists                               │
│     ├── DWalletCaps permanently locked after seal                             │
│     └── dWallet can NEVER sign again once sealed                              │
│                                                                                │
│  2. PDA MINT AUTHORITY                                                         │
│     ├── MintAuthority PDA has no withdraw capability                          │
│     ├── Can only mint to pre-specified recipient                              │
│     └── Update authority locked (immutable metadata)                          │
│                                                                                │
│  3. ED25519 PRECOMPILE (Solana)                                               │
│     ├── verify_ed25519_signature uses Solana's native                         │
│     │   ed25519_program (hardware accelerated)                               │
│     └── Signature verified against stored attestation_pubkey                  │
│                                                                                │
│  4. DOUBLE-SEAL PREVENTION                                                    │
│     ├── SealVault tracks sealed dWallet IDs in Table                          │
│     ├── Rejects duplicate seal attempts                                        │
│     └── Anti-replay VAA consumption tracking                                   │
│                                                                                │
│  5. THRESHOLD SIGNATURES                                                      │
│     ├── IKA 2PC-MPC requires both parties to sign                             │
│     │   (user + IKA key holder)                                               │
│     ├── No single party can unilaterally sign                                 │
│     └── DKG ensures distributed key generation                                │
│                                                                                │
│  6. PERMISSIONLESS MARK_REBORN                                                │
│     ├── Anyone can call mark_reborn() on Sui                                  │
│     ├── No auth required - enforces openness                                   │
│     └── Prevents single point of failure for completion                       │
│                                                                                │
└────────────────────────────────────────────────────────────────────────────────┘
```

## Module Summary

| Module | Location | Purpose |
|--------|----------|---------|
| `ikatensei::registry` | Sui Move | Seal registration, state management |
| `ikatensei::seal_vault` | Sui Move | Permanent DWalletCap locking |
| `ikatensei::admin` | Sui Move | Protocol configuration |
| `ikatensei::emitters` | Sui Move | Trusted Wormhole emitter registry |
| `ika_tensei` | Solana Rust | Verify + mint reborn NFTs |
| `relayer` | Node.js | Cross-chain orchestration |
| `shared` | TypeScript | IKA SDK, Wormhole, metadata |
| `eth-contracts` | Solidity | (Deposit contracts - Phase 2) |
