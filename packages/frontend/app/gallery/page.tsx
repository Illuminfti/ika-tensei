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
  imageHash: string; // seed for unique visual
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
    rebornMintAddress: "8XqLbP8kTqHoqLnqP7qKqZqZqZqZqZqZqZqZqZqZqZq",
    date: "2024-01-18", rarity: "rare", imageHash: "e5f6g7h8", collection: "Sui Frens",
  },
  {
    id: "3", name: "BoredApe #3399", originalChain: "Ethereum", chainColor: "#627EEA", chainIcon: "⟐",
    tokenId: "3399", originalContract: "0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D",
    rebornMintAddress: "9YmNbP9kTqHoqLnqP7qKqZqZqZqZqZqZqZqZqZqZqZq",
    date: "2024-01-20", rarity: "epic", imageHash: "i9j0k1l2", collection: "BAYC",
  },
  {
    id: "4", name: "Azuki #8821", originalChain: "Ethereum", chainColor: "#627EEA", chainIcon: "⟐",
    tokenId: "8821", originalContract: "0xED5AF388653567Af2F388E6224dC7C4b3241C544",
    rebornMintAddress: "5BoPdP8kTqHoqLnqP7qKqZqZqZqZqZqZqZqZqZqZqZ",
    date: "2024-01-25", rarity: "epic", imageHash: "q5r6s7t8", collection: "Azuki",
  },
  {
    id: "5", name: "Sui Capys #777", originalChain: "Sui", chainColor: "#6FBCF0", chainIcon: "◎",
    tokenId: "777", originalContract: "0x9586...b6b6",
    rebornMintAddress: "2AnOcP8kTqHoqLnqP7qKqZqZqZqZqZqZqZqZqZqZqZ",
    date: "2024-01-22", rarity: "common", imageHash: "m3n4o5p6", collection: "Sui Capys",
  },
  {
    id: "6", name: "Sui Doods #256", originalChain: "Sui", chainColor: "#6FBCF0", chainIcon: "◎",
    tokenId: "256", originalContract: "0xa1b2...a1b2",
    rebornMintAddress: "7CpPeP8kTqHoqLnqP7qKqZqZqZqZqZqZqZqZqZqZqZ",
    date: "2024-01-28", rarity: "rare", imageHash: "u9v0w1x2", collection: "Sui Doods",
  },
  {
    id: "7", name: "Pudgy #4201", originalChain: "Ethereum", chainColor: "#627EEA", chainIcon: "⟐",
    tokenId: "4201", originalContract: "0xBd3531dA5CF5857e7CfAA92426877b022e612cf8",
    rebornMintAddress: "3DqReP7kTqHoqLnqP7qKqZqZqZqZqZqZqZqZqZqZqZ",
    date: "2024-02-01", rarity: "rare", imageHash: "y3z4a5b6", collection: "Pudgy Penguins",
  },
  {
    id: "8", name: "Milady #6969", originalChain: "Ethereum", chainColor: "#627EEA", chainIcon: "⟐",
    tokenId: "6969", originalContract: "0x5Af0D9827E0c53E4799BB226655A1de152A425a5",
    rebornMintAddress: "4EsRfP8kTqHoqLnqP7qKqZqZqZqZqZqZqZqZqZqZqZ",
    date: "2024-02-05", rarity: "legendary", imageHash: "c7d8e9f0", collection: "Milady",
  },
];

const RARITY_CONFIG = {
  common:    { label: "COMMON",    color: "#8b8b8b", bg: "#8b8b8b15", border: "#8b8b8b30", glow: "none" },
  rare:      { label: "RARE",      color: "#00ccff", bg: "#00ccff15", border: "#00ccff30", glow: "0 0 15px rgba(0,204,255,0.2)" },
  epic:      { label: "EPIC",      color: "#ffd700", bg: "#ffd70015", border: "#ffd70030", glow: "0 0 15px rgba(255,215,0,0.2)" },
  legendary: { label: "LEGENDARY", color: "#ff3366", bg: "#ff336615", border: "#ff336630", glow: "0 0 20px rgba(255,51,102,0.3)" },
};

function truncateAddress(addr: string, n = 6) {
  return addr.length > n * 2 + 3 ? `${addr.slice(0, n)}...${addr.slice(-n)}` : addr;
}

// Simple hash to generate consistent colors from imageHash
function hashToColors(hash: string): [string, string] {
  let h = 0;
  for (let i = 0; i < hash.length; i++) h = ((h << 5) - h + hash.charCodeAt(i)) | 0;
  const hue1 = Math.abs(h % 360);
  const hue2 = (hue1 + 60 + Math.abs((h >> 8) % 120)) % 360;
  return [`hsl(${hue1}, 70%, 50%)`, `hsl(${hue2}, 60%, 40%)`];
}

// ============================================================================
// CARD COMPONENT - Tarot-style with card frame
// ============================================================================

function TarotCard({ nft, index, onClick }: { nft: RebornNFT; index: number; onClick: () => void }) {
  const rarity = RARITY_CONFIG[nft.rarity];
  const [c1, c2] = hashToColors(nft.imageHash);
  const [isHovered, setIsHovered] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 30, rotateY: -15 }}
      animate={{ opacity: 1, y: 0, rotateY: 0 }}
      transition={{ delay: index * 0.08, type: "spring", damping: 20 }}
      whileHover={{ y: -8, scale: 1.03, rotateY: 3 }}
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      className="cursor-pointer perspective-1000"
    >
      <div
        className="relative overflow-hidden transition-all duration-300"
        style={{ boxShadow: isHovered ? rarity.glow.replace("0.2", "0.5").replace("0.3", "0.6") : rarity.glow }}
      >
        {/* Card frame using card-frame.png */}
        <div className="absolute inset-0 z-10 pointer-events-none">
          <Image src="/art/card-frame.png" alt="" fill className="object-cover opacity-40" />
        </div>

        {/* Image area */}
        <div className="relative h-52 overflow-hidden" style={{ background: `linear-gradient(135deg, ${c1}22, ${c2}22)` }}>
          {/* Animated gradient orb */}
          <motion.div
            className="absolute inset-0"
            style={{
              background: `radial-gradient(circle at 50% 50%, ${c1}44 0%, transparent 60%)`,
            }}
            animate={isHovered ? { scale: [1, 1.2, 1], opacity: [0.5, 0.8, 0.5] } : {}}
            transition={{ duration: 2, repeat: Infinity }}
          />

          {/* NFT placeholder with Ika watermark */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative">
              <motion.div
                animate={isHovered ? { rotate: [0, 5, -5, 0], scale: [1, 1.1, 1] } : {}}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                <Image src="/art/ika-mascot-v2.png" alt="" width={72} height={72} className="pixelated opacity-50" />
              </motion.div>
              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 font-pixel text-[7px] text-ghost-white/40 whitespace-nowrap">
                {nft.collection}
              </div>
            </div>
          </div>

          {/* Reborn stamp */}
          <motion.div
            className="absolute top-2 right-2 z-20"
            initial={{ scale: 0, rotate: -20 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ delay: index * 0.08 + 0.3, type: "spring" }}
          >
            <div className="bg-spectral-green/20 backdrop-blur-sm border border-spectral-green/50 px-2 py-0.5">
              <span className="font-pixel text-spectral-green text-[7px]">✦ REBORN</span>
            </div>
          </motion.div>

          {/* Chain badge */}
          <div className="absolute top-2 left-2 z-20">
            <div
              className="px-1.5 py-0.5 backdrop-blur-sm border"
              style={{ backgroundColor: `${nft.chainColor}20`, borderColor: `${nft.chainColor}40` }}
            >
              <span className="font-pixel text-[7px]" style={{ color: nft.chainColor }}>
                {nft.chainIcon}
              </span>
            </div>
          </div>

          {/* Rarity glow bar */}
          <motion.div
            className="absolute bottom-0 left-0 right-0 h-[2px]"
            style={{ backgroundColor: rarity.color }}
            animate={nft.rarity === "legendary" ? { opacity: [0.5, 1, 0.5] } : {}}
            transition={{ duration: 2, repeat: Infinity }}
          />
        </div>

        {/* Card info */}
        <div className="relative bg-[#0a0815] p-3 border-t border-faded-spirit/10">
          <h3 className="font-pixel text-ghost-white text-[10px] mb-1.5 truncate">{nft.name}</h3>
          <div className="flex items-center justify-between">
            <span className="font-mono text-faded-spirit text-[9px]">{nft.date}</span>
            <span className="font-pixel text-[7px] px-1.5 py-0.5" style={{ color: rarity.color, backgroundColor: rarity.bg, border: `1px solid ${rarity.border}` }}>
              {rarity.label}
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ============================================================================
// STATS BAR
// ============================================================================

function StatsBar({ nfts }: { nfts: RebornNFT[] }) {
  const stats = useMemo(() => ({
    total: nfts.length,
    chains: new Set(nfts.map(n => n.originalChain)).size,
    legendary: nfts.filter(n => n.rarity === "legendary").length,
    collections: new Set(nfts.map(n => n.collection)).size,
  }), [nfts]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="flex flex-wrap gap-6 justify-center mb-10"
    >
      {[
        { label: "REBORN", value: stats.total, icon: "✦", color: "#ff3366" },
        { label: "CHAINS", value: stats.chains, icon: "◆", color: "#ffd700" },
        { label: "LEGENDARY", value: stats.legendary, icon: "★", color: "#ff3366" },
        { label: "COLLECTIONS", value: stats.collections, icon: "◈", color: "#00ccff" },
      ].map((stat, i) => (
        <motion.div
          key={stat.label}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4 + i * 0.1 }}
          className="text-center"
        >
          <div className="font-pixel text-lg" style={{ color: stat.color }}>
            <span className="text-xs mr-1">{stat.icon}</span>
            {stat.value}
          </div>
          <div className="font-pixel text-[7px] text-faded-spirit tracking-wider">{stat.label}</div>
        </motion.div>
      ))}
    </motion.div>
  );
}

// ============================================================================
// DETAIL MODAL
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
      className="fixed inset-0 bg-void-purple/90 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.85, y: 30 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.85, y: 30 }}
        onClick={e => e.stopPropagation()}
        className="bg-[#0a0a14] max-w-lg w-full overflow-hidden"
        style={{ border: `1px solid ${rarity.border}`, boxShadow: rarity.glow }}
      >
        {/* Large image area */}
        <div className="relative h-52" style={{ background: `linear-gradient(135deg, ${c1}22, ${c2}22)` }}>
          <div className="absolute inset-0 flex items-center justify-center">
            <Image src="/art/ika-mascot-v2.png" alt="" width={96} height={96} className="pixelated opacity-40" />
          </div>
          <div className="absolute inset-0" style={{ background: `radial-gradient(circle at 50% 60%, ${c1}33 0%, transparent 50%)` }} />
          
          {/* Close button */}
          <button onClick={onClose} className="absolute top-3 right-3 font-pixel text-faded-spirit text-xs hover:text-ghost-white transition-colors z-10">✕</button>
          
          {/* Rarity banner */}
          <div className="absolute bottom-3 left-3">
            <span className="font-pixel text-[8px] px-2 py-1" style={{ color: rarity.color, backgroundColor: rarity.bg, border: `1px solid ${rarity.border}` }}>
              {rarity.label}
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="p-5">
          <h2 className="font-pixel text-ghost-white text-sm mb-1">{nft.name}</h2>
          <div className="flex items-center gap-2 mb-5">
            <span className="font-pixel text-[8px] px-2 py-0.5 border" style={{ color: nft.chainColor, borderColor: `${nft.chainColor}44` }}>
              {nft.chainIcon} {nft.originalChain}
            </span>
            <span className="font-mono text-faded-spirit text-[10px]">{nft.date}</span>
            <span className="font-pixel text-spectral-green text-[8px]">✦ Reborn</span>
          </div>

          {/* Provenance chain */}
          <div className="bg-[#0f0a1a] border border-faded-spirit/10 p-4 mb-5 space-y-3">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-1.5 h-1.5 bg-ritual-gold" />
              <span className="font-pixel text-ritual-gold text-[8px] tracking-wider">PROVENANCE CHAIN</span>
            </div>
            
            {/* Visual chain: Original → Sealed → Reborn */}
            <div className="flex items-center gap-2 text-[9px]">
              <div className="flex-1">
                <p className="font-pixel text-faded-spirit text-[7px] mb-0.5">ORIGINAL</p>
                <p className="font-mono text-soul-cyan text-[9px]">{truncateAddress(nft.originalContract, 8)}</p>
                <p className="font-pixel text-[7px] mt-0.5" style={{ color: nft.chainColor }}>{nft.originalChain} #{nft.tokenId}</p>
              </div>
              <div className="font-pixel text-ritual-gold text-xs">→</div>
              <div className="flex-1">
                <p className="font-pixel text-faded-spirit text-[7px] mb-0.5">REBORN ON SOLANA</p>
                <p className="font-mono text-spectral-green text-[9px]">{truncateAddress(nft.rebornMintAddress, 8)}</p>
                <p className="font-pixel text-[7px] text-spectral-green/60 mt-0.5">Metaplex Core</p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <PixelButton variant="primary" className="flex-1" onClick={handleShare}>
              🐦 Share on X
            </PixelButton>
            <PixelButton variant="dark" className="flex-1" onClick={() => window.open(`https://solscan.io/token/${nft.rebornMintAddress}?cluster=devnet`, "_blank")}>
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
    <div className="min-h-screen bg-void-purple">
      {/* Hero header with atmosphere */}
      <div className="relative overflow-hidden pb-8 pt-12">
        {/* Summoning circle background */}
        <div className="absolute inset-0 flex items-center justify-center opacity-10 pointer-events-none">
          <SummoningCircle size={400} phase="idle" />
        </div>

        {/* Header content */}
        <div className="relative z-10 text-center px-4">
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="font-pixel text-ritual-gold text-xl md:text-2xl mb-2" style={{ textShadow: "0 0 20px rgba(255,215,0,0.6), 0 0 40px rgba(255,215,0,0.3), 0 2px 8px rgba(0,0,0,0.8)" }}>
              ✦ 転生の書庫 ✦
            </h1>
            <p className="font-pixel text-blood-pink text-sm mb-1" style={{ textShadow: "0 0 15px rgba(255,51,102,0.5), 0 2px 6px rgba(0,0,0,0.8)" }}>REBORN GALLERY</p>
            <p className="font-jp text-xs text-faded-spirit/70 mb-2">再生された NFT の 保存庫</p>
            <p className="font-silk text-ghost-white/80 text-xs max-w-md mx-auto" style={{ textShadow: "0 2px 8px rgba(0,0,0,0.9)" }}>
              Your sealed and reincarnated NFTs, preserved forever on Solana
            </p>
          </motion.div>
        </div>

        {/* Stats */}
        <div className="relative z-10 mt-8">
          <StatsBar nfts={MOCK_NFTS} />
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-6xl mx-auto px-4 pb-16">
        {/* Filter + Sort bar */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="flex flex-wrap items-center justify-between gap-3 mb-8"
        >
          {/* Chain filters */}
          <div className="flex gap-2">
            {chains.map(chain => (
              <button
                key={chain}
                onClick={() => setFilter(chain)}
                className={`font-pixel text-[9px] px-3 py-1.5 border transition-all duration-200 ${
                  filter === chain
                    ? "border-ritual-gold/60 bg-ritual-gold/10 text-ritual-gold"
                    : "border-faded-spirit/15 text-faded-spirit/60 hover:border-faded-spirit/30 hover:text-faded-spirit"
                }`}
              >
                {chain === "All" ? "◆ All" : chain === "Ethereum" ? "⟐ ETH" : `◎ ${chain.toUpperCase()}`}
              </button>
            ))}
          </div>

          {/* Sort */}
          <div className="flex gap-2">
            <button
              onClick={() => setSortBy("date")}
              className={`font-pixel text-[8px] px-2 py-1 transition-all ${sortBy === "date" ? "text-ritual-gold" : "text-faded-spirit/40"}`}
            >
              ↓ Recent
            </button>
            <button
              onClick={() => setSortBy("rarity")}
              className={`font-pixel text-[8px] px-2 py-1 transition-all ${sortBy === "rarity" ? "text-ritual-gold" : "text-faded-spirit/40"}`}
            >
              ★ Rarity
            </button>
          </div>
        </motion.div>

        {/* Grid or empty state */}
        {filteredNFTs.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-20">
            <Image src="/art/ika-mascot-v2.png" alt="Ika" width={100} height={100} className="pixelated mx-auto mb-6 opacity-40" />
            <DialogueBox
              speaker="Ika"
              portrait="worried"
              text="No reborn NFTs here yet... Begin the ritual to seal your first NFT!"
            />
            <Link href="/seal" className="inline-block mt-6">
              <PixelButton variant="primary">✦ Begin the Ritual</PixelButton>
            </Link>
          </motion.div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
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
