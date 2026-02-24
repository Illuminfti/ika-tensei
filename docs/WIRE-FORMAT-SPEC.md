# Ika Tensei Wire Format Specification

**Status:** CANONICAL — All contracts MUST match this spec exactly.
**Last Updated:** 2026-02-23

## Purpose

This document is the single source of truth for all cross-chain data formats.
Every contract, program, and service MUST reference this document.
Sub-agents MUST receive this spec before writing any code.

## 1. Seal Payload (EVM → Wormhole → Sui)

Binary format, no ABI encoding, no Borsh. Raw packed bytes.

```
Offset  Size  Field            Type      Encoding
──────  ────  ─────            ────      ────────
0       1     payload_type     u8        = 0x01 (SealAttestation)
1       2     source_chain     u16       big-endian
3       32    nft_contract     bytes32   left-padded (uint256(uint160(addr)))
35      32    token_id         bytes32   big-endian uint256
67      32    deposit_address  bytes32   left-padded (uint256(uint160(addr)))
99      32    receiver         bytes32   raw Solana pubkey
131     var   token_uri        bytes     raw UTF-8, no length prefix, MAY be empty
```

Total minimum: 131 bytes (empty URI)
Maximum: 131 + 2048 bytes (MAX_URI_LENGTH)

### Encoding (Solidity)
```solidity
abi.encodePacked(
    uint8(1),                              // 1 byte
    wormhole.chainId(),                    // 2 bytes
    bytes32(uint256(uint160(nftContract))),  // 32 bytes
    tokenId,                               // 32 bytes
    bytes32(uint256(uint160(depositAddress))), // 32 bytes
    solanaReceiver,                        // 32 bytes
    bytes(tokenURI)                        // variable
)
```

### Decoding (Move)
```
payload[0]     → payload_type
payload[1..3]  → source_chain (big-endian u16)
payload[3..35] → nft_contract
payload[35..67] → token_id
payload[67..99] → deposit_address
payload[99..131] → receiver
payload[131..]  → token_uri (may be empty)
```

## 2. Signing Message (Sui → IKA dWallet)

```
message = sha256(token_uri || token_id || receiver)
```

Where:
- token_uri: variable bytes (from payload, may be empty)
- token_id: 32 bytes (from payload)
- receiver: 32 bytes (Solana pubkey from payload)

Result: 32-byte SHA256 hash, signed with Ed25519 via IKA 2PC-MPC.

**NOTE (v7):** Field order changed from v6. token_uri is now FIRST.

## 3. SealSigned Event (Sui → Relayer)

All fields are hex-encoded in the Sui event JSON.

| Field            | Type   | Description |
|-----------------|--------|-------------|
| source_chain    | u16    | Wormhole chain ID |
| nft_contract    | hex    | 32-byte contract address |
| token_id        | hex    | 32-byte token ID |
| token_uri       | hex    | UTF-8 bytes of URI |
| receiver        | hex    | 32-byte Solana pubkey |
| deposit_address | hex    | 32-byte deposit address |
| message_hash    | hex    | 32-byte SHA256 |
| signature       | hex    | 64-byte Ed25519 signature |
| dwallet_pubkey  | hex    | 32-byte Ed25519 public key |
| vaa_hash        | hex    | 32-byte VAA hash |

## 4. Solana Transaction (Relayer → Solana Program)

### Instruction Format
Anchor Borsh serialization. Use `@coral-xyz/anchor` Program.methods builder.
DO NOT hand-encode instruction data.

### Required Instructions (in order)
1. Ed25519 precompile instruction (signature verification)
2. mint_reborn instruction (Anchor)

### PDA Seeds (exact)
```
sig_used:          ["sig_used", sha256(signature)]   ← per-signature replay PDA
collection_registry: ["collection_registry"]
provenance:        ["provenance", source_chain.to_le_bytes(), nft_contract, token_id]
reborn_collection: ["reborn_collection", source_chain.to_le_bytes(), nft_contract]
mint_authority:    ["mint_authority", source_chain.to_le_bytes(), nft_contract]
```

Note: source_chain is u16 little-endian in PDA seeds (Solana convention).
This differs from the wire format (big-endian). Relayer must convert.

### Required Accounts (MintReborn)
1. payer (signer, mut)
2. receiver (unchecked)
3. sig_record (init, PDA)
4. registry (mut, PDA)
5. provenance (init, PDA)
6. collection (init_if_needed, PDA)
7. collection_asset (for Metaplex Core collection)
8. mint_authority (PDA)
9. asset (signer, new keypair per mint)
10. mpl_core_program
11. system_program
12. instructions_sysvar

## 5. Validation Checklist

Before ANY cross-chain code ships:

- [ ] Encode a test payload in EVM, decode it in Sui — fields match?
- [ ] Construct signing message in Sui, verify signature in Solana — passes?
- [ ] Derive all PDAs in both TypeScript and Rust — addresses match?
- [ ] Anchor IDL discriminator matches what relayer sends?
- [ ] Ed25519 precompile instruction is instruction[0] in the tx?
- [ ] Event hex decoding produces correct byte lengths?
