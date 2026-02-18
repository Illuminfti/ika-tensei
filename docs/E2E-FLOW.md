# End-to-End Flow Documentation

This document describes the complete step-by-step flow for sealing an NFT on Sui and reincarnating it on Solana.

## Pre-requisites

### Wallets & Keys

| Item | Description |
|------|-------------|
| **Sui Wallet** | Sui keypair with testnet SUI (for gas) |
| **Sui Address** | e.g., `0x...` |
| **Solana Wallet** | Solana keypair (devnet SOL for mint fees) |
| **Solana Address** | e.g., `7xKX...` |
| **IKA Testnet Tokens** | At least 1 IKA for DKG (get via faucet/exchange) |

### Deployed Contracts

| Chain | Contract | Address |
|-------|----------|---------|
| Sui | SealRegistry | `0x8474...` (testnet) |
| Sui | SealVault | Shared object |
| Solana | IkaTensei | `mbEQv...` (devnet) |
| Solana | Metaplex Core | `CoR...` (devnet) |

### Test NFT

A test NFT on Sui with the following properties:
- **Object ID**: `0x...`
- **Name**: `Test NFT #1`
- **Metadata URI**: `ipfs://...` or `https://...`

---

## Step 1: Mint Test NFT on Sui

Create a test NFT to seal. In production, this would be an existing NFT from a collection.

```typescript
import { SuiClient } from '@mysten/sui/client';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { Transaction } from '@mysten/sui/transactions';

// Using ika_nft package
const tx = new Transaction();
const nft = tx.moveCall({
  target: '0x...::ika_nft::mint',
  arguments: [
    tx.pure.string('Test NFT #1'),
    tx.pure.string('A test NFT for Ika Tensei'),
    tx.pure.string('https://example.com/nft1.json'),
  ],
});

tx.transferObjects([nft], tx.pure.address(recipientAddress));

const result = await suiClient.signAndExecuteTransaction({
  transaction: tx,
  signer: keypair,
  options: { showEffects: true },
});

// NFT Object ID
const nftId = result.objectChanges?.find(c => c.type === 'created')?.objectId;
console.log('NFT minted:', nftId);

// Transaction digest: 0x...
```

---

## Step 2: Register Seal on Sui

Register the NFT with the Ika Tensei protocol. This creates a seal record and transfers the NFT to the dWallet's Sui address.

```typescript
// First, create the dWallet (if not already created)
// See IKA-DWALLET-GUIDE.md for full DKG flow

const dwallet = await createDWallet('ED25519');
// dwallet.dwalletId = 0x36ada...
// dwallet.dwalletCapId = 0xae22f...
// dwallet.publicKey = Uint8Array (32 bytes)
// dwallet.solanaAddress = 7xKX...

// Now register the seal
const tx = new Transaction();

// Get the registry and vault objects
const registryId = '0x8474...'; // SealRegistry
const vaultId = '0x...';        // SealVault

// Prepare metadata
const metadataName = 'Test NFT #1';
const metadataDescription = 'A test NFT for Ika Tensei';
const metadataUri = 'https://example.com/nft1.json';
const collectionName = 'Test Collection';

// Prepare Walrus mirror (if available)
const walrusMetadataBlobId = ''; // or upload metadata to Walrus
const walrusImageBlobId = '';

// Compute seal hash
import { computeSealHash } from '@ika-tensei/shared';
const nonce = BigInt(Date.now());
const sealHash = computeSealHash({
  sourceChainId: 2, // Sui
  sourceContract: '0x...::ika_nft', // NFT contract
  tokenId: nftId,
  attestationPubkey: dwallet.publicKey,
  nonce,
});

// Register native seal (no VAA needed for Sui-native NFTs)
tx.moveCall({
  target: '0x8474...::registry::register_seal_native',
  arguments: [
    tx.object(registryId),  // &mut SealRegistry
    tx.object(vaultId),    // &mut SealVault
    tx.object(nftId),      // NFT object to transfer
    tx.pure.address(dwallet.dwalletId),
    tx.pure.address(dwallet.dwalletCapId),
    tx.pure.address(dwallet.dwalletId),  // attestation same as primary
    tx.pure.address(dwallet.dwalletCapId),
    tx.pure.vectorU8(dwallet.publicKey),
    tx.pure.vectorU8(dwallet.publicKey),
    tx.pure.address(dwallet.solanaAddress),  // dwallet_sui_address
    tx.pure.string('0x...::ika_nft'),
    tx.pure.string(nftId),
    tx.pure.u64(Number(nonce)),
    tx.pure.string(metadataName),
    tx.pure.string(metadataDescription),
    tx.pure.string(metadataUri),
    tx.pure.string(walrusMetadataBlobId),
    tx.pure.string(walrusImageBlobId),
    tx.pure.string(collectionName),
  ],
});

const result = await suiClient.signAndExecuteTransaction({
  transaction: tx,
  signer: keypair,
  options: { showEffects: true, showObjectChanges: true },
});

// Transaction digest: 0x...
// seal_hash: 0x... (32 bytes)
console.log('Seal registered:', result.digest);
```

---

## Step 3: Lock dWallet (Transfer DWalletCap to SealVault)

The DWalletCap must be transferred to the SealVault to permanently lock the dWallet. This is a critical security step - once transferred, the dWallet can never sign again.

```typescript
// Transfer DWalletCap to SealVault
const tx = new Transaction();

const vaultAddress = '0x...'; // SealVault address (same as registry for shared objects)

tx.moveCall({
  target: '0x1::transfer::public_transfer',
  arguments: [
    tx.object(dwallet.dwalletCapId),  // DWalletCap
    tx.pure.address(vaultAddress),     // Recipient = SealVault
  ],
});

const result = await suiClient.signAndExecuteTransaction({
  transaction: tx,
  signer: keypair,
  options: { showEffects: true },
});

// Transaction digest: 0x...
console.log('DWalletCap locked:', result.digest);

// Verify seal status
const sealRecord = await suiClient.getObject({
  id: registryId,
  options: { showContent: true },
});
// seal_record.reborn === false
// seal_record.dwallet_id === dwallet.dwalletId
```

---

## Step 4: IKA Signing (2PC-MPC Ed25519)

The relayer triggers the IKA 2PC-MPC signing flow to sign the seal hash. This produces an Ed25519 signature that can be verified on Solana.

```typescript
// Using IKA SDK to sign the seal hash
import { IkaClient, IkaTransaction, Hash, SignatureAlgorithm } from '@ika.xyz/sdk';

// Convert seal hash to Uint8Array
const message = Uint8Array.from(Buffer.from(sealHash, 'hex'));

// Request presign
const presignTx = new Transaction();
const presignIkaTx = new IkaTransaction({
  ikaClient,
  transaction: presignTx,
  userShareEncryptionKeys,
});

presignIkaTx.requestPresign({
  dWallet: dwallet,
  signatureAlgorithm: SignatureAlgorithm.EdDSA,
  ikaCoin: presignTx.gas,
  suiCoin: presignTx.gas,
});

const presignResult = await suiClient.signAndExecuteTransaction({
  transaction: presignTx,
  signer: keypair,
  options: { showEffects: true, showObjectChanges: true },
});

// Poll for presign completion
const presign = await pollForState(
  () => ikaClient.getPresignInParticularState(presignId, 'Completed'),
  120000,
);

// Request signature
const signTx = new Transaction();
const signIkaTx = new IkaTransaction({
  ikaClient,
  transaction: signTx,
  userShareEncryptionKeys,
});

const messageApproval = signIkaTx.approveMessage({
  dWalletCap: dwallet.dwalletCapId,
  curve: Curve.ED25519,
  signatureAlgorithm: SignatureAlgorithm.EdDSA,
  hashScheme: Hash.SHA512,  // IMPORTANT: SHA512 for EdDSA
  message,
});

const verifiedPresignCap = signIkaTx.verifyPresignCap({ presign });

await signIkaTx.requestSign({
  dWallet: dwallet,
  messageApproval,
  hashScheme: Hash.SHA512,
  verifiedPresignCap,
  presign,
  message,
  signatureScheme: SignatureAlgorithm.EdDSA,
  secretShare: dkgCache.userSecretKeyShare,
  publicOutput: dkgCache.userPublicOutput,
  ikaCoin: signTx.gas,
  suiCoin: signTx.gas,
});

const signResult = await suiClient.signAndExecuteTransaction({
  transaction: signTx,
  signer: keypair,
  options: { showEffects: true, showObjectChanges: true },
});

// Poll for signature completion
const signOutput = await pollForState(
  () => ikaClient.getSignInParticularState(
    signSessionId,
    Curve.ED25519,
    SignatureAlgorithm.EdDSA,
    'Completed'
  ),
  120000,
);

// Parse signature
const signature = await parseSignatureFromSignOutput(
  Curve.ED25519,
  SignatureAlgorithm.EdDSA,
  Uint8Array.from(signOutput.state.Completed.signature),
);

// Signature: 64 bytes (R + S)
// Transaction digest: 0x...
console.log('Signature produced:', Buffer.from(signature).toString('hex'));
```

---

## Step 5: Verify Seal on Solana

Submit the signature to the Solana program for verification. The program uses the Ed25519 precompile to verify the signature against the stored attestation public key.

```typescript
import { Connection, PublicKey, Transaction, SystemProgram } from '@solana/web3.js';
import { ikaTenseiProgram } from './program';

const connection = new Connection('https://api.devnet.solana.com');
const program = ikaTenseiProgram(connection);

// Derive PDA for ReincarnationRecord
const [recordPda] = PublicKey.findProgramAddressSync(
  [Buffer.from('reincarnation'), Buffer.from(sealHash, 'hex')],
  program.programId,
);

// Create verify instruction
const tx = new Transaction();

// Add verify_seal instruction
tx.add(
  program.instruction.verifySeal(
    Buffer.from(sealHash, 'hex'),           // seal_hash: [u8; 32]
    2,                                      // source_chain: u16 (Sui)
    Buffer.from(nftContract),               // source_contract: Vec<u8>
    Buffer.from(tokenId),                   // token_id: Vec<u8>
    new PublicKey(attestationPubkey),       // attestation_pubkey: Pubkey
    new PublicKey(recipientSolanaAddress), // recipient: Pubkey
    {
      accounts: {
        config: configPda,
        collection: collectionPda,
        record: recordPda,
        payer: payerPublicKey,
        instructionsSysvar: SystemProgram.programId,
        systemProgram: SystemProgram.programId,
      },
    }
  ),
);

// Note: The signature verification happens via a separate
// Ed25519 instruction in the same transaction
const ed25519Ix = new TransactionInstruction({
  keys: [
    { pubkey: new PublicKey(attestationPubkey), isSigner: false, isWritable: false },
  ],
  programId: new PublicKey('Ed25519SigVerify111111111111111111111111111'),
  data: Buffer.concat([
    Buffer.from([1]),  // num_signatures
    Buffer.from([0, 0]),  // padding
    Buffer.from([32, 0]),  // signature offset
    Buffer.from([32, 0]),  // message offset
    Buffer.from([32, 0]),  // message size
    Buffer.from([0, 0]),  // padding
    signature,              // 64 bytes
    attestationPubkey,     // 32 bytes
    sealHashBytes,         // 32 bytes
  ]),
});

tx.add(ed25519Ix);

const sig = await connection.sendTransaction(tx, [payerKeypair]);
console.log('Seal verified on Solana:', sig);

// Record PDA created
// The record is now created with:
// - seal_hash
// - attestation_pubkey
// - recipient
// - minted = false
```

---

## Step 6: Mint Reborn NFT (Metaplex Core CPI)

Mint the reborn NFT on Solana using Metaplex Core. The program uses a CPI (Cross-Program Invocation) to create the Core Asset.

```typescript
import { Keypair, PublicKey } from '@solana/web3.js';
import { MPL_CORE_PROGRAM_ID } from '@metaplex-foundation/mpl-core';

const asset = Keypair.generate();  // New asset keypair

// Derive mint authority PDA
const [mintAuthorityPda] = PublicKey.findProgramAddressSync(
  [Buffer.from('reincarnation_mint'), Buffer.from(sealHash, 'hex')],
  program.programId,
);

// Metadata URI (can be from Walrus or IPFS)
const name = 'Reborn Test NFT #1';
const uri = 'https://blob.swm.affiliate/...';  // Walrus blob ID or IPFS

const tx = new Transaction();

tx.add(
  program.instruction.mintReborn(
    Buffer.from(sealHash, 'hex'),
    name,
    uri,
    {
      accounts: {
        config: configPda,
        record: recordPda,
        mintAuthority: mintAuthorityPda,
        asset: asset.publicKey,
        recipient: recipientSolanaAddress,
        payer: payerPublicKey,
        mplCoreProgram: MPL_CORE_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      },
      signers: [asset],  // Asset keypair must sign
    }
  ),
);

// The program CPI to Metaplex Core creates:
// - Core Asset with:
//   - Royalties: 690 bps (500 guild + 190 team)
//   - ImmutableMetadata plugin
//   - Owner: recipient
//   - Update authority: mint_authority PDA

const sig = await connection.sendTransaction(tx, [payerKeypair, asset]);
console.log('NFT reborn on Solana:', sig);

// Asset address (Solana mint)
const assetAddress = asset.publicKey.toBase58();
```

---

## Step 7: Mark Reborn on Sui

After the NFT is minted on Solana, mark the seal as reborn on Sui. This is **permissionless** - anyone can call it.

```typescript
const tx = new Transaction();

tx.moveCall({
  target: '0x8474...::registry::mark_reborn',
  arguments: [
    tx.object(registryId),                  // &mut SealRegistry
    tx.pure.vectorU8(sealHashBytes),       // seal_hash
    tx.pure.vectorU8(assetAddressBytes),   // solana_mint_address (32 bytes)
  ],
});

const result = await suiClient.signAndExecuteTransaction({
  transaction: tx,
  signer: keypair,
  options: { showEffects: true },
});

// Transaction digest: 0x...
console.log('Marked reborn:', result.digest);

// Verify
const sealRecord = await suiClient.getObject({
  id: registryId,
  options: { showContent: true },
});
// seal_record.reborn === true
// seal_record.solana_mint_address === assetAddress
```

---

## Step 8-10: Realms DAO Integration

For governance features, integrate with Realms (Solana's DAO framework).

### Step 8: Create DAO Proposal

```typescript
import { createProposal } from './realms-dao';

const proposal = await createProposal({
  connection,
  treasury: daoTreasury,
  signer: adminKeypair,
  title: 'Reborn NFT #1 Collection Membership',
  description: 'Grant collection membership to Reborn NFT',
  instructions: [
    // Add asset to collection instruction
  ],
});

console.log('Proposal created:', proposal.signature);
```

### Step 9: Vote on Proposal

```typescript
import { castVote } from './realms-dao';

await castVote({
  connection,
  proposal,
  voter: memberKeypair,
  vote: 'approve',  // or 'reject' / 'abstain'
});
```

### Step 10: Execute Proposal

```typescript
import { executeProposal } from './realms-dao';

await executeProposal({
  connection,
  proposal,
  executor: adminKeypair,
});
```

---

## Transaction Summary

| Step | Action | Chain | TX Digest |
|------|--------|-------|-----------|
| 1 | Mint NFT | Sui | `0x...` |
| 2 | Register Seal | Sui | `0x...` |
| 3 | Lock DWalletCap | Sui | `0x...` |
| 4 | IKA Sign | Sui | `0x...` |
| 5 | Verify Seal | Solana | `0x...` |
| 6 | Mint Reborn | Solana | `0x...` |
| 7 | Mark Reborn | Sui | `0x...` |
| 8 | Create Proposal | Solana | `0x...` |
| 9 | Vote | Solana | `0x...` |
| 10 | Execute | Solana | `0x...` |

---

## Troubleshooting

### Transaction Fails with "Invalid Signature"

**Cause**: Signature verification failed on Solana

**Solutions**:
1. Verify `attestation_pubkey` matches the dWallet's Ed25519 public key
2. Ensure message is exactly the 32-byte seal hash
3. Check signature format (64 bytes: R + S, no padding)

### NFT Not Appearing in Wallet

**Cause**: Asset not properly associated with wallet

**Solutions**:
1. Verify the `recipient` field in `mint_reborn` matches your Solana address
2. Check Metaplex Core indexer for asset
3. Force refresh the wallet's NFT cache

### Gas/Clawback Errors

**Cause**: Insufficient SUI for transactions

**Solutions**:
1. Ensure wallet has at least 2-3 SUI for gas
2. Increase gas budget in transactions
3. Check for stuck coins in the wallet

### Wormhole VAA Not Found

**Cause**: For cross-chain seals, VAA not yet available

**Solutions**:
1. Wait for guardian signature (usually < 1 minute)
2. Poll Wormhole API for VAA
3. Check emitter address is correct
