<p align="center">
  <img src="packages/frontend/public/art/ika-mascot-v2.png" width="120" />
</p>

<h1 align="center">イカ転生 - IKA TENSEI</h1>

<p align="center">
  <strong>Resurrect dead NFT collections on Solana. Community-governed. Built to decentralize.</strong>
</p>

<p align="center">
  <a href="#the-problem">Problem</a> · <a href="#the-solution">Solution</a> · <a href="#how-it-works">How It Works</a> · <a href="#the-guild">The Guild</a> · <a href="#architecture">Architecture</a> · <a href="#progressive-decentralization">Decentralization Roadmap</a> · <a href="#build">Build</a> · <a href="docs/PRD-v6.md">PRD</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/source_chains-EVM_+_Sui_+_NEAR_+_Aptos-gold?style=flat-square" />
  <img src="https://img.shields.io/badge/destination-Solana_(Metaplex_Core)-9945FF?style=flat-square" />
  <img src="https://img.shields.io/badge/signing-IKA_dWallet-ff3366?style=flat-square" />
  <img src="https://img.shields.io/badge/governance-Realms_DAO-blueviolet?style=flat-square" />
</p>

---

## The Problem

Millions of NFTs are trapped on dead chains and in abandoned collections.

The devs rugged. The floor went to zero. The chain got sunset. But the art, the community, the memories still matter to the people who held them.

There is no good way to bring them back. Existing bridges are custodial, centralized, or both. They ask you to trust a multisig with your identity. When that team disappears too, you lose everything again.

## The Solution

**Ika Tensei** (イカ転生, "squid reincarnation") is a protocol that **seals** NFTs on any source chain and **reborns** them on Solana with full on-chain provenance.

| What you get | How |
|---|---|
| Cross-chain NFT detection | Relayer verifies ownership on source chain via RPC |
| IKA dWallet signing | Shared minting authority via IKA Network's 2PC-MPC |
| Provenance forever | Original chain, contract, token ID, URI stored on-chain |
| Enforced royalties | Metaplex Core on Solana, royalties baked into the standard |
| Community treasury | The Adventurer's Guild manages funds through Realms DAO |

### Supported Source Chains

**EVM:** Ethereum · Polygon · Arbitrum · Base · Optimism · Avalanche · BSC (+ testnets)

**Other:** Sui · Aptos · NEAR

**Destination:** Solana (Metaplex Core, ~0.003 SOL per mint)

---

## How It Works

The current implementation uses a **centralized relayer** for speed and reliability during the hackathon. The relayer handles verification, signing coordination, and minting. See [Progressive Decentralization](#progressive-decentralization) for the trustless roadmap.

```
    YOUR DEAD NFT                                              YOUR REBORN NFT
    on Ethereum                                                on Solana
         |                                                          ^
         v                                                          |
   +-----------+         +-----------+         +-----------+  +------------+
   |  1 SEAL   |-------->| 2 VERIFY  |-------->|  3 SIGN   |->| 4 REBORN   |
   |           |         |           |         |           |  |            |
   | Deposit   |  RPC    | Relayer   |  Sui TX | IKA dWallet|  | Metaplex   |
   | NFT to    |-------->| verifies  |-------->| signs the |->| Core Mint  |
   | dWallet   |         | ownership |         | seal msg  |  | Provenance |
   +-----------+         +-----------+         +-----------+  +------------+
    Source Chain            Relayer                Sui              Solana
```

### Step by Step

**1. Pay + Create dWallet** - You connect your Solana wallet and pay a small fee. The relayer creates a fresh IKA deposit dWallet on the source chain. This is the address you send your NFT to.

**2. Deposit + Detect** - You transfer your NFT to the deposit address. The relayer's chain verifier confirms ownership via source chain RPC. It also detects which token IDs are at the deposit address so you don't need to enter them manually.

**3. Verify + Upload Metadata** - The relayer fetches the original NFT metadata (name, image, attributes) from the source chain, transforms it with reborn provenance data, and uploads it to Arweave for permanent storage. A TOCTOU re-verification confirms the NFT is still at the deposit address before proceeding.

**4. Seal on Sui** - The relayer calls `create_centralized_seal` on the Sui orchestrator contract. This emits a `SealPending` event. The seal signer picks it up, coordinates with IKA's 2PC-MPC network using the shared minting dWallet, and calls `complete_seal` which emits `SealSigned`.

**5. Reborn on Solana** - The relayer delivers the Ed25519 signature to Solana, where the program verifies it via the native precompile, creates a Metaplex Core collection (if first NFT from this source collection), and mints the reborn NFT to your wallet with full provenance on-chain. Royalties are set at 6.9% with the DAO treasury as primary recipient.

**6. Realm Created** - If this is the first NFT from a collection, the relayer automatically creates a Realms DAO on Solana. The collection now has a governed treasury that accumulates trading royalties.

**Total time:** ~2 minutes. **Cost:** ~0.003 SOL + small seal fee.

---

## The Guild

The **Adventurer's Guild** gives resurrected collections a community-owned treasury and governance layer built on [Realms](https://realms.today) (SPL Governance).

### How Royalties Flow

Every reborn NFT collection is minted with Metaplex Core royalties baked in at the protocol level: **6.9% total on all trades**, split automatically:

- **72% → DAO Treasury** (~5%) - Controlled by the guild through Realms proposals and votes
- **28% → Protocol** (~1.9%) - Funds protocol development and relayer operations

Each reborn collection gets its own Realm on Solana. Guild members (reborn NFT holders) can view the treasury balance, create proposals for how to spend funds, and vote on them through the Council tab in the app.

### What the Treasury Funds

- Gas subsidies for new resurrections
- Marketing and community growth for reborn collections
- Protocol development and infrastructure
- Whatever the guild members vote for

The point: when a collection gets reborn through Ika Tensei, it gets more than new life on Solana. It gets a funded community with real governance through Realms. The original holders had nothing. No devs, no treasury, no roadmap. Now they have all three.

---

## Architecture

```
packages/
├── eth-contracts/      Solidity     SealInitiator for EVM chains
├── sui-contracts/      Move         Orchestrator, DWallet Registry, Treasury, Signing
├── solana-program/     Anchor/Rust  IkaTenseiReborn (Metaplex Core CPI) + Core Voter
├── near-contracts/     Rust         NEAR SealInitiator
├── aptos-contracts/    Move         Aptos SealInitiator
├── relayer-v6/         TypeScript   Full orchestration service (see below)
├── frontend/           Next.js      Seal flow UI, Gallery, Guild
├── test-mint/          Next.js      Test minting UI for EVM/Sui/NEAR
└── trailer/            Remotion     Promo + demo videos
```

### The Relayer

The relayer is the brain of the current system. It runs five parallel services:

| Service | What it does |
|---|---|
| **API Server** | Express API for seal sessions, payment confirmation, NFT detection, guild endpoints |
| **Chain Verifier** | Verifies NFT ownership on source chains via RPC (EVM, Sui, NEAR, Aptos) |
| **NFT Detector** | Discovers token IDs at deposit addresses without user input |
| **Metadata Handler** | Fetches source metadata, adds provenance, uploads to Arweave |
| **Seal Signer** | Coordinates IKA 2PC-MPC signing using the shared minting dWallet |
| **Solana Submitter** | Submits `mint_reborn` with Ed25519 signature verification |
| **Realm Creator** | Creates Realms DAOs for new collections, configures voter plugins |
| **VAA Ingester** | (Optional) Polls Wormholescan for guardian-attested VAAs |
| **Treasury Manager** | Maintains IKA/SUI balances for signing operations |
| **Presign Pool** | Pre-generates signing nonces for faster seal completion |

Additional infrastructure: rate limiting, per-wallet session limits, atomic status transitions (no double-processing), TOCTOU re-verification, Sui transaction queue (serializes shared object access), session expiry, and a health endpoint.

### Key Design Decisions

| Decision | Why |
|---|---|
| Centralized relayer for hackathon | Ship fast, prove the flow works end-to-end. Decentralize in phases. |
| IKA dWallet for signing | The minting key never exists in one place. Even in centralized mode, the relayer alone cannot forge signatures. |
| `create_centralized_seal` on Sui | Bypasses Wormhole VAA requirement. The relayer calls it directly with an AdminCap. Same contract, same events, same downstream flow. |
| PDA-per-signature replay (Solana) | Scales indefinitely. Anchor's `init` constraint fails atomically on replay. Zero maintenance. |
| Ed25519 precompile + sysvar introspection | Solana programs cannot call the precompile directly. Instruction 0 verifies, instruction 1 reads from the sysvar. |
| Metaplex Core over Token Metadata | Core has enforced royalties, lower rent, and native collection support. Token Metadata royalties are advisory and routinely bypassed. |
| Realms for DAO governance | Battle-tested SPL Governance. Each collection gets its own Realm with treasury and proposals. |
| Sui-side treasury | Holds IKA + SUI tokens for coordinator fees. Withdraw-use-return pattern so signing operations are funded from the protocol, not the user. |

### Wire Format

Cross-chain payload (131+ bytes, no ABI encoding):

```
[0]        u8       payload_type (0x01 = SEAL)
[1-2]      u16      source_chain (big-endian Wormhole chain ID)
[3-34]     bytes32  nft_contract (left-padded)
[35-66]    bytes32  token_id
[67-98]    bytes32  deposit_address (left-padded)
[99-130]   bytes32  receiver (Solana pubkey)
[131+]     bytes    token_uri (raw UTF-8, variable length)
```

Full spec: [`docs/WIRE-FORMAT-SPEC.md`](docs/WIRE-FORMAT-SPEC.md)

---

## Progressive Decentralization

The hackathon version is intentionally centralized. A single relayer verifies deposits, coordinates signing, and submits transactions. This is the fastest path to a working demo, but it is not the end state.

The contracts are already built for the trustless version. The Sui orchestrator has both `process_vaa` (Wormhole-verified) and `create_centralized_seal` (relayer-authorized) entry points. The Solana program verifies Ed25519 signatures regardless of how they were produced. Switching from centralized to decentralized does not require redeploying contracts.

### The Roadmap

| Phase | Trust Model | What Changes |
|---|---|---|
| **Now (Hackathon)** | Relayer verifies deposits via RPC, calls `create_centralized_seal` | Single operator, fast iteration, easy debugging |
| **Phase 1: Wormhole VAA** | Wormhole 13/19 guardian consensus attests deposits | Source chain SealInitiator contracts emit Wormhole messages. VAA Ingester (already built, currently optional) polls Wormholescan and submits `process_vaa` to Sui. The relayer becomes a thin relay, not a verifier. |
| **Phase 2: Permissionless Relaying** | Anyone can relay VAAs and signatures | Remove AdminCap requirement. Anyone can call `process_vaa` with a valid VAA. Relayer competition for fees. |
| **Phase 3: Full Decentralization** | No single point of failure | Multiple relayers, MEV-protected submission, on-chain fee market, community-run infrastructure |

The key insight: IKA's dWallet signing is already trust-minimized even in the centralized flow. The relayer coordinates the signing ceremony, but it never holds the full key. The minting authority is split between the relayer's key share and IKA's MPC network. Neither party can sign alone.

What centralization buys us today: faster iteration, simpler debugging, the ability to handle edge cases (metadata formats vary wildly across chains) without governance overhead. What decentralization buys us on mainnet: censorship resistance, liveness guarantees, and the ability to say "this thing runs even if we disappear."

The EVM SealInitiator contracts, the Wormhole integration in the Sui orchestrator, and the VAA ingester in the relayer are all already written and tested. Flipping `ENABLE_VAA_INGESTER=true` activates the first phase.

---

## Build

```bash
# EVM contracts (Foundry)
cd packages/eth-contracts && forge build && forge test

# Sui contracts (requires Wormhole git dependency)
cd packages/sui-contracts/ikatensei && sui move build

# Solana program (Anchor)
cd packages/solana-program/ika-tensei-reborn && anchor build

# Relayer
cd packages/relayer-v6 && npm install && npm run build

# Frontend
cd packages/frontend && npm install && npm run dev
```

### Prerequisites

- [Foundry](https://book.getfoundry.sh/) for Solidity
- [Sui CLI](https://docs.sui.io/guides/developer/getting-started/sui-install) for Move
- [Anchor](https://www.anchor-lang.com/) + [Solana CLI](https://docs.solanalabs.com/cli/install) for Rust
- Node.js 18+ for Relayer + Frontend

---

## Docs

| Document | Description |
|---|---|
| [PRD v6](docs/PRD-v6.md) | Full protocol spec and architecture |
| [Wire Format Spec](docs/WIRE-FORMAT-SPEC.md) | Canonical byte-level cross-chain payload format |

---

## The Name

転生 (*tensei*) means reincarnation in Japanese. In anime and manga, *isekai tensei* stories follow characters who die and are reborn in another world, carrying memories of their past life.

That is exactly what happens here. Your NFT dies on one chain and is reborn on another, carrying its full history, its provenance, its art, its identity, into a new life on Solana.

イカ (*ika*) means squid. Because [IKA Network](https://ika.xyz) is the cryptographic backbone that makes cross-chain signing possible.

🦑

---

<p align="center">
  <strong>Built for the <a href="https://www.colosseum.org/renaissance">Solana Graveyard Hackathon</a></strong>
</p>

<p align="center">
  <a href="https://ika.xyz">IKA Network</a> · <a href="https://wormhole.com">Wormhole</a> · <a href="https://metaplex.com">Metaplex</a> · <a href="https://realms.today">Realms</a>
</p>

<p align="center">
  <sub>MIT License · 2026</sub>
</p>
