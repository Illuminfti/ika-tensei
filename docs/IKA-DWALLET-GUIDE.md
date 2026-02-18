# IKA dWallet Integration Guide

This guide covers integration with the IKA Network's dWallet (Distributed Key Generation) system for the Ika Tensei protocol.

## What is a dWallet?

A **dWallet** is a 2PC-MPC (Two-Party Computation Multi-Party Computation) threshold signature wallet. Unlike traditional wallets with a single private key, a dWallet requires cooperation between two parties:

- **User**: Holds one share of the private key
- **Key Holder (IKA)**: Holds the other share

To sign any transaction, **both parties must cooperate** via the IKA protocol. This provides:
- **Key sharding**: No single party ever has the full private key
- **Threshold signing**: 2-of-2 signature requirement
- **Distributed key generation (DKG)**: The public key is jointly computed without either party seeing the full private key

## dWallet Creation Flow (DKG)

The DKG process creates a new dWallet. It consists of 2 steps:

```
┌────────────────────────────────────────────────────────────────────────────────┐
│                         DKG Flow Overview                                       │
├────────────────────────────────────────────────────────────────────────────────┤
│                                                                                │
│  User                              IKA Network                                 │
│   │                                                                     │
│   │  1. createRandomSessionIdentifier()                                  │
│   │     prepareDKGAsync(curve, session)                                  │
│   │                                                                     │
│   ├─────────────────────────────────────────────────────────────────►     │
│   │                                                                     │
│   │  2. registerSessionIdentifier + requestDWalletDKG (single TX)       │
│   │                                                                     │
│   ├─────────────────────────────────────────────────────────────────►     │
│   │                                                                     │
│   │     [Wait for on-chain DKG completion - poll getDWallet()]         │
│   │                                                                     │
│   │  3. getDWallet() → AwaitingKeyHolderSignature                     │
│   │                                                                     │
│   ├─────────────────────────────────────────────────────────────────►     │
│   │                                                                     │
│   │  4. acceptEncryptedUserShare (single TX)                           │
│   │                                                                     │
│   ├─────────────────────────────────────────────────────────────────►     │
│   │                                                                     │
│   │  5. getDWallet() → Active                                         │
│   │     dWallet ready for signing                                       │
│   │                                                                     │
└────────────────────────────────────────────────────────────────────────────────┘
```

### Step 1: Prepare DKG

```typescript
import {
  IkaClient,
  IkaTransaction,
  Curve,
  Hash,
  SignatureAlgorithm,
  getNetworkConfig,
  prepareDKGAsync,
  createRandomSessionIdentifier,
} from '@ika.xyz/sdk';

const ikaConfig = getNetworkConfig('testnet');
const ikaClient = new IkaClient({ suiClient, config: ikaConfig });
await ikaClient.initialize();

// Generate session identifier
const sessionBytes = createRandomSessionIdentifier();

// Prepare DKG input
const dkgInput = await prepareDKGAsync(
  ikaClient,
  Curve.ED25519,        // or Curve.SECP256K1 for ETH/BTC
  userShareKeys,        // derived from user's Sui keypair seed
  sessionBytes,
  senderAddress,
);
```

### Step 2: Execute DKG Transaction

```typescript
const tx = new Transaction();
const ikaTx = new IkaTransaction({
  ikaClient,
  transaction: tx,
  userShareEncryptionKeys: userShareKeys,
});

// Register session identifier
const sessionId = ikaTx.registerSessionIdentifier(sessionBytes);

// Get latest network encryption key
const encKey = await ikaClient.getLatestNetworkEncryptionKey();

// Request DKG
await ikaTx.requestDWalletDKG({
  curve: Curve.ED25519,
  dkgRequestInput: dkgInput,
  ikaCoin: tx.gas,
  suiCoin: tx.gas,
  sessionIdentifier: sessionId,
  dwalletNetworkEncryptionKeyId: encKey.id,
});

// Execute transaction
const txResult = await suiClient.signAndExecuteTransaction({
  transaction: tx,
  signer: suiKeypair,
  options: { showEffects: true, showObjectChanges: true },
});
```

### Step 3: Wait for DKG Completion

```typescript
// Poll until dWallet reaches Active state
const dwallet = await pollUntilState(
  () => ikaClient.getDWalletInParticularState(dwalletCapId, 'Active'),
  'dWallet DKG completion',
  120000,  // 2 minute timeout
  2000,    // 2 second poll interval
);
```

### Step 4: Accept Encrypted User Share

```typescript
// Get the encrypted share table ID from the dWallet object
const encShareTableId = dwallet.encrypted_user_secret_key_shares.id.id;

if (encShareTableId) {
  const acceptTx = new Transaction();
  const acceptIkaTx = new IkaTransaction({
    ikaClient,
    transaction: acceptTx,
    userShareEncryptionKeys: userShareKeys,
  });
  
  const encShare = await ikaClient.getEncryptedUserSecretKeyShare(encShareTableId);
  
  await acceptIkaTx.acceptEncryptedUserShare({
    dWallet: dwallet,
    userPublicOutput: dkgInput.userPublicOutput,
    encryptedUserSecretKeyShareId: encShare.id.id || encShareTableId,
  });
  
  await suiClient.signAndExecuteTransaction({
    transaction: acceptTx,
    signer: suiKeypair,
  });
}
```

### Step 5: Extract Public Key

```typescript
import { publicKeyFromDWalletOutput, Curve } from '@ika.xyz/sdk';

const activeState = dwallet.state.Active;
const publicOutputBytes = Uint8Array.from(activeState.public_output);

// Extract Ed25519 public key
const publicKeyBytes = await publicKeyFromDWalletOutput(
  Curve.ED25519,
  publicOutputBytes,
);

// Convert to Solana address
import { PublicKey } from '@solana/web3.js';
const solanaAddress = new PublicKey(publicKeyBytes).toBase58();
```

## Signing Flow

Once the dWallet is Active, messages can be signed via the 2PC-MPC protocol:

```
┌────────────────────────────────────────────────────────────────────────────────┐
│                         Signing Flow Overview                                    │
├────────────────────────────────────────────────────────────────────────────────┤
│                                                                                │
│  User                              IKA Network                                 │
│   │                                                                     │
│   │  1. requestGlobalPresign() (TX 1)                                   │
│   │                                                                     │
│   ├─────────────────────────────────────────────────────────────────►     │
│   │                                                                     │
│   │     [Poll for presign completion]                                    │
│   │                                                                     │
│   │  2. getPresign() → Completed                                       │
│   │                                                                     │
│   ├─────────────────────────────────────────────────────────────────►     │
│   │                                                                     │
│   │  3. verifyPresignCap() + approveMessage() + requestSign() (TX 2)  │
│   │                                                                     │
│   ├─────────────────────────────────────────────────────────────────►     │
│   │                                                                     │
│   │     [Poll for signature completion]                                 │
│   │                                                                     │
│   │  4. getSign() → Completed                                         │
│   │                                                                     │
│   │  5. parseSignatureFromSignOutput()                                 │
│   │                                                                     │
│   ◄─────────────────────────────────────────────────────────────────┤     │
│   │                                                                     │
│   │  Signature ready!                                                   │
│   │                                                                     │
└────────────────────────────────────────────────────────────────────────────────┘
```

### Step 1: Request Presign

```typescript
const presignTx = new Transaction();
const presignIkaTx = new IkaTransaction({
  ikaClient,
  transaction: presignTx,
  userShareEncryptionKeys: userShareKeys,
});

presignIkaTx.requestPresign({
  dWallet: dwallet,
  signatureAlgorithm: SignatureAlgorithm.EdDSA,  // Ed25519
  ikaCoin: presignTx.gas,
  suiCoin: presignTx.gas,
});

const presignResult = await suiClient.signAndExecuteTransaction({
  transaction: presignTx,
  signer: suiKeypair,
  options: { showEffects: true, showObjectChanges: true },
});

// Extract presign session ID from created objects
const presignId = presignResult.objectChanges
  .filter((c: any) => c.type === 'created' && c.objectType?.includes('PresignSession'))
  [0]?.objectId;
```

### Step 2: Wait for Presign Completion

```typescript
const presign = await pollUntilState(
  () => ikaClient.getPresignInParticularState(presignId, 'Completed'),
  'presign completion',
  120000,
  2000,
);
```

### Step 3: Request Signature

```typescript
const signTx = new Transaction();
const signIkaTx = new IkaTransaction({
  ikaClient,
  transaction: signTx,
  userShareEncryptionKeys: userShareKeys,
});

// Approve the message to be signed
const messageApproval = signIkaTx.approveMessage({
  dWalletCap: dwalletCapId,
  curve: Curve.ED25519,
  signatureAlgorithm: SignatureAlgorithm.EdDSA,
  hashScheme: Hash.SHA512,  // IMPORTANT: EdDSA uses SHA512, NOT KECCAK256!
  message: messageToSign,
});

// Verify the presign capability
const verifiedPresignCap = signIkaTx.verifyPresignCap({ presign });

// Get cached DKG output (needed for signing)
const dkgCache = await getCachedDkgOutput(dwalletCapId);

// Request the actual signature
await signIkaTx.requestSign({
  dWallet: dwallet,
  messageApproval,
  hashScheme: Hash.SHA512,  // Must match approveMessage
  verifiedPresignCap,
  presign,
  message: messageToSign,
  signatureScheme: SignatureAlgorithm.EdDSA,
  secretShare: dkgCache?.userSecretKeyShare,
  publicOutput: dkgCache?.userPublicOutput,
  ikaCoin: signTx.gas,
  suiCoin: signTx.gas,
});

const signResult = await suiClient.signAndExecuteTransaction({
  transaction: signTx,
  signer: suiKeypair,
  options: { showEffects: true, showObjectChanges: true },
});

// Extract sign session ID
const signSessionId = signResult.objectChanges
  .filter((c: any) => c.type === 'created' && c.objectType?.includes('SignSession'))
  [0]?.objectId;
```

### Step 4: Wait for Signature Completion

```typescript
const signOutput = await pollUntilState(
  () => ikaClient.getSignInParticularState(
    signSessionId,
    Curve.ED25519,
    SignatureAlgorithm.EdDSA,
    'Completed'
  ),
  'signature completion',
  120000,
  2000,
);
```

### Step 5: Parse Signature

```typescript
import { parseSignatureFromSignOutput, Curve, SignatureAlgorithm } from '@ika.xyz/sdk';

const completedState = signOutput.state.Completed;
const rawSignature = Uint8Array.from(completedState.signature);

const signature = await parseSignatureFromSignOutput(
  Curve.ED25519,
  SignatureAlgorithm.EdDSA,
  rawSignature,
);

// signature is now ready for use
// For Solana: use with web3.js Transaction
```

## SDK Gotchas

### 1. Use `getDWallet()`, NOT `getActiveDWallet()`

```typescript
// ❌ Wrong - this method doesn't exist
const dwallet = await ikaClient.getActiveDWallet(dwalletCapId);

// ✅ Correct
const dwallet = await ikaClient.getDWallet(dwalletCapId);
```

### 2. Use `getPresign()`, NOT `getPresignSession()`

```typescript
// ❌ Wrong
const presign = await ikaClient.getPresignSession(presignId);

// ✅ Correct
const presign = await ikaClient.getPresign(presignId);
```

### 3. EdDSA Requires `Hash.SHA512`, NOT KECCAK256

```typescript
// ❌ Wrong - this is for ECDSA/Secp256k1
const hashScheme = Hash.KECCAK256;

// ✅ Correct - EdDSA uses SHA-512
const hashScheme = Hash.SHA512;
```

### 4. Extract Public Key Correctly

```typescript
import { publicKeyFromDWalletOutput, Curve } from '@ika.xyz/sdk';

// For Ed25519
const publicKeyBytes = await publicKeyFromDWalletOutput(
  Curve.ED25519,
  publicOutputBytes,  // from dwallet.state.Active.public_output
);
```

### 5. Gas Budget: 100M SUI is Sufficient

```typescript
// Set gas budget (in MIST, not SUI)
// 100 SUI = 100,000,000,000 MIST = 100M SUI * 10^9
const tx = new Transaction();
tx.setGasBudget(100_000_000_000);  // 100 SUI
```

## IKA Testnet Token Exchange

To get IKA testnet tokens for development:

**Contract**: `ika_exchange::exchangeForIka`
**Address**: `0x5d2fd4...` (testnet)
**Rate**: 10 IKA per 1 SUI

```typescript
import { Transaction } from '@mysten/sui/transactions';

const tx = new Transaction();

// Swap 1 SUI for 10 IKA
const coin = tx.splitCoins(tx.gas, [tx.pure.u64(1_000_000_000)]); // 1 SUI

tx.moveCall({
  target: '0x5d2fd4...::ika_exchange::exchangeForIka',
  arguments: [coin],
});

await suiClient.signAndExecuteTransaction({
  transaction: tx,
  signer: keypair,
});
```

## RPC Endpoints

### Sui Testnet

```typescript
const suiClient = new SuiClient({
  url: 'https://rpc-testnet.suiscan.xyz',  // Public, rate-limited
});

// Alternative (may need API key):
// const suiClient = new SuiClient({
//   url: 'https://testnet.sui-rpc.com',
// });
```

### Rate Limits

The public RPC at `rpc-testnet.suiscan.xyz` has rate limits. For production:
- Use a dedicated RPC provider (e.g., Tatum, QuickNode, Alchemy)
- Implement request caching
- Add retry with exponential backoff

## Common Errors and Solutions

### Error: `user_output_signature undefined`

**Cause**: SDK bug in `requestReEncryptUserShareFor` at line 1461

**Solution**: 
1. Check if the dWallet is already Active (DKG may have completed)
2. Poll `getDWallet()` to get current state
3. If already Active, skip the encrypted share acceptance step

```typescript
const dwallet = await ikaClient.getDWallet(dwalletCapId);
if (dwallet.state.Active) {
  console.log('DKG already complete, skipping encrypted share acceptance');
  // Proceed to extract public key
}
```

### Error: `Invalid signature scheme`

**Cause**: Mismatch between signature algorithm and hash scheme

**Solution**: For EdDSA, always use `Hash.SHA512`:
```typescript
hashScheme: Hash.SHA512,
signatureAlgorithm: SignatureAlgorithm.EdDSA,
```

### Error: `Exceeded memory limit`

**Cause**: Transaction too complex or gas budget too low

**Solution**: 
- Increase gas budget to 200M SUI
- Split complex operations into multiple transactions
- Use `dryRun` before submitting

### Error: `Object not found` for PresignSession

**Cause**: Polling started before transaction confirmed

**Solution**: Always wait for transaction confirmation:
```typescript
const txResult = await suiClient.waitForTransaction({
  digest: txDigest,
  options: { showEffects: true },
});
// Only then start polling for state changes
```

### Error: `Signature verification failed`

**Cause**: Incorrect public key extraction or message mismatch

**Solution**: 
1. Ensure you're using the correct `attestation_pubkey` (Ed25519)
2. Verify the message bytes match exactly what's being signed
3. For Solana, ensure message includes the `PrefixedMessage` wrapper

## Complete Example

```typescript
import { SuiClient } from '@mysten/sui/client';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { Transaction } from '@mysten/sui/transactions';
import { PublicKey } from '@solana/web3.js';
import {
  IkaClient,
  IkaTransaction,
  Curve,
  Hash,
  SignatureAlgorithm,
  getNetworkConfig,
  prepareDKGAsync,
  createRandomSessionIdentifier,
  publicKeyFromDWalletOutput,
  parseSignatureFromSignOutput,
  UserShareEncryptionKeys,
} from '@ika.xyz/sdk';

class IkaDWalletService {
  private ikaClient: IkaClient;
  private suiClient: SuiClient;
  private suiKeypair: Ed25519Keypair;
  private userShareKeys: UserShareEncryptionKeys;
  
  constructor(suiRpcUrl: string, ikaNetwork: string, secretKey: Uint8Array) {
    this.suiClient = new SuiClient({ url: suiRpcUrl });
    const ikaConfig = getNetworkConfig(ikaNetwork);
    this.ikaClient = new IkaClient({ suiClient: this.suiClient, config: ikaConfig });
    
    this.suiKeypair = Ed25519Keypair.fromSecretKey(secretKey);
  }
  
  async initialize() {
    await this.ikaClient.initialize();
    const seed = this.suiKeypair.getSecretKey().slice(0, 32);
    this.userShareKeys = await UserShareEncryptionKeys.fromRootSeedKey(
      Uint8Array.from(seed),
      Curve.ED25519,
    );
  }
  
  async createDWallet(curve: 'ED25519' | 'SECP256K1' = 'ED25519') {
    const ikaCurve = curve === 'ED25519' ? Curve.ED25519 : Curve.SECP256K1;
    const sessionBytes = createRandomSessionIdentifier();
    
    const dkgInput = await prepareDKGAsync(
      this.ikaClient,
      ikaCurve,
      this.userShareKeys,
      sessionBytes,
      this.suiKeypair.getPublicKey().toSuiAddress(),
    );
    
    const tx = new Transaction();
    const ikaTx = new IkaTransaction({
      ikaClient: this.ikaClient,
      transaction: tx,
      userShareEncryptionKeys: this.userShareKeys,
    });
    
    const sessionId = ikaTx.registerSessionIdentifier(sessionBytes);
    const encKey = await this.ikaClient.getLatestNetworkEncryptionKey();
    
    await ikaTx.requestDWalletDKG({
      curve: ikaCurve,
      dkgRequestInput: dkgInput,
      ikaCoin: tx.gas,
      suiCoin: tx.gas,
      sessionIdentifier: sessionId,
      dwalletNetworkEncryptionKeyId: encKey.id,
    });
    
    const result = await this.suiClient.signAndExecuteTransaction({
      transaction: tx,
      signer: this.suiKeypair,
      options: { showEffects: true, showObjectChanges: true },
    });
    
    const dwalletCapId = result.objectChanges
      .find((c: any) => c.type === 'created' && c.objectType?.includes('DWalletCap'))
      ?.objectId;
    
    // Poll for Active state
    // ... (see full implementation above)
    
    return { dwalletCapId, publicKey: publicKeyBytes, solanaAddress };
  }
  
  async signMessage(message: Uint8Array) {
    // ... (see full signing flow above)
    return signature;
  }
}

// Usage
const service = new IkaDWalletService(
  'https://rpc-testnet.suiscan.xyz',
  'testnet',
  keypairBytes,
);
await service.initialize();

const dwallet = await service.createDWallet('ED25519');
console.log('Solana address:', dwallet.solanaAddress);

const signature = await service.signMessage(sealHash);
console.log('Signature:', Buffer.from(signature).toString('hex'));
```
