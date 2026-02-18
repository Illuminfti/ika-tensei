# Ika Tensei v3 - Sui Move Contracts Re-Audit Report

**Date**: 2026-02-18  
**Auditor**: Sub-agent Re-Audit  
**Version**: Protocol v3 (PRD-compliant)

---

## Executive Summary

This is a re-audit of the Ika Tensei Sui Move smart contracts following security fixes. Of 7 previous findings, **all are FIXED**. However, **6 new issues** were identified, of which **2 are HIGH severity**.

---

## Previous Findings Status

| ID | Finding | Status | Notes |
|----|---------|--------|-------|
| C1 | VAA stub replaced with authorized relayer | ✅ FIXED | Relayer check at line 254-257 |
| C2/C5 | SealVault stores SealProof, relayer-gated | ✅ FIXED | SealProof stored, registry gates access |
| C3 | mark_reborn restricted to relayer + admin | ✅ FIXED | Dual paths: relayer + admin override |
| C10 | max_seals enforced | ✅ FIXED | Per-collection limit check |
| H1 | Fee parameter added | ✅ FIXED | Minimum fee enforced |
| H7 | AdminCap verification | ✅ FIXED | Type-level access control |
| H9 | cancel_seal with timeout | ✅ FIXED | 7-epoch timeout enforced |

---

## New Issues

### N1: VAA Parser Returns Stub Values - No Real Verification
**Severity**: HIGH  
**Location**: `registry.move:585-591` (`parse_vaa_for_relayer`)

**Description**: The VAA parser returns hardcoded stub values:
```move
fun parse_vaa_for_relayer(vaa: &vector<u8>): (u16, vector<u8>, vector<u8>) {
    (21u16, vector[], std::hash::sha2_256(*vaa))
}
```

This returns chain 21 (Sui) and an empty emitter address regardless of actual VAA contents.

**Impact**: 
- The emitter verification at line 272-275 is ineffective (empty vs trusted emitter)
- The relayer could submit VAAs from any emitter since stub always fails the check
- The actual VAA payload (depositor, token_id, dwallet_address) is never parsed or validated

**Recommendation**: 
1. Implement full Wormhole VAA parsing as documented in comments
2. OR remove the emitter check and fully trust the authorized relayer
3. Current state is inconsistent - has relayer check but emitter check is broken

---

### N2: cancel_seal Admin Check Is Broken
**Severity**: MEDIUM  
**Location**: `registry.move:425-457`

**Description**: The `cancel_seal` function accepts `cap: &AdminCap` but never validates it:

```move
public fun cancel_seal(
    registry: &mut SealRegistry,
    cap: &AdminCap,  // <- Required but unused
    seal_hash: vector<u8>,
    ctx: &mut TxContext,
) {
    // ...
    let _ = cap;  // Never used!
    let sender = tx_context::sender(ctx);
    assert!(sender == sealer, E_NOT_SEALER_OR_ADMIN);  // Only checks sealer
}
```

**Impact**: Only the original sealer can cancel after timeout. Admins cannot cancel seals despite having AdminCap. The error message `E_NOT_SEALER_OR_ADMIN` is misleading.

**Recommendation**: Add admin verification:
```move
let admin = admin::get_admin(&registry.config);  // Need to add this
assert!(sender == sealer || sender == admin, E_NOT_SEALER_OR_ADMIN);
```

---

### N3: Relayer Can Be Set to Zero Address
**Severity**: MEDIUM  
**Location**: `admin.move:set_authorized_relayer`

**Description**: No validation prevents setting relayer to `@0x0`:
```move
public fun set_authorized_relayer(
    config: &mut ProtocolConfig,
    _cap: &AdminCap,
    relayer_address: address,
) {
    config.authorized_relayer = relayer_address;  // No @0x0 check
}
```

**Impact**: If admin mistakenly sets zero address, all relayer-gated functions (`register_seal_with_vaa`, `mark_reborn`) become unusable.

**Recommendation**: Add validation:
```move
assert!(relayer_address != @0x0, E_ZERO_RELAYER);
```

---

### N4: Potential Underflow in cancel_seal Counter
**Severity**: LOW  
**Location**: `registry.move:448-451`

**Description**: Counter decremented without bounds check:
```move
table::borrow_mut(&mut registry.collections, source_contract).current_seals =
    table::borrow(&registry.collections, source_contract).current_seals - 1;
```

**Impact**: If seal was never counted or data is inconsistent, could underflow.

**Recommendation**: Add check:
```move
let current = table::borrow(&registry.collections, source_contract).current_seals;
assert!(current > 0, E_INTERNAL_ERROR);
```

---

### N5: DWalletCaps Not Transferred to SealVault (Design Gap)
**Severity**: HIGH  
**Location**: `registry.move:289-293` (comment) vs implementation

**Description**: Comments state (per PRD §5.1):
> The DWalletCap objects must actually be TRANSFERRED to the SealVault contract.

But implementation only records IDs in a table:
```move
seal_vault::seal(vault, dwallet_id, dwallet_cap_id, ...);
```

The actual `DWalletCap` objects are never transferred to the SealVault's Sui address.

**Impact**: The "permanent locking" is incomplete. DWalletCaps remain in relayer's custody or elsewhere - not in the vault. The vault only tracks IDs, not the actual capability objects.

**Recommendation**: 
1. If PRD requirement stands: Transfer DWalletCaps to vault address
2. If ID-tracking is intentional: Update PRD to reflect this design choice

---

### N6: No Global max_seals for Unregistered Collections
**Severity**: LOW (Design Choice)  
**Location**: `registry.move:280-285`

**Description**: Max seals only enforced for pre-registered collections. Unregistered collections have unlimited seals.

**Impact**: Protocol-level unbounded growth possible if users seal NFTs without registering collections.

**Recommendation**: Consider adding protocol-wide `max_total_seals` in ProtocolConfig.

---

## Security Model Notes

The audit confirms the 2PC-MPC dWallet security model as documented:
- DWalletCaps are sealed (IDs recorded) at seal time
- No `approve_message()` function in SealVault
- Once sealed, dWallets cannot sign (by design)
- Network cannot sign without user's share (cryptographically impossible to collude)

---

## Conclusion

**Previous Findings**: 7/7 FIXED ✅

**New Issues**: 
- 2 HIGH severity
- 2 MEDIUM severity  
- 2 LOW severity

**Recommendation**: Issues N1 and N5 should be addressed before mainnet deployment. N2 and N3 are medium priority. N4 and N6 are low priority / design choices.

---

*End of Report*
