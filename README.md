# Ika Tensei

Cross-chain NFT reincarnation protocol. Seal an NFT on any supported chain, mint a provenance-verified copy on Solana via Metaplex Core.

Zero backend. Zero admin keys. Wormhole VAA verification + IKA 2PC-MPC signing.

## Problem

NFTs are stuck on dying chains and dead collections. There's no trustless way to move them cross-chain while preserving provenance. Existing bridges are custodial, centralized, or both.

## Solution

Ika Tensei uses Wormhole's guardian network (13/19 consensus) for cross-chain state attestation and IKA Network's dWallet 2PC-MPC for threshold signing. The result is a fully permissionless seal-and-mint pipeline with on-chain provenance.

**Destination chain: Solana** (Metaplex Core, ~0.003 SOL per mint, enforced royalties)

## Protocol Flow

```
EVM Chain                    Wormhole              IKA (Sui)                  Solana
────────────                 ────────              ─────────                  ──────
SealInitiator.sol            19 Guardian nodes      Orchestrator.move          IkaTenseiReborn (Anchor)
├─ ownerOf() check           ├─ observe tx          ├─ parse_and_verify()      ├─ Ed25519 precompile verify
├─ tokenURI() read           ├─ sign attestation    ├─ emitter validation      ├─ PDA-based replay check
├─ encodePacked payload      └─ emit VAA            ├─ Ed25519 sig verify      ├─ CreateV2 CPI (Metaplex Core)
└─ publishMessage()                                 └─ emit SealSigned         └─ store Provenance PDA
```

### Phase 1: Seal (source chain)

`SealInitiator` verifies NFT ownership via `ownerOf()` (ERC-721), `balanceOf()` (ERC-1155), or `punkIndexToAddress()` (CryptoPunks). Reads `tokenURI()`. Encodes a packed binary payload and publishes a Wormhole message.

Payload format (131+ bytes, no ABI encoding):
```
[0]      u8     payload_type (0x01)
[1-2]    u16    source_chain (big-endian)
[3-34]   bytes32 nft_contract (left-padded)
[35-66]  bytes32 token_id
[67-98]  bytes32 deposit_address (left-padded)
[99-130] bytes32 receiver (Solana pubkey)
[131+]   bytes   token_uri (raw UTF-8, variable)
```

### Phase 2: Verify + Sign (Sui)

Two-transaction process on Sui:

1. **`process_vaa`**: Takes raw VAA bytes + Wormhole `State` object. Calls `wormhole::vaa::parse_and_verify()` for guardian signature verification. Validates emitter address against a per-chain registry. Decodes payload. Stores a `PendingSeal` with `message_hash = sha256(token_id || token_uri || receiver)`.

2. **`complete_seal`**: Relayer submits the Ed25519 signature produced by IKA's off-chain 2PC-MPC ceremony. On-chain verification via `sui::ed25519::ed25519_verify()`. Emits `SealSigned` event. Locks `DWalletCap` permanently in `SealVault` (transferred to an address derived from the vault's object ID — no signer controls it).

IKA signing is asynchronous. The Sui contract cannot call the IKA network synchronously, so the relayer bridges the two transactions using the `@ika.xyz/sdk` TypeScript package.

### Phase 3: Mint (Solana)

The relayer watches `SealSigned` events and submits Anchor transactions to Solana:

- **Instruction 0**: Ed25519 precompile — the runtime verifies the signature natively
- **Instruction 1**: `mint_reborn` — program loads instruction 0 from the sysvar, checks pubkey + message + all 64 signature bytes via `constant_time_eq`, then mints

Replay protection uses per-signature PDAs: `seeds = ["sig_used", sha256(signature)]`. Anchor's `init` constraint fails atomically if the PDA exists. No ring buffers, no overflow, no expiry.

Metaplex Core `CreateV2` CPI mints the reborn NFT with:
- Collection linkage (auto-created per source chain collection)
- Original token URI preserved
- Full provenance stored in a separate PDA

## Architecture

```
packages/
├── eth-contracts/     Solidity    SealInitiator + Forge tests
├── sui-contracts/     Move        Orchestrator, Payload Decoder, DWallet Registry
├── solana-program/    Anchor      IkaTenseiReborn (Metaplex Core minting)
├── relayer-v6/        TypeScript  Sui→Solana bridge (Borsh encoding, Ed25519 ix)
└── frontend/          Next.js     Seal flow UI
```

### Key design decisions

- **`abi.encodePacked` not `abi.encode`**: ABI encoding inserts 32-byte padding and offset tables. The Sui decoder uses fixed byte offsets. Packed encoding is the only format that works cross-chain without an ABI decoder in Move.
- **Two-phase seal on Sui**: IKA 2PC-MPC is async. Can't do VAA verification and signing in one tx.
- **PDA-per-signature replay**: A global account with a bounded buffer overflows. PDA-per-signature scales indefinitely and fails atomically on replay.
- **Ed25519 precompile + sysvar introspection**: Solana programs can't call the Ed25519 precompile directly. The relayer places it as instruction 0, the program reads it from the instructions sysvar and verifies all three fields (pubkey, message, signature bytes).
- **DWalletCap burn via transfer**: Sui has no `destroy` for arbitrary types. Transferring to an address derived from a shared object's ID makes the cap permanently inaccessible.

## Source Chains

18 chains via Wormhole:

**EVM**: Ethereum, Polygon, Arbitrum, Base, Optimism, Avalanche, BSC, Fantom, Celo, Moonbeam, Gnosis, Klaytn, Scroll, zkSync

**Other**: Sui, Aptos, NEAR, Solana (seal old Token Metadata → reborn as Metaplex Core)

## Security

3 audit rounds, 12 agents. 58 findings total, all CRITICAL/HIGH fixed. Report: [`audits/v3/MASTER-AUDIT-V6.md`](audits/v3/MASTER-AUDIT-V6.md)

| Property | Implementation |
|----------|---------------|
| Cross-chain verification | Wormhole 13/19 guardian consensus |
| Signing | IKA 2PC-MPC (neither party signs alone) |
| Replay (EVM) | `mapping(bytes32 => bool) sealedNFTs` |
| Replay (Solana) | PDA per signature hash |
| Replay (Sui) | `processed_vaas` table + Wormhole consumed_vaas |
| Signature verification | Ed25519 precompile, 64-byte constant-time comparison |
| Admin keys (Solana) | None |
| Reentrancy (EVM) | Checks-effects-interactions pattern |

Wire format spec: [`docs/WIRE-FORMAT-SPEC.md`](docs/WIRE-FORMAT-SPEC.md)

## Build

```bash
# EVM
cd packages/eth-contracts && forge build && forge test

# Sui (requires Wormhole git dependency)
cd packages/sui-contracts/ikatensei && sui move build

# Solana
cd packages/solana-program/ika-tensei-reborn && anchor build

# Relayer
cd packages/relayer-v6 && npm install && npm run build

# Frontend
cd packages/frontend && npm install && npm run dev
```

## Docs

- [PRD v6](docs/PRD-v6.md) — Protocol specification
- [Wire Format Spec](docs/WIRE-FORMAT-SPEC.md) — Cross-chain byte layouts
- [Audit Report](audits/v3/MASTER-AUDIT-V6.md) — Security findings + fixes

## License

MIT
