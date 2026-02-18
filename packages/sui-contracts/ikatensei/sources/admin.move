// Ika Tensei v3 - Protocol Admin
// AdminCap + ProtocolConfig. No events here - events emitted by registry.
module ikatensei::admin {

    const E_INVALID_SHARE: u64 = 1;
    const E_ZERO_ADDRESS: u64 = 2;

    /// Protocol version = 3
    const PROTOCOL_VERSION: u64 = 3;
    /// Guild share: 500 bps = 5%
    const DEFAULT_GUILD_SHARE_BPS: u16 = 500;
    /// Team share: 190 bps = 1.9%
    const DEFAULT_TEAM_SHARE_BPS: u16 = 190;
    const MAX_BPS: u16 = 10000;

    /// Admin capability. Transfer to change admin.
    /// Has store so it can be held in multisig or timelock contracts.
    public struct AdminCap has key, store {
        id: UID,
    }

    /// Protocol configuration - embedded as a field in SealRegistry.
    public struct ProtocolConfig has copy, drop, store {
        version: u64,
        guild_treasury: address,
        team_treasury: address,
        guild_share_bps: u16,
        team_share_bps: u16,
        paused: bool,
    }

    public fun create_admin_cap(ctx: &mut TxContext): AdminCap {
        AdminCap { id: object::new(ctx) }
    }

    public fun create_initial_config(
        guild_treasury: address,
        team_treasury: address,
    ): ProtocolConfig {
        ProtocolConfig {
            version: PROTOCOL_VERSION,
            guild_treasury,
            team_treasury,
            guild_share_bps: DEFAULT_GUILD_SHARE_BPS,
            team_share_bps: DEFAULT_TEAM_SHARE_BPS,
            paused: false,
        }
    }

    public fun pause_protocol(config: &mut ProtocolConfig, _cap: &AdminCap) {
        config.paused = true;
    }

    public fun unpause_protocol(config: &mut ProtocolConfig, _cap: &AdminCap) {
        config.paused = false;
    }

    public fun update_treasuries(
        config: &mut ProtocolConfig,
        _cap: &AdminCap,
        guild_treasury: address,
        team_treasury: address,
    ) {
        assert!(guild_treasury != @0x0, E_ZERO_ADDRESS);
        assert!(team_treasury != @0x0, E_ZERO_ADDRESS);
        config.guild_treasury = guild_treasury;
        config.team_treasury = team_treasury;
    }

    public fun update_shares(
        config: &mut ProtocolConfig,
        _cap: &AdminCap,
        guild_share_bps: u16,
        team_share_bps: u16,
    ) {
        let total = (guild_share_bps as u32) + (team_share_bps as u32);
        assert!((total as u16) <= MAX_BPS, E_INVALID_SHARE);
        config.guild_share_bps = guild_share_bps;
        config.team_share_bps = team_share_bps;
    }

    // Accessors
    public fun is_paused(c: &ProtocolConfig): bool { c.paused }
    public fun version(c: &ProtocolConfig): u64 { c.version }
    public fun guild_treasury(c: &ProtocolConfig): address { c.guild_treasury }
    public fun team_treasury(c: &ProtocolConfig): address { c.team_treasury }
    public fun guild_share_bps(c: &ProtocolConfig): u16 { c.guild_share_bps }
    public fun team_share_bps(c: &ProtocolConfig): u16 { c.team_share_bps }

    public fun calculate_guild_share(c: &ProtocolConfig, fee: u64): u64 {
        (fee * (c.guild_share_bps as u64)) / (MAX_BPS as u64)
    }

    public fun calculate_team_share(c: &ProtocolConfig, fee: u64): u64 {
        (fee * (c.team_share_bps as u64)) / (MAX_BPS as u64)
    }
}
