# Ika Tensei Relayer & Shared Library Security Audit

**Audit Date:** 2026-02-18  
**Scope:** Relayer (2,188 LOC) + Shared Library (2,283 LOC)  
**Auditor:** Security Subagent  
**Classification:** CONFIDENTIAL - Internal Only

---

## Executive Summary

The Ika Tensei relayer and shared library contain **CRITICAL** security vulnerabilities that could lead to:
- Complete protocol compromise via key extraction
- Double-minting of reborn NFTs
- Unauthorized DAO creation
- SQL injection (mitigated by parameterized queries)
- Privacy leakage via health endpoint

**Overall Risk Rating: HIGH**

---

## CRITICAL Vulnerabilities

### 1. Hardcoded Production Keys in config.ts

**File:** `packages/relayer/src/config.ts` (lines 240-250)

```typescript
const dwalletCapId = env.DWALLET_CAP_ID || '0xae22f56a0c471eb338be0e5103c074a7a76b86271ca0c90a9f6e508d5741d7fa';
const dwalletId = env.DWALLET_ID || '0x36ada1f568e2f8aa89590d0157db5732d5ade4080dbf34adddb4e52788a39a32';
const encryptedShareId = env.ENCRYPTED_SHARE_ID || '0x09988d0cc971bf6f47c3d21247e4aa391a22f9d2c21995c87dcfbd0ca34287dc';
const dwalletPubkeyHex = env.DWALLET_PUBKEY_HEX || '46453f6becb294253dd798a96d86bf62871239aeda8d67d6ea5f788fb0cab756';
```

**Issue:** Default values for IKA dWallet identifiers are hardcoded. If the relayer is deployed without explicit environment variables, it will use these production keys. This is a supply chain/time-of-check vulnerability.

**Impact:** Attacker who obtains these default values (e.g., from repo leak, binary reverse engineering) can:
1. Sign arbitrary messages with the dWallet
2. Drain the IKA coin balance
3. Create unauthorized reborns

**Recommendation:** Remove all default values. Require explicit configuration:
```typescript
const dwalletCapId = env.DWALLET_CAP_ID;
if (!dwalletCapId) throw new Error('DWALLET_CAP_ID is required');
```

---

### 2. Unauthenticated Health Endpoint Exposes Sensitive Data

**File:** `packages/relayer/src/health.ts` (lines 85-120)

```typescript
function handleRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
  // NO AUTHENTICATION CHECK
  res.setHeader('Access-Control-Allow-Origin', '*');
  // ... serves all data without auth
}
```

**Issue:** The health endpoint (`/health`, `/ready`, `/live`) exposes:
- Database stats (total, pending, completed, failed seals)
- Queue statistics (processing count)
- Service status for Sui/Solana/IKA
- Version information
- Uptime

**Impact:** An attacker can:
1. Map the relayer's activity and transaction volume
2. Identify when operations are in progress
3. Determine failure patterns
4. Target the relayer during high-activity periods

**PoC:**
```bash
curl http://relayer:3470/health | jq '.database'
# {"total": 142, "pending": 3, "completed": 139, "failed": 0}
```

**Recommendation:** Add authentication to health endpoint or restrict to localhost/authorized IPs.

---

### 3. No Idempotency Protection for Solana Minting

**File:** `packages/relayer/src/index.ts` (lines 130-145) + `packages/relayer/src/services/solana-minter.ts` (lines 185-230)

```typescript
// index.ts - Step 4: Mint reborn NFT
const mintResult = await solanaMinter.mintReborn(...);

// solana-minter.ts mintReborn()
async function mintReborn(...) {
  // NO CHECK if mint already exists for this seal!
  const mintKp = Keypair.generate();  // Generates NEW keypair each time
  // ... sends transaction
}
```

**Issue:** If the relayer crashes after the mint transaction is sent but before `db.updateSealMinted()` completes, a retry will:
1. Generate a NEW mint keypair
2. Send a NEW mint transaction
3. Create a SECOND reborn NFT

The `verifySeal` function has protection (checks `recordInfo`), but `mintReborn` does NOT.

**Impact:** Double-minting of NFTs, economic exploitation.

**PoC Scenario:**
1. Relayer calls `mintReborn()` → tx sent to Solana
2. Solana confirms tx, but network hiccup delays response
3. Relayer times out, marks as failed
4. Retry: generates NEW mint, sends NEW tx
5. Result: Two reborn NFTs for one seal

**Recommendation:** Add idempotency check in `mintReborn`:
```typescript
// Check if already minted for this seal
const existingMint = await connection.getProgramAccount(recordPda);
if (existingMint) {
  logger.info('Already minted, skipping');
  return { mintAddress: existingMint.mint, txDigest: '' };
}
```

---

### 4. DKG Secret Share Caching in Memory

**File:** `packages/relayer/src/services/ika-signer.ts` (lines 55-75) + `packages/shared/src/ika-dwallet.ts` (lines 170-190)

```typescript
// ika-signer.ts
const seed = secretKey.slice(0, 32);
userShareKeys = await UserShareEncryptionKeys.fromRootSeedKey(
  Uint8Array.from(seed),
  Curve.ED25519,
);

// ika-dwallet.ts - stores DKG output in memory cache
private dkgCache = new Map<string, DKGOutput>();
// DKGOutput contains:
// - userPublicOutput: Uint8Array
// - userSecretKeyShare: Uint8Array  <-- CRITICAL
```

**Issue:** 
1. The `userSecretKeyShare` (DKG secret share) is stored in memory
2. If an attacker achieves RCE (e.g., via dependency vulnerability), they can extract the secret share
3. With the secret share, attacker can complete the 2PC-MPC signing without the relayer's participation

**Impact:** Complete compromise of dWallet signing authority.

**Recommendation:** 
- Never store DKG secret share in persistent storage or long-lived memory
- Use ephemeral sessions only
- Consider Hardware Security Module (HSM) integration

---

## HIGH Vulnerabilities

### 5. Race Condition in Queue Processing

**File:** `packages/relayer/src/queue.ts` (lines 55-80)

```typescript
enqueue(event: NFTSealedEvent, priority: number = 0): void {
  // Check if already in queue or processing
  if (this.processing.has(event.seal_hash)) {
    this.logger.debug(`Seal ${event.seal_hash} already processing, skipping`);
    return;
  }
  
  if (this.queue.some(item => item.sealHash === event.seal_hash)) {
    this.logger.debug(`Seal ${event.seal_hash} already queued, skipping`);
    return;
  }
  // ... add to queue
}
```

**Issue:** The check-and-add is not atomic. Between the check and the add:
- Two concurrent `enqueue()` calls for the same seal could both pass the check
- Multiple workers could pick up the same seal

**Impact:** Double-processing of the same seal (though DB check in `processSeal` provides some protection).

**Recommendation:** Use a mutex or lock for queue operations.

---

### 6. Seal Hash Endianness Mismatch Risk

**File:** `packages/shared/src/seal-hash.ts` (lines 30-100)

```typescript
// constructSealHashBytes - source_chain_id (u16 BE)
buffer[offset++] = (sourceChainId >> 8) & 0xff;
buffer[offset++] = sourceChainId & 0xff;

// nonce (u64 BE) - 8 bytes
const nonceNum = Number(nonce);
buffer[offset++] = (nonceNum >> 56) & 0xff;
// ... big-endian encoding
```

**Issue:** The code uses big-endian encoding for `sourceChainId`, `destChainId`, and `nonce`. If the Sui Move contract uses little-endian (or vice versa), all seal verifications will fail. This would cause:
- All NFT sealed events to fail verification
- Complete protocol deadlock

The code comments claim it matches "PRD §6.1 exactly" but there's no verification against the actual Move contract.

**Impact:** Protocol failure due to encoding mismatch.

**Recommendation:** 
1. Add integration tests that verify JS hash matches Move contract hash byte-by-byte
2. Document exact encoding expectations
3. Add test vectors from Move contract

---

### 7. Insufficient Input Validation in Sui Listener

**File:** `packages/relayer/src/services/sui-listener.ts` (lines 70-110)

```typescript
const sealedEvent: NFTSealedEvent = {
  seal_hash: sealHash,  // No validation!
  source_chain: parsed.source_chain || 2,
  dest_chain: parsed.dest_chain || 3,
  source_contract: parsed.source_contract || suiPackageId,
  token_id: String(parsed.token_id || '0'),
  nonce: parsed.nonce || 0,
  // ... no length limits
};
```

**Issue:**
- No validation that `seal_hash` is valid hex
- No length limits on `nft_name`, `nft_description`, `metadata_uri`
- `source_chain` and `dest_chain` not validated against known chain IDs
- Arbitrary values from malicious Sui events could be stored

**Impact:** 
- Malicious events could inject invalid data into DB
- Large payloads could cause memory issues
- Invalid chain IDs could cause downstream failures

**Recommendation:** Add validation:
```typescript
if (!/^[0-9a-f]{64}$/.test(sealHash)) {
  throw new Error(`Invalid seal_hash format: ${sealHash}`);
}
if (nftName.length > 256) {
  throw new Error(`nft_name too long: ${nftName.length}`);
}
```

---

### 8. No Transaction Atomicity in Multi-Step Flow

**File:** `packages/relayer/src/index.ts` (lines 70-155)

```typescript
try {
  // Step 1: Create seal record ✓
  // Step 2: Sign with IKA dWallet ✓
  // Step 3: Verify seal on Solana ✓
  // Step 4: Mint reborn NFT
  // Step 5: Mark reborn on Sui
} catch (err) {
  db.updateSealStatus(seal_hash, 'failed', errorMsg);
}
```

**Issue:** The 5-step flow is NOT atomic:
- If Step 3 (verify) succeeds but Step 4 (mint) fails, the seal is "verified" but not "minted"
- Manual intervention required to recover
- Could leave NFTs in inconsistent state

**Impact:** State inconsistency, requires manual recovery.

**Recommendation:** Implement compensation transactions or rollback logic:
- If mint fails after verification, consider calling a "revoke" instruction on Solana
- Use database transactions to ensure atomicity of state updates

---

### 9. Logging of Sensitive Data

**File:** `packages/relayer/src/index.ts` (lines 85-90)

```typescript
logger.info(`Processing seal: ${seal_hash.slice(0, 16)}...`);
logger.debug(`Event: chain=${source_chain}->${dest_chain}, contract=${source_contract}, token=${token_id}`);

// Line 110:
logger.info(`Signature obtained: ${signResult.signatureHex.slice(0, 32)}...`);
```

**Issue:** 
- While full keys are not logged, partial signatures are (32 chars = 16 bytes)
- Transaction digests could be correlated with on-chain activity
- Event data reveals chain activity patterns

**Impact:** Privacy leakage if logs are compromised.

**Recommendation:** Reduce logging verbosity in production, use structured logging with redaction.

---

### 10. Realms DAO Unauthorized Creation

**File:** `packages/relayer/src/services/realms-creator.ts` (lines 55-90)

```typescript
async function ensureGuildExists(collectionName: string, communityTokenMint: PublicKey) {
  // Check cache
  const cachedRealm = realmCache.get(collectionName);
  if (cachedRealm) return cachedRealm;
  
  // Check on-chain - NO AUTHORIZATION CHECK
  const realmAccount = await getRealm(connection, communityTokenMint);
  
  // Creates new Realm if none exists
  const realmAddress = await createRealm(collectionName, communityTokenMint);
}
```

**Issue:** Any collection name can be used to create a Realms DAO. There's no verification that:
- The relayer operator actually owns the collection
- The collection was legitimately created through Ika Tensei

**Impact:** 
- Unauthorized DAO creation on Solana
- Potential squatting of collection names
- Confusion about legitimate vs fake guilds

**Recommendation:** Verify collection ownership before DAO creation.

---

## MEDIUM Vulnerabilities

### 11. SQL Parameterization (SAFE - but note schema)

**File:** `packages/relayer/src/db.ts` (lines 80-150)

The SQLite layer uses proper parameterized queries (SAFE):
```typescript
const stmtCreateSeal = db.prepare(`
  INSERT INTO seals (...) VALUES (@seal_hash, @status, ...)
`);
```

**However:** The schema has no constraints preventing duplicate seal_hash after deletion.

**Issue:** If a seal is deleted from DB, it could be re-processed.

**Recommendation:** Add `ON CONFLICT DO NOTHING` or implement soft deletes.

---

### 12. No Graceful Shutdown Waiting

**File:** `packages/relayer/src/index.ts` (lines 200-215)

```typescript
async function stop(): Promise<void> {
  running = false;
  // Stop services immediately
  await suiListener?.stop();
  await healthServer?.stop();
  queue.stop();  // No wait for in-flight!
  db.close();
}
```

**Issue:** In-flight seal processing is abandoned on shutdown. If a mint transaction is pending:
- Transaction may have been sent to Solana
- But DB won't reflect completion
- Could cause double-mint on restart

**Recommendation:** Implement graceful shutdown with drain timeout:
```typescript
async function stop(): Promise<void> {
  running = false;
  const drained = await queue.waitForDrain(30000);
  if (!drained) {
    logger.warn('Queue drain timeout, forcing shutdown');
  }
  // ... stop services
}
```

---

### 13. Dependency Supply Chain Risk

**File:** `packages/relayer/package.json` (not shown but assumed)

Dependencies used:
- `@solana/web3.js` - Solana RPC client
- `@mysten/sui` - Sui RPC client
- `@ika.xyz/sdk` - IKA SDK
- `better-sqlite3` - SQLite
- `dotenv` - Config loading

**Issue:**
- No lock file analysis performed
- Known CVEs in transitive dependencies could be exploited
- `@ika.xyz/sdk` is a custom package - cannot audit supply chain

**Recommendation:** 
- Use `npm audit` and `npm outdated` regularly
- Pin exact versions
- Consider reproducible builds

---

### 14. RPC Trust - No Response Validation

**File:** `packages/relayer/src/services/sui-listener.ts` (lines 30-50)

```typescript
const response = await client.queryEvents({
  query: { MoveEventType: `${suiPackageId}::registry::NFTSealed` },
  cursor,
  limit: 50,
  order: 'ascending',
});
```

**Issue:** 
- Relies entirely on Sui RPC for event data
- No verification that events actually occurred on-chain
- Malicious RPC could return fake events
- Could cause processing of non-existent seals

**Impact:** Processing fake seals, wasting gas, confusing state.

**Recommendation:** Verify events via transaction receipts or include events in transaction data.

---

### 15. Memory Safety - No Payload Size Limits

**File:** `packages/relayer/src/services/sui-listener.ts` + `packages/relayer/src/index.ts`

```typescript
// sui-listener.ts
metadata_uri: parsed.metadata_uri || '',  // No length check

// index.ts
nft_name: event.nft_name || 'Ika Tensei NFT',  // Used directly
metadata_uri: event.metadata_uri || '',  // No limits
```

**Issue:** 
- No max length validation on `metadata_uri`, `nft_name`, `nft_description`
- Could cause OOM with maliciously large payloads
- Could exceed Solana transaction size limits (1232 bytes)

**Recommendation:** Add validation:
```typescript
if (metadataUri.length > 500) {
  throw new Error('metadata_uri exceeds 500 characters');
}
```

---

## LOW / INFO Issues

### 16. Default Keystore Path Security

**File:** `packages/relayer/src/config.ts` (lines 190-220)

```typescript
function loadDefaultKeystore(): Uint8Array | null {
  const keystorePath = `${homedir()}/.sui/sui_config/sui.keystore`;
  // ...
}

function loadDefaultSolanaKeypair(): Uint8Array | null {
  const keypath = `${homedir()}/.config/solana/id.json`;
  // ...
}
```

**Issue:** Default paths could conflict with other applications or have incorrect permissions.

**Recommendation:** Require explicit key configuration, no fallbacks to user home directories.

---

### 17. VAA Parsing Error Handling

**File:** `packages/shared/src/wormhole-vaa.ts` (lines 150-180)

```typescript
export function parseVAAPayload(vaaBytes: Uint8Array): ParsedVAA {
  const version = vaaBytes[offset++];
  if (version !== 1) {
    throw new Error(`Invalid VAA version: ${version}, expected 1`);
  }
  // ...
}
```

**Issue:** Malformed VAAs throw unhandled errors that could crash the relayer.

**Recommendation:** Add try-catch around VAA parsing, log errors, continue processing.

---

### 18. Missing Index on seal_hash for Performance

**File:** `packages/relayer/src/db.ts` (lines 50-60)

```sql
CREATE INDEX IF NOT EXISTS idx_seals_hash ON seals(seal_hash);
```

Actually present - this is fine.

---

### 19. Configuration Error Handling

**File:** `packages/relayer/src/config.ts` (lines 160-180)

```typescript
function parseHexBytes(value: string | undefined, key: string): Uint8Array {
  // Throws on invalid hex, which is correct
}
```

Good - proper error handling.

---

### 20. Poll Timeout Could Be Exceeded

**File:** `packages/relayer/src/services/ika-signer.ts` (lines 30-45)

```typescript
const POLL_TIMEOUT_MS = 120_000; // 2 minutes
```

**Issue:** Fixed timeout may be insufficient under network congestion.

**Recommendation:** Make timeout configurable, add exponential backoff.

---

## Summary Table

| Severity | Count | Key Issues |
|----------|-------|------------|
| CRITICAL | 4 | Hardcoded keys, unauth health endpoint, no idempotency, DKG secret caching |
| HIGH | 6 | Race condition, endianness mismatch, input validation, no atomicity, sensitive logging, unauthorized DAO |
| MEDIUM | 5 | SQL schema, shutdown, dependencies, RPC trust, memory safety |
| LOW/INFO | 5 | Default paths, VAA error handling, indexes, config errors, timeouts |

---

## Recommendations Priority

### Immediate (Fix Before Production)
1. Remove hardcoded default keys in config.ts
2. Add authentication to health endpoint
3. Add idempotency check in mintReborn()
4. Fix DKG secret share caching (use ephemeral only)

### Before Launch
5. Add input validation in sui-listener
6. Implement graceful shutdown
7. Verify seal-hash.ts matches Move contract
8. Add transaction atomicity/rollback

### Post-Launch
9. Set up dependency scanning (npm audit)
10. Add RPC response verification
11. Reduce logging of sensitive data
12. Implement rate limiting

---

## Test Scenarios to Implement

1. **Double-Mint Test**: Kill relayer mid-mint, restart, verify no duplicate
2. **Event Replay Test**: Re-process same event, verify skipped
3. **Invalid Input Test**: Send malformed events, verify rejection
4. **Hash Mismatch Test**: Compare JS hash vs Move contract hash
5. **Concurrent Processing Test**: Submit same seal twice simultaneously
6. **Health Endpoint Test**: Verify unauthorized access blocked

---

*End of Audit Report*
