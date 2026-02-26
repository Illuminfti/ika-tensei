# Audit Report: Ethereum Solidity Contracts

**Package**: `packages/eth-contracts/`
**Compiler**: Solidity 0.8.20 (optimizer enabled, 200 runs, via-ir)
**Purpose**: EVM-side NFT bridging initiation via Wormhole attestations

---

## Contract Inventory

| Contract | File | Lines | Status |
|----------|------|-------|--------|
| SealInitiator (v6) | `contracts/SealInitiator.sol` | 577 | **Active** — production contract |
| IkaTenseiDeposit (v3) | `src/IkaTenseiDeposit.sol` | 518 | **Legacy** — superseded by SealInitiator |
| ISealInitiator | `contracts/interfaces/ISealInitiator.sol` | — | Interface + events |
| IWormhole | `contracts/interfaces/` + `src/interfaces/` | — | Duplicated interface |
| Test suite | `test/SealInitiator.t.sol` | 539 | Foundry tests |
| Scripts | `script/` | — | Deploy + test scripts |

**Overall Assessment**: SealInitiator (v6) is well-designed — permissionless, non-upgradeable, minimal admin surface. IkaTenseiDeposit (v3) has significant issues but appears to be legacy/deprecated.

---

## Findings

### CRITICAL-01: Private Key in `.env` File

**Severity**: CRITICAL
**Location**: `.env` file

The `.env` file contains a plaintext deployer private key. While `.gitignore`d, it's present on disk. If shared or the gitignore is bypassed, the deployer key is exposed.

**Impact**: Full compromise of the deployer account.

**Recommendation**: Rotate this key immediately if it controls any value. Use a hardware wallet, environment variable injection, or secrets manager.

---

### HIGH-01: Emergency Withdraw Does NOT Transfer the NFT Back

**Severity**: HIGH
**Location**: `IkaTenseiDeposit.sol`, lines 400-420

`executeEmergencyWithdraw()` marks the request as executed and emits events, but **never actually transfers the NFT**. The NFT was transferred to the dWallet address in `depositERC721()`, so the contract doesn't hold it. The function is a no-op.

**Impact**: Users relying on emergency withdrawal to recover NFTs will find it non-functional.

**Recommendation**: Remove the feature entirely (since NFTs are at the dWallet address, not in the contract), or redesign to escrow first.

---

### HIGH-02: Emergency Withdraw — No NFT Contract Tracking

**Severity**: HIGH
**Location**: `IkaTenseiDeposit.sol`, lines 382-398

`emergencyWithdrawRequests` is keyed solely by `tokenId` (bare `uint256`), no NFT contract address. Token ID collisions between different NFT contracts are treated as the same request. Anyone can call `requestEmergencyWithdraw(tokenId)` for any token ID.

**Impact**: If the withdraw worked (see HIGH-01), this would allow theft via access control bypass.

**Recommendation**: Key by `keccak256(abi.encodePacked(nftContract, tokenId))` and record depositor at deposit time.

---

### HIGH-03: `transfer()` for ETH Sends — Gas Limit Vulnerability

**Severity**: HIGH
**Location**: `IkaTenseiDeposit.sol`, lines 211-215

Uses `payable(...).transfer(...)` for refunds and fees. `transfer()` forwards only 2300 gas, which fails for smart contract wallets (Gnosis Safe, etc.).

**Impact**: Deposits revert for smart contract wallet users.

**Recommendation**: Use `call{value: amount}("")` with success check, as SealInitiator correctly does.

---

### HIGH-04: Fee Recipient Can DoS All Deposits

**Severity**: HIGH
**Location**: `IkaTenseiDeposit.sol`, line 215

Protocol fee sent to `feeRecipient` synchronously within deposit transaction. If `feeRecipient` reverts on receive, all deposits permanently fail. Combined with 2-day timelock on changing fee recipient = prolonged DoS.

**Impact**: Complete denial of service for all deposit operations.

**Recommendation**: Use pull-based fee withdrawal pattern.

---

### MEDIUM-01: Permanent Seal Lock — No Re-seal After One-Way Bridge

**Severity**: MEDIUM
**Location**: `SealInitiator.sol`, lines 143-147

`sealedNFTs` mapping permanently marks `(nftContract, tokenId)` as sealed. No unseal mechanism. If an NFT is bridged and later returned, it can never be sealed again.

**Impact**: Permanently locks out re-bridging. May be intentional for one-way bridge.

**Recommendation**: If re-sealing is needed, add an admin/oracle-gated `unseal()` function. If one-way is intentional, document prominently.

---

### MEDIUM-02: Hardcoded SOURCE_CHAIN_ID Wrong for Non-Ethereum

**Severity**: MEDIUM
**Location**: `IkaTenseiDeposit.sol`, line 28

`SOURCE_CHAIN_ID = 2` (Ethereum mainnet) but deployed on Base Sepolia (chain 10004). SealInitiator correctly uses `wormhole.chainId()` dynamically.

**Impact**: Incorrect payload data — Sui consumer would misidentify origin chain.

---

### MEDIUM-03: No `nonReentrant` Guard on SealInitiator

**Severity**: MEDIUM
**Location**: `SealInitiator.sol`, lines 136-204

`initiateSeal()` and `initiateSealBatch()` make external calls to Wormhole and ETH refunds without reentrancy protection. Checks-effects-interactions ordering is maintained, but defense-in-depth is missing.

**Recommendation**: Add OpenZeppelin `ReentrancyGuard`.

---

### MEDIUM-04: `receive()` Accepts ETH with No Withdrawal Mechanism

**Severity**: MEDIUM
**Location**: `SealInitiator.sol`, line 563

`receive() external payable {}` accepts direct ETH but there's no admin withdrawal function. ETH sent directly is permanently locked.

**Recommendation**: Add a sweep function or remove the `receive()` if Wormhole refunds can be handled differently.

---

### MEDIUM-05: `_getTokenURI` ABI Decode Can Panic on Malicious Contracts

**Severity**: MEDIUM
**Location**: `SealInitiator.sol`, lines 389-427

When `staticcall` returns `success && data.length > 0`, `abi.decode(data, (string))` is called without verifying proper ABI encoding. A malicious NFT contract returning garbage data causes a panic that prevents sealing.

**Impact**: Malicious/buggy NFT contract can prevent its tokens from being sealed.

**Recommendation**: Wrap `abi.decode` in try-catch or validate encoding length first.

---

### MEDIUM-06: Incomplete `supportsInterface` in IkaTenseiDeposit

**Severity**: MEDIUM
**Location**: `IkaTenseiDeposit.sol`, lines 485-487

Only returns true for `IERC1155Receiver.interfaceId`, not `IERC165.interfaceId` (required by ERC-165 standard).

**Impact**: Some ERC-1155 contracts may reject transfers.

---

### LOW-01: No `solanaReceiver` Zero Check

**Severity**: LOW
**Location**: `SealInitiator.sol`, line 140

`bytes32 solanaReceiver` not checked for `bytes32(0)`. Wasted fees on useless messages.

---

### LOW-02: No `depositAddress` Zero Check

**Severity**: LOW
**Location**: `SealInitiator.sol`, line 139

Similar to LOW-01.

---

### LOW-03: Duplicate IWormhole Interface Definitions

**Severity**: LOW
**Location**: `src/interfaces/IWormhole.sol` and `contracts/interfaces/IWormhole.sol`

Two identical interface files — maintenance risk.

---

### LOW-04: Duplicate ISealInitiator in Test Scripts

**Severity**: LOW
**Location**: `script/TestMilady.s.sol`, `TestMiladyE2E.s.sol`, `TestSeal.s.sol`

Each script redefines `ISealInitiator` locally instead of importing from canonical interface.

---

### LOW-05: One-Step Ownership Transfer

**Severity**: LOW
**Location**: `IkaTenseiDeposit.sol`, line 362

Uses `Ownable` instead of `Ownable2Step`. Typo in proposed owner address = permanent ownership loss.

---

### LOW-06: Redundant `ownerOf` Fallback in `_verifyOwnership`

**Severity**: LOW
**Location**: `SealInitiator.sol`, lines 300-359

Second `ownerOf` call uses `abi.encodeWithSignature` producing same selector as first attempt — redundant.

---

## Positive Observations

1. **SealInitiator is intentionally non-upgradeable** — no admin keys, no proxy pattern, no ownership. Excellent security for a permissionless attestation contract.
2. **Correct use of `call` for ETH refunds** in SealInitiator (line 201).
3. **Gas griefing protections** — `MAX_URI_LENGTH = 2048` and `MAX_BATCH_SIZE = 50`.
4. **Clear wire format documentation** — ASCII table layout in NatSpec comments (lines 13-26).
5. **ERC-1155 `{id}` replacement** handles the full spec correctly with two-pass approach.

---

## Summary Table

| # | Severity | Finding |
|---|----------|---------|
| CRITICAL-01 | CRITICAL | Private key in `.env` on disk |
| HIGH-01 | HIGH | Emergency withdraw is a no-op |
| HIGH-02 | HIGH | Emergency withdraw lacks access control |
| HIGH-03 | HIGH | `transfer()` gas limit DoS |
| HIGH-04 | HIGH | Fee recipient can DoS all deposits |
| MEDIUM-01 | MEDIUM | Permanent seal lock (one-way) |
| MEDIUM-02 | MEDIUM | Wrong hardcoded chain ID |
| MEDIUM-03 | MEDIUM | No reentrancy guard on SealInitiator |
| MEDIUM-04 | MEDIUM | Locked ETH in `receive()` |
| MEDIUM-05 | MEDIUM | ABI decode panic on malicious NFTs |
| MEDIUM-06 | MEDIUM | Incomplete ERC-165 support |
| LOW-01-06 | LOW | Missing zero checks, duplicate interfaces, one-step ownership |

**Note**: HIGH-01 through HIGH-04 all affect `IkaTenseiDeposit` (v3 legacy). If this contract is truly deprecated, consider removing it from the repository entirely.
