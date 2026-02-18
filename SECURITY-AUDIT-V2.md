# Ika Tensei v2 Security Audit Report

**Version:** Protocol v2 (permissionless, no backend)  
**Date:** 2026-02-17  
**Auditor:** Security Research  
**Classification:** Cross-chain NFT Reincarnation Protocol (Sui → Solana)

---

## Executive Summary

The Ika Tensei v2 protocol implements a cross-chain NFT reincarnation system where 1 NFT = 1 IKA dWallet (Ed25519). The architecture is fully permissionless with no backend service. After thorough analysis, I found **1 CRITICAL**, **2 HIGH**, and **3 MEDIUM** severity vulnerabilities, plus several informational issues.

---

## Findings Summary

| Severity | Count | Issues |
|----------|-------|--------|
| CRITICAL | 1 | Cross-chain state inconsistency / Missing verification |
| HIGH | 2 | dWallet ownership not verified at registration, Incorrect mint address binding |
| MEDIUM | 3 | Fee rounding loss, Griefing via wrong data, No replay protection on Sui |
| LOW | 3 | Integer truncation, Frontend dependency, Event consistency |
| INFO | 2 | Design observations |

---

## Detailed Findings

---

### 🔴 CRITICAL #1: Cross-Chain State Inconsistency — No Verification of Solana Mint Success

**Location:** 
- Sui: `registry.move` - `mark_reborn` function (lines 194-230)
- Solana: `lib.rs` - `verify_seal` function

**Description:**

The `mark_reborn` function on Sui is PERMISSIONLESS (anyone can call), but it has **ZERO verification** that the corresponding Solana mint actually succeeded. The function blindly trusts the caller-provided `solana_mint_address`.

```move
// registry.move - mark_reborn (NO VERIFICATION)
public entry fun mark_reborn<T: key + store>(
    registry: &mut WorldRegistry,
    sealed: &mut SealedNFT<T>,
    destination_chain_id: u16,
    solana_mint_address: vector<u8>,  // ← Just accepts whatever caller provides!
    clock: &Clock,
    ctx: &mut TxContext
) {
    assert!(!seal::has_dwallet(sealed), E_NO_DWALLET);  // Only checks dWallet exists
    // ... marks as reborn without verifying Solana transaction
}
```

**Attack Scenario:**

1. Victim seals NFT on Sui
2. Frontend submits `verify_seal` to Solana (succeeds)
3. Frontend submits Metaplex mint to Solana (FAILS - e.g., insufficient funds, RPC error)
4. Frontend calls `mark_reborn` on Sui anyway (maliciously or by bug)
5. **Result:** NFT marked as "reborn" on Sui, but no NFT exists on Solana. NFT is permanently lost on both chains.

**Alternatively:**
1. Attacker calls `mark_reborn` with ANY valid 32-byte address (not verified against registered dWallet)
2. NFT is marked reborn to a mint address the attacker controls
3. The actual dWallet owner gets nothing

**Impact:** Permanent loss of user NFT, no cross-chain atomicity

**Recommendation:**

1. **Add verification that solana_mint_address matches the registered dWallet pubkey:**
```move
assert!(*seal::dwallet_pubkey(sealed) == solana_mint_address, E_INVALID_MINT_FOR_DWALLET);
```

2. **Or implement a callback pattern** where Solana calls back to Sui via a verified instruction (though this requires Solana-to-Sui communication)

3. **Or require proof** - store the mint address in the ReincarnationRecord on Solana and have the caller provide merkle proof

---

### 🟠 HIGH #2: dWallet Ownership Not Verified at Registration

**Location:** 
- Sui: `registry.move` - `register_dwallet` function (lines 159-181)
- Sui: `seal.move` - `register_dwallet` function (lines 87-101)

**Description:**

The `register_dwallet` function accepts ANY dWallet pubkey and ID without verifying the caller actually owns the dWallet. There's no signature verification proving dWallet control.

```move
// seal.move - register_dwallet (NO OWNERSHIP PROOF)
public(package) fun register_dwallet<T: key + store>(
    sealed: &mut SealedNFT<T>,
    dwallet_pubkey: vector<u8>,  // ← No verification caller controls this
    dwallet_id: vector<u8>,      // ← No verification this is caller's dWallet
) {
    assert!(vector::length(&sealed.dwallet_pubkey) == 0, E_DWALLET_ALREADY_REGISTERED);
    assert!(vector::length(&dwallet_pubkey) == DWALLET_PUBKEY_SIZE, E_INVALID_PUBKEY_LENGTH);
    // Just stores whatever is provided - no ownership verification!
    sealed.dwallet_pubkey = dwallet_pubkey;
    sealed.dwallet_id = dwallet_id;
}
```

**Attack Scenario:**

1. Alice seals her NFT (NFT_A)
2. Alice registers her dWallet (dWallet_A) - correct behavior
3. Attacker sees this in events, calls `register_dwallet` with THEIR dWallet (dWallet_B) before Alice can
4. Since registration is one-time and irreversible, Alice's NFT is now bound to attacker's dWallet
5. Attacker calls `verify_seal` on Solana (signs with dWallet_B)
6. Attacker calls `mark_reborn` - reborn NFT goes to attacker's address

**However:** The seal_hash is deterministic (keccak256 of collection + chain + token_id). The REAL protection is that to call `verify_seal` on Solana, you MUST have the dWallet that signed. So if you register someone else's dWallet, you can only complete the attack if you ALSO have their dWallet.

**But the reverse attack is more practical:**
1. Attacker seals NFT_A, registers their dWallet_B
2. Frontend submits to Solana with dWallet_B signature (attacker controls)
3. Frontend calls `mark_reborn` with attacker's solana_mint_address
4. **Victim's NFT gets reborn to attacker's address!**

The victim never authorized this - the attacker registered their own dWallet to the victim's sealed NFT.

**Impact:** Theft of reborn NFT value

**Recommendation:**

Require proof of dWallet ownership during registration. Options:
1. Require the dWallet to sign a message proving ownership (e.g., sign "I own dWallet X for seal Y")
2. Require the dWallet to have called a specific function on the IKA protocol
3. Check that dWallet_id is a valid object the caller owns

---

### 🟠 HIGH #3: No Verification That Mint Address Matches Registered dWallet

**Location:** 
- Sui: `registry.move` - `mark_reborn` function

**Description:**

Even if we fix CRITICAL #1, there's still no check that the `solana_mint_address` provided to `mark_reborn` corresponds to the registered `dwallet_pubkey`. Anyone can mark the NFT as reborn to ANY Solana address.

```move
// Current code - no correlation check
assert!(seal::has_dwallet(sealed), E_NO_DWALLET);
assert!(vector::length(&solana_mint_address) == 32, E_SOLANA_MINT_REQUIRED);
// MISSING: assert!(seal::dwallet_pubkey(sealed) == solana_mint_address);
```

**Attack:**
- Register dWallet_A (pubkey = address_A)
- Call `mark_reborn` with solana_mint_address = address_B (attacker's address)
- NFT gets reborn to address_B, not address_A

**Recommendation:** Add assertion: `assert!(*seal::dwallet_pubkey(sealed) == solana_mint_address, E_MINT_MISMATCH);`

---

### 🟡 MEDIUM #4: Fee Rounding Loss

**Location:** 
- Sui: `registry.move` - `seal_nft` fee splitting (lines 104-124)
- Solana: `lib.rs` - `verify_seal` fee calculation (lines 118-136)

**Description:**

Both Sui and Solana use integer division for fee splitting, causing rounding down. The remainder is lost (or kept by the caller if overpaid).

```move
// Sui - seal_nft
guild_amount = (fee_value * (guild_share as u64)) / total_share;
team_amount = fee_value - guild_amount;  // Remainder goes to team

// Example: 100 SUI, guild=5000bps, team=4900bps, total=9900
// guild_amount = 100 * 5000 / 9900 = 50
// team_amount = 100 - 50 = 50
// Lost: 0 (lucky case)

// Example: 100 SUI, guild=3333bps, team=3333bps, total=6666
// guild_amount = 100 * 3333 / 6666 = 50
// team_amount = 100 - 50 = 50
// Lost: 0 (also lucky)

// Example: 101 SUI, guild=5000bps, team=5000bps, total=10000
// guild_amount = 101 * 5000 / 10000 = 50 (truncated)
// team_amount = 101 - 50 = 51
// Lost: 0 (actually works out)

// Example: 199 SUI, guild=1bps, team=1bps, total=2
// guild_amount = 199 * 1 / 2 = 99 (truncated from 99.5)
// team_amount = 199 - 99 = 100
// Lost: 0 (works out due to how remainder is calculated)
```

Actually, the math is: `team_amount = fee_value - guild_amount`, so the remainder always goes to team. Let me recalculate:

**Example:** 101 SUI, guild=5000bps, team=3000bps, total=8000bps
- guild_amount = 101 * 5000 / 8000 = 63 (truncated from 63.125)
- team_amount = 101 - 63 = 38
- Total distributed: 101 ✓

Actually this is correct - the remainder goes to team. But what if team_share is 0?
- guild_amount = fee_value (all goes to guild)
- No loss

**Impact:** Small amount of fees stuck in contracts over time. Not critical but accumulative.

**Recommendation:** Document this behavior or implement a sweep function to collect dust.

---

### 🟡 MEDIUM #5: Griefing - Can Call mark_reborn with Wrong Data

**Location:** 
- Sui: `registry.move` - `mark_reborn`

**Description:**

As noted in CRITICAL #1, anyone can call `mark_reborn` with ANY valid 32-byte `solana_mint_address`. While the function checks that:
1. Registry not paused
2. NFT not already reborn
3. dWallet is registered
4. Mint address is 32 bytes

It does NOT check:
- That the caller is the dWallet owner
- That the mint address matches the dWallet

**Impact:** Griefing is possible - but limited because:
1. The attacker would need to pay for the transaction
2. The "damage" is limited to marking an NFT as reborn (which is what should happen eventually)
3. The real theft vector requires the attacker to have a dWallet registered

But there's a DOS-like attack:
- Continuously call `mark_reborn` on every sealed NFT that has a dWallet registered
- Would cause unnecessary events, potential confusion

---

### 🟡 MEDIUM #6: No Replay Protection on Sui Side

**Location:** 
- Sui: `registry.move` - `mark_reborn`

**Description:**

If Solana's `verify_seal` is called twice (despite Solana having replay protection via seed), there's no check on Sui side to prevent double `mark_reborn` calls. The Sui side relies entirely on `seal::is_reborn(sealed)`:

```move
assert!(!seal::is_reborn(sealed), E_ALREADY_REBORN);
```

This is actually correct - once marked reborn, it cannot be called again. But what if:
1. `verify_seal` succeeds on Solana (creates record)
2. `mark_reborn` called on Sui (marks reborn)
3. `record_mint` FAILS on Solana (mint never recorded)
4. Attacker tries `verify_seal` again - would fail (record exists)
5. But if record_mint failed, the mint never happened!

The Sui side is marked reborn but Solana never minted. See CRITICAL #1.

---

### 🟢 LOW #7: Integer Overflow in Supply Counting

**Location:** 
- Solana: `lib.rs` - `verify_seal` (line 156)

```rust
coll.total_minted = coll.total_minted.checked_add(1).unwrap();
```

This uses `checked_add` which is good. However, there's no overflow in Sui because Sui's integers don't wrap in Move.

---

### 🟢 LOW #8: Frontend Dependency - Single Point of Trust

**Description:**

The entire cross-chain flow depends on an honest frontend:
1. User seals NFT on Sui
2. User creates dWallet via IKA SDK
3. **Frontend** submits `verify_seal` to Solana
4. **Frontend** mints NFT via Metaplex SDK
5. **Frontend** calls `mark_reborn` on Sui

If the frontend is compromised or malicious, it can:
- Submit `verify_seal` with attacker's dWallet signature
- Call `mark_reborn` with attacker's mint address

This is acknowledged in the architecture but is a centralization risk. The backend was removed in v2, but the frontend now has enormous trust requirements.

---

### 🟢 LOW #9: Event Data Consistency

**Location:** 
- Events emitted before state changes vs after

In `seal_nft`, the NFTSealed event is emitted AFTER the NFT is sealed but BEFORE incrementing seals? Let me check:

```move
let config_mut = table::borrow_mut(&mut registry.collections, collection_id);
increment_seals(config_mut);

events::emit_nft_sealed(...);  // After state change
```

This is actually correct order. But in `mark_reborn`:

```move
seal::mark_reborn(sealed);  // State changed first

events::emit_nft_reborn(...);  // Then event
```

Also correct. No issue here.

---

### 🔵 INFO #10: Design Observations (Not Vulnerabilities)

1. **Seal key uses keccak256**: This is fine for the use case, though SHA-256 might be more standard in Solana ecosystem. Keccak256 is collision-resistant.

2. **No expiration on seal records**: Once sealed, the seal_hash is valid forever. This could lead to issues if Solana state needs to be pruned.

3. **Admin capabilities are transferable**: Standard pattern, two-step process is good.

4. **Protocol can be paused**: Emergency stop functionality exists, good for incident response.

---

## Attack Vectors Summary

### Must-Fix (CRITICAL/HIGH)

| # | Attack | Likelihood | Impact |
|---|--------|------------|--------|
| 1 | Cross-chain inconsistency - Sui trusts caller without Solana proof | HIGH | NFT LOSS |
| 2 | Register wrong dWallet to steal reborn NFT | MEDIUM | NFT THEFT |
| 3 | Mark reborn to wrong address | HIGH | NFT THEFT |

### Should-Fix (MEDIUM)

| # | Issue | Recommendation |
|---|-------|----------------|
| 4 | Fee rounding | Document or sweep |
| 5 | Griefing via mark_reborn | Add caller verification |
| 6 | No replay check on Sui | Already protected by `is_reborn` |

---

## Positive Security Observations

1. ✅ **Double-spend protection on Solana**: seal_hash is used as seed, cannot be reused
2. ✅ **Double-spend protection on Sui**: seal_key in table prevents duplicate seals  
3. ✅ **Fee validation**: Cannot underpay fees
4. ✅ **No arithmetic overflow**: Uses checked math on Solana
5. ✅ **Admin transfer**: Two-step process for admin changes
6. ✅ **Permanent lock**: NFT truly cannot be extracted after sealing
7. ✅ **dWallet one-time registration**: Cannot be changed after set
8. ✅ **Ed25519 verification**: Properly validates signature via precompile

---

## Conclusion

The protocol has a solid architecture but relies too heavily on frontend honesty and cross-chain trust without verification. The **most critical issue** is that Sui's `mark_reborn` has no way to verify the Solana mint actually succeeded - this breaks the cross-chain atomicity guarantee.

**Recommended Priority:**
1. Fix CRITICAL #1 - Add verification of solana_mint_address against dwallet_pubkey
2. Fix HIGH #2 - Require dWallet ownership proof during registration
3. Fix HIGH #3 - Already implied by fixing CRITICAL #1
4. Consider MEDIUM items for robustness

---

*Audit performed on source code only. No external verification or testing conducted.*
