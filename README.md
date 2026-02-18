# 🦑 Ika Tensei (イカ転生)

<p align="center">
  <img src="https://img.shields.io/badge/Sui-Testnet-6FB49C?style=flat&logo=blockchain" alt="Sui Testnet" />
  <img src="https://img.shields.io/badge/Solana-Devnet-9945FF?style=flat&logo=solana" alt="Solana Devnet" />
  <img src="https://img.shields.io/badge/Ethereum-Sepolia-3C3C3D?style=flat&logo=ethereum" alt="Ethereum Sepolia" />
  <img src="https://img.shields.io/badge/Tests-105%2B-passing-green?style=flat" alt="Tests" />
  <img src="https://img.shields.io/badge/License-MIT-yellow.svg?style=flat" alt="License" />
  <img src="https://img.shields.io/badge/Solana%20Graveyard-Hackathon-FF6B6B?style=flat" alt="Hackathon" />
</p>

> **Squid Reincarnation** — A fully permissionless cross-chain NFT reincarnation protocol. Bring dead NFTs back to life across chains.

**Core thesis: 1 NFT = 1 dWallet.** The dWallet IS your cross-chain vault.

---

## ✨ Why Ika Tensei?

Your Bored Ape is stuck on Ethereum. Your Magic Eden pass is on Solana. The floor is dead. **What if you could reincarnate it?**

Ika Tensei seals your NFT on the source chain using IKA Network's 2PC-MPC dWallets, then mints a cryptographically-linked exact copy ("reborn NFT") on Solana. The original is **permanently locked** — not sold, not bridged, **gone forever**. The reborn is the new canonical version.

- 🔒 **Permissionless** — No admin, no whitelist, no central authority
- 🔐 **Cryptographically proven** — Ed25519 signatures from IKA dWallets verified on-chain
- 🌊 **Cross-chain native** — ETH → Sui → Solana (or any supported chain)
- 🎮 **1 NFT = 1 vote** — Reborn NFTs become governance tokens in Realms DAOs

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              SOURCE CHAIN                                   │
│                      (Ethereum • Sui • Solana • NEAR)                      │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  User transfers NFT to dWallet-derived address                     │    │
│  │  Pays fee in native token + submits Wormhole VAA                    │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────┬──────────────────────────────────────────┘
                                   │ Wormhole VAA (13/19 guardian threshold)
                                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              SUI (IKA NETWORK)                              │
│  ┌────────────────────┐  ┌────────────────────┐  ┌────────────────────┐    │
│  │   SealVault        │  │   SealRegistry    │  │   IKA dWallet      │    │
│  │   (immutable)      │◄─│   (per-chain)     │  │   (2PC-MPC)        │    │
│  │   + DWalletCap     │  │   + metadata      │  │   Ed25519 signing  │    │
│  └────────────────────┘  └────────────────────┘  └────────────────────┘    │
│           │                                              │                 │
│           │         NFT locked forever                  │                 │
│           └──────────────────────────────────────────────┘                 │
└──────────────────────────────────┬──────────────────────────────────────────┘
                                   │ Ed25519 signature over seal hash
                                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              SOLANA                                         │
│  ┌────────────────────┐  ┌────────────────────┐  ┌────────────────────┐    │
│  │   verify_seal       │  │   Metaplex Core   │  │   Realms DAO       │    │
│  │   (Ed25519 precomp) │─►│   (reborn NFT)    │─►│   (1 NFT = 1 vote) │    │
│  └────────────────────┘  └────────────────────┘  └────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 🔄 How It Works

### The 10-Step Reincarnation Flow

| Step | Action | What Happens |
|------|--------|--------------|
| **1** | **Deposit** | User transfers NFT to the dWallet's derived address on the source chain. Pays fee in native token. |
| **2** | **Wormhole VAA** | Deposit event emitted, Wormhole guardians (13/19 threshold) verify and sign the VAA. |
| **3** | **Seal Registration** | VAA submitted to Sui. NFT registered in `SealRegistry` with full metadata (chain, contract, token ID, dWallet pubkey). |
| **4** | **dWallet Lock** | `DWalletCap` (the "key" to the dWallet) is transferred to the immutable `SealVault`. **The NFT is now permanently locked.** |
| **5** | **IKA Signing** | IKA Network's 2PC-MPC protocol generates an Ed25519 signature over the seal hash. This is cryptographic proof that the dWallet authorized the seal. |
| **6** | **Solana Verify** | The reborn request hits Solana. The program calls Ed25519 precompile to verify the dWallet's signature on-chain. |
| **7** | **Mint Reborn** | Signature valid? → Metaplex Core CPI mints the exact NFT copy. Mint authority is a PDA (program-controlled), not an admin. |
| **8** | **Mark Reborn** | Seal marked `complete` on Sui. The loop is closed. The original can never be unsealed. |
| **9** | **Create Guild** | An "Adventurer's Guild" (Realms DAO) is instantiated for the collection. |
| **10** | **Deposit to Guild** | Reborn NFT deposited as governance token. **1 NFT = 1 vote** in the DAO. |

---

## ⛓️ Chains Supported

| Chain | Standard | dWallet Type | Status |
|-------|----------|--------------|--------|
| **Ethereum** | ERC-721, ERC-1155 | Dual (secp256k1 + Ed25519) | ✅ Foundry / Sepolia-ready |
| **Sui** | Native objects (`key + store`) | Ed25519 | ✅ Testnet |
| **Solana** | SPL Token / Metaplex Core | Ed25519 | ✅ Devnet |
| **NEAR** | NEP-171 | Ed25519 | 🔜 Phase 2 |
| **Bitcoin** | Ordinals | — | 🔜 Phase 2 |

---

## 📜 Smart Contracts

| Chain | Language | LOC | Tests | Status |
|-------|----------|-----|-------|--------|
| Sui | Move | 950 | 59/59 | ✅ Testnet |
| Solana | Rust/Anchor | 497 | 7/7 | ✅ Devnet |
| Ethereum | Solidity | 337 | 39/39 | ✅ Foundry |

### Deployed Addresses

| Network | Contract | Explorer |
|---------|----------|----------|
| **Sui Testnet** | `0x22a886dfaa15087cbe092b4f7f3135e802c02f8b9fa68d267173de1edc55036e` | [Sui Explorer](https://testnet.suiexplorer.com/object/0x22a886dfaa15087cbe092b4f7f3135e802c02f8b9fa68d267173de1edc55036e) |
| **Solana Devnet** | `mbEQvaiUYdc65Qz4rd67oBY1LbSCBq1Da8Y1MciwtPa` | [Solana Explorer](https://explorer.solana.com/address/mbEQvaiUYdc65Qz4rd67oBY1LbSCBq1Da8Y1MciwtPa?cluster=devnet) |
| **Ethereum Sepolia** | Ready for deployment | — |

### Proven E2E Results

- ✅ **Full E2E v2**: Native Sui NFT → dWallet seal → IKA 2PC-MPC signing → Solana mint
- ✅ **Two dWallets** created and actively signing on IKA testnet
- ✅ **Reborn NFT**: `7kw62zZyVWhgiMG6sYN3NSnENZk67R5g8tgqwFEHV7ry`

---

## 🔐 Seal Hash Computation

The seal hash ties the original NFT to its reborn twin cryptographically:

```
SHA-256(
  source_chain_id     │ u16 (big-endian)
  dest_chain_id       │ u16 (big-endian, 0x0003 = Solana)
  contract_len        │ u8
  contract            │ N bytes
  token_id_len        │ u8
  token_id            │ M bytes
  attestation_pubkey  │ 32 bytes
  nonce               │ u64 (big-endian)
)
```

---

## 🛡️ Security Features

- **Immutable SealVault** — No upgrade, no release function. Once sealed, it stays sealed.
- **PDA Mint Authority** — Program-controlled, not admin. Team cannot mint.
- **Ed25519 Precompile** — On-chain signature verification, not client-side trust.
- **Wormhole 13/19** — Guardian threshold for cross-chain message integrity.
- **Double-Seal Prevention** — Nonce uniqueness guarantees each NFT can only be sealed once.
- **105+ Tests** — Across Sui, Solana, and Ethereum. 100% passing.

---

## 💰 Fee Structure

| Component | Amount | Recipient |
|-----------|--------|-----------|
| **Mint Fee** | 0.001 SOL | Protocol (covers Solana gas) |
| **Guild Share** | 5% | Realms DAO Treasury |
| **Team Share** | 1.9% | Devs |
| **Royalties** | 6.9% | Original creators (preserved) |

User pays **once** on the source chain in native token. Protocol covers Sui gas + IKA gas + Solana gas.

---

## 🧩 Package Structure

```
packages/
├── sui-contracts/          # Sui Move
│   ├── ikatensei/          # Main protocol (seal_vault, registry, admin, events)
│   └── ika_nft/            # Demo NFT module
├── solana-program/         # Anchor (Ed25519 verify + Metaplex Core CPI)
├── eth-contracts/          # Solidity (ERC-721/1155 deposit + Wormhole)
├── shared/                 # TypeScript (IKA SDK, Walrus, Wormhole VAA, Realms)
├── relayer/                # Production relayer (event-driven pipeline)
├── tests/                  # Integration test suite
└── frontend/               # Next.js 14 (Phase 4)
```

---

## 🚀 Quick Start

### Prerequisites

```bash
# Install Rust (Solana)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source ~/.cargo/env

# Install Sui CLI
cargo install --locked --git https://github.com/MystenLabs/sui.git sui

# Install Foundry (Ethereum)
curl -L https://foundry.paradigm.xyz | bash
foundryup

# Install pnpm
npm install -g pnpm
```

### Build & Test

```bash
# Clone and enter
git clone https://github.com/ika-network/ika-tensei.git
cd ika-tensei

# Sui contracts
cd packages/sui-contracts
cargo build --release
cargo test --release

# Solana program
cd packages/solana-program
cargo build-sbf
cargo test-sbf

# Ethereum contracts
cd packages/eth-contracts
forge build
forge test
```

### Run E2E Tests

```bash
cd packages/tests
pnpm install
pnpm test:e2e
```

---

## 🏆 Hackathon

Built for the **Solana Graveyard Hackathon** — bringing dead NFTs back to life across chains.

---

## 📄 License

MIT License. See [LICENSE](LICENSE) for details.

---

## 🔗 Links

- [IKA Network](https://ika.network)
- [Wormhole](https://wormhole.com)
- [Metaplex Core](https://metaplex.com)
- [Realms DAO](https://realms.xyz)
- [Walrus Storage](https://walrus.space)

---

<p align="center">
  <strong>🦑 Ika Tensei — Squid Reincarnation</strong><br />
  Death is not the end. It's a new beginning.
</p>
