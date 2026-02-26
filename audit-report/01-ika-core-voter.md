# Audit Report: ika-core-voter (Anchor Program)

**File**: `packages/solana-program/ika-core-voter/programs/ika-core-voter/src/lib.rs`
**Lines**: ~380
**Program ID**: `E5thJCWofTMbmyhUhCai3hZiruFtYmmscDio6GwFCGaW`
**Purpose**: Lightweight SPL Governance voter weight plugin for Metaplex Core assets (1 NFT = 1 vote)

---

## Summary

The program implements a voter weight plugin for SPL Governance that allows Metaplex Core NFT holders to vote in Realms DAOs. It provides 5 instructions: `create_registrar`, `configure_collection`, `create_voter_weight_record`, `update_voter_weight_record`, and `create_max_voter_weight_record`. The program verifies Core asset ownership by parsing raw account bytes at fixed offsets.

**Overall Assessment**: Functional for devnet/testnet use. Several security issues must be addressed before mainnet deployment.

---

## Findings

### CRITICAL-01: Realm Authority Not Validated Against Realm Account Data

**Severity**: CRITICAL
**Location**: `create_registrar`, `configure_collection`

The `realm_authority` signer is never validated against the actual realm account's stored authority. Any signer can pass themselves as `realm_authority` and create a registrar or configure collections for any realm. The realm account is passed as `UncheckedAccount` with no deserialization or ownership verification.

**Impact**: An attacker could create a fraudulent registrar for a legitimate realm, potentially allowing unauthorized collections to influence governance votes.

**Recommendation**: Deserialize the realm account using SPL Governance's layout and verify that `realm_authority` matches the stored `authority` field.

---

### HIGH-01: Duplicate NFT Counting in remaining_accounts

**Severity**: HIGH
**Location**: `update_voter_weight_record` (line ~280-320)

When iterating `remaining_accounts` to count NFTs, the same asset account can be passed multiple times. There is no deduplication check. A voter with 1 NFT could pass the same account 10 times and get `voter_weight = 10`.

**Impact**: Vote weight inflation — a single NFT holder can claim arbitrary voting power.

**Recommendation**: Track seen asset pubkeys in a `BTreeSet` or sorted array and skip/reject duplicates:
```rust
let mut seen = std::collections::BTreeSet::new();
for asset_info in ctx.remaining_accounts.iter() {
    if !seen.insert(asset_info.key()) {
        continue; // or return error
    }
    // ... verify ownership
}
```

---

### HIGH-02: Missing Realm Account Ownership Check

**Severity**: HIGH
**Location**: `create_registrar`, `configure_collection`

The `realm` account is typed as `UncheckedAccount` with only a `/// CHECK: validated by seeds` comment. However, no actual validation occurs — the account's `owner` program is never checked. An attacker could pass a system-owned account at the correct PDA address.

**Impact**: Allows creating registrars with fake realm accounts.

**Recommendation**: Add `constraint = realm.owner == &governance_program_id` or verify the realm account's owner matches the SPL Governance program.

---

### MEDIUM-01: Missing Governance Program Executable Check

**Severity**: MEDIUM
**Location**: `create_registrar`

The `governance_program_id` stored in the Registrar is taken from an unchecked account. It's never verified to be an executable program, let alone the SPL Governance program.

**Recommendation**: Add `constraint = governance_program.executable` on the governance program account, or hardcode the expected SPL Governance program ID.

---

### MEDIUM-02: No Mechanism to Remove Collections

**Severity**: MEDIUM
**Location**: Program-wide

`configure_collection` can add collections to the registrar but there's no instruction to remove a collection. If a collection is compromised or needs to be deprecated, there's no way to revoke its voting privileges.

**Recommendation**: Add a `remove_collection` instruction gated by `realm_authority`.

---

### MEDIUM-03: No Update Mechanism for Max Voter Weight Record

**Severity**: MEDIUM
**Location**: `create_max_voter_weight_record`

The max voter weight record is created with `max_voter_weight = u64::MAX` and can never be updated. While this is acceptable for Metaplex Core collections (no fixed supply cap), it prevents any future adjustment.

**Recommendation**: Consider adding an `update_max_voter_weight_record` instruction.

---

### MEDIUM-04: Registrar Collections Vec Unbounded Reallocation

**Severity**: MEDIUM
**Location**: `configure_collection`

The `collections` vector in the Registrar has a max of 10 entries (enforced by `require!(registrar.collections.len() < 10)`), but the account space is allocated with `8 + 32 + 32 + 32 + 4 + (10 * 40)` = 512 bytes at init. This is fine, but if the max is ever increased without a realloc, it would silently fail.

**Recommendation**: Minor — document the 10-collection limit clearly or use `#[max_len(10)]` Anchor attribute.

---

### LOW-01: Voter Weight Expires at Current Slot

**Severity**: LOW
**Location**: `update_voter_weight_record` (line ~310)

`voter_weight_expiry = Some(Clock::get()?.slot)` means the weight expires in the same slot it's set. This is by design (forces update_voter_weight_record to be in the same transaction as the governance action), but it's very strict. Any slot advancement between signing and landing would invalidate the weight.

**Impact**: Minimal in practice since Solana transactions are atomic, but could cause issues with preflight simulation on a different slot.

---

### LOW-02: No `close` Instructions for PDAs

**Severity**: LOW
**Location**: Program-wide

None of the PDAs (Registrar, VoterWeightRecord, MaxVoterWeightRecord) have close instructions. Rent-exempt SOL locked in these accounts cannot be reclaimed.

**Recommendation**: Add `close_voter_weight_record` for users who want to reclaim rent.

---

### LOW-03: Anchor Toolchain Version Mismatch

**Severity**: LOW
**Location**: `Cargo.toml`

Using `anchor-lang = "0.30.1"` while the deploy used Anchor CLI 0.31.x. Minor version mismatches can cause subtle issues.

---

### LOW-04: blake3 Dependency Unused

**Severity**: LOW
**Location**: `Cargo.toml`

`blake3 = "=1.5.5"` is pinned in dependencies but never used in the program code. It was added to work around a cargo-build-sbf compilation issue with edition 2024 crates.

**Recommendation**: Remove if build succeeds without it, or document why it's needed.

---

### INFO-01: Hardcoded Byte Offsets for Core Asset Parsing

**Severity**: INFO
**Location**: `verify_core_nft_ownership` (line ~340-370)

The function parses Metaplex Core asset data at fixed byte offsets (0, 1-32, 33, 34-65). This is correct for the current Core v1 asset layout but would break if Metaplex changes the binary format.

**Note**: This is acceptable given Core's stability guarantees, but worth noting.

---

### INFO-02: SPL Governance Discriminators Correctly Implemented

**Severity**: INFO (Positive)

The VoterWeightRecord and MaxVoterWeightRecord use Anchor's `#[account]` attribute which generates `SHA256("account:StructName")[..8]` discriminators. These match what SPL Governance v3 expects. Verified correct.

---

## Positive Observations

1. Correct Metaplex Core binary parsing (Key=1, owner at bytes 1-32, UA discriminant=2 at byte 33, collection at 34-65)
2. Proper PDA derivation matching SPL Governance conventions
3. Checked arithmetic throughout (no overflow risks)
4. Voter is required signer in update_voter_weight_record
5. VoterWeightRecord fields match SPL Governance interface exactly
6. Correct use of `init` vs `init_if_needed` (all use `init`, preventing reinitialization)
