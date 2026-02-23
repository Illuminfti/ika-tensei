// Ika Tensei PRD v6 - Payload Encoding/Decoding
//
// Handles encoding and decoding of Wormhole VAA payloads for the seal process.
// The payload format matches the EVM SealInitiator encoding.
//
// Payload Layout (from EVM SealInitiator):
//   [0]       payload_type: u8 = 1 (SealAttestation)
//   [1-2]     source_chain: u16 (big-endian)
//   [3-34]    nft_contract: 32 bytes (address padded to 32)
//   [35-66]   token_id: 32 bytes (u256 padded to 32)
//   [67-98]   deposit_address: 32 bytes (address padded to 32)
//   [99-130]  receiver: 32 bytes (Solana wallet, 32 bytes)
//   [131+]    token_uri: variable length string (remaining bytes)
//
// Total minimum: 131 bytes (without token_uri)
module ikatensei::payload {
    use std::vector;

    // Error codes
    const E_INVALID_PAYLOAD: u64 = 1;
    const E_INVALID_PAYLOAD_TYPE: u64 = 2;
    const E_INVALID_CHAIN_ID: u64 = 3;
    const E_INVALID_TOKEN_URI: u64 = 4;

    // Payload type constant
    const PAYLOAD_TYPE_SEAL: u8 = 1;

    // Supported chain IDs (Wormhole chain IDs)
    const CHAIN_ETHEREUM: u16 = 2;
    const CHAIN_POLYGON: u16 = 5;
    const CHAIN_ARBITRUM: u16 = 23;
    const CHAIN_OPTIMISM: u16 = 24;
    const CHAIN_BASE: u16 = 30;
    const CHAIN_AVALANCHE: u16 = 6;
    const CHAIN_BSC: u16 = 4;
    const CHAIN_SUI: u16 = 21;
    const CHAIN_SOLANA: u16 = 1;
    const CHAIN_NEAR: u16 = 15;

    /// Decoded seal payload from Wormhole VAA
    public struct SealPayload has copy, drop, store {
        source_chain: u16,
        nft_contract: vector<u8>,
        token_id: vector<u8>,
        deposit_address: vector<u8>,
        receiver: vector<u8>,
        token_uri: vector<u8>,
    }

    /// Decode a VAA payload into a SealPayload struct
    /// Panics if payload is invalid or wrong type
    public fun decode_seal_payload(payload: &vector<u8>): SealPayload {
        let len = vector::length(payload);
        assert!(len >= 131, E_INVALID_PAYLOAD); // Minimum payload size

        // [0] - payload type
        let payload_type = *vector::borrow(payload, 0);
        assert!(payload_type == PAYLOAD_TYPE_SEAL, E_INVALID_PAYLOAD_TYPE);

        // [1-2] - source chain (u16 big-endian)
        let source_chain = ((*vector::borrow(payload, 1) as u16) << 8) | (*vector::borrow(payload, 2) as u16);
        assert!(is_supported_chain(source_chain), E_INVALID_CHAIN_ID);

        // [3-34] - nft_contract (32 bytes)
        let mut nft_contract = vector::empty<u8>();
        let mut i = 3;
        while (i < 35) {
            vector::push_back(&mut nft_contract, *vector::borrow(payload, i));
            i = i + 1;
        };

        // [35-66] - token_id (32 bytes)
        let mut token_id = vector::empty<u8>();
        i = 35;
        while (i < 67) {
            vector::push_back(&mut token_id, *vector::borrow(payload, i));
            i = i + 1;
        };

        // [67-98] - deposit_address (32 bytes)
        let mut deposit_address = vector::empty<u8>();
        i = 67;
        while (i < 99) {
            vector::push_back(&mut deposit_address, *vector::borrow(payload, i));
            i = i + 1;
        };

        // [99-130] - receiver (32 bytes, Solana wallet)
        let mut receiver = vector::empty<u8>();
        i = 99;
        while (i < 131) {
            vector::push_back(&mut receiver, *vector::borrow(payload, i));
            i = i + 1;
        };

        // [131+] - token_uri (variable length)
        let mut token_uri = vector::empty<u8>();
        i = 131;
        while (i < len) {
            vector::push_back(&mut token_uri, *vector::borrow(payload, i));
            i = i + 1;
        };

        // Validate token_uri is not empty
        assert!(vector::length(&token_uri) > 0, E_INVALID_TOKEN_URI);

        SealPayload {
            source_chain,
            nft_contract,
            token_id,
            deposit_address,
            receiver,
            token_uri,
        }
    }

    /// Construct the message hash for IKA signing
    /// Format: sha256(token_id || token_uri || receiver)
    /// All fields are concatenated as raw bytes
    public fun construct_signing_message(
        token_id: &vector<u8>,
        token_uri: &vector<u8>,
        receiver: &vector<u8>,
    ): vector<u8> {
        let mut data = vector::empty<u8>();
        
        // Append token_id
        vector::append(&mut data, *token_id);
        
        // Append token_uri
        vector::append(&mut data, *token_uri);
        
        // Append receiver (Solana wallet address, 32 bytes)
        vector::append(&mut data, *receiver);
        
        // SHA256 hash
        std::hash::sha2_256(data)
    }

    /// Encode a seal payload (for testing or rebuilding VAA)
    public fun encode_seal_payload(
        source_chain: u16,
        nft_contract: vector<u8>,
        token_id: vector<u8>,
        deposit_address: vector<u8>,
        receiver: vector<u8>,
        token_uri: vector<u8>,
    ): vector<u8> {
        let mut payload = vector::empty<u8>();
        
        // Payload type
        vector::push_back(&mut payload, PAYLOAD_TYPE_SEAL);
        
        // Source chain (u16 big-endian)
        vector::push_back(&mut payload, ((source_chain >> 8) & 0xFF) as u8);
        vector::push_back(&mut payload, (source_chain & 0xFF) as u8);
        
        // NFT contract (32 bytes - pad if needed)
        let contract_len = vector::length(&nft_contract);
        let mut i = 0;
        while (i < 32) {
            if (i < contract_len) {
                vector::push_back(&mut payload, *vector::borrow(&nft_contract, i));
            } else {
                vector::push_back(&mut payload, 0u8);
            };
            i = i + 1;
        };
        
        // Token ID (32 bytes - pad if needed)
        let token_len = vector::length(&token_id);
        i = 0;
        while (i < 32) {
            if (i < token_len) {
                vector::push_back(&mut payload, *vector::borrow(&token_id, i));
            } else {
                vector::push_back(&mut payload, 0u8);
            };
            i = i + 1;
        };
        
        // Deposit address (32 bytes - pad if needed)
        let deposit_len = vector::length(&deposit_address);
        i = 0;
        while (i < 32) {
            if (i < deposit_len) {
                vector::push_back(&mut payload, *vector::borrow(&deposit_address, i));
            } else {
                vector::push_back(&mut payload, 0u8);
            };
            i = i + 1;
        };
        
        // Receiver (32 bytes - pad if needed)
        let receiver_len = vector::length(&receiver);
        i = 0;
        while (i < 32) {
            if (i < receiver_len) {
                vector::push_back(&mut payload, *vector::borrow(&receiver, i));
            } else {
                vector::push_back(&mut payload, 0u8);
            };
            i = i + 1;
        };
        
        // Token URI (variable length)
        vector::append(&mut payload, token_uri);
        
        payload
    }

    /// Check if a chain ID is supported
    public fun is_supported_chain(chain_id: u16): bool {
        chain_id == CHAIN_ETHEREUM
            || chain_id == CHAIN_POLYGON
            || chain_id == CHAIN_ARBITRUM
            || chain_id == CHAIN_OPTIMISM
            || chain_id == CHAIN_BASE
            || chain_id == CHAIN_AVALANCHE
            || chain_id == CHAIN_BSC
            || chain_id == CHAIN_SUI
            || chain_id == CHAIN_SOLANA
            || chain_id == CHAIN_NEAR
    }

    /// Get chain name for debugging/logging
    public fun chain_name(chain_id: u16): vector<u8> {
        if (chain_id == CHAIN_ETHEREUM) { return x"657468657265756d"; }; // "ethereum"
        if (chain_id == CHAIN_POLYGON) { return x"706f6c79676f6e"; };    // "polygon"
        if (chain_id == CHAIN_ARBITRUM) { return x"617262697472756d"; }; // "arbitrum"
        if (chain_id == CHAIN_OPTIMISM) { return x"6f7074696d69736d"; }; // "optimism"
        if (chain_id == CHAIN_BASE) { return x"62617365"; };             // "base"
        if (chain_id == CHAIN_AVALANCHE) { return x"6176616c616e636865"; }; // "avalanche"
        if (chain_id == CHAIN_BSC) { return x"627363"; };               // "bsc"
        if (chain_id == CHAIN_SUI) { return x"737569"; };               // "sui"
        if (chain_id == CHAIN_SOLANA) { return x"736f6c616e61"; };     // "solana"
        if (chain_id == CHAIN_NEAR) { return x"6e656172"; };           // "near"
        x"756e6b6f776e"  // "unknown"
    }

    // Accessor functions
    public fun get_source_chain(p: &SealPayload): u16 { p.source_chain }
    public fun get_nft_contract(p: &SealPayload): &vector<u8> { &p.nft_contract }
    public fun get_token_id(p: &SealPayload): &vector<u8> { &p.token_id }
    public fun get_deposit_address(p: &SealPayload): &vector<u8> { &p.deposit_address }
    public fun get_receiver(p: &SealPayload): &vector<u8> { &p.receiver }
    public fun get_token_uri(p: &SealPayload): &vector<u8> { &p.token_uri }
}
