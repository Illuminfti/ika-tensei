# Contributing to Ika Tensei

Thank you for your interest in contributing to Ika Tensei! This document outlines the process for contributing code, documentation, and bug fixes.

## Getting Started

### Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Node.js | >= 18 | JavaScript runtime |
| Rust | >= 1.70 | Solana program |
| Move | (via Sui CLI) | Sui smart contracts |
| Docker | Latest | Local development |

### Repository Structure

```
ika-tensei/
├── packages/
│   ├── sui-contracts/      # Move contracts (Sui)
│   │   ├── ikatensei/      # Main protocol contracts
│   │   └── ikatensei_nft/ # Example NFT contract
│   ├── solana-program/    # Rust programs (Solana)
│   │   └── ika_tensei/    # Main protocol program
│   ├── eth-contracts/     # Solidity contracts (Ethereum)
│   ├── shared/            # TypeScript shared libraries
│   ├── relayer/           # Node.js relayer service
│   └── frontend/          # Web frontend
├── docs/                  # Documentation
└── tests/                 # Integration tests
```

### Setting Up Development Environment

```bash
# Clone the repository
git clone https://github.com/ika-network/ika-tensei.git
cd ika-tensei

# Install Node.js dependencies
npm install

# Install Rust dependencies
rustup update
cargo fetch

# Install Sui CLI
cargo install --locked sui

# Verify installation
sui --version
solana --version
```

### Running Tests

```bash
# Sui Move tests
cd packages/sui-contracts/ikatensei
sui move test

# Solana program tests
cd packages/solana-program/ika_tensei
cargo test

# Ethereum tests (requires Foundry)
cd packages/eth-contracts
forge test

# Relayer tests
cd packages/relayer
npm test
```

---

## Code Style

### TypeScript

We use strict TypeScript with the following rules:

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

**Formatting**: Use Prettier with default settings:
```bash
npm run format
```

**Linting**: 
```bash
npm run lint
```

### Move (Sui)

- Use 4-space indentation
- Document all public functions with doc comments (`///`)
- Use snake_case for functions and variables
- Use PascalCase for types and structs
- Maximum line length: 120 characters

**Example**:
```move
/// Registers a new seal in the registry.
/// 
/// # Arguments
/// * `registry` - Mutable reference to the SealRegistry
/// * `vault` - Mutable reference to the SealVault
/// * `seal_hash` - Canonical seal hash (32 bytes)
///
/// # Returns
/// The seal hash on success
public fun register_seal_with_vaa(
    registry: &mut SealRegistry,
    vault: &mut SealVault,
    seal_hash: vector<u8>,
    // ... other args
): vector<u8> {
    // implementation
}
```

### Rust (Solana)

Follow standard Rust conventions and the [Rust Book](https://doc.rust-lang.org/book/):

- Use `cargo fmt` for formatting
- Use `cargo clippy` for linting
- Document public APIs with doc comments
- Write unit tests for non-trivial functions

**Example**:
```rust
/// Verify a seal signature on Solana using Ed25519 precompile.
///
/// # Arguments
/// * `instructions_sysvar` - The instructions sysvar account
/// * `expected_signer` - Expected Ed25519 public key
/// * `expected_message` - Expected message (seal hash)
///
/// # Errors
/// Returns `ErrorCode::InvalidSignature` if verification fails
fn verify_ed25519_signature(
    instructions_sysvar: &AccountInfo,
    expected_signer: &Pubkey,
    expected_message: &[u8; 32],
) -> Result<()> {
    // implementation
}
```

### Solidity (Ethereum)

Follow [Solidity style guide](https://docs.soliditylang.org/en/v0.8.20/style-guide.html):

- Use `forge fmt` for formatting
- Use `forge test` for testing
- NatSpec documentation for public functions

---

## Testing Requirements

### Unit Tests

All new code should include unit tests:

**TypeScript**:
```typescript
describe('computeSealHash', () => {
  it('should compute correct hash', () => {
    const hash = computeSealHash({
      sourceChainId: ChainId.SUI,
      sourceContract: '0x1234',
      tokenId: '0x5678',
      attestationPubkey: new Uint8Array(32),
      nonce: 12345n,
    });
    expect(hash).toHaveLength(32);
  });
});
```

**Move**:
```move
#[test]
fun test_compute_seal_hash() {
    let hash = compute_seal_hash(
        2,                      // source_chain_id
        b"test_contract",      // source_contract
        b"test_token",         // token_id
        &x"0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
        12345,                 // nonce
    );
    assert!(vector::length(&hash) == 32, 0);
}
```

**Rust**:
```rust
#[test]
fn test_verify_ed25519_signature() {
    let result = verify_ed25519_signature(
        &instructions_sysvar,
        &expected_signer,
        &expected_message,
    );
    assert!(result.is_ok());
}
```

### Integration Tests

Integration tests should verify cross-chain flows:

```bash
# Run all integration tests
npm run test:e2e

# Run specific chain tests
npm run test:sui
npm run test:solana
npm run test:eth
```

### Coverage Requirements

- **Unit tests**: Minimum 80% coverage
- **Integration tests**: All E2E flows covered
- **Security-critical code**: 100% coverage

---

## Pull Request Process

### 1. Create a Branch

```bash
git checkout -b feature/my-new-feature
# or
git checkout -b fix/bug-description
```

### 2. Make Changes

- Follow code style guidelines
- Add tests for new functionality
- Update documentation if needed

### 3. Commit Messages

Use conventional commits:

```
feat: add new feature X
fix: resolve issue with Y
docs: update documentation
test: add tests for Z
refactor: simplify code in module
security: fix vulnerability in signature verification
```

### 4. Submit PR

1. Push your branch: `git push origin feature/my-new-feature`
2. Open a Pull Request on GitHub
3. Fill out the PR template
4. Request review from maintainers

### 5. Review Process

- All PRs require review
- CI must pass
- Tests must pass
- No merge conflicts

---

## Security Disclosure

If you discover a security vulnerability, please disclose it responsibly:

### Reporting Process

1. **DO NOT** create a public GitHub issue
2. Email security@ika.xyz with details
3. Wait for acknowledgment (within 48 hours)
4. Work with team on remediation
5. Receive credit after disclosure (if desired)

### Scope

In-scope vulnerabilities:
- Signature forgery
- Unauthorized seal registration
- dWallet key exposure
- Replay attacks
- Access control bypasses

Out of scope:
- Social engineering
- Phishing
- DDoS
- Third-party service issues

### Rewards

We have a bug bounty program for critical vulnerabilities. Rewards are based on severity and paid in IKA tokens.

---

## Code of Conduct

### Our Pledge

We are committed to providing a welcoming and inclusive environment for everyone.

### Standards

- Be respectful and inclusive
- Welcome newcomers
- Accept constructive criticism gracefully
- Focus on what's best for the community

### Enforcement

Violations should be reported to the maintainers. All complaints will be reviewed and investigated appropriately.

---

## Resources

- [Documentation](docs/)
- [Specification (PRD)](PRD-v3.md)
- [Security Audit](SECURITY_AUDIT.md)
- [Discord](https://discord.gg/ika)
- [Twitter](https://twitter.com/ika)

---

## Questions?

If you have questions, feel free to:
- Open a GitHub Discussion
- Join our Discord
- Email hello@ika.xyz
