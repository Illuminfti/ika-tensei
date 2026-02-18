# 🦑 Ika Tensei (イカ転生)

<p align="center">
  <img src="https://img.shields.io/badge/Chains-18+-6FB49C?style=flat" alt="18+ Chains" />
  <img src="https://img.shields.io/badge/Solana-Devnet-9945FF?style=flat&logo=solana" alt="Solana Devnet" />
  <img src="https://img.shields.io/badge/IKA-dWallet%202PC--MPC-00CCFF?style=flat" alt="IKA dWallet" />
  <img src="https://img.shields.io/badge/Storage-Arweave-222222?style=flat" alt="Arweave" />
  <img src="https://img.shields.io/badge/License-MIT-yellow.svg?style=flat" alt="License" />
</p>

> **Seal your NFTs from any chain. Reborn on Solana.**

A permissionless cross-chain NFT reincarnation protocol powered by IKA Network's 2PC-MPC dWallets. Deposit an NFT into a cryptographic vault on any supported chain, and mint a provably-linked reborn copy on Solana.

**🌐 Live Demo:** [frontend-phi-nine-12.vercel.app](https://frontend-phi-nine-12.vercel.app)

---

## How It Works

```
   Source Chain (any of 17+)              IKA Network (Sui)                 Solana
┌──────────────────────────┐    ┌─────────────────────────────┐    ┌──────────────────────┐
│                          │    │                             │    │                      │
│  User sends NFT to       │───►│  dWallet detects deposit    │───►│  Ed25519 verify      │
│  dWallet deposit address │    │  Locks DWalletCap in Vault  │    │  Metaplex Core mint  │
│                          │    │  Signs attestation (2PC-MPC)│    │  Reborn NFT created  │
└──────────────────────────┘    └─────────────────────────────┘    └──────────────────────┘
```

1. **Connect** your Solana wallet
2. **Choose** the source chain where your NFT lives
3. **Receive** a deposit address (derived from a dWallet created just for you)
4. **Send** your NFT to that address
5. **Wait** — the protocol detects the deposit, fetches metadata, uploads to Arweave, and mints your reborn NFT on Solana

The original NFT is permanently locked. The `DWalletCap` (the key) is transferred to an immutable `SealVault` on Sui. No admin, no multisig, no escape hatch.

---

## Supported Chains

### EVM (secp256k1 — one deposit address works across all)

| Chain | Chain ID | Status |
|-------|----------|--------|
| Ethereum | 2 | ✅ |
| Polygon | 5 | ✅ |
| Arbitrum | 23 | ✅ |
| Base | 30 | ✅ |
| Optimism | 24 | ✅ |
| BNB Chain | 4 | ✅ |
| Avalanche | 6 | ✅ |
| Fantom | 10 | ✅ |
| Moonbeam | 16 | ✅ |
| Celo | 14 | ✅ |
| Scroll | 34 | ✅ |
| Blast | 36 | ✅ |
| Linea | 38 | ✅ |
| Gnosis | 25 | ✅ |

### Non-EVM (Ed25519 — separate deposit address per chain)

| Chain | Chain ID | Status |
|-------|----------|--------|
| Sui | 21 | ✅ |
| Aptos | 22 | ✅ |
| NEAR | 15 | ✅ |
| Solana | 1 | ✅ |

### Destination

All reborn NFTs mint on **Solana** via Metaplex Core.

---

## Architecture

### Core Principle: 1 NFT = 1 dWallet

Each seal creates a dedicated dWallet on IKA Network. The dWallet derives deposit addresses:
- **secp256k1** key → EVM address (same address on all EVM chains)
- **Ed25519** key → addresses for Sui, Aptos, NEAR, and Solana attestation signing

### Key Components

| Component | Description |
|-----------|-------------|
| **dWallet Pre-creation Pool** | dWallets created in advance for instant deposit addresses |
| **Deposit Detection** | Alchemy webhooks (EVM) + Helius (Solana) + custom RPC (Sui) |
| **Metadata Resolution** | Alchemy (EVM, free 600K/mo) + Helius DAS (Solana) + NFTScan (gaps) + direct RPC (Sui) |
| **Storage** | Arweave via Irys (~$0.01-0.02 per NFT, permanent) |
| **Minting** | Metaplex Core on Solana (~0.003 SOL per mint) |
| **Governance** | Realms DAO (1 reborn NFT = 1 vote) |

### Reborn NFT Design

```json
{
  "name": "CryptoPunk #1234 ✦ Reborn",
  "symbol": "REBORN",
  "attributes": [
    "...all original attributes preserved...",
    { "trait_type": "source_chain", "value": "ethereum" },
    { "trait_type": "original_contract", "value": "0xb47e...3bbb" },
    { "trait_type": "original_token_id", "value": "1234" },
    { "trait_type": "seal_date", "value": "2026-02-18T12:00:00Z" },
    { "trait_type": "dwallet_address", "value": "0x1234...abcd" }
  ]
}
```

---

## Smart Contracts

| Chain | Language | Tests | Status |
|-------|----------|-------|--------|
| Sui (IKA) | Move | 59/59 | ✅ Testnet |
| Solana | Rust/Anchor | 7/7 | ✅ Devnet |
| Ethereum | Solidity | 39/39 | ✅ Foundry |

### Deployed Addresses

| Network | Address |
|---------|---------|
| **Sui Testnet** | `0x22a886dfaa15087cbe092b4f7f3135e802c02f8b9fa68d267173de1edc55036e` |
| **Solana Devnet** | `mbEQvaiUYdc65Qz4rd67oBY1LbSCBq1Da8Y1MciwtPa` |

---

## Security

- **Immutable SealVault** — No upgrade function, no release. Sealed = sealed forever.
- **PDA Mint Authority** — Program-controlled, not admin. Nobody can mint arbitrarily.
- **Ed25519 On-chain Verification** — Solana precompile verifies dWallet signatures, not client-side trust.
- **Double-Seal Prevention** — Nonce uniqueness per seal hash.
- **No Bridges** — No wrapped tokens, no multisigs, no bridge risk. dWallets hold the NFT directly.
- **105+ Tests** — Across all three contract platforms.

---

## Frontend

Live at [frontend-phi-nine-12.vercel.app](https://frontend-phi-nine-12.vercel.app)

- **Stack:** Next.js 14 + Tailwind CSS + NES.css + Framer Motion
- **Theme:** Pixel Otaku Occult (Press Start 2P + Silkscreen fonts, occult color palette)
- **Wallet:** Dynamic.xyz (Solana-only, lazy-loaded)
- **Pages:** Landing, Seal Flow, Gallery, Guild (DAO), Profile

### Guild Features

The Adventurer's Guild is a gamified DAO interface built on Solana Realms:
- **Quest Board** — RPG-style missions with difficulty ranks (S/A/B/C/D)
- **Council** — Governance proposals with for/against/abstain voting + quorum tracking
- **Vault** — Treasury overview with revenue breakdown
- **Rankings** — Leaderboard with class system (warrior/mage/rogue/healer/summoner)

---

## Project Structure

```
packages/
├── sui-contracts/      # Sui Move (seal_vault, registry, admin, events)
├── solana-program/     # Anchor (Ed25519 verify + Metaplex Core CPI)
├── eth-contracts/      # Solidity (ERC-721/1155 deposit + emergency withdraw)
├── shared/             # TypeScript (IKA SDK, Wormhole VAA, Realms DAO)
├── backend/            # Service layer (API, queue, metadata resolver, minter)
├── relayer/            # Event-driven pipeline
├── tests/              # Integration test suite
├── frontend/           # Next.js 14 (live on Vercel)
└── docs/               # PRD, architecture docs
```

---

## Quick Start

```bash
git clone https://github.com/Illuminfti/ika-tensei.git
cd ika-tensei

# Sui contracts
cd packages/sui-contracts && cargo build --release && cargo test --release

# Solana program
cd packages/solana-program && cargo build-sbf && cargo test-sbf

# Ethereum contracts
cd packages/eth-contracts && forge build && forge test

# Frontend
cd packages/frontend && npm install && npm run dev
```

---

## Fee Structure

| Component | Amount |
|-----------|--------|
| **Seal Fee** | Flat SOL fee per seal |
| **Source Chain Gas** | Paid by user |
| **Guild Treasury** | 5% of fees |
| **Creator Royalties** | 5% advisory (preserved from original) |

---

## Links

- **Live Demo:** [frontend-phi-nine-12.vercel.app](https://frontend-phi-nine-12.vercel.app)
- **PRD v4:** [docs/PRD-v4.md](docs/PRD-v4.md)
- [IKA Network](https://ika.network) · [Metaplex Core](https://metaplex.com) · [Arweave](https://arweave.org) · [Realms DAO](https://realms.xyz)

---

## License

MIT — See [LICENSE](LICENSE)

---

<p align="center">
  <strong>🦑 イカ転生</strong><br />
  Death is not the end. It's a new beginning.
</p>
