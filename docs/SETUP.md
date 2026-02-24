# Ika Tensei — Full Setup & Testing Guide

End-to-end setup for testing the Ika Tensei NFT reincarnation protocol across all chains.

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Build All Contracts](#2-build-all-contracts)
3. [Deploy Solana Program](#3-deploy-solana-program)
4. [Deploy Sui Contracts](#4-deploy-sui-contracts)
5. [Deploy Source Chain Contracts](#5-deploy-source-chain-contracts)
6. [One-Time Admin Setup](#6-one-time-admin-setup)
7. [Configure & Start the Relayer](#7-configure--start-the-relayer)
8. [Test the Full Flow](#8-test-the-full-flow)
9. [Troubleshooting](#9-troubleshooting)

---

## 1. Prerequisites

### Required Tools

| Tool | Version | Install |
|------|---------|---------|
| **Node.js** | >=18 | `brew install node` |
| **Rust** | stable + wasm32 | `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \| sh` |
| **Sui CLI** | >=1.40 | `cargo install --locked --git https://github.com/MystenLabs/sui.git sui` |
| **Solana CLI** | >=1.18 | `sh -c "$(curl -sSfL https://release.anza.xyz/stable/install)"` |
| **Anchor** | >=0.30.1 | `cargo install --git https://github.com/coral-xyz/anchor anchor-cli` |
| **Foundry** | latest | `curl -L https://foundry.paradigm.xyz \| bash && foundryup` |
| **Aptos CLI** | >=4.0 | `brew install aptos` |

### Required Targets

```bash
# NEAR contracts require wasm32
rustup target add wasm32-unknown-unknown
```

### Network Accounts

```bash
# Create Sui testnet account (if you don't have one)
sui client new-address ed25519
sui client faucet   # Get testnet SUI

# Create Solana devnet keypair
solana-keygen new -o ./relayer-keypair.json
solana airdrop 5 --url devnet   # Get devnet SOL

# Export Sui keypair for the relayer
sui keytool export --key-identity <your-address> --json > ./sui-keypair.json
```

---

## 2. Build All Contracts

Run from the repository root:

```bash
# ── Sui Contracts ──
cd packages/sui-contracts/ikatensei
sui move build
sui move test
# Expected: 7 tests pass

# ── Solana Program ──
cd packages/solana-program/ika-tensei-reborn
anchor build
# Output: target/deploy/ika_tensei_reborn.so

# ── EVM Contracts ──
cd packages/eth-contracts
forge build
# forge test  (optional — requires test fixtures)

# ── NEAR Contract ──
cd packages/near-contracts/seal-initiator
cargo check --target wasm32-unknown-unknown
cargo test
# Expected: 8 tests pass

# ── Aptos Contract ──
cd packages/aptos-contracts
aptos move compile --named-addresses ika_tensei_aptos=0x1
aptos move test --named-addresses ika_tensei_aptos=0x1
# Expected: 3 tests pass
```

---

## 3. Deploy Solana Program

```bash
cd packages/solana-program/ika-tensei-reborn

# Deploy to devnet
anchor deploy --provider.cluster devnet
# Note the program ID from output (e.g., GaF33RCjTAW6cGCWaiefEVuptbsDDDSAtNx3ipDmNqnj)

# Initialize the collection registry (one-time)
# Using Anchor client or CLI:
anchor run initialize-registry --provider.cluster devnet
```

Save the **program ID** — you'll need it for the relayer config.

---

## 4. Deploy Sui Contracts

```bash
cd packages/sui-contracts/ikatensei

# Deploy to testnet
sui client publish --gas-budget 500000000
```

The publish output prints the created objects. Extract and save these IDs:

| Object | Type | How to Find |
|--------|------|-------------|
| **Package ID** | Published | Look for `Published Objects` |
| **OrchestratorState** | `ikatensei::orchestrator::OrchestratorState` | `Created Objects` section, shared |
| **SigningState** | `ikatensei::signing::SigningState` | `Created Objects` section, shared |
| **MintingAuthority** | `ikatensei::orchestrator::MintingAuthority` | `Created Objects` section, shared |
| **OrchestratorAdminCap** | `ikatensei::orchestrator::OrchestratorAdminCap` | `Created Objects` section, owned by deployer |
| **DWalletRegistry** | `ikatensei::dwallet_registry::DWalletRegistry` | `Created Objects` section, shared |
| **DWalletRegistryCap** | `ikatensei::dwallet_registry::DWalletRegistryCap` | `Created Objects` section, owned by deployer |

You can also query them after deployment:

```bash
# List all objects created by the package
sui client objects --json | jq '.[] | select(.type | contains("ikatensei"))'
```

---

## 5. Deploy Source Chain Contracts

### EVM (Ethereum / Polygon / Base / etc.)

See `packages/eth-contracts/DEPLOY.md` for full instructions. Summary:

```bash
cd packages/eth-contracts

# Set environment
cp .env.example .env
# Edit .env: set PRIVATE_KEY, RPC_URL, WORMHOLE_ADDRESS, CHAIN_ID

# Deploy
forge script script/Deploy.s.sol --rpc-url $RPC_URL --broadcast --verify
```

### NEAR

```bash
cd packages/near-contracts/seal-initiator

# Build WASM
cargo near build

# Deploy (requires NEAR CLI)
near deploy seal-initiator.testnet target/near/seal_initiator_near.wasm

# Initialize
near call seal-initiator.testnet new '{"wormhole_account":"wormhole.testnet"}' --accountId deployer.testnet

# Register as Wormhole emitter
near call seal-initiator.testnet register_as_emitter --accountId deployer.testnet --deposit 1
```

### Aptos

```bash
cd packages/aptos-contracts

# Deploy
aptos move publish --named-addresses ika_tensei_aptos=<deployer-address>

# Initialize
aptos move run --function-id <deployer-address>::seal_initiator::initialize
```

> **Note:** The `initialize` function registers the contract as a Wormhole emitter. After calling it, query the emitter capability to find the emitter address for `SOURCE_CHAIN_EMITTERS` config. On Aptos, the Wormhole emitter address is a u64 sequence ID left-padded to 32 bytes hex (not the contract address).

---

## 6. One-Time Admin Setup

These steps run once after all contracts are deployed. They wire everything together.

### Step 1: Register Source Chain Emitters on Sui

Register the Wormhole emitter address of each source chain's SealInitiator contract:

```bash
# For each source chain, register its emitter address (32 bytes, left-padded)
sui client call --package $SUI_PACKAGE_ID \
  --module orchestrator \
  --function register_emitter \
  --args $ORCHESTRATOR_STATE_ID $ADMIN_CAP_ID \
    <chain_id_u16> \        # e.g., 2 for Ethereum
    <emitter_address_hex>   # 32-byte hex of the SealInitiator's Wormhole emitter
  --gas-budget 10000000
```

Wormhole chain IDs:
- Solana = 1, Ethereum = 2, BSC = 4, Polygon = 5, Avalanche = 6
- NEAR = 15, Sui = 21, Aptos = 22, Arbitrum = 23, Optimism = 24, Base = 30

### Step 2: Create the Minting dWallet

The minting dWallet is the single shared Ed25519 key that signs ALL seal attestations. This is created once and the DWalletCap stays permanently in the Sui contract.

```typescript
// scripts/setup-minting-dwallet.ts
import { SuiClient } from '@mysten/sui/client';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { Transaction } from '@mysten/sui/transactions';
import { IkaClient, getNetworkConfig, prepareDKGAsync } from '@ika.xyz/sdk';

const sui = new SuiClient({ url: SUI_RPC_URL });
const keypair = Ed25519Keypair.fromSecretKey(/* your key */);
const ikaConfig = getNetworkConfig('testnet');
const ika = new IkaClient({ suiClient: sui, config: ikaConfig });
await ika.initialize();

// 1. Get encryption key
const encKey = await ika.getLatestNetworkEncryptionKey();

// 2. Prepare DKG inputs
const dkg = await prepareDKGAsync(
  3,  // Ed25519 curve
  encKey.encryptionKey,
  encKey.keyId,
);

// 3. Call create_minting_dwallet on Sui
const tx = new Transaction();
tx.moveCall({
  target: `${PACKAGE_ID}::orchestrator::create_minting_dwallet`,
  arguments: [
    tx.object(ORCHESTRATOR_STATE_ID),
    tx.object(SIGNING_STATE_ID),
    tx.object(ADMIN_CAP_ID),
    tx.object(IKA_COORDINATOR_ID),           // shared DWalletCoordinator
    tx.pure.id(encKey.objectId),
    tx.pure.vector('u8', dkg.centralizedPublicKeyShareAndProof),
    tx.pure.vector('u8', dkg.userPublicOutput),
    tx.pure.vector('u8', dkg.userSecretKeyShare),
    tx.pure.vector('u8', dkg.sessionBytes),
  ],
});
const result = await sui.signAndExecuteTransaction({ transaction: tx, signer: keypair });

// 4. Extract and save the DKG outputs (CRITICAL — needed for signing later)
console.log('userSecretKeyShare (hex):', Buffer.from(dkg.userSecretKeyShare).toString('hex'));
console.log('userPublicOutput (hex):', Buffer.from(dkg.userPublicOutput).toString('hex'));
// ^^^ Save these in .env as MINTING_DWALLET_SECRET_KEY_SHARE / MINTING_DWALLET_PUBLIC_OUTPUT

// 5. Wait for DKG to complete (IKA async process)
// Poll the dWallet until it reaches 'Active' state, then extract the public key
const dwalletOutput = await ika.getDWalletInParticularState(dwalletId, 'Active', { timeout: 120_000 });
const mintingPubkey = publicKeyFromDWalletOutput(dwalletOutput);
console.log('Minting pubkey (hex):', Buffer.from(mintingPubkey).toString('hex'));
```

### Step 3: Set Minting Pubkey on Sui

```bash
sui client call --package $SUI_PACKAGE_ID \
  --module orchestrator \
  --function set_minting_pubkey \
  --args $MINTING_AUTHORITY_ID $ADMIN_CAP_ID \
    <32-byte-minting-pubkey-hex> \
  --gas-budget 10000000
```

### Step 4: Initialize MintConfig on Solana

Store the same minting pubkey on Solana so the program can verify signatures:

```bash
# Using Anchor client or a script:
anchor run initialize-mint-config -- --minting-pubkey <32-byte-hex>
```

Or via raw transaction:
```typescript
const ix = program.methods
  .initializeMintConfig(Array.from(mintingPubkeyBytes))
  .accounts({ config: mintConfigPDA, admin: adminKeypair.publicKey, systemProgram: SystemProgram.programId })
  .instruction();
```

### Step 5: Top Up Treasury

The Sui treasury pays for all IKA coordinator calls (DKG, presign, sign):

```bash
# Add IKA tokens
sui client call --package $SUI_PACKAGE_ID \
  --module orchestrator \
  --function add_ika_payment \
  --args $ORCHESTRATOR_STATE_ID $ADMIN_CAP_ID <ika-coin-object-id> \
  --gas-budget 10000000

# Add SUI tokens
sui client call --package $SUI_PACKAGE_ID \
  --module orchestrator \
  --function add_sui_payment \
  --args $ORCHESTRATOR_STATE_ID $ADMIN_CAP_ID <sui-coin-object-id> \
  --gas-budget 10000000
```

### Step 6: Seed Presign Pool

Request initial presigns so the relayer has them ready for signing:

```bash
# Request 10 presigns (each is an on-chain call)
for i in $(seq 1 10); do
  sui client call --package $SUI_PACKAGE_ID \
    --module orchestrator \
    --function request_presign \
    --args $ORCHESTRATOR_STATE_ID $IKA_COORDINATOR_ID $ADMIN_CAP_ID \
      <enc-key-id> $i \
    --gas-budget 50000000
done
```

The relayer's `PresignPool` will also do this automatically on startup.

---

## 7. Configure & Start the Relayer

```bash
cd packages/relayer-v6

# Install dependencies
npm install

# Create .env from template
cp .env.example .env

# Fill in all values from the deployment steps above:
# - SUI_PACKAGE_ID, SUI_ORCHESTRATOR_STATE_ID, SUI_SIGNING_STATE_ID, etc.
# - SOLANA_PROGRAM_ID
# - MINTING_DWALLET_SECRET_KEY_SHARE, MINTING_DWALLET_PUBLIC_OUTPUT
# - Keypair paths
#
# VAA Ingester (required for cross-chain flows):
# - WORMHOLE_STATE_OBJECT_ID  (Wormhole State shared object on Sui)
# - WORMHOLESCAN_API_URL      (https://api.testnet.wormholescan.io)
# - SOURCE_CHAIN_EMITTERS     (chainId:emitterAddress:label, comma-separated)
# - VAA_POLLING_INTERVAL_MS   (default: 30000)
#
# Example SOURCE_CHAIN_EMITTERS:
#   2:000000000000000000000000<eth-seal-initiator>:Ethereum,15:<near-emitter-sha256>:NEAR,22:00000000000000000000000000000000000000000000000000000000<aptos-emitter-u64>:Aptos

# Build
npm run build

# Start (development, with hot reload)
npm run dev

# Start (production)
npm run start
```

### Verify Startup

The relayer logs should show:

```
INFO: Starting Ika Tensei v8 Relayer…
INFO: All connections verified
INFO: Treasury manager initialized
INFO: Seeding initial presign pool (count=5)
INFO: Seal signer initialized
INFO: Starting VAA ingester
INFO:   emitters: ["Ethereum(2)", "NEAR(15)", "Aptos(22)"]
INFO: API server listening (port=3001)
INFO: Relayer is running
```

### Health Check

```bash
curl http://localhost:8080/health
# {"status":"healthy","suiConnected":true,"solanaConnected":true,...}
```

---

## 8. Test the Full Flow

### 8.1 Cross-Chain Flow (EVM → Solana)

```bash
# 1. Start a seal session
curl -X POST http://localhost:3001/api/seal/start \
  -H 'Content-Type: application/json' \
  -d '{"solanaWallet":"<solana-pubkey>","sourceChain":"ethereum"}'
# Returns: { sessionId, paymentAddress, feeAmountLamports }

# 2. Send SOL payment (from your Solana wallet to paymentAddress)
solana transfer <paymentAddress> 0.01 --url devnet

# 3. Confirm payment
curl -X POST http://localhost:3001/api/seal/confirm-payment \
  -H 'Content-Type: application/json' \
  -d '{"sessionId":"<session-id>","paymentTxSignature":"<tx-sig>"}'
# Returns: { dwalletId, depositAddress }

# 4. Send an ERC-721 NFT to the depositAddress on the source chain
#    (Use MetaMask or a script to call transferFrom/safeTransferFrom)

# 5. Call initiate_seal on the source chain's SealInitiator contract
#    This reads the NFT ownership, reads tokenURI, and publishes a Wormhole VAA

# 6. Wait ~2-15 minutes for Wormhole guardian consensus
#    (The VAA ingester polls Wormholescan every 30s by default)

# 7. The relayer automatically (via VAA ingester + signing flow):
#    - Detects signed VAA on Wormholescan
#    - Submits process_vaa() to Sui → SealPending event
#    - Signs via IKA 2PC-MPC (allocates presign, computes centralized sig)
#    - Calls complete_seal() → SealSigned event
#    - Submits mint_reborn to Solana

# 9. Check seal status
curl http://localhost:3001/api/seal/<session-id>/status
# Returns: { status: "complete", rebornNFT: { mint, name, image } }
```

### 8.2 Solana-to-Solana Native Path

No relayer needed — direct smart contract call:

```typescript
import { Program } from '@coral-xyz/anchor';

const program = new Program(idl, programId, provider);

// User owns an SPL token NFT. Seal it and mint a reborn NFT in one tx.
await program.methods
  .sealAndMintNative('ipfs://QmTokenUri', 'My Collection Reborn')
  .accounts({
    user: wallet.publicKey,
    nftTokenAccount: userNftTokenAccount,
    nftMint: nftMintPubkey,
    sealedNftVault: sealedVaultPDA,
    sealedNftAuthority: sealedAuthPDA,
    registry: registryPDA,
    provenance: provenancePDA,
    collection: collectionPDA,
    mintAuthority: mintAuthorityPDA,
    collectionAsset: collectionAssetKeypair.publicKey,
    asset: assetKeypair.publicKey,
    mplCoreProgram: MPL_CORE_PROGRAM_ID,
    tokenProgram: TOKEN_PROGRAM_ID,
    systemProgram: SystemProgram.programId,
    rent: SYSVAR_RENT_PUBKEY,
  })
  .signers([collectionAssetKeypair, assetKeypair])
  .rpc();
```

### 8.3 Monitor

```bash
# Treasury balances
curl http://localhost:3001/api/treasury/balances

# Presign pool stats
curl http://localhost:3001/api/presign/stats
```

---

## 9. Troubleshooting

### "Signing services disabled"

The relayer logs `Signing services disabled — missing orchestrator/signing state IDs`.

**Fix:** Set `SUI_ORCHESTRATOR_STATE_ID` and `SUI_SIGNING_STATE_ID` in `.env`.

### "MINTING_DWALLET_SECRET_KEY_SHARE not set"

The relayer starts but cannot sign seals.

**Fix:** Complete [Step 2 of Admin Setup](#step-2-create-the-minting-dwallet) and set both `MINTING_DWALLET_SECRET_KEY_SHARE` and `MINTING_DWALLET_PUBLIC_OUTPUT` in `.env`.

### "Treasury balance too low"

Presign or sign requests fail because the on-chain treasury has insufficient IKA/SUI.

**Fix:** Top up via `add_ika_payment` / `add_sui_payment` (see [Step 5](#step-5-top-up-treasury)).

### "No presigns available"

The presign pool is empty. Signing is blocked.

**Fix:** Either wait for automatic replenishment (30s cycle) or manually call `request_presign`.

### "E_INVALID_EMITTER" on process_vaa

The VAA's emitter address doesn't match any registered emitter.

**Fix:** Register the source chain's SealInitiator emitter address on Sui via `register_emitter` (see [Step 1](#step-1-register-source-chain-emitters-on-sui)).

### "E_DWALLET_ALREADY_USED"

The deposit dWallet was already used for a previous seal.

**Fix:** Each dWallet is one-use. Create a new dWallet for the new seal.

### NEAR "No pending seal found"

`complete_seal_initiation` was called but no pending seal exists.

**Fix:** Ensure `nft_transfer_call` was called first (Step 1 of the two-step NEAR flow). The NFT must be sent to the SealInitiator contract with the correct `msg` JSON.

### Aptos emitter address for SOURCE_CHAIN_EMITTERS

On Aptos, the Wormhole emitter address is **not** the contract address. It's a u64 sequence ID assigned by `wormhole::register_emitter()`, left-padded to 32 bytes hex. Check the Wormhole emitter capability object or the `WormholeMessage` event after calling `initialize()` to find the correct value.

---

## Architecture Reference

```
 Source Chains               Sui (Brain)                  Solana (Destination)
┌────────────┐             ┌──────────────────┐          ┌──────────────────┐
│ EVM        │─Wormhole──>│ orchestrator.move │          │ ika_tensei_reborn│
│ NEAR       │─Wormhole──>│   process_vaa()   │ Relayer  │   mint_reborn()  │
│ Aptos      │─Wormhole──>│   request_sign()  │────────>│   Ed25519 verify │
│ Sui        │─on-chain──>│   complete_seal() │          │   Metaplex mint  │
└────────────┘             │                  │          │                  │
                           │ signing.move     │          │ seal_and_mint_   │
┌────────────┐             │   IKA 2PC-MPC    │          │   native()       │
│ Solana     │────────────>│                  │          │   (no IKA)       │
│ (native)   │ direct call │ treasury.move    │          └──────────────────┘
└────────────┘             │   IKA/SUI pool   │
                           └──────────────────┘

Message: sha256(token_uri || token_id || receiver)
Signing: Ed25519 via IKA 2PC-MPC (shared minting dWallet)
```

### Key Contracts

| Contract | Location | Purpose |
|----------|----------|---------|
| `orchestrator.move` | `sui-contracts/ikatensei/sources/` | VAA verification, seal state, signature verification |
| `signing.move` | `sui-contracts/ikatensei/sources/` | IKA DWalletCap storage, sign/presign via coordinator |
| `treasury.move` | `sui-contracts/ikatensei/sources/` | On-chain IKA/SUI balance pool |
| `dwallet_registry.move` | `sui-contracts/ikatensei/sources/` | Deposit dWallet tracking (one-use) |
| `dwallet_factory.move` | `sui-contracts/ikatensei/sources/` | dWallet creation via IKA DKG |
| `payload.move` | `sui-contracts/ikatensei/sources/` | Wire format encode/decode |
| `SealInitiator.sol` | `eth-contracts/contracts/` | EVM NFT seal + Wormhole VAA |
| `seal_initiator.move` | `aptos-contracts/sources/` | Aptos NFT seal + Wormhole VAA |
| `lib.rs` (NEAR) | `near-contracts/seal-initiator/src/` | NEAR NFT lock + Wormhole VAA |
| `lib.rs` (Solana) | `solana-program/ika-tensei-reborn/` | Ed25519 verify + Metaplex Core mint |

### Wire Format

See `docs/WIRE-FORMAT-SPEC.md` for the canonical binary payload specification.

### Data Flow

```
1. User pays fee → relayer creates deposit dWallet
2. User sends NFT to deposit address
3. Source chain SealInitiator verifies + emits Wormhole VAA
4. Relayer submits VAA to Sui → process_vaa() → SealPending event
5. Relayer allocates presign, computes centralized signature
6. Relayer calls request_sign_seal() → IKA 2PC-MPC signing
7. Relayer polls IKA for completion, gets Ed25519 signature
8. Relayer calls complete_seal() → SealSigned event
9. Relayer submits mint_reborn to Solana with signature
10. Solana verifies Ed25519 + mints Metaplex Core NFT to receiver
```
