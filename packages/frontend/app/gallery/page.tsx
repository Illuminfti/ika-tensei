"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { SummoningCircle } from "@/components/ui/SummoningCircle";
import { DialogueBox } from "@/components/ui/DialogueBox";
import { PixelButton } from "@/components/ui/PixelButton";

// ============================================================================
// TYPES & DATA
// ============================================================================

interface RebornNFT {
  id: string;
  name: string;
  originalChain: string;
  chainColor: string;
  chainIcon: string;
  tokenId: string;
  originalContract: string;
  rebornMintAddress: string;
  date: string;
  rarity: "common" | "rare" | "epic" | "legendary";
  imageHash: string;
  collection: string;
}

const MOCK_NFTS: RebornNFT[] = [
  {
    id: "1", name: "Cryptopunk #7842", originalChain: "Ethereum", chainColor: "#627EEA", chainIcon: "⟐",
    tokenId: "7842", originalContract: "0xb47e3cd837dDF8e4c57F05d70Ab865de6e193BBB",
    rebornMintAddress: "CXwpmrmqF7DqMX5Zk3mLp5XqG7Uf8xJkYzPYjRqRqRqR",
    date: "2024-01-15", rarity: "legendary", imageHash: "a1b2c3d4", collection: "CryptoPunks",
  },
  {
    id: "2", name: "Sui Frens #1024", originalChain: "Sui", chainColor: "#6FBCF0", chainIcon: "◎",
    tokenId: "1024", originalContract: "0x8474...b6b6",
    rebornMintAddress: "8XqLbP8kTqHoqLnqP7qKqZqZqZqZqZqZqZqZqZqZq",
    date: "2024-01-18", rarity: "rare", imageHash: "e5f6g7h8", collection: "Sui Frens",
  },
  {
    id: "3", name: "BoredApe #3399", originalChain: "Ethereum", chainColor: "#627EEA", chainIcon: "⟐",
    tokenId: "3399", originalContract: "0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D",
    rebornMintAddress: "9YmNbP9kTqHoqLnqP7qKqZqZqZqZqZqZqZqZqZqZqZ",
    date: "2024-01-20", rarity: "epic", imageHash: "i9j0k1l2", collection: "BAYC",
  },
  {
    id: "4", name: "Azuki #8821", originalChain: "Ethereum", chainColor: "#627EEA", chainIcon: "⟐",
    tokenId: "8821", originalContract: "0xED5AF388653567Af2F388E6224dC7C4b3241C544",
    rebornMintAddress: "5BoPdP8kTqHoqLnqP7qKqZqZqZqZqZqZqZqZqZqZ",
    date: "2024-01-25", rarity: "epic", imageHash: "q5r6s7t8", collection: "Azuki",
  },
  {
    id: "5", name: "Sui Capys #777", originalChain: "Sui", chainColor: "#6FBCF0", chainIcon: "◎",
    tokenId: "777", originalContract: "0x9586...b6b6",
    rebornMintAddress: "2AnOcP8kTqHoqLnqP7qKqZqZqZqZqZqZqZqZqZqZ",
    date: "2024-01-22", rarity: "common", imageHash: "m3n4o5p6", collection: "Sui Capys",
  },
  {
    id: "6", name: "Sui Doods #256", originalChain: "Sui", chainColor: "#6FBCF0", chainIcon: "◎",
    tokenId: "256", originalContract: "0xa1b2...a1b2",
    rebornMintAddress: "7CpPeP8kTqHoqLnqP7qKqZqZqZqZqZqZqZqZqZqZ",
    date: "2024-01-28", rarity: "rare", imageHash: "u9v0w1x2", collection: "Sui Doods",
  },
  {
    id: "7", name: "Pudgy #4201", originalChain: "Ethereum", chainColor: "#627EEA", chainIcon: "⟐",
    tokenId: "4201", originalContract: "0xBd3531dA5CF5857e7CfAA92426877b022e612cf8",
    rebornMintAddress: "3DqReP7kTqHoqLnqP7qKqZqZqZqZqZqZqZqZqZqZ",
    date: "2024-02-01", rarity: "rare", imageHash: "y3z4a5b6", collection: "Pudgy Penguins",
  },
  {
    id: "8", name: "Milady #6969", originalChain: "Ethereum", chainColor: "#627EEA", chainIcon: "⟐",
    tokenId: "6969", originalContract: "0x5Af0D9827E0c53E4799BB226655A1de152A425a5",
    rebornMintAddress: "4EsRfP8kTqHoqLnqP7qKqZqZqZqZqZqZqZqZqZqZ",
    date: "2024-02-05", rarity: "legendary", imageHash: "c7d8e9f0", collection: "Milady",
  },
];

const RARITY_CONFIG = {
  common:    { label: "COMMON",    color: "#8b8b8b", bg: "#8b8b8b15", border: "#8b8b8b30", glow: "none", runeColor: "#6b6b6b" },
  rare:      { label: "RARE",      color: "#00ccff", bg: "#00ccff15", border: "#00ccff30", glow: "0 0 20px rgba(0,204,255,0.3)", runeColor: "#00ccff" },
  epic:      { label: "EPIC",      color: "#ffd700", bg: "#ffd70015", border: "#ffd70030", glow: "0 0 25px rgba(255,215,0,0.4)", runeColor: "#ffd700" },
  legendary: { label: "LEGENDARY", color: "#ff3366", bg: "#ff336615", border: "#ff336630", glow: "0 0 35px rgba(255,51,102,0.5)", runeColor: "#ff3366" },
};

function truncateAddress(addr: string, n = 6) {
  return addr.length > n * 2 + 3 ? `${addr.slice(0, n)}...${addr.slice(-n)}` : addr;
}

function hashToColors(hash: string): [string, string] {
  let h = 0;
  for (let i = 0; i < hash.length; i++) h = ((h << 5) - h + hash.charCodeAt(i)) | 0;
  const hue1 = Math.abs(h % 360);
  const hue2 = (hue1 + 60 + Math.abs((h >> 8) % 120)) % 360;
  return [`hsl(${hue1}, 70%, 50%)`, `hsl(${hue2}, 60%, 40%)`];
}

// ============================================================================
// FLOATING PARTICLES COMPONENT
// ============================================================================

function FloatingParticles() {
  const particles = useMemo(() => {
    return Array.from({ length: 20 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      delay: Math.random() * 15,
      duration: 15 + Math.random() * 10,
      size: Math.random() > 0.7 ? 3 : 2,
      opacity: 0.1 + Math.random() * 0.3,
    }));
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute rounded-full"
          style={{
            left: `${p.x}%`,
            bottom: "-20px",
            width: p.size,
            height: p.size,
            background: p.size > 2 
              ? "radial-gradient(circle, #ffd700 0%, transparent 70%)" 
              : "radial-gradient(circle, #8b7aac 0%, transparent 70%)",
            opacity: p.opacity,
          }}
          animate={{
            y: [-20, -1000],
            x: [0, Math.sin(p.id) * 50],
            opacity: [0, p.opacity, p.opacity, 0],
          }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            repeat: Infinity,
            ease: "linear",
          }}
        />
      ))}
    </div>
  );
}

// ============================================================================
// CARD COMPONENT - Enhanced occult artifact style
// ============================================================================

function TarotCard({ nft, index, onClick }: { nft: RebornNFT; index: number; onClick: () => void }) {
  const rarity = RARITY_CONFIG[nft.rarity];
  const [c1, c2] = hashToColors(nft.imageHash);
  const [isHovered, setIsHovered] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 40, rotateY: -15 }}
      animate={{ opacity: 1, y: 0, rotateY: 0 }}
      transition={{ delay: index * 0.08, type: "spring", damping: 18, stiffness: 120 }}
      whileHover={{ y: -12, scale: 1.04, rotateY: 2 }}
      whileTap={{ scale: 0.96 }}
      onClick={onClick}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      className="cursor-pointer perspective-1000"
    >
      {/* Outer glow container */}
      <div
        className="relative overflow-hidden transition-all duration-500"
        style={{ 
          boxShadow: isHovered 
            ? `0 0 40px ${rarity.runeColor}40, 0 0 80px ${rarity.runeColor}20, inset 0 0 30px ${rarity.runeColor}10`
            : `0 0 15px ${rarity.runeColor}20, 0 0 30px ${rarity.runeColor}10`,
        }}
      >
        {/* Card frame border */}
        <div 
          className="absolute inset-0 z-20 pointer-events-none"
          style={{ 
            border: `2px solid ${rarity.border}`,
            background: `linear-gradient(135deg, ${rarity.bg} 0%, transparent 50%, ${rarity.bg} 100%)`,
          }}
        />

        {/* Corner runes decoration */}
        <div className="absolute inset-0 z-25 pointer-events-none opacity-40">
          {["ᚠ", "ᚢ", "ᚦ", "ᚨ"].map((rune, i) => (
            <span
              key={i}
              className="absolute font-jp text-xs"
              style={{
                color: rarity.runeColor,
                top: i < 2 ? 4 : "auto",
                bottom: i >= 2 ? 4 : "auto",
                left: i % 2 === 0 ? 6 : "auto",
                right: i % 2 === 1 ? 6 : "auto",
              }}
            >
              {rune}
            </span>
          ))}
        </div>

        {/* Animated rune shimmer on hover */}
        <AnimatePresence>
          {isHovered && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: [0.3, 0.7, 0.3] }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-15 pointer-events-none"
              style={{
                background: `linear-gradient(135deg, transparent 0%, ${rarity.runeColor}15 25%, transparent 50%, ${rarity.runeColor}15 75%, transparent 100%)`,
                filter: `blur(2px)`,
              }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            />
          )}
        </AnimatePresence>

        {/* Image area */}
        <div className="relative h-56 overflow-hidden" style={{ background: `linear-gradient(135deg, ${c1}15, ${c2}15)` }}>
          {/* Mystical orb effect */}
          <motion.div
            className="absolute inset-0"
            style={{
              background: `radial-gradient(ellipse at 50% 30%, ${c1}33 0%, ${c2}15 40%, transparent 70%)`,
            }}
            animate={isHovered 
              ? { scale: [1, 1.3, 1.1], opacity: [0.6, 0.9, 0.7] }
              : { scale: [1, 1.1, 1], opacity: [0.4, 0.6, 0.4] }
            }
            transition={{ duration: 3, repeat: Infinity }}
          />

          {/* Floating dust particles in card */}
          {isHovered && (
            <div className="absolute inset-0 overflow-hidden">
              {Array.from({ length: 8 }).map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute w-1 h-1 rounded-full"
                  style={{
                    background: rarity.runeColor,
                    left: `${20 + Math.random() * 60}%`,
                    top: `${20 + Math.random() * 60}%`,
                  }}
                  animate={{
                    y: [0, -60 - Math.random() * 40],
                    x: [0, Math.sin(i * 2) * 20],
                    opacity: [0.8, 0],
                  }}
                  transition={{ duration: 2 + Math.random(), repeat: Infinity, ease: "easeOut" }}
                />
              ))}
            </div>
          )}

          {/* NFT placeholder */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative">
              <motion.div
                animate={isHovered 
                  ? { rotate: [0, 8, -8, 0], scale: [1, 1.15, 1] }
                  : { rotate: [0, 3, -3, 0], scale: [1, 1.05, 1] }
                }
                transition={{ duration: isHovered ? 2 : 4, repeat: Infinity }}
              >
                <Image 
                  src="/art/ika-mascot-v2.png" 
                  alt="" 
                  width={80} 
                  height={80} 
                  className="pixelated" 
                  style={{ opacity: isHovered ? 0.7 : 0.4 }}
                />
              </motion.div>
              <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 font-pixel text-[6px] text-ghost-white/50 whitespace-nowrap tracking-wider">
                {nft.collection}
              </div>
            </div>
          </div>

          {/* Reborn stamp */}
          <motion.div
            className="absolute top-3 right-3 z-20"
            initial={{ scale: 0, rotate: -30 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ delay: index * 0.08 + 0.3, type: "spring" }}
          >
            <div 
              className="bg-void-purple/80 backdrop-blur-sm border px-2.5 py-1"
              style={{ borderColor: rarity.runeColor, boxShadow: `0 0 10px ${rarity.runeColor}30` }}
            >
              <span className="font-pixel text-spectral-green text-[6px] tracking-widest">✦ REBORN</span>
            </div>
          </motion.div>

          {/* Chain badge */}
          <div className="absolute top-3 left-3 z-20">
            <div
              className="px-2 py-1 backdrop-blur-sm border font-pixel text-[7px]"
              style={{ 
                backgroundColor: `${nft.chainColor}15`, 
                borderColor: `${nft.chainColor}40`,
                color: nft.chainColor 
              }}
            >
              {nft.chainIcon}
            </div>
          </div>

          {/* Rarity bottom glow line */}
          <motion.div
            className="absolute bottom-0 left-0 right-0 h-[3px]"
            style={{ 
              background: `linear-gradient(90deg, transparent, ${rarity.color}, ${rarity.color}, transparent)`,
              boxShadow: `0 0 10px ${rarity.color}, 0 0 20px ${rarity.color}50`,
            }}
            animate={nft.rarity === "legendary" || nft.rarity === "epic" 
              ? { opacity: [0.6, 1, 0.6] } 
              : {}
            }
            transition={{ duration: 2, repeat: Infinity }}
          />
        </div>

        {/* Card info */}
        <div className="relative bg-void-purple/90 p-3.5 border-t" style={{ borderColor: `${rarity.border}` }}>
          <h3 className="font-pixel text-ghost-white text-[9px] mb-2 truncate" style={{ textShadow: "0 0 10px rgba(232,224,240,0.3)" }}>
            {nft.name}
          </h3>
          <div className="flex items-center justify-between">
            <span className="font-mono text-faded-spirit text-[8px]">{nft.date}</span>
            <span 
              className="font-pixel text-[6px] px-2 py-0.5 tracking-wider" 
              style={{ 
                color: rarity.color, 
                backgroundColor: rarity.bg, 
                border: `1px solid ${rarity.border}`,
                textShadow: `0 0 8px ${rarity.color}`,
              }}
            >
              {rarity.label}
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ============================================================================
// STATS BAR - Shrine panel style
// ============================================================================

function StatsBar({ nfts }: { nfts: RebornNFT[] }) {
  const stats = useMemo(() => ({
    total: nfts.length,
    chains: new Set(nfts.map(n => n.originalChain)).size,
    legendary: nfts.filter(n => n.rarity === "legendary").length,
    collections: new Set(nfts.map(n => n.collection)).size,
  }), [nfts]);

  const statConfig = [
    { label: "REBORN", value: stats.total, icon: "✦", color: "#ff3366", subLabel: "神聖" },
    { label: "CHAINS", value: stats.chains, icon: "◆", color: "#ffd700", subLabel: "鎖" },
    { label: "LEGENDARY", value: stats.legendary, icon: "★", color: "#ff3366", subLabel: "伝説" },
    { label: "COLLECTIONS", value: stats.collections, icon: "◈", color: "#00ccff", subLabel: "召喚" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="relative"
    >
      {/* Shrine panel effect */}
      <div className="absolute inset-0 bg-void-purple/50 border border-sigil-border/30" style={{ transform: "scale(1.02)" }} />
      <div className="absolute inset-2 border border-ritual-gold/10" />
      
      {/* Corner decorations */}
      <div className="absolute -top-1 -left-1 w-3 h-3 border-l-2 border-t-2 border-ritual-gold/40" />
      <div className="absolute -top-1 -right-1 w-3 h-3 border-r-2 border-t-2 border-ritual-gold/40" />
      <div className="absolute -bottom-1 -left-1 w-3 h-3 border-l-2 border-b-2 border-ritual-gold/40" />
      <div className="absolute -bottom-1 -right-1 w-3 h-3 border-r-2 border-b-2 border-ritual-gold/40" />

      <div className="relative flex flex-wrap gap-8 justify-center py-5 px-6">
        {statConfig.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4 + i * 0.1, type: "spring" }}
            className="text-center group"
          >
            <div className="relative">
              {/* Glow effect */}
              <div 
                className="absolute inset-0 blur-xl opacity-0 group-hover:opacity-50 transition-opacity duration-500"
                style={{ background: stat.color }}
              />
              <div className="relative font-pixel text-xl" style={{ color: stat.color }}>
                <span className="text-xs mr-1 opacity-70">{stat.icon}</span>
                {stat.value}
              </div>
            </div>
            <div className="font-pixel text-[6px] text-faded-spirit tracking-[0.2em] mt-1">{stat.label}</div>
            <div className="font-jp text-[8px] text-faded-spirit/50 mt-0.5">{stat.subLabel}</div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

// ============================================================================
// DETAIL MODAL - Ancient scroll style
// ============================================================================

function DetailModal({ nft, onClose }: { nft: RebornNFT; onClose: () => void }) {
  const rarity = RARITY_CONFIG[nft.rarity];
  const [c1, c2] = hashToColors(nft.imageHash);

  const handleShare = () => {
    const text = `✦ ${nft.name} has been reborn on Solana!\n\nSealed from ${nft.originalChain} → Reborn via @IkaTensei\n\n#IkaTensei #NFTReborn`;
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, "_blank");
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-void-purple/95 backdrop-blur-md z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Modal background glow */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse at center, ${rarity.color}08 0%, transparent 60%)`,
        }}
      />

      <motion.div
        initial={{ scale: 0.8, y: 40, rotateX: -10 }}
        animate={{ scale: 1, y: 0, rotateX: 0 }}
        exit={{ scale: 0.8, y: 40, rotateX: -10 }}
        transition={{ type: "spring", damping: 20 }}
        onClick={e => e.stopPropagation()}
        className="relative bg-void-purple border max-w-lg w-full overflow-hidden"
        style={{ 
          borderColor: rarity.border,
          boxShadow: `0 0 60px ${rarity.color}30, 0 0 120px ${rarity.color}10`,
        }}
      >
        {/* Corner decorations */}
        <div className="absolute top-0 left-0 w-6 h-6 border-l-2 border-t-2 z-10" style={{ borderColor: rarity.color }} />
        <div className="absolute top-0 right-0 w-6 h-6 border-r-2 border-t-2 z-10" style={{ borderColor: rarity.color }} />
        <div className="absolute bottom-0 left-0 w-6 h-6 border-l-2 border-b-2 z-10" style={{ borderColor: rarity.color }} />
        <div className="absolute bottom-0 right-0 w-6 h-6 border-r-2 border-b-2 z-10" style={{ borderColor: rarity.color }} />

        {/* Large image area */}
        <div className="relative h-56" style={{ background: `linear-gradient(135deg, ${c1}20, ${c2}15)` }}>
          <div className="absolute inset-0 flex items-center justify-center">
            <motion.div
              animate={{ scale: [1, 1.1, 1], rotate: [0, 5, -5, 0] }}
              transition={{ duration: 6, repeat: Infinity }}
            >
              <Image src="/art/ika-mascot-v2.png" alt="" width={120} height={120} className="pixelated opacity-50" />
            </motion.div>
          </div>
          <div 
            className="absolute inset-0" 
            style={{ background: `radial-gradient(ellipse at 50% 70%, ${c1}30 0%, transparent 50%)` }} 
          />
          
          {/* Close button */}
          <button 
            onClick={onClose} 
            className="absolute top-4 right-4 font-pixel text-faded-spirit text-xs hover:text-ghost-white transition-colors z-10"
          >
            ✕
          </button>
          
          {/* Rarity banner */}
          <div className="absolute bottom-4 left-4">
            <span 
              className="font-pixel text-[7px] px-3 py-1.5 tracking-wider"
              style={{ 
                color: rarity.color, 
                backgroundColor: rarity.bg, 
                border: `1px solid ${rarity.border}`,
                textShadow: `0 0 10px ${rarity.color}`,
              }}
            >
              {rarity.label}
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <h2 className="font-pixel text-ghost-white text-sm mb-1" style={{ textShadow: "0 0 15px rgba(232,224,240,0.4)" }}>
            {nft.name}
          </h2>
          <div className="flex items-center gap-3 mb-6">
            <span 
              className="font-pixel text-[7px] px-2.5 py-1 border"
              style={{ color: nft.chainColor, borderColor: `${nft.chainColor}44` }}
            >
              {nft.chainIcon} {nft.originalChain}
            </span>
            <span className="font-mono text-faded-spirit text-[9px]">{nft.date}</span>
            <span className="font-pixel text-spectral-green text-[7px]">✦ Reborn</span>
          </div>

          {/* Provenance chain - scroll style */}
          <div 
            className="relative bg-void-purple/80 border p-4 mb-6"
            style={{ borderColor: `${rarity.border}50` }}
          >
            {/* Scroll header */}
            <div className="absolute -top-2 left-4 px-2 bg-void-purple">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ background: "#ffd700" }} />
                <span className="font-pixel text-ritual-gold text-[7px] tracking-wider">PROVENANCE CHAIN</span>
              </div>
            </div>
            
            {/* Visual chain */}
            <div className="flex items-center gap-3 mt-2">
              <div className="flex-1 p-3 border" style={{ borderColor: "#3a285050" }}>
                <p className="font-pixel text-faded-spirit text-[6px] mb-1">ORIGINAL</p>
                <p className="font-mono text-soul-cyan text-[8px]">{truncateAddress(nft.originalContract, 8)}</p>
                <p className="font-pixel text-[6px] mt-1" style={{ color: nft.chainColor }}>
                  {nft.originalChain} #{nft.tokenId}
                </p>
              </div>
              
              <div className="text-ritual-gold text-lg font-pixel">→</div>
              
              <div className="flex-1 p-3 border" style={{ borderColor: "#3a285050" }}>
                <p className="font-pixel text-faded-spirit text-[6px] mb-1">REBORN ON SOLANA</p>
                <p className="font-mono text-spectral-green text-[8px]">{truncateAddress(nft.rebornMintAddress, 8)}</p>
                <p className="font-pixel text-[6px] text-spectral-green/60 mt-1">Metaplex Core</p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <PixelButton variant="primary" className="flex-1" onClick={handleShare}>
              🐦 Share on X
            </PixelButton>
            <PixelButton 
              variant="dark" 
              className="flex-1" 
              onClick={() => window.open(`https://solscan.io/token/${nft.rebornMintAddress}?cluster=devnet`, "_blank")}
            >
              🔍 View on Solscan
            </PixelButton>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ============================================================================
// MAIN PAGE
// ============================================================================

export default function GalleryPage() {
  const [filter, setFilter] = useState<string>("All");
  const [selectedNFT, setSelectedNFT] = useState<RebornNFT | null>(null);
  const [sortBy, setSortBy] = useState<"date" | "rarity">("date");

  const chains = ["All", ...Array.from(new Set(MOCK_NFTS.map(n => n.originalChain)))];
  
  const filteredNFTs = useMemo(() => {
    const nfts = filter === "All" ? [...MOCK_NFTS] : MOCK_NFTS.filter(n => n.originalChain === filter);
    if (sortBy === "rarity") {
      const order = { legendary: 0, epic: 1, rare: 2, common: 3 };
      nfts.sort((a, b) => order[a.rarity] - order[b.rarity]);
    } else {
      nfts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }
    return nfts;
  }, [filter, sortBy]);

  return (
    <div className="min-h-screen bg-void-purple relative">
      {/* Ambient floating particles */}
      <FloatingParticles />

      {/* Hero header */}
      <div className="relative overflow-hidden pb-10 pt-16">
        {/* Layered background effects */}
        <div className="absolute inset-0">
          {/* Summoning circle - large and subtle */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-8 pointer-events-none">
            <SummoningCircle size={600} phase="idle" />
          </div>
          
          {/* Radial gradient overlay */}
          <div 
            className="absolute inset-0"
            style={{
              background: "radial-gradient(ellipse at 50% 0%, rgba(255,51,102,0.08) 0%, transparent 50%, rgba(13,10,26,0.9) 100%)",
            }}
          />
        </div>

        {/* Header content */}
        <div className="relative z-10 text-center px-4">
          <motion.div 
            initial={{ opacity: 0, y: -30 }} 
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            {/* Japanese title with glow */}
            <h1 
              className="font-pixel text-ritual-gold text-2xl md:text-3xl mb-3"
              style={{ 
                textShadow: "0 0 30px rgba(255,215,0,0.6), 0 0 60px rgba(255,215,0,0.3), 0 4px 12px rgba(0,0,0,0.9)",
                letterSpacing: "0.1em",
              }}
            >
              ✦ 転生の書庫 ✦
            </h1>
            
            {/* English subtitle */}
            <p 
              className="font-pixel text-blood-pink text-base md:text-lg mb-2"
              style={{ textShadow: "0 0 20px rgba(255,51,102,0.6), 0 2px 8px rgba(0,0,0,0.9)" }}
            >
              REBORN GALLERY
            </p>
            
            {/* Japanese subtitle */}
            <p className="font-jp text-xs text-faded-spirit/70 mb-3">再生された NFT の 保存庫</p>
            
            {/* Description */}
            <p 
              className="font-silk text-ghost-white/70 text-xs max-w-lg mx-auto leading-relaxed"
              style={{ textShadow: "0 2px 10px rgba(0,0,0,0.9)" }}
            >
              Your sealed and reincarnated NFTs, preserved forever on the blockchain
            </p>
          </motion.div>
        </div>

        {/* Stats */}
        <div className="relative z-10 mt-10 max-w-2xl mx-auto px-4">
          <StatsBar nfts={MOCK_NFTS} />
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-6xl mx-auto px-4 pb-16">
        {/* Filter + Sort bar - shrine tablet style */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="flex flex-wrap items-center justify-between gap-4 mb-10 p-4 border border-sigil-border/30 bg-void-purple/50"
        >
          {/* Chain filters - ritual inscription style */}
          <div className="flex flex-wrap gap-2">
            <span className="font-pixel text-[7px] text-faded-spirit/50 mr-2 self-center"> FILTER:</span>
            {chains.map(chain => (
              <button
                key={chain}
                onClick={() => setFilter(chain)}
                className={`font-pixel text-[8px] px-4 py-2 border transition-all duration-300 relative overflow-hidden ${
                  filter === chain
                    ? "border-ritual-gold/60 bg-ritual-gold/10 text-ritual-gold"
                    : "border-faded-spirit/20 text-faded-spirit/60 hover:border-faded-spirit/40 hover:text-faded-spirit hover:bg-void-purple/30"
                }`}
              >
                {/* Hover glow */}
                {filter !== chain && (
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-faded-spirit/5 to-transparent -translate-x-full hover:translate-x-full transition-transform duration-700" />
                )}
                <span className="relative z-10">
                  {chain === "All" ? "◆ ALL" : chain === "Ethereum" ? "⟐ ETH" : `◎ ${chain.toUpperCase()}`}
                </span>
              </button>
            ))}
          </div>

          {/* Sort - shrine lever style */}
          <div className="flex items-center gap-1 border border-faded-spirit/20 p-1">
            <span className="font-pixel text-[6px] text-faded-spirit/40 px-2">SORT:</span>
            <button
              onClick={() => setSortBy("date")}
              className={`font-pixel text-[7px] px-3 py-1.5 transition-all ${
                sortBy === "date" 
                  ? "bg-void-purple text-ritual-gold border border-ritual-gold/30" 
                  : "text-faded-spirit/40 hover:text-faded-spirit"
              }`}
            >
              ↓ RECENT
            </button>
            <button
              onClick={() => setSortBy("rarity")}
              className={`font-pixel text-[7px] px-3 py-1.5 transition-all ${
                sortBy === "rarity" 
                  ? "bg-void-purple text-ritual-gold border border-ritual-gold/30" 
                  : "text-faded-spirit/40 hover:text-faded-spirit"
              }`}
            >
              ★ RARITY
            </button>
          </div>
        </motion.div>

        {/* Grid or empty state */}
        {filteredNFTs.length === 0 ? (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            className="text-center py-24"
          >
            {/* Empty shrine aesthetic */}
            <div className="relative inline-block mb-8">
              {/* Glow behind */}
              <div className="absolute inset-0 blur-3xl opacity-20 bg-void-indigo" />
              
              <motion.div
                animate={{ y: [0, -10, 0], opacity: [0.3, 0.5, 0.3] }}
                transition={{ duration: 4, repeat: Infinity }}
              >
                <Image 
                  src="/art/ika-mascot-v2.png" 
                  alt="Ika" 
                  width={140} 
                  height={140} 
                  className="pixelated relative z-10"
                />
              </motion.div>
              
              {/* Decorative circles */}
              <div className="absolute inset-0 -z-10 border border-faded-spirit/10 rounded-full animate-pulse" style={{ transform: "scale(1.3)" }} />
            </div>
            
            <DialogueBox
              speaker="Ika"
              portrait="worried"
              text="No reborn NFTs here yet... The shrine awaits its first artifact. Begin the ritual to seal your first NFT!"
            />
            
            <Link href="/seal" className="inline-block mt-8">
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <PixelButton variant="primary">✦ Begin the Ritual</PixelButton>
              </motion.div>
            </Link>
          </motion.div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {filteredNFTs.map((nft, i) => (
              <TarotCard key={nft.id} nft={nft} index={i} onClick={() => setSelectedNFT(nft)} />
            ))}
          </div>
        )}

        {/* Bottom CTA */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="text-center mt-16"
        >
          <Link href="/seal">
            <PixelButton variant="dark" size="sm">✦ Seal Another NFT</PixelButton>
          </Link>
        </motion.div>
      </div>

      {/* Detail modal */}
      <AnimatePresence>
        {selectedNFT && <DetailModal nft={selectedNFT} onClose={() => setSelectedNFT(null)} />}
      </AnimatePresence>
    </div>
  );
}
