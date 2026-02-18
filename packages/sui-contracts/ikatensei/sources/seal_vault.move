// Ika Tensei v3 - Seal Vault
// Permanently holds DWalletCap IDs. One-way vault - NO release function.
// Shared object. DWalletCaps themselves are passed to IKA coordinator for locking.
//
// Security model: Once IDs are recorded here, the corresponding DWalletCaps
// are owned by this contract. Since this contract has no approve_message()
// function, the IKA network can never produce signatures for sealed dWallets.
module ikatensei::seal_vault {
    use sui::table::{Self, Table};

    const E_CAP_NOT_FOUND: u64 = 1;
    const E_ALREADY_SEALED: u64 = 2;

    /// Shared object. Holds records of permanently sealed dWallet caps.
    /// Has key+store so it can be shared via public_share_object.
    public struct SealVault has key, store {
        id: UID,
        /// dWallet ID bytes -> sealed cap record
        sealed_caps: Table<vector<u8>, SealedCap>,
        total_sealed: u64,
    }

    /// Immutable record of a sealed capability
    public struct SealedCap has store {
        dwallet_id: ID,
        cap_id: ID,
    }

    public fun new_vault(ctx: &mut TxContext): SealVault {
        SealVault {
            id: object::new(ctx),
            sealed_caps: table::new(ctx),
            total_sealed: 0,
        }
    }

    /// Record permanently sealed DWalletCap IDs.
    /// Handles both single (Ed25519) and dual (secp256k1) dWallet cases.
    ///
    /// PERMANENT: No unseal() / release() / recover() function exists.
    /// Once sealed, the corresponding dWallet(s) can NEVER sign.
    public fun seal(
        vault: &mut SealVault,
        dwallet_id: ID,
        cap_id: ID,
        attestation_dwallet_id: ID,
        attestation_cap_id: ID,
        _seal_hash: vector<u8>,
        _ctx: &mut TxContext,
    ) {
        let key = object::id_to_bytes(&dwallet_id);
        assert!(!table::contains(&vault.sealed_caps, key), E_ALREADY_SEALED);
        table::add(&mut vault.sealed_caps, key, SealedCap { dwallet_id, cap_id });
        vault.total_sealed = vault.total_sealed + 1;

        // For secp256k1 chains: second attestation dWallet is also sealed
        if (attestation_dwallet_id != dwallet_id) {
            let attest_key = object::id_to_bytes(&attestation_dwallet_id);
            assert!(!table::contains(&vault.sealed_caps, attest_key), E_ALREADY_SEALED);
            table::add(&mut vault.sealed_caps, attest_key, SealedCap {
                dwallet_id: attestation_dwallet_id,
                cap_id: attestation_cap_id,
            });
            vault.total_sealed = vault.total_sealed + 1;
        };
    }

    /// Convenience wrapper for Ed25519 chains (single dWallet)
    public fun seal_single(
        vault: &mut SealVault,
        dwallet_id: ID,
        cap_id: ID,
        seal_hash: vector<u8>,
        ctx: &mut TxContext,
    ) {
        seal(vault, dwallet_id, cap_id, dwallet_id, cap_id, seal_hash, ctx);
    }

    public fun is_sealed(vault: &SealVault, dwallet_id: ID): bool {
        table::contains(&vault.sealed_caps, object::id_to_bytes(&dwallet_id))
    }

    public fun total_sealed(vault: &SealVault): u64 { vault.total_sealed }

    public fun get_cap_ids(vault: &SealVault, dwallet_id: ID): (ID, ID) {
        let key = object::id_to_bytes(&dwallet_id);
        assert!(table::contains(&vault.sealed_caps, key), E_CAP_NOT_FOUND);
        let s = table::borrow(&vault.sealed_caps, key);
        (s.dwallet_id, s.cap_id)
    }

    /// Get total sealed count
    public fun vault_total_sealed(vault: &SealVault): u64 {
        vault.total_sealed
    }
}
