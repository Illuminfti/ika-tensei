# Ika Tensei — NFT Reincarnation on Solana

**Your NFT died on Ethereum. Reborn it on Solana.**

Dead collection? Floor at zero? Your PFP is still you. Ika Tensei lets you seal any NFT on any chain and mint a verified reborn copy on Solana — with full provenance, enforced royalties, and community governance.

No backend. No trust assumptions. Just Wormhole guardians and math.

## Why Solana?

Because reborn NFTs deserve a chain that's fast, cheap, and alive. Minting on Solana costs ~0.003 SOL. Metaplex Core gives enforced royalties out of the box. And the ecosystem is where the culture is.

Ika Tensei brings NFTs *to* Solana from everywhere else: Ethereum, Polygon, Arbitrum, Base, Optimism, Avalanche, BSC, Sui, Aptos, NEAR — 18 chains and counting.

## How It Works

```
Source Chain (ETH, etc.)     Wormhole          Sui (IKA)              Solana
┌──────────────────┐     ┌──────────┐     ┌──────────────┐     ┌──────────────┐
│ SealInitiator    │────▶│ Guardian  │────▶│ Orchestrator │────▶│ IkaTensei    │
│ verifies NFT     │     │ consensus │     │ verifies VAA │     │ Reborn       │
│ ownership +      │     │ (13/19)   │     │ + IKA dWallet│     │ mints NFT    │
│ emits Wormhole   │     │           │     │ Ed25519 sign │     │ via Metaplex │
│ message          │     │           │     │              │     │ Core         │
└──────────────────┘     └──────────┘     └──────────────┘     └──────────────┘
```

1. **Seal**: User sends their NFT to a deposit address. SealInitiator contract verifies ownership and emits a Wormhole message.
2. **Verify**: 13 of 19 Wormhole guardians sign the message. The VAA is submitted to the Sui Orchestrator which verifies guardian signatures.
3. **Sign**: IKA dWallet performs 2PC-MPC Ed25519 signing. Neither the user nor the network can sign alone — both parties must cooperate.
4. **Mint**: Relayer submits the verified signature to the Solana program, which mints a Metaplex Core NFT with full provenance to the user's wallet.

The entire flow is permissionless and trustless. No backend server. No admin keys on Solana. Anyone with a valid IKA signature can trigger a mint.

## Architecture

```
packages/
├── eth-contracts/     # Solidity — SealInitiator (EVM source chains)
├── sui-contracts/     # Move — Orchestrator, DWallet Registry, Payload Decoder
├── solana-program/    # Anchor — IkaTenseiReborn (mints Metaplex Core NFTs)
├── relayer-v6/        # TypeScript — Bridges Sui events to Solana transactions
└── frontend/          # Next.js — Seal flow UI (Vercel)
```

### Solana Program (the destination)

The Solana program is where NFTs are reborn. It:
- Verifies Ed25519 signatures from IKA dWallets via the native precompile
- Creates Metaplex Core collections per source chain collection
- Mints reborn NFTs with enforced royalties
- Stores full provenance on-chain (source chain, contract, token ID, original URI)
- Uses PDA-based replay protection (one mint per signature, forever)

No admin keys. No upgrade authority needed. Pure verification + minting.

### EVM Contracts (source chains)

SealInitiator is deployed on each EVM chain. It:
- Verifies NFT ownership (ERC-721, ERC-1155, CryptoPunks)
- Reads token URI from the source contract
- Emits a Wormhole message with a packed binary payload
- Has replay protection (each NFT can only be sealed once)
- Supports batch sealing (up to 50 NFTs per tx)

### Sui Orchestrator (verification layer)

The orchestrator on Sui handles cross-chain verification:
- Parses and verifies Wormhole VAAs (real `wormhole::vaa::parse_and_verify`)
- Validates emitter addresses against a registry of known SealInitiator contracts
- Stores pending seals awaiting IKA dWallet signatures
- Verifies Ed25519 signatures on-chain before emitting events
- Locks DWalletCaps permanently after sealing (no recovery, by design)

Two-phase process: `process_vaa` (verify) → `complete_seal` (sign + emit).

### Relayer

The relayer bridges Sui to Solana:
- Subscribes to SealSigned events on Sui
- Builds Anchor transactions with correct Borsh encoding
- Prepends Ed25519 precompile instructions
- Handles retries with exponential backoff
- Persists event cursors for crash recovery

## Supported Source Chains

| Chain | Type | Status |
|-------|------|--------|
| Ethereum | EVM | ✅ |
| Polygon | EVM | ✅ |
| Arbitrum | EVM | ✅ |
| Base | EVM | ✅ |
| Optimism | EVM | ✅ |
| Avalanche | EVM | ✅ |
| BSC | EVM | ✅ |
| Fantom | EVM | ✅ |
| Celo | EVM | ✅ |
| Moonbeam | EVM | ✅ |
| Gnosis | EVM | ✅ |
| Klaytn | EVM | ✅ |
| Scroll | EVM | ✅ |
| zkSync | EVM | ✅ |
| Sui | MoveVM | ✅ |
| Aptos | MoveVM | ✅ |
| NEAR | NEAR | ✅ |
| Solana | Solana | ✅ (seal old Token Metadata → reborn as Core) |

**Destination: Solana** (Metaplex Core)

## Security

3 rounds of security auditing with 12 parallel agents. Full report: [`audits/v3/MASTER-AUDIT-V6.md`](audits/v3/MASTER-AUDIT-V6.md)

- 58 findings identified, all CRITICAL and HIGH fixed
- Wire format specification: [`docs/WIRE-FORMAT-SPEC.md`](docs/WIRE-FORMAT-SPEC.md)
- No admin keys on Solana program
- Wormhole guardian consensus (13/19) for cross-chain messages
- IKA 2PC-MPC for signing (neither party can sign alone)
- PDA-based replay protection (permanent, no overflow)
- Ed25519 signature verification checks all 64 bytes

## Reborn NFT Design

When your NFT is reborn on Solana:
- **Name**: `"{Original Collection} ✦ Reborn"`
- **Metadata**: Original token URI preserved
- **Provenance**: Source chain, contract address, token ID stored on-chain
- **Standard**: Metaplex Core (single account per NFT, enforced royalties)
- **Storage**: Arweave via Irys for permanent metadata

## Development

```bash
# EVM contracts
cd packages/eth-contracts && forge build && forge test

# Sui contracts
cd packages/sui-contracts/ikatensei && sui move build

# Solana program
cd packages/solana-program/ika-tensei-reborn && anchor build

# Relayer
cd packages/relayer-v6 && npm install && npm run build

# Frontend
cd packages/frontend && npm install && npm run dev
```

## Docs

- [PRD v6](docs/PRD-v6.md) — Protocol design
- [Wire Format Spec](docs/WIRE-FORMAT-SPEC.md) — Canonical cross-chain byte layouts
- [Sub-Agent Rules](docs/SUBAGENT-RULES.md) — Development guardrails

## License

MIT
