# Deployment Guide

This guide covers deploying all Ika Tensei contracts to testnet and mainnet environments.

## Prerequisites

### Required Tools

| Tool | Version | Installation |
|------|---------|--------------|
| Node.js | >= 18 | `nvm install 18` |
| Rust | >= 1.70 | `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh` |
| Solana CLI | >= 1.17 | `sh -c "$(curl -sSfL https://release.solana.com/v1.17.0/install)"` |
| Sui CLI | >= 1.20 | `cargo install --locked sui` |
| Foundry | latest | `curl -L https://foundry.paradigm.xyz | bash` |

### Environment Variables

```bash
# Required
export SUI_RPC_URL="https://rpc-testnet.suiscan.xyz"
export SOLANA_RPC_URL="https://api.devnet.solana.com"
export ETH_RPC_URL="https://sepolia.infura.io/v3/YOUR_KEY"

# Optional (for mainnet)
export MAINNET_SUI_RPC="https://rpc-mainnet.suiscan.xyz"
export MAINNET_SOLANA_RPC="https://api.mainnet-beta.solana.com"
export MAINNET_ETH_RPC="https://mainnet.infura.io/v3/YOUR_KEY"
```

### Required Balances

| Chain | Asset | Amount | Purpose |
|-------|-------|--------|---------|
| Sui Testnet | SUI | 5-10 | Gas for deployments + transactions |
| Sui Testnet | IKA | 1-2 | DKG for dWallets |
| Solana Devnet | SOL | 2-5 | Deploy program + mint fees |
| Ethereum Sepolia | ETH | 0.1 | Deploy deposit contracts |

---

## Sui Deployment

### Step 1: Build the Move Package

```bash
cd packages/sui-contracts/ikatensei

# Build the package
sui move build

# Output shows compiled .mv files
```

### Step 2: Publish to Testnet

```bash
# Publish the package
sui client publish --gas-budget 100000000 --json

# Output includes:
# - Package ID: 0x...
# - SealRegistry: shared object
# - SealVault: shared object
# - AdminCap: owned object
```

### Step 3: Initialize the Protocol

```bash
# Get the package ID from previous step
PACKAGE_ID="0x..."

# Get the shared object IDs (from tx effects)
REGISTRY_ID="0x..."
VAULT_ID="0x..."

# Transfer AdminCap to deployer (if not already)
sui client object $ADMIN_CAP_ID

# Register trusted emitter (for Wormhole integration)
sui client call \
  --package $PACKAGE_ID \
  --module registry \
  --function register_trusted_emitter \
  --args "2" "0x0000000000000000000000000000000000000000000000000000000000000002" \
  --type-args "0x2::sui::SUI" \
  --gas-budget 10000000

# Parameters:
# - chain_id: 2 = Sui, 1 = Ethereum, 3 = Solana, 4 = NEAR
# - emitter_address: Wormhole emitter address (32 bytes)
```

### Verifying Deployment

```bash
# Check registry state
sui client object $REGISTRY_ID --json

# Verify shared objects
sui client objects $SUI_ADDRESS --json | jq '.data[] | select(.type | contains("SealRegistry"))'

# Check vault
sui client object $VAULT_ID --json
```

---

## Solana Deployment

### Step 1: Build the Program

```bash
cd packages/solana-program/ika_tensei

# Build for devnet
cargo build-sbf --platform-linux-gnu

# Or build for mainnet
cargo build-sbf --release --platform-linux-gnu
```

**Important**: Use `cargo build-sbf`, NOT `anchor build`. This program uses vanilla Anchor, not the Anchor CLI.

### Step 2: Deploy to Devnet

```bash
# Set devnet cluster
solana config set --url devnet

# Airdrop some SOL if needed
solana airdrop 2

# Deploy the program
solana program deploy target/deploy/ika_tensei.so

# Output includes:
# - Program ID: mbEQvaiUYdc65Qz4rd67oBY1LbSCBq1Da8Y1MciwtPa
# - Signature: ...
```

### Step 3: Initialize the Program

```bash
# Get your wallet address
solana address

# Initialize protocol config
solana invoke \
  --program-id mbEQvaiUYdc65Qz4rd67oBY1LbSCBq1Da8Y1MciwtPa \
  --fee-payer ~/.config/solana/devnet.json \
  initialize \
  --guild-treasury <GUILD_WALLET> \
  --team-treasury <TEAM_WALLET> \
  --guild-share-bps 500 \
  --mint-fee 1000000

# Parameters:
# - guild_treasury: Wallet receiving 5% of mint fees
# - team_treasury: Wallet receiving 1.9% of mint fees
# - guild_share_bps: 500 = 5%
# - mint_fee: 1000000 lamports = 0.001 SOL
```

### Step 4: Register a Collection

```bash
solana invoke \
  --program-id mbEQvaiUYdc65Qz4rd67oBY1LbSCBq1Da8Y1MciwtPa \
  --fee-payer ~/.config/solana/devnet.json \
  register_collection \
  --source-chain 2 \
  --source-contract "0x...::ika_nft" \
  --name "Test Collection" \
  --max-supply 1000
```

### Verifying Deployment

```bash
# Check program info
solana program show mbEQvaiUYdc65Qz4rd67oBY1LbSCBq1Da8Y1MciwtPa

# Derive and check PDAs
solana address -k target/deploy/ika_tensei-keypair.json

# Check config PDA
solana account $(solana address -n mbEQv)
```

---

## Ethereum Deployment

### Step 1: Configure Foundry

```bash
cd packages/eth-contracts

# Create .env file
cat > .env << EOF
SEPOLIA_RPC_URL="https://sepolia.infura.io/v3/YOUR_KEY"
PRIVATE_KEY="your_private_key"
ETHERSCAN_API_KEY="your_etherscan_key"
EOF
```

### Step 2: Build Contracts

```bash
# Install dependencies
forge install

# Build
forge build

# Output includes compiled artifacts in out/
```

### Step 3: Deploy to Sepolia

```bash
# Deploy IkaNFT (example deposit contract)
forge create \
  --rpc-url $SEPOLIA_RPC_URL \
  --private-key $PRIVATE_KEY \
  --verify \
  src/IkaNFT.sol:IkaNFT

# Output includes:
# - Deployed to: 0x...
# - Verifying: ...
```

### Verifying Deployment

```bash
# Verify on Etherscan
forge verify-contract <CONTRACT_ADDRESS> src/IkaNFT.sol:IkaNFT

# Check deployment
cast call <CONTRACT_ADDRESS> "owner()" --rpc-url $SEPOLIA_RPC_URL
```

---

## Relayer Deployment

### Step 1: Build the Relayer

```bash
cd packages/relayer

# Install dependencies
npm install

# Build TypeScript
npm run build
```

### Step 2: Configure Environment

```bash
# Copy example config
cp config.example.yaml config.yaml

# Edit configuration
cat > config.yaml << EOF
server:
  host: "0.0.0.0"
  port: 3000

database:
  path: "./data/ika-tensei.db"

sui:
  rpcUrl: "https://rpc-testnet.suiscan.xyz"
  registryId: "0x8474..."
  vaultId: "0x..."

solana:
  rpcUrl: "https://api.devnet.solana.com"
  programId: "mbEQvaiUYdc65Qz4rd67oBY1LbSCBq1Da8Y1MciwtPa"

ika:
  network: "testnet"
  suiKeypairBytes: "base64_encoded_keypair"

relayer:
  privateKey: "base58_encoded_solana_keypair"
  pollingIntervalMs: 5000
  timeoutMs: 120000

logging:
  level: "info"
  format: "json"
EOF
```

### Step 3: Run the Relayer

```bash
# Development mode
npm run dev

# Production (with systemd)
sudo cp relayer.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable relayer
sudo systemctl start relayer
```

### Step 4: Verify Relayer Health

```bash
# Check health endpoint
curl http://localhost:3000/health

# Check queue status
curl http://localhost:3000/api/queue/status

# Check database
sqlite3 ./data/ika-tensei.db ".tables"
sqlite3 ./data/ika-tensei.db "SELECT * FROM seal_records LIMIT 10;"
```

---

## Verifying Full Deployment

### Check Sui Objects

```bash
# Registry should exist and have correct settings
sui client object $REGISTRY_ID --json | jq '.data.content'

# Vault should exist
sui client object $VAULT_ID --json | jq '.data.content'

# SealRegistry total_seals should be 0 initially
sui client call \
  --package $PACKAGE_ID \
  --module registry \
  --function total_seals \
  --args "$REGISTRY_ID" \
  --gas-budget 1000000
```

### Check Solana Program

```bash
# Config PDA should exist
solana account $(solana address -n mbEQv)

# Program should be upgradeable (or not, depending on config)
solana program show mbEQvaiUYdc65Qz4rd67oBY1LbSCBq1Da8Y1MciwtPa

# Should show:
# - Program Id: mbEQvaiUY...
# - Owner: System Program
# - Executable: true
# - Data Len: ...
```

### Check Relayer

```bash
# Health check
curl -s http://localhost:3000/health | jq '.'

# Response should include:
# {
#   "status": "healthy",
#   "version": "1.0.0",
#   "database": "connected",
#   "sui": "connected",
#   "solana": "connected"
# }
```

---

## Mainnet Deployment Checklist

- [ ] **Sui**
  - [ ] Package published to mainnet
  - [ ] SealRegistry shared object created
  - [ ] SealVault shared object created
  - [ ] AdminCap secured in multisig
  - [ ] Trusted emitters registered (Wormhole)

- [ ] **Solana**
  - [ ] Program deployed to mainnet
  - [ ] Config initialized with mainnet treasuries
  - [ ] Collections registered
  - [ ] Mint authority PDAs tested

- [ ] **Ethereum**
  - [ ] NFT deposit contract deployed
  - [ ] Verified on Etherscan

- [ ] **Relayer**
  - [ ] Built for production
  - [ ] Running with systemd
  - [ ] Health checks configured
  - [ ] Monitoring/alerts set up

- [ ] **Integration**
  - [ ] E2E flow tested on testnet
  - [ ] Frontend connected to mainnet
  - [ ] Error handling verified

---

## Troubleshooting

### "Program size too large"

**Cause**: Program exceeds size limit

**Solution**:
- Optimize Rust code (remove unused dependencies)
- Split into multiple programs
- Use `cargo build-sbf --release` for smaller binary

### "Transaction reverted: out of gas"

**Cause**: Gas budget too low

**Solution**:
- Increase gas budget (Sui: `--gas-budget 200000000`)
- Split into smaller transactions
- Optimize contract code

### "Invalid signature"

**Cause**: Wrong public key or message

**Solutions**:
- Verify Ed25519 pubkey matches between Sui and Solana
- Ensure seal hash is exactly 32 bytes
- Check signature format (64 bytes)

### "Account does not exist"

**Cause**: PDA not derived correctly

**Solution**:
- Verify seed strings match exactly
- Check program ID is correct
- Ensure bump is correct (or use canonical)

### "Rate limited" from RPC

**Cause**: Too many requests

**Solution**:
- Use dedicated RPC provider
- Implement request caching
- Add exponential backoff
