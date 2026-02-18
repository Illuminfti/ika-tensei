import React from "react";
import {
  AbsoluteFill,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Img,
  staticFile,
} from "remotion";

// ============================================================================
// CONSTANTS
// ============================================================================

const VOID_PURPLE = "#0d0a1a";
const BLOOD_PINK = "#ff3366";
const RITUAL_GOLD = "#ffd700";
const SOUL_CYAN = "#00ccff";
const SPECTRAL_GREEN = "#00ff88";
const GHOST_WHITE = "#e8e0f0";

const CHAINS = [
  { name: "Ethereum", color: "#627EEA", icon: "⟐" },
  { name: "Polygon", color: "#8247E5", icon: "⬡" },
  { name: "Arbitrum", color: "#28A0F0", icon: "◈" },
  { name: "Base", color: "#0052FF", icon: "◆" },
  { name: "Optimism", color: "#FF0420", icon: "◉" },
  { name: "BNB", color: "#F0B90B", icon: "◈" },
  { name: "Avalanche", color: "#E84142", icon: "△" },
  { name: "Sui", color: "#6FBCF0", icon: "◎" },
  { name: "Aptos", color: "#2AAAC2", icon: "◈" },
  { name: "NEAR", color: "#00C08B", icon: "◆" },
  { name: "Solana", color: "#9945FF", icon: "◎" },
  { name: "Fantom", color: "#1969FF", icon: "◉" },
  { name: "Moonbeam", color: "#53CBC8", icon: "◆" },
  { name: "Celo", color: "#FCFF52", icon: "○" },
  { name: "Scroll", color: "#EBC28E", icon: "◈" },
  { name: "Blast", color: "#FCFC03", icon: "◆" },
  { name: "Linea", color: "#61DFFF", icon: "◎" },
  { name: "Gnosis", color: "#3E6957", icon: "◉" },
];

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

const Particles: React.FC<{ count: number; color: string; frame: number }> = ({
  count,
  color,
  frame,
}) => {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => {
        const seed = i * 137.508;
        const x = ((seed * 7.3) % 100);
        const baseY = ((seed * 13.7) % 100);
        const y = (baseY + frame * 0.3 * ((i % 3) + 1)) % 120 - 10;
        const size = 2 + (i % 4);
        const opacity = 0.2 + (Math.sin(frame * 0.05 + i) * 0.15);
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${x}%`,
              top: `${y}%`,
              width: size,
              height: size,
              borderRadius: "50%",
              backgroundColor: color,
              opacity,
              filter: `blur(${size > 4 ? 1 : 0}px)`,
            }}
          />
        );
      })}
    </>
  );
};

const GlowText: React.FC<{
  children: React.ReactNode;
  color: string;
  size: number;
  opacity?: number;
  glowSize?: number;
}> = ({ children, color, size, opacity = 1, glowSize = 20 }) => (
  <div
    style={{
      fontFamily: "'Press Start 2P', monospace",
      fontSize: size,
      color,
      opacity,
      textShadow: `0 0 ${glowSize}px ${color}, 0 0 ${glowSize * 2}px ${color}44, 0 4px 12px rgba(0,0,0,0.8)`,
      textAlign: "center",
      lineHeight: 1.4,
    }}
  >
    {children}
  </div>
);

const SummoningCircleSVG: React.FC<{ size: number; rotation: number; opacity: number }> = ({
  size,
  rotation,
  opacity,
}) => (
  <svg
    viewBox="0 0 200 200"
    width={size}
    height={size}
    style={{ opacity, transform: `rotate(${rotation}deg)` }}
  >
    <circle cx="100" cy="100" r="90" fill="none" stroke={RITUAL_GOLD} strokeWidth="1" strokeDasharray="4 4" opacity={0.6} />
    <circle cx="100" cy="100" r="70" fill="none" stroke={BLOOD_PINK} strokeWidth="0.8" opacity={0.4} />
    <polygon
      points="100,20 175,140 25,140"
      fill="none"
      stroke={RITUAL_GOLD}
      strokeWidth="1"
      opacity={0.5}
    />
    <polygon
      points="100,180 25,60 175,60"
      fill="none"
      stroke={RITUAL_GOLD}
      strokeWidth="1"
      opacity={0.5}
    />
    {[0, 60, 120, 180, 240, 300].map((angle) => (
      <circle
        key={angle}
        cx={100 + 80 * Math.cos((angle * Math.PI) / 180)}
        cy={100 + 80 * Math.sin((angle * Math.PI) / 180)}
        r="4"
        fill={BLOOD_PINK}
        opacity={0.6}
      />
    ))}
  </svg>
);

// ============================================================================
// SCENE 1: COLD OPEN - Dark, mysterious (0-5s, frames 0-150)
// ============================================================================

const Scene1_ColdOpen: React.FC = () => {
  const frame = useCurrentFrame();

  const textOpacity = interpolate(frame, [30, 60], [0, 1], { extrapolateRight: "clamp" });
  const textY = interpolate(frame, [30, 60], [30, 0], { extrapolateRight: "clamp" });
  const questionOpacity = interpolate(frame, [80, 110], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [130, 150], [1, 0], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ backgroundColor: VOID_PURPLE, opacity: fadeOut }}>
      <Particles count={30} color={BLOOD_PINK} frame={frame} />

      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <div style={{ opacity: textOpacity, transform: `translateY(${textY}px)` }}>
          <GlowText color={GHOST_WHITE} size={28}>
            Your NFTs are trapped.
          </GlowText>
        </div>
        <div style={{ marginTop: 40, opacity: questionOpacity }}>
          <GlowText color={BLOOD_PINK} size={22}>
            Different chains. Different standards. No escape.
          </GlowText>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ============================================================================
// SCENE 2: CHAIN SHOWCASE - Chains flying in (5-10s, frames 150-300)
// ============================================================================

const Scene2_Chains: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill style={{ backgroundColor: VOID_PURPLE }}>
      <Particles count={20} color={SOUL_CYAN} frame={frame} />

      {/* Chain badges flying in from edges */}
      <div style={{ position: "absolute", inset: 0, display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "center", gap: 20, padding: 100 }}>
        {CHAINS.map((chain, i) => {
          const delay = i * 3;
          const s = spring({ frame: frame - delay, fps, config: { damping: 12, stiffness: 80 } });
          const opacity = interpolate(frame, [delay, delay + 15], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          const angle = (i / CHAINS.length) * Math.PI * 2;
          const startX = Math.cos(angle) * 800;
          const startY = Math.sin(angle) * 500;
          const x = interpolate(s, [0, 1], [startX, 0]);
          const y = interpolate(s, [0, 1], [startY, 0]);

          return (
            <div
              key={chain.name}
              style={{
                opacity,
                transform: `translate(${x}px, ${y}px)`,
                padding: "8px 16px",
                border: `2px solid ${chain.color}`,
                backgroundColor: `${chain.color}22`,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span style={{ fontSize: 24 }}>{chain.icon}</span>
              <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 12, color: chain.color }}>
                {chain.name}
              </span>
            </div>
          );
        })}
      </div>

      {/* "18 Chains" counter */}
      {frame > 80 && (
        <div style={{ position: "absolute", bottom: 100, width: "100%", textAlign: "center" }}>
          <GlowText color={RITUAL_GOLD} size={36}>
            18 Chains
          </GlowText>
        </div>
      )}
    </AbsoluteFill>
  );
};

// ============================================================================
// SCENE 3: THE RITUAL - Summoning circle + seal flow (10-17s, frames 300-510)
// ============================================================================

const Scene3_Ritual: React.FC = () => {
  const frame = useCurrentFrame();

  const circleScale = interpolate(frame, [0, 60], [0.3, 1], { extrapolateRight: "clamp" });
  const circleOpacity = interpolate(frame, [0, 30], [0, 0.8], { extrapolateRight: "clamp" });
  const rotation = frame * 0.5;
  const mascotOpacity = interpolate(frame, [40, 70], [0, 1], { extrapolateRight: "clamp" });
  const mascotY = interpolate(frame, [40, 70], [50, 0], { extrapolateRight: "clamp" });

  const sealText = interpolate(frame, [80, 100], [0, 1], { extrapolateRight: "clamp" });
  const arrowOpacity = interpolate(frame, [110, 130], [0, 1], { extrapolateRight: "clamp" });
  const rebornText = interpolate(frame, [140, 160], [0, 1], { extrapolateRight: "clamp" });

  // Pulse glow
  const pulseGlow = Math.sin(frame * 0.1) * 10 + 20;

  return (
    <AbsoluteFill style={{ backgroundColor: VOID_PURPLE }}>
      <Particles count={40} color={BLOOD_PINK} frame={frame} />

      {/* Summoning circle */}
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ transform: `scale(${circleScale})` }}>
          <SummoningCircleSVG size={600} rotation={rotation} opacity={circleOpacity} />
        </div>
      </div>

      {/* Mascot */}
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ opacity: mascotOpacity, transform: `translateY(${mascotY}px)`, filter: `drop-shadow(0 0 ${pulseGlow}px ${BLOOD_PINK})` }}>
          <Img src={staticFile("art/ika-mascot-v2.png")} width={200} height={200} style={{ imageRendering: "pixelated" }} />
        </div>
      </div>

      {/* Seal → Reborn flow text */}
      <div style={{ position: "absolute", bottom: 150, width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 40 }}>
        <div style={{ opacity: sealText }}>
          <GlowText color={SOUL_CYAN} size={28}>SEAL</GlowText>
        </div>
        <div style={{ opacity: arrowOpacity }}>
          <GlowText color={RITUAL_GOLD} size={36}>→</GlowText>
        </div>
        <div style={{ opacity: rebornText }}>
          <GlowText color={SPECTRAL_GREEN} size={28}>REBORN</GlowText>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ============================================================================
// SCENE 4: FEATURES - Quick cuts (17-23s, frames 510-690)
// ============================================================================

const Scene4_Features: React.FC = () => {
  const frame = useCurrentFrame();

  const features = [
    { text: "No Bridges", sub: "Direct deposit addresses via dWallet MPC", color: SPECTRAL_GREEN, icon: "🛡" },
    { text: "18 Chains → Solana", sub: "EVM, Sui, Aptos, NEAR, and more", color: SOUL_CYAN, icon: "◆" },
    { text: "Metaplex Core", sub: "Next-gen NFT standard on Solana", color: BLOOD_PINK, icon: "✦" },
    { text: "Permanent Storage", sub: "Arweave via Irys — forever", color: RITUAL_GOLD, icon: "◈" },
  ];

  const featureDuration = 45; // frames per feature

  return (
    <AbsoluteFill style={{ backgroundColor: VOID_PURPLE }}>
      {features.map((feature, i) => {
        const start = i * featureDuration;
        const end = start + featureDuration;
        const isActive = frame >= start && frame < end;

        if (!isActive) return null;

        const localFrame = frame - start;
        const enterOpacity = interpolate(localFrame, [0, 10], [0, 1], { extrapolateRight: "clamp" });
        const enterY = interpolate(localFrame, [0, 10], [40, 0], { extrapolateRight: "clamp" });
        const exitOpacity = interpolate(localFrame, [35, 45], [1, 0], { extrapolateRight: "clamp" });

        return (
          <AbsoluteFill key={i} style={{ opacity: enterOpacity * exitOpacity }}>
            <Particles count={15} color={feature.color} frame={frame} />
            <div style={{
              position: "absolute", inset: 0,
              display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
              transform: `translateY(${enterY}px)`,
            }}>
              <div style={{ fontSize: 72, marginBottom: 30 }}>{feature.icon}</div>
              <GlowText color={feature.color} size={42} glowSize={30}>
                {feature.text}
              </GlowText>
              <div style={{ marginTop: 24 }}>
                <GlowText color={GHOST_WHITE} size={18} opacity={0.7} glowSize={10}>
                  {feature.sub}
                </GlowText>
              </div>
            </div>
          </AbsoluteFill>
        );
      })}
    </AbsoluteFill>
  );
};

// ============================================================================
// SCENE 5: GUILD TEASE (23-26s, frames 690-780)
// ============================================================================

const Scene5_Guild: React.FC = () => {
  const frame = useCurrentFrame();

  const titleOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });
  const titleScale = interpolate(frame, [0, 20], [0.8, 1], { extrapolateRight: "clamp" });
  const subOpacity = interpolate(frame, [25, 45], [0, 1], { extrapolateRight: "clamp" });
  const badgesOpacity = interpolate(frame, [40, 60], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ backgroundColor: VOID_PURPLE }}>
      <Particles count={25} color={RITUAL_GOLD} frame={frame} />

      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        {/* Guild banner */}
        <div style={{ opacity: titleOpacity, transform: `scale(${titleScale})`, marginBottom: 20 }}>
          <Img src={staticFile("art/guild-banner.png")} width={150} height={150} style={{ imageRendering: "pixelated" }} />
        </div>

        <div style={{ opacity: titleOpacity, transform: `scale(${titleScale})` }}>
          <GlowText color={RITUAL_GOLD} size={38}>冒険者ギルド</GlowText>
        </div>
        <div style={{ marginTop: 10, opacity: subOpacity }}>
          <GlowText color={BLOOD_PINK} size={20}>ADVENTURER&apos;S GUILD</GlowText>
        </div>
        <div style={{ marginTop: 30, opacity: subOpacity }}>
          <GlowText color={GHOST_WHITE} size={16} opacity={0.7}>
            Quests • Governance • Treasury • Rankings
          </GlowText>
        </div>

        {/* RPG class badges */}
        <div style={{ display: "flex", gap: 30, marginTop: 40, opacity: badgesOpacity }}>
          {["⚔️ Warrior", "🧙 Mage", "🗡️ Rogue", "🛡️ Paladin", "🏹 Ranger"].map((cls) => (
            <div key={cls} style={{
              padding: "8px 16px",
              border: `1px solid ${RITUAL_GOLD}44`,
              backgroundColor: `${RITUAL_GOLD}11`,
            }}>
              <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 11, color: RITUAL_GOLD }}>
                {cls}
              </span>
            </div>
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ============================================================================
// SCENE 6: FINAL CTA - Logo + URL (26-30s, frames 780-900)
// ============================================================================

const Scene6_CTA: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoScale = spring({ frame, fps, config: { damping: 10, stiffness: 60 } });
  const titleOpacity = interpolate(frame, [20, 40], [0, 1], { extrapolateRight: "clamp" });
  const subtitleOpacity = interpolate(frame, [40, 60], [0, 1], { extrapolateRight: "clamp" });
  const urlOpacity = interpolate(frame, [60, 80], [0, 1], { extrapolateRight: "clamp" });
  const pulseGlow = Math.sin(frame * 0.08) * 15 + 25;

  return (
    <AbsoluteFill style={{ backgroundColor: VOID_PURPLE }}>
      <Particles count={50} color={BLOOD_PINK} frame={frame} />
      <Particles count={30} color={RITUAL_GOLD} frame={frame + 100} />

      {/* Summoning circle bg */}
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", opacity: 0.15 }}>
        <SummoningCircleSVG size={800} rotation={frame * 0.3} opacity={1} />
      </div>

      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        {/* Mascot */}
        <div style={{
          transform: `scale(${logoScale})`,
          filter: `drop-shadow(0 0 ${pulseGlow}px ${BLOOD_PINK})`,
          marginBottom: 30,
        }}>
          <Img src={staticFile("art/ika-mascot-v2.png")} width={180} height={180} style={{ imageRendering: "pixelated" }} />
        </div>

        {/* Title */}
        <div style={{ opacity: titleOpacity }}>
          <GlowText color={RITUAL_GOLD} size={56} glowSize={30}>
            イカ転生
          </GlowText>
        </div>
        <div style={{ marginTop: 15, opacity: titleOpacity }}>
          <GlowText color={BLOOD_PINK} size={24}>
            IKA TENSEI
          </GlowText>
        </div>

        {/* Tagline */}
        <div style={{ marginTop: 30, opacity: subtitleOpacity }}>
          <GlowText color={GHOST_WHITE} size={20} opacity={0.9}>
            Seal your NFTs from any chain. Reborn on Solana.
          </GlowText>
        </div>

        {/* URL */}
        <div style={{ marginTop: 50, opacity: urlOpacity }}>
          <div style={{
            padding: "12px 40px",
            border: `2px solid ${BLOOD_PINK}`,
            backgroundColor: `${BLOOD_PINK}22`,
          }}>
            <GlowText color={BLOOD_PINK} size={18} glowSize={15}>
              Begin the Ritual →
            </GlowText>
          </div>
        </div>

        {/* Powered by */}
        <div style={{ marginTop: 30, opacity: urlOpacity }}>
          <GlowText color={GHOST_WHITE} size={10} opacity={0.4}>
            Powered by IKA dWallet Network
          </GlowText>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ============================================================================
// MAIN COMPOSITION
// ============================================================================

export const IkaTenseiTrailer: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: VOID_PURPLE }}>
      {/* Scene 1: Cold Open (0-5s) */}
      <Sequence from={0} durationInFrames={150}>
        <Scene1_ColdOpen />
      </Sequence>

      {/* Scene 2: Chain showcase (5-10s) */}
      <Sequence from={150} durationInFrames={150}>
        <Scene2_Chains />
      </Sequence>

      {/* Scene 3: The Ritual (10-17s) */}
      <Sequence from={300} durationInFrames={210}>
        <Scene3_Ritual />
      </Sequence>

      {/* Scene 4: Features quick cuts (17-23s) */}
      <Sequence from={510} durationInFrames={180}>
        <Scene4_Features />
      </Sequence>

      {/* Scene 5: Guild tease (23-26s) */}
      <Sequence from={690} durationInFrames={90}>
        <Scene5_Guild />
      </Sequence>

      {/* Scene 6: Final CTA (26-30s) */}
      <Sequence from={780} durationInFrames={120}>
        <Scene6_CTA />
      </Sequence>
    </AbsoluteFill>
  );
};
