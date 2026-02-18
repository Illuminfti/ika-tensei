# Security

This document outlines security considerations and practices for Ika Tensei.

## Program Upgrade Authority Lifecycle

The Solana program implements a 3-phase upgrade authority model to balance flexibility during development with security for production.

### Phase 1: Deployer Authority (Development)
- **Authority:** Deployer keypair
- **Use case:** Initial deployment, development, testing
- **Risk:** High - single point of failure

### Phase 2: Multisig Authority (Post-Audit)
- **Authority:** Multi-signature wallet (recommended: 3-of-5)
- **Use case:** Production mainnet after audit completion
- **Risk:** Medium - requires coordination among signers
- **Implementation:**
  ```bash
  solana program set-upgrade-authority <PROGRAM_ID> \
    --new-upgrade-authority <MULTISIG_ADDRESS> \
    --url mainnet-beta
  ```

### Phase 3: Immutable (Post-Stability)
- **Authority:** None (revoked)
- **Use case:** After 30+ days of stable operation
- **Risk:** None - no upgrades possible
- **Implementation:**
  ```bash
  solana program set-upgrade-authority <PROGRAM_ID> \
    --final \
    --url mainnet-beta
  ```

## Security Checklist

Before mainnet deployment:
- [ ] Complete third-party security audit
- [ ] Transfer upgrade authority to multisig
- [ ] Document multisig signers and threshold
- [ ] Store multisig configuration in secure operational runbook
- [ ] Verify upgrade authority: `solana program show <PROGRAM_ID>`
- [ ] Plan stability period (minimum 30 days)
- [ ] Plan revocation after stability period

## Multisig Recommendations

- Use hardware wallets for all signers
- Distribute signers across geographic locations
- Document recovery procedures
- Test upgrade flow on devnet first
- Use multisig with timelock for additional safety

## Reporting Security Issues

For security vulnerabilities, contact the team via appropriate channels. Do not open public issues for security bugs.
