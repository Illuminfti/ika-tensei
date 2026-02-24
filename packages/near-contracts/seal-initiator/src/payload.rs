use sha2::{Digest, Sha256};

/// Wormhole chain ID for NEAR
pub const WORMHOLE_CHAIN_ID_NEAR: u16 = 15;

/// Payload type for Seal Attestation
pub const PAYLOAD_TYPE_SEAL: u8 = 0x01;

/// Encode a NEAR account ID (string) into 32 bytes via SHA256.
///
/// NEAR account IDs are variable-length strings (e.g., "alice.near").
/// EVM uses left-padded 20-byte addresses. To produce a deterministic
/// 32-byte value from a string, we use SHA256.
pub fn encode_near_account(account_id: &str) -> [u8; 32] {
    let mut hasher = Sha256::new();
    hasher.update(account_id.as_bytes());
    hasher.finalize().into()
}

/// Encode a NEAR token ID (string) into 32 bytes via SHA256.
///
/// NEAR token IDs are strings (e.g., "1", "cool-nft-42").
/// The wire format requires a 32-byte big-endian value.
/// SHA256 produces a deterministic 32-byte hash.
pub fn encode_near_token_id(token_id: &str) -> [u8; 32] {
    let mut hasher = Sha256::new();
    hasher.update(token_id.as_bytes());
    hasher.finalize().into()
}

/// Build the binary Wormhole payload matching the canonical wire format.
///
/// Wire format (from docs/WIRE-FORMAT-SPEC.md):
///   Offset  Size  Field            Encoding
///   0       1     payload_type     u8 = 0x01
///   1       2     source_chain     u16 big-endian = 15 (NEAR)
///   3       32    nft_contract     SHA256(nft_contract_account_id)
///   35      32    token_id         SHA256(token_id_string)
///   67      32    deposit_address  SHA256(deposit_account_id)
///   99      32    receiver         raw Solana pubkey (32 bytes)
///   131     var   token_uri        raw UTF-8, no length prefix
///
/// Total minimum: 131 bytes (empty URI)
pub fn build_seal_payload(
    nft_contract: &str,
    token_id: &str,
    deposit_address: &str,
    solana_receiver: &[u8; 32],
    token_uri: &str,
) -> Vec<u8> {
    let mut payload = Vec::with_capacity(131 + token_uri.len());

    // [0] payload_type = 0x01
    payload.push(PAYLOAD_TYPE_SEAL);

    // [1-2] source_chain = 15 (big-endian u16)
    payload.extend_from_slice(&WORMHOLE_CHAIN_ID_NEAR.to_be_bytes());

    // [3-34] nft_contract = SHA256(account_id)
    payload.extend_from_slice(&encode_near_account(nft_contract));

    // [35-66] token_id = SHA256(token_id_string)
    payload.extend_from_slice(&encode_near_token_id(token_id));

    // [67-98] deposit_address = SHA256(account_id)
    payload.extend_from_slice(&encode_near_account(deposit_address));

    // [99-130] receiver = raw Solana pubkey
    payload.extend_from_slice(solana_receiver);

    // [131+] token_uri = raw UTF-8 bytes, no length prefix
    payload.extend_from_slice(token_uri.as_bytes());

    debug_assert!(payload.len() >= 131, "Payload too short");

    payload
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_payload_encoding_minimum() {
        let payload = build_seal_payload(
            "nft.paras.near",
            "42",
            "alice.near",
            &[0xAA; 32],
            "", // empty URI
        );

        assert_eq!(payload.len(), 131);
        assert_eq!(payload[0], 0x01); // payload_type
        assert_eq!(payload[1], 0x00); // source_chain high byte
        assert_eq!(payload[2], 0x0F); // source_chain low byte (15)
    }

    #[test]
    fn test_payload_encoding_with_uri() {
        let uri = "ipfs://QmTest123";
        let payload = build_seal_payload(
            "nft.paras.near",
            "42",
            "alice.near",
            &[0xBB; 32],
            uri,
        );

        assert_eq!(payload.len(), 131 + uri.len());
        assert_eq!(&payload[131..], uri.as_bytes());
    }

    #[test]
    fn test_nft_contract_encoding() {
        let expected = encode_near_account("nft.paras.near");
        let payload = build_seal_payload(
            "nft.paras.near",
            "1",
            "bob.near",
            &[0; 32],
            "",
        );
        assert_eq!(&payload[3..35], &expected);
    }

    #[test]
    fn test_token_id_encoding() {
        let expected = encode_near_token_id("42");
        let payload = build_seal_payload(
            "nft.near",
            "42",
            "bob.near",
            &[0; 32],
            "",
        );
        assert_eq!(&payload[35..67], &expected);
    }

    #[test]
    fn test_deposit_address_encoding() {
        let expected = encode_near_account("alice.near");
        let payload = build_seal_payload(
            "nft.near",
            "1",
            "alice.near",
            &[0; 32],
            "",
        );
        assert_eq!(&payload[67..99], &expected);
    }

    #[test]
    fn test_receiver_raw_bytes() {
        let receiver = [0x42u8; 32];
        let payload = build_seal_payload(
            "nft.near",
            "1",
            "bob.near",
            &receiver,
            "",
        );
        assert_eq!(&payload[99..131], &receiver);
    }

    #[test]
    fn test_encode_account_deterministic() {
        let a = encode_near_account("alice.near");
        let b = encode_near_account("alice.near");
        assert_eq!(a, b);

        let c = encode_near_account("bob.near");
        assert_ne!(a, c);
    }

    #[test]
    fn test_chain_id() {
        assert_eq!(WORMHOLE_CHAIN_ID_NEAR, 15);
    }
}
