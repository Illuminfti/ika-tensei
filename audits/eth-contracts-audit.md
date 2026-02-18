# IkaTenseiDeposit.sol Security Audit Report

**Contract:** `IkaTenseiDeposit.sol`  
**Lines of Code:** 337  
**Solidity Version:** ^0.8.20  
**Audit Date:** 2026-02-18  
**Severity:** CRITICAL | HIGH | MEDIUM | LOW | INFO  

---

## Executive Summary

The IkaTenseiDeposit contract has **CRITICAL vulnerabilities** that allow a malicious owner to steal all user funds and NFTs. The admin has unlimited power with no timelock, no governance, and no emergency withdrawal for users when paused. Several other HIGH and MEDIUM issues exist.

---

## CRITICAL Vulnerabilities

### 1. Admin Rug Pull - Unlimited Owner Power

**Component:** Access Control / Owner Functions  
**Location:** Lines 188-217 (all admin functions)

**Description:**
The contract uses OpenZeppelin's `Ownable` with NO restrictions. The owner can:

1. **Set arbitrary fee** - Can set `depositFee` to any value (line 188-192)
2. **Change fee recipient** - Can redirect all fees to attacker's address (line 194-199)
3. **Change Wormhole core** - Can point to malicious contract (line 201-206)
4. **Pause forever** - Can lock all deposits indefinitely (line 208-211)

**Impact:**
A malicious or compromised owner can:
- Steal all collected protocol fees
- Set fee to MAX_UINT256, blocking all deposits
- Redirect feeRecipient to attacker-controlled address
- Replace wormholeCore with fake contract to intercept messages

**PoC:**
```solidity
// Attacker deploys contract, then:
function attack() external onlyOwner {
    // 1. Drain all ETH
    payable(owner()).transfer(address(this).balance);
    
    // 2. Set fee recipient to attacker
    feeRecipient = attackerAddress;
    
    // 3. Pause forever - users cannot withdraw
    pause();
}
```

**Recommendation:**
1. Add a **TimelockController** (minimum 24h delay on critical changes)
2. Add **multi-sig** requirement for admin actions
3. Add **emergency withdrawal** function that allows users to retrieve NFTs when paused
4. Add **fee caps** (max depositFee = 1 ETH, etc.)
5. Add **governance module** for critical parameter changes

---

### 2. User Funds Locked When Paused - No Emergency Exit

**Component:** Pausability  
**Location:** Lines 208-214, 104-107, 152-155

**Description:**
When the owner calls `pause()`, all deposits (`depositERC721`, ` depositERC1155`) become blocked via `whenNotPaused` modifier. If the owner:
- Goes offline / loses private key
- Becomes malicious
- Simply forgets to unpause

...users have NO WAY to recover their:
- Excess ETH sent with deposits (refund logic on lines 175-178, 161-164)
- Future deposits that were in mempool

**Impact:**
Permanent loss of user funds. The contract has ~337 lines but zero emergency exit logic.

**Recommendation:**
Add emergency withdrawal functions:
```solidity
function emergencyWithdrawEth() external nonReentrant {
    require(paused(), "Only when paused");
    uint256 balance = address(this).balance;
    require(balance > 0, "No ETH to withdraw");
    // Split proportionally to users who deposited
}
```
OR implement a claim system where users can claim back their sent ETH.

---

### 3. NFT Loss - No dWallet Address Validation

**Component:** ERC-721/ERC-1155 Handling  
**Location:** Lines 108-110, 129-131

**Description:**
The contract transfers NFTs to `dwalletAddress` without verifying:
1. The address can receive ERC-721 tokens (no `onERC721Received` check)
2. The address is not a smart contract that will revert on receive
3. The address is not the zero address (checked, but not the problem)

If a user specifies a wrong dWallet address (typo, non-supporting contract), the NFT is **PERMANENTLY LOST**.

**Impact:**
Users lose their NFTs forever. No recovery mechanism.

**Recommendation:**
Add address capability check:
```solidity
// Before transfer, verify dwalletAddress can receive
// Option 1: Check if it's EOA
require(dwalletAddress.code.length == 0, "dWallet must be EOA");
// Option 2: Support contracts but warn
emit NftTransferWarning(nftContract, tokenId, dwalletAddress);
```

---

## HIGH Vulnerabilities

### 4. Fee Griefing - Owner Can Block All Deposits

**Component:** Fee Handling  
**Location:** Lines 99-101, 134-136

**Description:**
The `depositFee` is checked against `msg.value` at deposit time:
```solidity
require(msg.value >= depositFee + wormholeFee, "Insufficient fee");
```

An owner can:
1. Set `depositFee` to a huge value (e.g., 1000 ETH)
2. All deposits revert with "Insufficient fee"
3. Users cannot deposit even if they have valid NFTs

**Impact:**
DoS attack on the entire protocol by malicious owner.

**Recommendation:**
Add fee caps:
```solidity
uint256 public constant MAX_DEPOSIT_FEE = 1 ether;
function setFee(uint256 newFee) external onlyOwner {
    require(newFee <= MAX_DEPOSIT_FEE, "Fee too high");
    depositFee = newFee;
}
```

---

### 5. Wormhole Fee Griefing - Blocks All Deposits

**Component:** Fee Handling / DoS  
**Location:** Lines 98-101, 133-136

**Description:**
The contract fetches `wormholeFee` dynamically:
```solidity
uint256 wormholeFee = IWormhole(wormholeCore).messageFee();
require(msg.value >= depositFee + wormholeFee, "Insufficient fee");
```

If the Wormhole protocol increases fees (or owner changes wormholeCore to a contract with high fees), ALL deposits fail. Users cannot adjust their msg.value after the fact.

**Impact:**
Protocol becomes unusable if Wormhole fees spike.

**Recommendation:**
Either:
1. Allow users to specify minimum acceptable wormhole fee
2. Add buffer (e.g., `msg.value >= depositFee + wormholeFee + 0.01 ether`)
3. Make wormholeFeeUpdate an event, not a blocking check

---

### 6. ERC-1155 SafeTransferFrom Reentrancy Risk

**Component:** Reentrancy  
**Location:** Lines 141-143

**Description:**
```solidity
nft.safeTransferFrom(msg.sender, dwalletAddress, tokenId, amount, "");
```

This is an external call to a user-controlled contract. While `nonReentrant` modifier is used, the pattern is:
1. Check owner balance
2. External call (safeTransferFrom)
3. Mark nonce used (already done before - good)

**BUT**: The balance check happens BEFORE the transfer:
```solidity
require(nft.balanceOf(msg.sender, tokenId) >= amount, "Insufficient balance");
```

If the ERC-1155 contract is malicious, it could:
- Return true but not actually transfer
- Call back into this contract (blocked by nonReentrant)
- But can call other functions in the same transaction

**Impact:**
If ERC-1155 contract is malicious, it could lie about balance, transfer tokens to different address, etc.

**Recommendation:**
Mark nonce as used BEFORE balance check (move line 140 to before line 138), or use:
```solidity
// Get balance BEFORE
uint256 balanceBefore = nft.balanceOf(msg.sender, tokenId);
require(balanceBefore >= amount, "Insufficient balance");
// Transfer
nft.safeTransferFrom(msg.sender, dwalletAddress, tokenId, amount, "");
// Verify transfer worked
require(nft.balanceOf(msg.sender, tokenId) == balanceBefore - amount, "Transfer failed");
```

---

### 7. No Validation of dWallet Address Ownership

**Component:** Access Control / NFT Handling  
**Location:** Lines 108-110, 129-131

**Description:**
The `dwalletAddress` is assumed to be a valid dWallet controlled by the user. But:
- User could specify someone else's address
- User could specify a burn address (0x000...dead)
- Contract doesn't verify the depositor controls the dWallet

**Impact:**
User loses NFT to wrong address. No verification that dWallet belongs to depositor.

**Recommendation:**
Add depositor verification:
```solidity
require(IDWallet(dwalletAddress).owner() == msg.sender, "Not your dWallet");
```
Or at minimum, emit an event warning about unverified dWallet.

---

## MEDIUM Vulnerabilities

### 8. Refund Can Fail and Block User

**Component:** Fee Handling  
**Location:** Lines 175-178, 161-164

**Description:**
```solidity
if (msg.value > totalFee) {
    payable(msg.sender).transfer(msg.value - totalFee);
}
```

If `msg.sender` is a contract without `receive()` or that reverts on ETH receive, the entire deposit transaction FAILS. User loses their deposit fee AND their NFT might already be transferred.

**Impact:**
User loses both NFT and fee if their address cannot receive ETH.

**Recommendation:**
Use pull-over-push pattern:
```solidity
mapping(address => uint256) public pendingRefunds;
function claimRefund() external {
    uint256 amount = pendingRefunds[msg.sender];
    require(amount > 0, "No pending refund");
    pendingRefunds[msg.sender] = 0;
    payable(msg.sender).transfer(amount);
}
// Instead of direct transfer:
if (msg.value > totalFee) {
    pendingRefunds[msg.sender] += msg.value - totalFee;
}
```

---

### 9. Fee Transfer Can Fail and Block User

**Component:** Fee Handling  
**Location:** Lines 180-182, 166-168

**Description:**
```solidity
payable(feeRecipient).transfer(depositFee);
```

If `feeRecipient` is:
- A contract without `receive()`
- A contract that reverts on ETH receive

Then the ENTIRE deposit transaction fails. The NFT is already transferred, but the transaction reverts. This could trap the NFT in the dWallet while the deposit appears failed.

**Impact:**
Deposit fails, user loses fee, NFT already transferred. Confusing UX and potential fund loss.

**Recommendation:**
Use pull-over-push for feeRecipient too. Or at minimum, wrap in try-catch:
```solidity
try payable(feeRecipient).transfer(depositFee) {} catch {
    // Log failure, allow admin to recover
    emit FeeTransferFailed(depositFee);
}
```

---

### 10. No Event for FeeRecipient Balance Tracking

**Component:** Event Emission  
**Location:** Missing

**Description:**
When fees are collected and transferred (lines 180-182, 166-168), there's no event emitted. Off-chain systems cannot track:
- When fees were collected
- How much was collected
- Fee recipient balance changes

**Recommendation:**
Add event:
```solidity
event FeeCollected(address indexed feeRecipient, uint256 amount);
```
Emit this before transfer.

---

### 11. Wormhole Message Not Stored - No Off-Chain Verification

**Component:** Wormhole Integration  
**Location:** Lines 115-124, 146-155

**Description:**
The `wormholeSequence` is returned to the caller but NOT stored on-chain. Users cannot:
- Prove they made a deposit on another chain
- Verify their VAA was published
- Dispute failed cross-chain transfers

**Impact:**
No on-chain proof of Wormhole message. Relies entirely on off-chain tracking.

**Recommendation:**
Store published messages:
```solidity
mapping(uint64 => bytes32) public publishedMessages;
mapping(bytes32 => bool) public messagePublished;

function publishMessage(...) internal returns (uint64 sequence) {
    sequence = IWormhole(wormholeCore).publishMessage{value: wormholeFee}(...);
    publishedMessages[sequence] = keccak256(payload);
    messagePublished[keccak256(payload)] = true;
}
```

---

### 12. Nonce Size - Potential Exhaustion

**Component:** Integer / DoS  
**Location:** Lines 47, 138, 139

**Description:**
`sealNonce` is `bytes32` (unlimited entries). An attacker could:
1. Call deposit with many different nonces (marking them as used)
2. Fill the `usedNonces` mapping
3. Increase gas costs for all future deposits

**Impact:**
While expensive, this could increase storage costs over time.

**Recommendation:**
Consider adding nonce expiration or batch cleanup:
```solidity
uint256 public constant NONCE_EXPIRY = 1000 blocks;
mapping(bytes32 => uint256) public nonceBlock;
```

---

## LOW Vulnerabilities

### 13. Front-Running Risk on Deposits

**Component:** Front-Running  
**Location:** Lines 107-110

**Description:**
When user submits deposit:
1. Checks `nft.ownerOf(tokenId) == msg.sender`
2. Transfers to dWallet

MEV bots could front-run by:
1. Seeing pending deposit transaction
2. Depositing to SAME dWallet first
3. Getting the sequence number first

**Impact:**
User gets second deposit, potentially confusing. But no direct theft since NFT goes to same dWallet.

**Recommendation:**
This is acceptable risk - NFT still ends up in user's dWallet.

---

### 14. onERC721Received Not Implemented

**Component:** ERC-721/ERC-1155 Handling  
**Location:** Missing

**Description:**
Contract implements `onERC1155Received` but NOT `onERC721Received`. If this contract ever receives NFTs directly, it cannot claim them.

**Impact:**
Low - contract shouldn't receive NFTs directly.

**Recommendation:**
Add for completeness:
```solidity
function onERC721Received(
    address,
    address,
    uint256,
    bytes calldata
) external pure override returns (bytes4) {
    return this.onERC721Received.selector;
}
```

---

### 15. No Zero Address Check for dWallet

**Component:** Input Validation  
**Location:** Lines 97, 132

**Description:**
```solidity
require(dwalletAddress != address(0), "Invalid dWallet address");
```

This check exists. ✓

---

## INFO Observations

### 16. Constants Properly Named

**Component:** Code Quality  
**Location:** Lines 17-30

**Description:**
`WORMHOLE_MAINNET`, `WORMHOLE_SEPOLIA`, `SOURCE_CHAIN_ID`, `CONSISTENCY_LEVEL` are all constants. Good practice.

---

### 17. Nonce Replay Protection

**Component:** Security  
**Location:** Lines 137-140

**Description:**
Nonces are checked and marked as used before external calls. Good pattern.

---

### 18. Solidity 0.8+ Overflow Protection

**Component:** Security  
**Location:** Entire contract

**Description:**
Using Solidity ^0.8.20 with built-in overflow checks. No manual overflow checks needed.

---

## Summary Table

| Severity | Issue | Component | Line |
|----------|-------|-----------|------|
| CRITICAL | Admin rug pull | Access Control | 188-217 |
| CRITICAL | Funds locked when paused | Pausability | 208-214 |
| CRITICAL | NFT loss - no dWallet validation | ERC-721/1155 | 108-143 |
| HIGH | Fee griefing | Fee Handling | 99, 188 |
| HIGH | Wormhole fee griefing | Fee Handling | 98-101 |
| HIGH | Reentrancy on balance check | Reentrancy | 138-143 |
| HIGH | No dWallet ownership verification | Access Control | 97-110 |
| MEDIUM | Refund can fail | Fee Handling | 175-178 |
| MEDIUM | Fee transfer can fail | Fee Handling | 180-182 |
| MEDIUM | No fee collection events | Event Emission | Missing |
| MEDIUM | No message storage | Wormhole | 146-155 |
| MEDIUM | Nonce exhaustion | DoS | 47 |
| LOW | Front-running | MEV | 107-110 |
| LOW | No onERC721Received | ERC-721 | Missing |

---

## Attack Vectors Summary

### As Malicious Owner:
1. Set fee to MAX_UINT256 → All deposits blocked
2. Change feeRecipient to attacker → Steal all fees
3. Change wormholeCore to fake → Intercept all messages
4. Pause forever → Users cannot deposit or withdraw
5. Set high wormholeCore messageFee → Block all deposits

### As Attacker (External):
1. Deploy malicious ERC-1155 → Drain user balances via reentrancy
2. Send NFTs to wrong dWallet address → Lose NFTs permanently
3. Fill nonces mapping → Increase gas costs
4. Send dust ETH to contract → Increase feeRecipient balance (dust attack)

### As User Error:
1. Wrong dWallet address → NFT permanently lost
2. Send ETH without enough for fees → Transaction fails
3. Contract as msg.sender without receive() → Cannot get refunds

---

## Recommendations Priority

1. **IMMEDIATE**: Add TimelockController for admin functions
2. **IMMEDIATE**: Add emergency withdrawal for paused state
3. **HIGH**: Add fee caps
4. **HIGH**: Use pull-over-push for refunds and fees
5. **HIGH**: Validate dWallet address is capable of receiving
6. **MEDIUM**: Add events for fee collection
7. **MEDIUM**: Store wormhole messages on-chain
8. **LOW**: Add onERC721Received for completeness
