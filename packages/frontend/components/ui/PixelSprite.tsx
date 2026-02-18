"use client";

// Inline pixel art SVG sprites - no emoji, real pixel art
// Each sprite is a hand-crafted SVG pixel grid

export function IkaSprite({ size = 64, expression = "neutral" }: { size?: number; expression?: "neutral" | "excited" | "worried" | "smug" }) {
  // 16x16 pixel squid sprite
  const colors = {
    body: "#9b59b6",
    bodyLight: "#c084fc",
    bodyDark: "#6b21a8",
    eye: "#e8e0f0",
    pupil: "#0d0a1a",
    tentacle: "#ff3366",
    glow: "#00ccff",
    blush: expression === "excited" ? "#ff3366" : "transparent",
  };

  const pupilOffset = expression === "worried" ? -1 : expression === "smug" ? 1 : 0;

  return (
    <svg width={size} height={size} viewBox="0 0 16 16" style={{ imageRendering: "pixelated" }}>
      {/* Head dome */}
      <rect x="5" y="1" width="6" height="1" fill={colors.bodyLight} />
      <rect x="4" y="2" width="8" height="1" fill={colors.bodyLight} />
      <rect x="3" y="3" width="10" height="1" fill={colors.body} />
      <rect x="3" y="4" width="10" height="1" fill={colors.body} />
      <rect x="3" y="5" width="10" height="1" fill={colors.body} />
      
      {/* Eyes */}
      <rect x="4" y="4" width="2" height="2" fill={colors.eye} />
      <rect x="9" y="4" width="2" height="2" fill={colors.eye} />
      <rect x={5 + pupilOffset} y="5" width="1" height="1" fill={colors.pupil} />
      <rect x={10 + pupilOffset} y="5" width="1" height="1" fill={colors.pupil} />
      
      {/* Blush */}
      <rect x="3" y="6" width="1" height="1" fill={colors.blush} opacity="0.6" />
      <rect x="12" y="6" width="1" height="1" fill={colors.blush} opacity="0.6" />
      
      {/* Body */}
      <rect x="3" y="6" width="10" height="1" fill={colors.body} />
      <rect x="4" y="7" width="8" height="1" fill={colors.body} />
      <rect x="4" y="8" width="8" height="1" fill={colors.bodyDark} />
      
      {/* Tentacles */}
      <rect x="4" y="9" width="1" height="2" fill={colors.tentacle} />
      <rect x="3" y="11" width="1" height="1" fill={colors.tentacle} />
      <rect x="6" y="9" width="1" height="3" fill={colors.tentacle} />
      <rect x="8" y="9" width="1" height="2" fill={colors.tentacle} />
      <rect x="9" y="11" width="1" height="1" fill={colors.tentacle} />
      <rect x="10" y="9" width="1" height="3" fill={colors.tentacle} />
      <rect x="11" y="9" width="1" height="1" fill={colors.tentacle} />
      <rect x="12" y="10" width="1" height="1" fill={colors.tentacle} />
      
      {/* Soul glow on excited */}
      {expression === "excited" && (
        <>
          <rect x="7" y="2" width="2" height="1" fill={colors.glow} opacity="0.5" />
          <rect x="2" y="5" width="1" height="1" fill={colors.glow} opacity="0.3" />
          <rect x="13" y="5" width="1" height="1" fill={colors.glow} opacity="0.3" />
        </>
      )}
    </svg>
  );
}

export function SealIcon({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" style={{ imageRendering: "pixelated" }}>
      <rect x="6" y="1" width="4" height="1" fill="#ffd700" />
      <rect x="4" y="2" width="8" height="1" fill="#ffd700" />
      <rect x="3" y="3" width="10" height="1" fill="#9b59b6" />
      <rect x="2" y="4" width="12" height="1" fill="#9b59b6" />
      <rect x="2" y="5" width="2" height="1" fill="#9b59b6" />
      <rect x="12" y="5" width="2" height="1" fill="#9b59b6" />
      <rect x="6" y="5" width="4" height="1" fill="#ff3366" />
      <rect x="2" y="6" width="12" height="1" fill="#9b59b6" />
      <rect x="2" y="7" width="12" height="1" fill="#9b59b6" />
      <rect x="3" y="8" width="10" height="1" fill="#9b59b6" />
      <rect x="4" y="9" width="8" height="1" fill="#ffd700" />
      <rect x="5" y="10" width="6" height="1" fill="#ffd700" />
      {/* Chain links */}
      <rect x="7" y="11" width="2" height="1" fill="#8a7a9a" />
      <rect x="6" y="12" width="4" height="1" fill="#8a7a9a" />
      <rect x="7" y="13" width="2" height="1" fill="#8a7a9a" />
    </svg>
  );
}

export function ChainBadge({ chain, size = 16 }: { chain: "ethereum" | "sui" | "solana"; size?: number }) {
  const colors: Record<string, string> = {
    ethereum: "#627eea",
    sui: "#4da2ff",
    solana: "#9945ff",
  };
  return (
    <svg width={size} height={size} viewBox="0 0 8 8" style={{ imageRendering: "pixelated" }}>
      <rect x="2" y="0" width="4" height="1" fill={colors[chain]} />
      <rect x="1" y="1" width="6" height="1" fill={colors[chain]} />
      <rect x="0" y="2" width="8" height="4" fill={colors[chain]} />
      <rect x="1" y="6" width="6" height="1" fill={colors[chain]} />
      <rect x="2" y="7" width="4" height="1" fill={colors[chain]} />
      {/* Letter */}
      <rect x="3" y="3" width="2" height="2" fill="#e8e0f0" />
    </svg>
  );
}
