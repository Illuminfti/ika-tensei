# Audit Report: ika-tensei-reborn (Anchor Program)

**File**: `packages/solana-program/ika-tensei-reborn/programs/ika-tensei-reborn/src/lib.rs`
**Lines**: ~926
**Anchor Version**: 0.30.1 (Cargo.toml) / 0.32.1 (Anchor.toml — mismatch noted)
**Purpose**: Metaplex Core NFT minting with Ed25519 signature verification, replay protection, and on-chain provenance

---

## Summary

The program is a Metaplex Core NFT minting system that:
1. Stores an Ed25519 public key (from an IKA dWallet) in a config PDA at initialization.
2. On `mint_reborn`, verifies that a matching Ed25519 precompile instruction exists in the transaction, confirming a valid dWallet signature over `sha256(token_uri || token_id || receiver)`.
3. Uses two layers of replay protection: a per-signature PDA (`sig_record`) and a per-NFT provenance PDA (unique per `source_chain + nft_contract + token_id`).
4. Creates Metaplex Core collections on first mint for each source collection, and mints individual NFT assets linked to those collections.
5. Records on-chain provenance (source chain, contract, token ID, URI, signature, receiver, timestamp).

**Overall Assessment**: Well-structured with solid security fundamentals. The Ed25519 verification is thorough and replay protection is robust. Several findings need attention before mainnet, especially around the signed message format.

---

## Findings

### HIGH-01: Ed25519 Instruction Index Fallback Weakens Security Guarantee

**Severity**: HIGH
**Location**: Lines 785-803, `verify_ed25519_signature`

The code first checks instruction index 0, then falls back to scanning indices 1-3 if index 0 isn't the Ed25519 program. This weakens the stated invariant ("The Ed25519 precompile instruction MUST be at index 0") and creates a wider attack surface for composed transaction attacks.

Additionally, there's a dead-code bug: the `found` variable is declared `false` but never set to `true` — the function returns from inside the loop via early `return`, making the `if !found` check always evaluate to `true`.

**Impact**: An attacker who can submit composed transactions could place the Ed25519 instruction at a non-zero index. While the signature, public key, and message are all verified, accepting instructions from arbitrary indices creates unnecessary risk.

**Recommendation**: Remove the fallback entirely. The relayer controls transaction construction and should always place the Ed25519 instruction at index 0:
```rust
let ed25519_ix = ix_sysvar::load_instruction_at_checked(0, instructions_sysvar)
    .map_err(|_| ErrorCode::NoEd25519Instruction)?;
if ed25519_ix.program_id != ed25519_program::ID {
    return Err(ErrorCode::NoEd25519Instruction.into());
}
```

---

### MEDIUM-01: `init_reborn_collection` Is Permissionless

**Severity**: MEDIUM
**Location**: Lines 115-124, `InitRebornCollection` struct; Lines 390-405

No access control on `init_reborn_collection`. Anyone can pre-create a `RebornCollection` PDA for any `(source_chain, nft_contract)` pair, causing the legitimate relayer's bundled `init_reborn_collection + mint_reborn` transaction to fail (PDA already exists).

**Impact**: Griefing vector — could cause relayer transaction failures.

**Recommendation**: Add signer check using the `MintConfig` admin, or gate behind a known relayer key. The relayer already handles this case (checks PDA existence before adding init instruction), so practical impact is low.

---

### MEDIUM-02: Royalty Configuration Not Included in Signed Message

**Severity**: MEDIUM
**Location**: Lines 428-429, 488-498

`royalty_basis_points` and `dao_treasury` are instruction arguments not included in the signed message (`sha256(token_uri || token_id || receiver)`). The relayer (or anyone with a valid signature) can set arbitrary royalty percentages and treasury addresses. The royalty split is hardcoded 50/50 between `dao_treasury` and `payer` (relayer).

**Impact**: If the relayer is compromised, an attacker could set malicious royalty recipients. Only the first mint's caller controls royalty config for all future mints in a collection.

**Recommendation**: Either include `royalty_basis_points` and `dao_treasury` in the signed message, or store them in the `MintConfig` PDA.

---

### MEDIUM-03: `source_chain` and `nft_contract` Not Included in Signed Message

**Severity**: MEDIUM
**Location**: Lines 736-741, `verify_seal`

The signed message is `sha256(token_uri || token_id || receiver)` — `source_chain` and `nft_contract` are NOT part of the message. A valid signature for minting `(token_uri, token_id, receiver)` could create provenance records under different source chain/contract values. The `sig_record` PDA prevents replay, so only one use succeeds, but this is a defense-in-depth gap.

**Impact**: Low in practice due to sig_record replay protection. The signed message should canonically identify which chain and contract the attestation is for.

**Recommendation**: Include `source_chain` and `nft_contract` in the signed message hash. Requires coordinated update to Sui signing logic.

---

### MEDIUM-04: No Length Delimiters in Message Hash

**Severity**: MEDIUM
**Location**: Lines 736-741, `verify_seal`

Simple concatenation `sha256(token_uri || token_id || receiver)` without length prefixes creates theoretical collision risk between different `token_uri` and `token_id` boundary splits.

**Impact**: Theoretical — PDA constraints and sig_record prevent exploitation, but violates cryptographic best practice.

**Recommendation**: Use length-prefixed encoding:
```rust
hasher.update(&(token_uri.len() as u32).to_le_bytes());
hasher.update(token_uri.as_bytes());
hasher.update(&(token_id.len() as u32).to_le_bytes());
hasher.update(token_id);
hasher.update(receiver_pubkey.as_ref());
```

---

### LOW-01: `CollectionRegistry` Is Unused Dead Code

**Severity**: LOW
**Location**: Lines 245-265

`CollectionRegistry` is defined and `initialize_collection_registry` creates it, but `mint_reborn` never updates the registry. The only call to `add_collection` is in the disabled `seal_and_mint_native` code path.

**Recommendation**: Either integrate into `mint_reborn` or remove entirely.

---

### LOW-02: Anchor Version Mismatch

**Severity**: LOW
**Location**: `Cargo.toml` (0.30.1) vs `Anchor.toml` (0.32.1)

Can cause IDL generation issues, build inconsistencies, or subtle behavioral differences.

---

### LOW-03: Empty `nft_contract` / `token_id` Not Rejected

**Severity**: LOW
**Location**: Line 434

Validates `nft_contract.len() <= MAX_CONTRACT_LENGTH` but not `nft_contract.len() > 0`. Empty values would pass validation and create nonsensical provenance records.

**Recommendation**: Add `require!(!nft_contract.is_empty())` and `require!(!token_id.is_empty())`.

---

### LOW-04: `InitializeMintConfig` Vulnerable to Front-Running

**Severity**: LOW
**Location**: Lines 66-74

Whoever calls `initialize_mint_config` first becomes the permanent admin. On mainnet, an attacker monitoring the mempool could front-run the initialization.

**Recommendation**: Add an `ADMIN_PUBKEY` constant, or deploy and initialize in the same transaction.

---

### LOW-05: No Admin Transfer Mechanism

**Severity**: LOW
**Location**: `MintConfig` struct, `UpdateMintConfig`

`update_mint_config` only updates the `minting_pubkey`, not the `admin` field. Key loss means permanent inability to rotate keys.

**Recommendation**: Add an `update_admin` instruction with a two-step transfer pattern.

---

### LOW-06: `asset` Account Not Explicitly Validated as Uninitialized

**Severity**: LOW
**Location**: Lines 191-193

The `asset` UncheckedAccount has only `#[account(mut)]`. Metaplex Core CPI validates this, but explicit checks would provide clearer errors.

---

### INFO-01: `MetaplexError` Swallows CPI Error Details

**Severity**: INFO
**Location**: Lines 514, 547, 372

All Metaplex CPI calls use `.map_err(|_e| ErrorCode::MetaplexError)?` which discards the original error. Consider `msg!("Metaplex CPI error: {:?}", e)` before converting.

---

### INFO-02: `token_id_to_decimal` Correctly Implemented

**Severity**: INFO (Positive)

The function correctly handles edge cases (all-zeros → "0", >u128 → hex fallback). The 16-byte threshold is correct for u128.

---

## Positive Observations

1. **Thorough signature verification** — verifies all three Ed25519 precompile components (signature bytes, public key, message). Uses `constant_time_eq` to prevent timing attacks.
2. **Dual-layer replay protection** — per-signature PDA + per-NFT provenance PDA provides defense in depth.
3. **Minting pubkey stored on-chain** — loaded from `MintConfig` PDA during verification, preventing attacker key substitution.
4. **Well-structured PDA seeds** — distinct prefixes (`sig_used`, `provenance`, `reborn_collection`, `mint_authority`, `mint_config`) prevent cross-type collisions.
5. **Stack management** — `#[inline(never)]` on `verify_seal`, `Box<Account<...>>` for large types, BPF stack-aware design.
6. **`overflow-checks = true`** in release profile — prevents arithmetic overflow bugs.
7. **`saturating_add` for counters** — prevents overflow panics on `total_minted`.
8. **Program ID constraints** — `#[account(address = mpl_core::ID)]` and `#[account(address = sysvar::instructions::ID)]` prevent substitution attacks.

---

## Summary Table

| # | Severity | Finding |
|---|----------|---------|
| HIGH-01 | HIGH | Ed25519 instruction index fallback weakens security; dead-code bug |
| MEDIUM-01 | MEDIUM | `init_reborn_collection` is permissionless (griefing) |
| MEDIUM-02 | MEDIUM | Royalty config not in signed message |
| MEDIUM-03 | MEDIUM | `source_chain`/`nft_contract` not in signed message |
| MEDIUM-04 | MEDIUM | No length delimiters in message hash |
| LOW-01 | LOW | `CollectionRegistry` unused dead code |
| LOW-02 | LOW | Anchor version mismatch |
| LOW-03 | LOW | Empty inputs not rejected |
| LOW-04 | LOW | `InitializeMintConfig` front-running risk |
| LOW-05 | LOW | No admin transfer mechanism |
| LOW-06 | LOW | `asset` not explicitly validated as uninitialized |
| INFO-01 | INFO | CPI errors swallowed |
| INFO-02 | INFO | `token_id_to_decimal` correct |
