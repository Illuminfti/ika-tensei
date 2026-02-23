# Sub-Agent Rules for Ika Tensei

## Mandatory Context

Every sub-agent writing cross-chain code MUST receive:
1. `docs/WIRE-FORMAT-SPEC.md` — the canonical wire format
2. The exact interface of the component they're integrating with
3. A test vector: known input → expected output for their boundary

## Rules

1. **NO stub cryptography in shared code.** Stubs are `#[test_only]` or behind feature flags. Production entry points MUST use real implementations.

2. **NO custom serialization.** Use the framework's serializer:
   - Solidity: `abi.encodePacked` per WIRE-FORMAT-SPEC
   - Move: manual byte slicing per WIRE-FORMAT-SPEC  
   - Rust/Anchor: Borsh via `@coral-xyz/anchor`
   - TypeScript: Anchor SDK `Program.methods` builder

3. **NO hardcoded addresses** that are chain-specific. All chain-specific values go through constructor params or config.

4. **Validate at boundaries.** Every component validates its inputs independently. Don't trust upstream validation.

5. **Wire format is FROZEN.** Changes to WIRE-FORMAT-SPEC.md require updating ALL components simultaneously. Never change one side without the other.

6. **PDA seeds are FROZEN.** If you change a seed, you must update: Solana program, relayer PDA derivation, and any indexer.

7. **Integration test before merge.** At minimum: encode on source → decode on destination → fields match. If you can't run the full pipeline, write a test vector and verify both sides against it.

## Failure Mode Prevention

| Past Failure | Prevention |
|-------------|------------|
| abi.encode vs packed binary | WIRE-FORMAT-SPEC is canonical |
| Stub crypto shipped as production | Stubs gated behind test_only |
| Wrong PDA seeds in relayer | Seeds documented in WIRE-FORMAT-SPEC |
| Missing Ed25519 instruction | Required instructions listed in spec |
| Field confusion (deposit_address vs pubkey) | Types documented with clear descriptions |
| Ring buffer overflow | Use PDA-per-item, not bounded buffers |
| Hardcoded mainnet addresses | Constructor params always |
