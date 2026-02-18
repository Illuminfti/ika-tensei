"use client";

import React from "react";

// ============================================
// Utility functions
// ============================================
function lightenColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace("#", ""), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.min(255, (num >> 16) + amt);
  const G = Math.min(255, ((num >> 8) & 0x00ff) + amt);
  const B = Math.min(255, (num & 0x0000ff) + amt);
  return `#${(0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)}`;
}

function darkenColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace("#", ""), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.max(0, (num >> 16) - amt);
  const G = Math.max(0, ((num >> 8) & 0x00ff) - amt);
  const B = Math.max(0, (num & 0x0000ff) - amt);
  return `#${(0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)}`;
}

// ============================================
// IkaSprite - 16x16 pixel squid with expressions
// ============================================
export type IkaExpression = "neutral" | "excited" | "worried" | "smug" | "angry" | "sleeping";

interface IkaSpriteProps {
  size?: number;
  expression?: IkaExpression;
}

const IKA_COLORS = {
  body: "#9b59b6",
  bodyLight: "#c084fc",
  bodyDark: "#6b21a8",
  eye: "#e8e0f0",
  pupil: "#0d0a1a",
  tentacle: "#ff3366",
  tentacleDark: "#cc1144",
  blush: "#ff6b9d",
  sleep: "#6b5a7a",
};

export function IkaSprite({ size = 32, expression = "neutral" }: IkaSpriteProps) {
  const renderEyes = () => {
    if (expression === "sleeping") {
      return (
        <>
          <rect x="5" y="7" width="3" height="1" fill={IKA_COLORS.sleep} />
          <rect x="8" y="7" width="3" height="1" fill={IKA_COLORS.sleep} />
        </>
      );
    }
    if (expression === "angry") {
      return (
        <>
          <rect x="4" y="6" width="4" height="3" fill={IKA_COLORS.eye} />
          <rect x="8" y="6" width="4" height="3" fill={IKA_COLORS.eye} />
          <rect x="4" y="5" width="4" height="1" fill="#ff0000" />
          <rect x="8" y="5" width="4" height="1" fill="#ff0000" />
          <rect x="5" y="8" width="1" height="1" fill={IKA_COLORS.pupil} />
          <rect x="10" y="8" width="1" height="1" fill={IKA_COLORS.pupil} />
        </>
      );
    }
    // neutral, excited, worried, smug
    return (
      <>
        <rect x="4" y="6" width="4" height="3" fill={IKA_COLORS.eye} />
        <rect x="8" y="6" width="4" height="3" fill={IKA_COLORS.eye} />
        <rect x="5" y="7" width="2" height="2" fill={IKA_COLORS.pupil} />
        <rect x="9" y="7" width="2" height="2" fill={IKA_COLORS.pupil} />
      </>
    );
  };

  const renderMouth = () => {
    switch (expression) {
      case "smug":
        return <rect x="6" y="10" width="4" height="1" fill={IKA_COLORS.bodyDark} />;
      case "worried":
        return (
          <>
            <rect x="4" y="10" width="3" height="1" fill={IKA_COLORS.bodyDark} />
            <rect x="9" y="10" width="3" height="1" fill={IKA_COLORS.bodyDark} />
          </>
        );
      case "angry":
        return <rect x="5" y="10" width="6" height="1" fill={IKA_COLORS.bodyDark} />;
      case "sleeping":
        return null;
      default:
        return <rect x="6" y="10" width="4" height="1" fill={IKA_COLORS.bodyDark} />;
    }
  };

  const renderBlush = () => {
    if (expression === "excited" || expression === "smug") {
      return (
        <>
          <rect x="2" y="9" width="2" height="1" fill={IKA_COLORS.blush} opacity="0.5" />
          <rect x="12" y="9" width="2" height="1" fill={IKA_COLORS.blush} opacity="0.5" />
        </>
      );
    }
    return null;
  };

  const renderGlow = () => {
    if (expression === "excited") {
      return (
        <>
          <rect x="6" y="2" width="4" height="1" fill="#00ccff" opacity="0.6" />
          <rect x="2" y="5" width="1" height="1" fill="#00ccff" opacity="0.4" />
          <rect x="13" y="5" width="1" height="1" fill="#00ccff" opacity="0.4" />
        </>
      );
    }
    return null;
  };

  const renderZzz = () => {
    if (expression === "sleeping") {
      return (
        <>
          <rect x="11" y="2" width="2" height="1" fill="#ffffff" opacity="0.7" />
          <rect x="12" y="1" width="2" height="1" fill="#ffffff" opacity="0.5" />
        </>
      );
    }
    return null;
  };

  return (
    <svg width={size} height={size} viewBox="0 0 16 16" style={{ imageRendering: "pixelated" as const }}>
      {/* Dome */}
      <rect x="5" y="1" width="6" height="1" fill={IKA_COLORS.bodyLight} />
      <rect x="4" y="2" width="8" height="1" fill={IKA_COLORS.bodyLight} />
      <rect x="3" y="3" width="10" height="1" fill={IKA_COLORS.body} />
      <rect x="2" y="4" width="12" height="6" fill={IKA_COLORS.body} />
      
      {/* Eyes */}
      {renderEyes()}
      
      {/* Blush marks */}
      {renderBlush()}
      
      {/* Mouth */}
      {renderMouth()}
      
      {/* Underbelly */}
      <rect x="3" y="10" width="10" height="2" fill={IKA_COLORS.bodyDark} />
      
      {/* Body mantle */}
      <rect x="2" y="12" width="12" height="2" fill={IKA_COLORS.body} />
      <rect x="3" y="14" width="10" height="1" fill={IKA_COLORS.bodyDark} />
      
      {/* Tentacles */}
      <rect x="2" y="15" width="2" height="1" fill={IKA_COLORS.tentacle} />
      <rect x="4" y="15" width="2" height="1" fill={IKA_COLORS.tentacle} />
      <rect x="6" y="15" width="2" height="1" fill={IKA_COLORS.tentacle} />
      <rect x="8" y="15" width="2" height="1" fill={IKA_COLORS.tentacle} />
      <rect x="10" y="15" width="2" height="1" fill={IKA_COLORS.tentacle} />
      <rect x="12" y="15" width="2" height="1" fill={IKA_COLORS.tentacle} />
      
      {/* Glow effects */}
      {renderGlow()}
      
      {/* Zzz for sleeping */}
      {renderZzz()}
    </svg>
  );
}

// ============================================
// SealIcon - 16x16 wax seal
// ============================================
interface SealIconProps {
  size?: number;
}

const SEAL_COLORS = {
  gold: "#ffd700",
  purple: "#9b59b6",
  pink: "#ff3366",
  grey: "#8a7a9a",
};

export function SealIcon({ size = 32 }: SealIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" style={{ imageRendering: "pixelated" as const }}>
      {/* Gold top */}
      <rect x="4" y="1" width="8" height="2" fill={SEAL_COLORS.gold} />
      <rect x="5" y="2" width="6" height="1" fill={SEAL_COLORS.gold} />
      
      {/* Purple body */}
      <rect x="3" y="3" width="10" height="8" fill={SEAL_COLORS.purple} />
      <rect x="4" y="4" width="8" height="6" fill={darkenColor(SEAL_COLORS.purple, 15)} />
      
      {/* Pink center mark */}
      <rect x="5" y="5" width="6" height="4" fill={SEAL_COLORS.pink} />
      <rect x="6" y="6" width="4" height="2" fill="#ff6699" />
      <rect x="7" y="7" width="2" height="1" fill="#ffffff" opacity="0.3" />
      
      {/* Gold bottom */}
      <rect x="4" y="11" width="8" height="2" fill={SEAL_COLORS.gold} />
      <rect x="5" y="12" width="6" height="1" fill={SEAL_COLORS.gold} />
      
      {/* Chain links below */}
      <rect x="3" y="13" width="2" height="2" fill={SEAL_COLORS.grey} />
      <rect x="7" y="13" width="2" height="2" fill={SEAL_COLORS.grey} />
      <rect x="11" y="13" width="2" height="2" fill={SEAL_COLORS.grey} />
      <rect x="5" y="14" width="2" height="1" fill={SEAL_COLORS.grey} />
      <rect x="9" y="14" width="2" height="1" fill={SEAL_COLORS.grey} />
    </svg>
  );
}

// ============================================
// ChainBadge - 8x8 rounded square
// ============================================
type ChainType = "ethereum" | "sui" | "solana";

interface ChainBadgeProps {
  chain: ChainType;
  size?: number;
}

const CHAIN_COLORS: Record<ChainType, { bg: string; letter: string }> = {
  ethereum: { bg: "#627eea", letter: "E" },
  sui: { bg: "#4da2ff", letter: "S" },
  solana: { bg: "#9945ff", letter: "S" },
};

export function ChainBadge({ chain, size = 24 }: ChainBadgeProps) {
  const { bg } = CHAIN_COLORS[chain];
  
  return (
    <svg width={size} height={size} viewBox="0 0 8 8" style={{ imageRendering: "pixelated" as const }}>
      {/* Rounded square background */}
      <rect x="1" y="1" width="6" height="6" rx="1" fill={bg} />
      <rect x="1" y="1" width="6" height="6" rx="1" fill={darkenColor(bg, 10)} opacity="0.3" />
      
      {/* Center letter pixel */}
      <rect x="3" y="3" width="2" height="2" fill="#ffffff" />
    </svg>
  );
}

// ============================================
// TreasureChest - 16x16
// ============================================
interface TreasureChestProps {
  size?: number;
  open?: boolean;
}

const CHEST_COLORS = {
  wood: "#8b4513",
  woodDark: "#5c2e0a",
  gold: "#ffd700",
  goldLight: "#ffec8b",
  metal: "#c0c0c0",
};

export function TreasureChest({ size = 32, open = false }: TreasureChestProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" style={{ imageRendering: "pixelated" as const }}>
      {open ? (
        <>
          {/* Lid open upward */}
          <rect x="2" y="1" width="12" height="4" fill={CHEST_COLORS.wood} />
          <rect x="3" y="1" width="10" height="3" fill={CHEST_COLORS.woodDark} />
          
          {/* Gold glow inside */}
          <rect x="3" y="9" width="10" height="5" fill={CHEST_COLORS.gold} opacity="0.5" />
          
          {/* Gold coins */}
          <rect x="4" y="10" width="2" height="2" fill={CHEST_COLORS.gold} />
          <rect x="7" y="9" width="2" height="2" fill={CHEST_COLORS.goldLight} />
          <rect x="10" y="10" width="2" height="2" fill={CHEST_COLORS.gold} />
          <rect x="5" y="12" width="2" height="2" fill={CHEST_COLORS.goldLight} />
          <rect x="9" y="11" width="2" height="2" fill={CHEST_COLORS.gold} />
          
          {/* Chest base */}
          <rect x="2" y="9" width="12" height="5" fill={CHEST_COLORS.wood} />
          <rect x="3" y="10" width="10" height="3" fill={CHEST_COLORS.woodDark} />
          
          {/* Metal bands */}
          <rect x="3" y="9" width="1" height="5" fill={CHEST_COLORS.metal} />
          <rect x="12" y="9" width="1" height="5" fill={CHEST_COLORS.metal} />
        </>
      ) : (
        <>
          {/* Closed chest */}
          <rect x="2" y="5" width="12" height="9" fill={CHEST_COLORS.wood} />
          <rect x="3" y="6" width="10" height="7" fill={CHEST_COLORS.woodDark} />
          
          {/* Lid */}
          <rect x="2" y="3" width="12" height="4" fill={CHEST_COLORS.wood} />
          <rect x="3" y="4" width="10" height="2" fill={CHEST_COLORS.woodDark} />
          
          {/* Lock */}
          <rect x="6" y="7" width="4" height="3" fill={CHEST_COLORS.metal} />
          <rect x="7" y="8" width="2" height="1" fill={CHEST_COLORS.gold} />
          
          {/* Metal bands */}
          <rect x="3" y="5" width="1" height="9" fill={CHEST_COLORS.metal} />
          <rect x="12" y="5" width="1" height="9" fill={CHEST_COLORS.metal} />
        </>
      )}
    </svg>
  );
}

// ============================================
// ScrollIcon - 16x16
// ============================================
interface ScrollIconProps {
  size?: number;
  open?: boolean;
}

const SCROLL_COLORS = {
  parchment: "#f4e4bc",
  parchmentDark: "#d4c49c",
  wood: "#8b4513",
};

export function ScrollIcon({ size = 32, open = false }: ScrollIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" style={{ imageRendering: "pixelated" as const }}>
      {open ? (
        <>
          {/* Unrolled scroll */}
          {/* Top roll */}
          <rect x="1" y="1" width="14" height="2" fill={SCROLL_COLORS.wood} />
          <rect x="2" y="1" width="12" height="1" fill={darkenColor(SCROLL_COLORS.wood, 10)} />
          
          {/* Parchment body */}
          <rect x="1" y="3" width="14" height="10" fill={SCROLL_COLORS.parchment} />
          <rect x="2" y="4" width="12" height="8" fill={SCROLL_COLORS.parchmentDark} opacity="0.3" />
          
          {/* Text lines */}
          <rect x="3" y="5" width="10" height="1" fill="#2a1a0a" opacity="0.4" />
          <rect x="3" y="7" width="8" height="1" fill="#2a1a0a" opacity="0.3" />
          <rect x="3" y="9" width="9" height="1" fill="#2a1a0a" opacity="0.3" />
          <rect x="3" y="11" width="6" height="1" fill="#2a1a0a" opacity="0.2" />
          
          {/* Bottom roll */}
          <rect x="1" y="13" width="14" height="2" fill={SCROLL_COLORS.wood} />
          <rect x="2" y="14" width="12" height="1" fill={darkenColor(SCROLL_COLORS.wood, 10)} />
        </>
      ) : (
        <>
          {/* Rolled scroll */}
          <rect x="5" y="2" width="6" height="12" fill={SCROLL_COLORS.wood} />
          <rect x="6" y="3" width="4" height="10" fill={SCROLL_COLORS.parchment} />
          
          {/* Top cap */}
          <rect x="4" y="1" width="3" height="2" fill={SCROLL_COLORS.wood} />
          <rect x="5" y="1" width="1" height="1" fill={SCROLL_COLORS.parchmentDark} />
          
          {/* Bottom cap */}
          <rect x="4" y="13" width="3" height="2" fill={SCROLL_COLORS.wood} />
          <rect x="5" y="14" width="1" height="1" fill={SCROLL_COLORS.parchmentDark} />
          
          {/* Ribbon tie */}
          <rect x="7" y="7" width="2" height="2" fill="#ff3366" />
        </>
      )}
    </svg>
  );
}

// ============================================
// SwordIcon - 16x16
// ============================================
interface SwordIconProps {
  size?: number;
  drawn?: boolean;
}

const SWORD_COLORS = {
  blade: "#c0c0c0",
  bladeLight: "#e0e0e0",
  handle: "#8b4513",
  guard: "#ffd700",
};

export function SwordIcon({ size = 32, drawn = false }: SwordIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" style={{ imageRendering: "pixelated" as const }}>
      {drawn ? (
        <>
          {/* Drawn sword */}
          {/* Blade */}
          <rect x="7" y="1" width="2" height="10" fill={SWORD_COLORS.blade} />
          <rect x="7" y="1" width="1" height="10" fill={SWORD_COLORS.bladeLight} />
          
          {/* Cross guard */}
          <rect x="4" y="11" width="8" height="1" fill={SWORD_COLORS.guard} />
          <rect x="5" y="11" width="6" height="1" fill={darkenColor(SWORD_COLORS.guard, 10)} />
          
          {/* Handle */}
          <rect x="7" y="12" width="2" height="3" fill={SWORD_COLORS.handle} />
          
          {/* Pommel */}
          <rect x="7" y="15" width="2" height="1" fill={SWORD_COLORS.guard} />
        </>
      ) : (
        <>
          {/* Sheathed sword */}
          {/* Sheath */}
          <rect x="6" y="6" width="4" height="9" fill={SWORD_COLORS.handle} />
          <rect x="6" y="6" width="3" height="9" fill={darkenColor(SWORD_COLORS.handle, 15)} />
          
          {/* Handle visible at top */}
          <rect x="6" y="3" width="4" height="3" fill={SWORD_COLORS.handle} />
          <rect x="7" y="2" width="2" height="1" fill={SWORD_COLORS.guard} />
          
          {/* Belt loop */}
          <rect x="5" y="10" width="6" height="1" fill={SWORD_COLORS.handle} />
        </>
      )}
    </svg>
  );
}

// ============================================
// ShieldIcon - 16x16 purple shield with gold crest
// ============================================
interface ShieldIconProps {
  size?: number;
}

const SHIELD_COLORS = {
  purple: "#9b59b6",
  gold: "#ffd700",
  outline: "#2a1a3a",
};

export function ShieldIcon({ size = 32 }: ShieldIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" style={{ imageRendering: "pixelated" as const }}>
      {/* Shield base */}
      <rect x="2" y="2" width="12" height="12" fill={SHIELD_COLORS.purple} />
      <rect x="3" y="3" width="10" height="10" fill={darkenColor(SHIELD_COLORS.purple, 15)} />
      
      {/* Shield shape inner */}
      <rect x="3" y="3" width="10" height="10" fill={SHIELD_COLORS.purple} />
      
      {/* Gold crest */}
      <rect x="5" y="5" width="6" height="4" fill={SHIELD_COLORS.gold} />
      <rect x="6" y="6" width="4" height="1" fill={SHIELD_COLORS.purple} />
      <rect x="6" y="8" width="4" height="1" fill={SHIELD_COLORS.purple} />
      <rect x="7" y="9" width="2" height="1" fill={SHIELD_COLORS.gold} />
      
      {/* Top point */}
      <rect x="6" y="3" width="4" height="2" fill={SHIELD_COLORS.gold} />
      
      {/* Shield border */}
      <rect x="2" y="2" width="12" height="1" fill={SHIELD_COLORS.outline} />
      <rect x="2" y="13" width="12" height="1" fill={SHIELD_COLORS.outline} />
      <rect x="2" y="3" width="1" height="10" fill={SHIELD_COLORS.outline} />
      <rect x="13" y="3" width="1" height="10" fill={SHIELD_COLORS.outline} />
    </svg>
  );
}

// ============================================
// RuneStone - 16x16 with 6 variants
// ============================================
interface RuneStoneProps {
  size?: number;
  variant?: number;
}

const RUNE_COLORS = [
  { stone: "#4a3020", rune: "#ff6600", glow: "#ffaa00" }, // fire
  { stone: "#203040", rune: "#00aaff", glow: "#66ddff" }, // water
  { stone: "#304020", rune: "#44aa44", glow: "#88cc66" }, // earth
  { stone: "#606070", rune: "#aaddff", glow: "#ddffff" }, // air
  { stone: "#f0e0a0", rune: "#ffffaa", glow: "#ffffff" }, // light
  { stone: "#201030", rune: "#8844cc", glow: "#aa66ff" }, // dark
];

// Rune symbol patterns (5x5)
const RUNE_PATTERNS = [
  ["01110", "10001", "11111", "10001", "10001"], // fire
  ["00100", "01110", "10101", "00100", "00100"], // water
  ["01110", "10001", "10001", "11111", "10001"], // earth
  ["00100", "01010", "11111", "01010", "10101"], // air
  ["01110", "11111", "11111", "01110", "01110"], // light
  ["10001", "11011", "11111", "01110", "00100"], // dark
];

export function RuneStone({ size = 32, variant = 0 }: RuneStoneProps) {
  const colors = RUNE_COLORS[variant % 6];
  const pattern = RUNE_PATTERNS[variant % 6];
  
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" style={{ imageRendering: "pixelated" as const }}>
      {/* Stone base with glow */}
      <rect x="2" y="2" width="12" height="12" fill={colors.stone} />
      <rect x="3" y="3" width="10" height="10" fill={darkenColor(colors.stone, 10)} />
      
      {/* Glowing aura */}
      <rect x="3" y="3" width="10" height="10" fill={colors.glow} opacity="0.2" />
      <rect x="4" y="4" width="8" height="8" fill={colors.glow} opacity="0.15" />
      
      {/* Rune symbol */}
      {pattern.map((row, y) =>
        row.split("").map((pixel, x) =>
          pixel === "1" && (
            <rect
              key={`${x}-${y}`}
              x={5 + x * 1}
              y={5 + y * 1}
              width="1"
              height="1"
              fill={colors.rune}
            />
          )
        )
      )}
      
      {/* Border glow */}
      <rect x="2" y="2" width="12" height="1" fill={colors.glow} opacity="0.4" />
      <rect x="2" y="13" width="12" height="1" fill={colors.glow} opacity="0.4" />
      <rect x="2" y="3" width="1" height="10" fill={colors.glow} opacity="0.4" />
      <rect x="13" y="3" width="1" height="10" fill={colors.glow} opacity="0.4" />
    </svg>
  );
}

// ============================================
// SoulOrb - 8x8 glowing circle
// ============================================
interface SoulOrbProps {
  size?: number;
  color?: string;
}

const SOUL_COLORS = {
  cyan: "#00ccff",
};

export function SoulOrb({ size = 24, color = SOUL_COLORS.cyan }: SoulOrbProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 8 8" style={{ imageRendering: "pixelated" as const }}>
      {/* Outer glow */}
      <rect x="1" y="1" width="6" height="6" fill={color} opacity="0.2" />
      <rect x="2" y="2" width="4" height="4" fill={color} opacity="0.3" />
      
      {/* Core orb */}
      <rect x="2" y="2" width="4" height="4" fill={color} />
      <rect x="3" y="3" width="2" height="2" fill={lightenColor(color, 20)} />
      
      {/* Inner highlight */}
      <rect x="3" y="3" width="1" height="1" fill="#ffffff" opacity="0.6" />
    </svg>
  );
}

// ============================================
// PortalIcon - 16x16 swirling void
// ============================================
interface PortalIconProps {
  size?: number;
}

const PORTAL_COLORS = {
  purple: "#6633cc",
  pink: "#ff3366",
  dark: "#1a0a2e",
};

export function PortalIcon({ size = 32 }: PortalIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" style={{ imageRendering: "pixelated" as const }}>
      {/* Outer ring */}
      <rect x="2" y="2" width="12" height="12" fill={PORTAL_COLORS.dark} />
      <rect x="3" y="3" width="10" height="10" fill={PORTAL_COLORS.purple} opacity="0.3" />
      
      {/* Swirling void - concentric circles */}
      <rect x="4" y="4" width="8" height="8" fill={PORTAL_COLORS.purple} opacity="0.4" />
      <rect x="5" y="5" width="6" height="6" fill={PORTAL_COLORS.pink} opacity="0.3" />
      <rect x="6" y="6" width="4" height="4" fill={PORTAL_COLORS.purple} opacity="0.5" />
      
      {/* Center void */}
      <rect x="7" y="7" width="2" height="2" fill="#000000" />
      <rect x="7" y="7" width="1" height="1" fill={PORTAL_COLORS.pink} opacity="0.5" />
      
      {/* Energy crackles */}
      <rect x="4" y="5" width="1" height="1" fill="#ffffff" opacity="0.4" />
      <rect x="11" y="7" width="1" height="1" fill="#ffffff" opacity="0.3" />
      <rect x="5" y="11" width="1" height="1" fill="#ffffff" opacity="0.4" />
      <rect x="10" y="4" width="1" height="1" fill="#ffffff" opacity="0.3" />
    </svg>
  );
}

// ============================================
// CrownIcon - 8x8 gold pixel crown
// ============================================
interface CrownIconProps {
  size?: number;
}

const CROWN_COLORS = {
  gold: "#ffd700",
  goldDark: "#b8860b",
};

export function CrownIcon({ size = 24 }: CrownIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 8 8" style={{ imageRendering: "pixelated" as const }}>
      {/* Crown base */}
      <rect x="1" y="4" width="6" height="3" fill={CROWN_COLORS.gold} />
      <rect x="2" y="5" width="4" height="2" fill={CROWN_COLORS.goldDark} />
      
      {/* Crown points */}
      <rect x="1" y="2" width="1" height="3" fill={CROWN_COLORS.gold} />
      <rect x="3" y="1" width="2" height="4" fill={CROWN_COLORS.gold} />
      <rect x="6" y="2" width="1" height="3" fill={CROWN_COLORS.gold} />
      
      {/* Point tips */}
      <rect x="1" y="1" width="1" height="1" fill={CROWN_COLORS.gold} />
      <rect x="3" y="0" width="2" height="1" fill={CROWN_COLORS.gold} />
      <rect x="6" y="1" width="1" height="1" fill={CROWN_COLORS.gold} />
      
      {/* Center gem */}
      <rect x="3" y="5" width="2" height="1" fill="#ff3366" />
    </svg>
  );
}

// ============================================
// StarRank - 1-5 stars, each 6x6 pixels
// ============================================
interface StarRankProps {
  size?: number;
  count?: number;
}

const STAR_COLORS = {
  gold: "#ffd700",
  goldDark: "#b8860b",
  empty: "#4a4a4a",
};

// 5x5 star pattern
const STAR_PATTERN = [
  "01010",
  "11111",
  "11111",
  "01010",
  "10101",
];

export function StarRank({ size = 32, count = 3 }: StarRankProps) {
  const starWidth = Math.floor(size / 5);
  
  return (
    <svg width={size} height={starWidth} viewBox="0 0 25 5" style={{ imageRendering: "pixelated" as const }}>
      {/* Filled stars */}
      {Array(count).fill(0).map((_, starIndex) => {
        const xOffset = starIndex * 5;
        return (
          <g key={`star-${starIndex}`} transform={`translate(${xOffset}, 0)`}>
            {STAR_PATTERN.map((row, y) =>
              row.split("").map((pixel, x) =>
                pixel === "1" && (
                  <rect
                    key={`${x}-${y}`}
                    x={x}
                    y={y}
                    width="1"
                    height="1"
                    fill={STAR_COLORS.gold}
                  />
                )
              )
            )}
            {/* Center highlight */}
            <rect x="2" y="2" width="1" height="1" fill="#ffffff" opacity="0.5" />
          </g>
        );
      })}
      
      {/* Empty stars */}
      {Array(5 - count).fill(0).map((_, i) => {
        const xOffset = (count + i) * 5;
        return (
          <g key={`empty-${i}`} transform={`translate(${xOffset}, 0)`}>
            {STAR_PATTERN.map((row, y) =>
              row.split("").map((pixel, x) =>
                pixel === "1" && (
                  <rect
                    key={`${x}-${y}`}
                    x={x}
                    y={y}
                    width="1"
                    height="1"
                    fill={STAR_COLORS.empty}
                    opacity="0.3"
                  />
                )
              )
            )}
          </g>
        );
      })}
    </svg>
  );
}

// ============================================
// Export all sprites
// ============================================
export default {
  IkaSprite,
  SealIcon,
  ChainBadge,
  TreasureChest,
  ScrollIcon,
  SwordIcon,
  ShieldIcon,
  RuneStone,
  SoulOrb,
  PortalIcon,
  CrownIcon,
  StarRank,
};
