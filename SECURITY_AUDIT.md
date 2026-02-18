# Ika Tensei Security Audit

**Version:** v2 (permissionless, no backend)  
**Date:** 2026-02-17  
**Auditor:** Security Review  
**Classification:** Cross-chain NFT Reincarnation Protocol  

---

## Executive Summary

Ika Tensei is a cross-chain NFT reincarnation protocol where users lock an NFT on Sui, register an IKA dWallet (Ed25519), and mint a corresponding NFT on Solana. The architecture is permissionless with no backend—frontend-driven.

**Overall Risk Rating: HIGH**

The protocol has fundamental design issues in cross-chain state synchronization, permissionless `mark_reborn` on Sui, and Ed25519 verification vulnerabilities. Several attack vectors can lead to theft of reborn NFTs or theft of fees.

---

## 1. Double-Mint Prevention

### 1.1 Sui Side

**Mechanism:**
- `seal_nft` (registry.move:142): Checks `!table::contains(&registry.sealed_nfts, seal_key)` with `E_ALREADY_SEALED`
- `mark_reborn` (registry.move:233): Checks `!seal::is_reborn(sealed)` with `E_ALREADY_REBORN`

**Assessment:** ✅ Adequate. The seal_key is deterministic (`keccak256(collection_id || chain_id || token_id)`), preventing duplicate seals.

### 1.2 Solana Side

**Mechanism:**
- `verify_seal` (lib.rs:89): PDA seed `[RECORD_SEED, seal_hash]`—init fails if exists
- `record_mint` (lib.rs:148): Checks `!record.minted`

**Assessment:** ✅ Adequate. PDA uniqueness enforced at program level.

### 1.3 Cross-Chain Gap

**CRITICAL ISSUE FOUND:**

Sui's `mark_reborn` and Solana's `verify_seal` operate independently. There is **no cross-chain proof verification**:

- Sui `mark_reborn` accepts ANY `solana_mint_address` without verifying:
  - A corresponding `ReincarnationRecord` exists on Solana
  - The `dwallet_signer` in the record matches Sui's registered dWallet
  - The record was created by the legitimate user

**Attack scenario:**
1. User seals NFT on Sui, registers their dWallet
2. User calls `verify_seal` on Solana (or attacker frontruns)
3. Attacker calls `mark_reborn` on Sui with attacker's own `solana_mint_address`
4. Sui marks NFT as reborn with attacker's mint address
5. Both users have "valid" state on respective chains

---

## 2. Ed25519 Verification

### 2.1 Code Review (lib.rs:196-247)

```rust
fn verify_ed25519_signature(
    instructions_sysvar: &AccountInfo,
    expected_signer: &Pubkey,
    expected_message: &[u8; 32],
) -> Result<()> {
    let current_ix = ix_sysvar::load_current_index_checked(instructions_sysvar)?;
    require!(current_ix > 0, ...);
    
    let ed25519_ix = ix_sysvar::load_instruction_at_checked(
        (current_ix - 1) as usize,  // ← ASSUMPTION: ed25519 is at index - 1
        instructions_sysvar,
    )?;
```

### 2.2 Vulnerability: Instruction Ordering Assumption

**Severity: HIGH**

The code assumes the Ed25519 instruction is at `current_ix - 1`. An attacker can craft a transaction with:

1. Legitimate Ed25519 signature from attacker's dWallet on seal_hash
2. A second Ed25519 instruction (dummy, invalid signature)
3. `verify_seal` instruction

**Problem:** The code will parse the FIRST Ed25519 instruction (index 0), not the one immediately preceding `verify_seal`. The check at line 213 only validates `program_id == ed25519_program::ID`, not position.

### 2.3 Vulnerability: Offset Parsing

**Severity: MEDIUM**

```rust
let pubkey_offset = u16::from_le_bytes([data[6], data[7]]) as usize;
let msg_offset = u16::from_le_bytes([data[10], data[11]]) as usize;
let msg_size = u16::from_le_bytes([data[12], data[13]]) as usize;
```

The offsets are read directly from attacker-controlled instruction data:

- `pubkey_offset + 32 <= data.len()` — bounds check exists (line 225)
- `msg_offset + 32 <= data.len()` — bounds check exists (line 234)

**Assessment:** ✅ Bounds checks are present. However, the code trusts `num_signatures` from `data[0]` without validating the signature count matches the actual Ed25519 instruction structure. Malformed instructions could cause unexpected behavior.

### 2.4 msg_size Check

```rust
require!(msg_size == 32, errors::IkaTenseiError::InvalidSignature);
```

**Assessment:** ✅ Correctly enforces 32-byte message (seal_hash).

---

## 3. Fee Extraction

### 3.1 Sui Fee Splitting (registry.move:161-185)

```rust
let guild_share = (fee_value * (guild_share_bps as u64)) / total_share;
let team_amount = fee_value - guild_share;
```

**Assessment:** ✅ No overflow possible. `guild_share_bps + team_share_bps <= 10000` enforced at registry creation (line 66).

### 3.2 Solana Fee Extraction (lib.rs:107-132)

```rust
let guild_share = mint_fee
    .checked_mul(config.guild_share_bps as u64)
    .unwrap()
    / 10_000;
let team_share = mint_fee.checked_sub(guild_share).unwrap();
```

**Assessment:** ✅ `checked_mul` prevents overflow. `unwrap()` only called after multiplication, not during.

### 3.3 Fee Bypass Vector

**Severity: MEDIUM**

The fee is paid by the `payer` in `verify_seal`. If `mint_fee = 0`, fees are bypassed entirely. While this is intentional for free mints, there's no minimum fee enforcement.

---

## 4. Admin Privilege Escalation

### 4.1 Sui: Two-Step Transfer

**Mechanism:**
- `propose_admin_transfer` (ikatensei.move:63): Creates proposal
- `accept_admin_transfer` (ikatensei.move:77): New admin must call to accept

**Assessment:** ✅ Secure. Two-step process with proposal storage.

### 4.2 Solana: Single-Step Transfer

**Mechanism (lib.rs:185-189):**
```rust
pub fn transfer_authority(
    ctx: Context<AdminOnly>,
    new_authority: Pubkey,
) -> Result<()> {
    ctx.accounts.config.authority = new_authority;
    Ok(())
}
```

**Severity: MEDIUM**

Single-step transfer. If admin key is compromised, attacker gains full control instantly. No notification to new authority, no acceptance required.

**Recommendation:** Implement two-step transfer matching Sui's design.

---

## 5. Seal Key Predictability

### 5.1 Seal Key Generation (seal.move:115-128)

```rust
public fun create_seal_key(
    collection_id: vector<u8>,
    source_chain_id: u16,
    token_id: u64
): vector<u8> {
    let mut raw_key = vector::empty<u8>();
    vector::append(&mut raw_key, collection_id);
    let chain_bytes = bcs::to_bytes(&source_chain_id);
    vector::append(&mut raw_key, chain_bytes);
    let token_bytes = bcs::to_bytes(&token_id);
    vector::append(&mut raw_key, token_bytes);
    keccak256(&raw_key)
}
```

### 5.2 Front-Running Analysis

**Severity: MEDIUM**

The seal_key is deterministic. An attacker monitoring the blockchain can:

1. See `NFTSealed` event with `seal_key`, `collection_id`, `source_chain_id`, `token_id`
2. Precompute the seal_key
3. Call `verify_seal` with attacker's dWallet BEFORE the legitimate user

**Mitigation:** The legitimate user's dWallet must sign the seal_hash. Even if attacker calls `verify_seal` first, they create a record with THEIR dWallet as `dwallet_signer`. The reborn NFT goes to the attacker's address, not the victim's.

**Actual Risk:** **FRONT-RUNNING CAN STEAL THE REBORN NFT.** The first caller of `verify_seal` wins the dWallet assignment.

---

## 6. PDA Grinding

### 6.1 PDA Seeds

- **Config:** `[CONFIG_SEED]` — constant, no grinding
- **Collection:** `[COLLECTION_SEED, source_chain.to_le_bytes(), source_contract]` — admin-controlled
- **Record:** `[RECORD_SEED, seal_hash]` — seal_hash is keccak256 output

**Assessment:** ✅ No grinding possible. seal_hash is cryptographically random (keccak256 output).

---

## 7. Race Conditions

### 7.1 verify_seal + record_mint Separation

**Severity: HIGH**

`verify_seal` and `record_mint` are separate transactions:

1. `verify_seal` creates `ReincarnationRecord` with `minted = false`
2. Frontend mints NFT via Metaplex
3. Frontend calls `record_mint` to set `minted = true` and record mint address

**Problems:**

1. **If record_mint is never called:** Record exists with `minted = false`. NFT is minted on-chain but not linked. State inconsistency.

2. **If record_mint is called twice:** Second call will fail (line 150: `require!(!record.minted)`). This is actually correct.

3. **Who can call record_mint?** Only `authority` (lib.rs:143). If authority is compromised, they can link ANY mint address to ANY record.

### 7.2 Sui: Front-Running dWallet Registration

**Severity: CRITICAL**

dWallet registration on Sui is NOT atomic with seal creation:

1. User calls `seal_nft` → gets SealedNFT
2. User calls `register_dwallet` → registers their dWallet

Between steps 1 and 2, an attacker can:
1. Watch for `NFTSealed` event
2. Call `register_dwallet` with attacker's dWallet (sealed NFT is owned by user, but registry is separate)
3. Wait for user to call verify_seal on Solana

**Problem:** The registry's `register_dwallet` checks the sealed NFT exists in the table, but NOT that the caller owns the SealedNFT. Looking at registry.move:201:

```rust
public entry fun register_dwallet<T: key + store>(
    registry: &WorldRegistry,
    sealed: &mut SealedNFT<T>,
    ...
) {
    // Only checks sealed is in registry table, NOT caller ownership
    let seal_key = seal::create_seal_key(...);
    assert!(table::contains(&registry.sealed_nfts, seal_key), E_NOT_REGISTERED);
    ...
    seal::register_dwallet(sealed, dwallet_pubkey, dwallet_id);
}
```

Wait—`seal::register_dwallet` is called on the `sealed` object passed in. The entry function receives `sealed: &mut SealedNFT<T>`, meaning the caller MUST own the SealedNFT object. In Sui, you can only pass objects you own to entry functions.

**Correction:** ✅ The SealedNFT ownership is enforced by Sui's object system. Attacker cannot pass someone else's SealedNFT.

However, there's still a race on the Solana side (see section 7.1).

---

## 8. Missing Access Control

### 8.1 Sui: mark_reborn Permissionless

**Severity: CRITICAL**

```rust
public entry fun mark_reborn<T: key + store>(
    registry: &mut WorldRegistry,
    sealed: &mut SealedNFT<T>,
    destination_chain_id: u16,
    solana_mint_address: vector<u8>,  // ← ANY VALUE ACCEPTED
    clock: &Clock,
    ctx: &mut TxContext
) {
    assert!(!seal::is_reborn(sealed), E_ALREADY_REBORN);
    assert!(seal::has_dwallet(sealed), E_NO_DWALLET);
    assert!(vector::length(&solana_mint_address) == 32, E_SOLANA_MINT_REQUIRED);
    // NO VERIFICATION OF:
    // - Does a ReincarnationRecord exist on Solana?
    // - Does the record's dwallet_signer match this seal's dwallet?
    // - Was verify_seal called by the legitimate user?
    seal::mark_reborn(sealed);
    ...
}
```

The comment says "The Solana program independently verifies the seal via ed25519 sig" but Sui NEVER verifies this. Sui blindly trusts whatever `solana_mint_address` is provided.

**Attack:** Anyone can call `mark_reborn` after `verify_seal` succeeds, setting the mint address to ANY value.

### 8.2 Solana: verify_seal Permissionless

**Severity: HIGH**

Anyone can call `verify_seal`. First caller wins (front-running). The `recipient` account is set from `ctx.accounts.recipient.key()`, which is any account the caller provides.

**Gap:** There's no verification that:
- The caller owns the corresponding SealedNFT on Sui
- The seal_hash was generated by the legitimate user

### 8.3 record_mint Requires Authority

**Severity: INFO**

Only authority can call `record_mint`. This is correct to prevent spoofing, but creates centralization risk.

---

## 9. Critical Protocol Invariants

### 9.1 Invariants That MUST Hold

| # | Invariant | Status | Notes |
|---|-----------|--------|-------|
| 1 | Every sealed NFT on Sui maps to at most one ReincarnationRecord on Solana | ⚠️ BROKEN | First `verify_seal` caller wins; no proof of ownership |
| 2 | 1 SealedNFT = 1 dWallet | ✅ HOLD | Enforced by `register_dwallet` one-time only |
| 3 | Reborn NFT owner = dWallet's Ed25519 pubkey | ⚠️ BROKEN | Front-running can steal this |
| 4 | Fees sum to total | ✅ HOLD | checked arithmetic |
| 5 | seal_key uniqueness | ✅ HOLD | keccak256 collision-resistant |
| 6 | No double-sealing | ✅ HOLD | Table check |
| 7 | No double-reborn | ✅ HOLD | reborn flag check |

### 9.2 Cross-Chain Invariants (BROKEN)

| # | Invariant | Status | Notes |
|---|-----------|--------|-------|
| 8 | If Sui marks NFT reborn, Solana has corresponding record | ❌ BROKEN | No cross-chain proof |
| 9 | If Solana record exists, Sui sealed NFT has matching dWallet | ❌ BROKEN | No verification |
| 10 | mark_reborn only accepts valid Solana mint | ❌ BROKEN | No verification |

---

## 10. Recommendations

### Critical (Fix Immediately)

| Issue | Recommendation | Affected |
|-------|----------------|----------|
| Cross-chain verification missing | Add Merkle proof or cross-chain message verification to `mark_reborn` | Sui |
| Front-running steals NFTs | Add commitment scheme: user commits to dWallet BEFORE seal, then reveals | Both |
| record_mint authority single point | Require signature from dWallet, not just authority | Solana |

### High Priority

| Issue | Recommendation | Affected |
|-------|----------------|----------|
| Ed25519 instruction position | Verify ed25519 ix is at exactly current_ix - 1, not just any ed25519 ix | Solana |
| transfer_authority single-step | Implement two-step transfer with acceptance | Solana |

### Medium Priority

| Issue | Recommendation | Affected |
|-------|----------------|----------|
| No minimum fee | Add `min_mint_fee` to ProtocolConfig | Solana |
| record_mint never called | Add timeout/cleanup for unclaimed records | Both |
| Front-running dWallet registration | Atomic seal + dWallet registration in single tx | Sui |

### Low/Informational

| Issue | Recommendation | Affected |
|-------|----------------|----------|
| No event indexer requirement | Document that off-chain indexer required for UI | Docs |
| collection_id not validated | source_contract is admin-controlled, ensure uniqueness | Solana |

---

## Summary Table

| Category | Severity | Issues |
|----------|----------|--------|
| Cross-Chain Sync | CRITICAL | 3 |
| Ed25519 Verification | HIGH | 2 |
| Access Control | CRITICAL | 2 |
| Race Conditions | HIGH | 2 |
| Fee Extraction | MEDIUM | 1 |
| Admin Privilege | MEDIUM | 1 |
| Seal Predictability | MEDIUM | 1 |
| Double-Mint Prevention | INFO | 0 |

---

## Appendix: Test Coverage Gaps

The existing test file (`ika_tensei.rs`) only tests PDA derivation and serialization. Missing:

1. ❌ Ed25519 verification with malicious instruction ordering
2. ❌ Front-running `verify_seal` with different dWallets
3. ❌ `mark_reborn` with spoofed solana_mint_address
4. ❌ Fee overflow/underflow bounds
5. ❌ Two-step admin transfer on Sui vs single-step on Solana

---

*End of Audit*
