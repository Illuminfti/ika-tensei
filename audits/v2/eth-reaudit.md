# IkaTenseiDeposit.sol Re-Audit Report

**Date:** 2026-02-18  
**Auditor:** Subagent Re-Audit  
**Contract:** `/packages/eth-contracts/src/IkaTenseiDeposit.sol`  
**Status:** FINDINGS BELOW

---

## Summary of Previous Findings

| Issue ID | Description | New Status | Notes |
|----------|-------------|------------|-------|
| C9 | Admin rug pull (timelock, max fee cap) | **PARTIALLY_FIXED** | New issues found |
| H5 | Emergency exit when paused (7-day window) | **NOT_FIXED** | Critical bug - feature broken |
| H7 | dWallet address validation | **FIXED** | Zero address check in place |
| M | Fee change events | **FIXED** | Events properly emitted |

---

## Detailed Findings

### C9: Admin Rug Pull (Timelock, Max Fee Cap)

**Previous:** No timelock or fee cap

**Current Implementation:**
- ✅ MAX_DEPOSIT_FEE = 0.1 ether (line 40)
- ✅ TIMELOCK_DURATION = 2 days (line 43)
- ✅ `proposeChangeOwner` / `executeChangeOwner` with timelock (lines 266-280)
- ✅ `setFee` capped at MAX_DEPOSIT_FEE (line 223)

**NEW ISSUE FOUND:**
- ❌ `setFeeRecipient` (lines 229-235) - **NO timelock**, instant change possible
- ❌ `setWormholeCore` (lines 237-243) - **NO timelock**, instant change possible

**Risk:** Admin could rug pull by changing feeRecipient to their own address or redirecting wormholeCore to malicious contract. While fee has cap, these two critical parameters have no delay.

**Rating:** PARTIALLY_FIXED

---

### H5: Emergency Exit When Paused (7-day Window)

**Previous:** No emergency exit mechanism

**Current Implementation:**
- ✅ `pause()` sets `pausedAt = block.timestamp` (line 256)
- ✅ `emergencyWithdrawERC721` requires 7 days after pause (line 263)
- ✅ Depositor verification via `depositers` mapping (line 264)

**CRITICAL BUG FOUND - NOT FIXED:**

The emergency withdrawal is **fundamentally broken**:

1. During deposit (line 132-133):
```solidity
address dwalletAddr = address(uint160(uint256(dwalletAddress)));
nft.transferFrom(msg.sender, dwalletAddr, tokenId);
```
NFT transfers **directly from depositor → dWallet address**. The contract NEVER takes custody.

2. During emergency withdrawal (line 268):
```solidity
IERC721(nftContract).safeTransferFrom(address(this), to, tokenId);
```
Attempts to transfer FROM the contract, but the contract never held the NFT!

**Result:** Emergency withdrawal will ALWAYS fail - it tries to transfer NFTs the contract doesn't have.

**Additional Issue:** ERC-1155 deposits don't track depositor at all (no `depositers` mapping update), so emergency withdrawal is impossible for ERC-1155s.

**Rating:** NOT_FIXED

---

### H7: dWallet Address Validation

**Previous:** No validation

**Current Implementation:**
- ✅ Zero address check: `require(dwalletAddress != bytes32(0), "Invalid dWallet address");` (line 110)
- Address converted via `address(uint160(uint256(dwalletAddress)))` (line 132)

**Notes:** This is minimal but functional validation. The address format is trusted (no checksum validation in Solidity anyway).

**Rating:** FIXED

---

### M: Fee Change Events

**Previous:** No events for fee changes

**Current Implementation:**
- ✅ `FeeUpdated(uint256 oldFee, uint256 newFee)` - line 71, emitted in `setFee` (line 225)
- ✅ `FeeRecipientUpdated(address oldRecipient, address newRecipient)` - line 75, emitted in `setFeeRecipient` (line 233)
- ✅ `WormholeCoreUpdated(address newWormholeCore)` - line 79, emitted in `setWormholeCore` (line 240)

**Rating:** FIXED

---

## New Issues Introduced by Fixes

### NEW-1: Emergency Withdrawal Unusable (Critical)

**Severity:** CRITICAL  
**Type:** Logic Error

The emergency withdrawal feature cannot work because:
1. NFTs are transferred directly to dWallet, not held by contract
2. ERC-1155 has no depositor tracking at all

**Recommendation:** Either:
- Change deposit flow to transfer NFT to contract first, then to dWallet (enables emergency path)
- Or remove emergency withdrawal as currently implemented (dead code)

---

### NEW-2: Missing Timelock on FeeRecipient / WormholeCore (High)

**Severity:** HIGH  
**Type:** Access Control

While `setFee` has MAX_DEPOSIT_FEE cap and owner changes have timelock, `setFeeRecipient` and `setWormholeCore` allow instant admin changes.

**Recommendation:** Add timelock to these functions:
```solidity
function proposeFeeRecipient(address newFeeRecipient) external onlyOwner { ... }
function executeFeeRecipient() external onlyOwner { ... }
// Same pattern for wormholeCore
```

---

### NEW-3: ERC-1155 Emergency Withdrawal Not Implemented (Medium)

**Severity:** MEDIUM  
**Type:** Feature Incomplete

Only ERC-721 has emergency withdrawal. ERC-1155 deposits don't populate `depositers` mapping.

---

### NEW-4: No Event for Owner Change Execution (Low)

**Severity:** LOW  
**Type:** Missing Event

`executeChangeOwner` doesn't emit an event, making it harder to track ownership changes on-chain.

---

## Final Ratings

| Issue | Previous Status | Current Status |
|-------|-----------------|----------------|
| C9: Admin rug pull | NOT_FIXED | PARTIALLY_FIXED |
| H5: Emergency exit | NOT_FIXED | NOT_FIXED |
| H7: dWallet validation | NOT_FIXED | FIXED |
| M: Fee events | NOT_FIXED | FIXED |

---

## Recommendations Priority

1. **CRITICAL:** Fix emergency withdrawal logic (NEW-1)
2. **HIGH:** Add timelock to feeRecipient and wormholeCore changes (NEW-2)
3. **MEDIUM:** Implement ERC-1155 emergency withdrawal (NEW-3)
4. **LOW:** Add owner change event (NEW-4)
