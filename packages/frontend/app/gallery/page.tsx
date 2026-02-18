"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { PixelButton } from "@/components/ui/PixelButton";
import { DialogueBox } from "@/components/ui/DialogueBox";

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
  imageGradient: [string, string]; // placeholder gradient colors
}

const MOCK_NFTS: RebornNFT[] = [
  {
    id: "1",
    name: "Cryptopunk #7842",
    originalChain: "Ethereum",
    chainColor: "#627EEA",
    chainIcon: "⟐",
    tokenId: "7842",
    originalContract: "0xb47e3cd837dDF8e4c57F05d70Ab865de6e193BBB",
    rebornMintAddress: "CXwpmrmqF7DqMX5Zk3mLp5XqG7Uf8xJkYzPYjRqRqRqR",
    date: "2024-01-15",
    rarity: "legendary",
    imageGradient: ["#ff3366", "#9945ff"],
  },
  {
    id: "2",
    name: "Sui Frens #1024",
    originalChain: "Sui",
    chainColor: "#6FBCF0",
    chainIcon: "◎",
    tokenId: "1024",
    originalContract: "0x8474...b6b6",
    rebornMintAddress: "8XqLbP8kTqHoqLnqP7qKqZqZqZqZqZqZqZqZqZqZqZq",
    date: "2024-01-18",
    rarity: "rare",
    imageGradient: ["#6FBCF0", "#00ff88"],
  },
  {
    id: "3",
    name: "BoredApe #3399",
    originalChain: "Ethereum",
    chainColor: "#627EEA",
    chainIcon: "⟐",
    tokenId: "3399",
    originalContract: "0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D",
    rebornMintAddress: "9YmNbP9kTqHoqLnqP7qKqZqZqZqZqZqZqZqZqZqZqZq",
    date: "2024-01-20",
    rarity: "epic",
    imageGradient: ["#ffd700", "#ff6b35"],
  },
  {
    id: "4",
    name: "Sui Capys #777",
    originalChain: "Sui",
    chainColor: "#6FBCF0",
    chainIcon: "◎",
    tokenId: "777",
    originalContract: "0x9586...b6b6",
    rebornMintAddress: "2AnOcP8kTqHoqLnqP7qKqZqZqZqZqZqZqZqZqZqZqZ",
    date: "2024-01-22",
    rarity: "common",
    imageGradient: ["#00ccff", "#9945ff"],
  },
  {
    id: "5",
    name: "Azuki #8821",
    originalChain: "Ethereum",
    chainColor: "#627EEA",
    chainIcon: "⟐",
    tokenId: "8821",
    originalContract: "0xED5AF388653567Af2F388E6224dC7C4b3241C544",
    rebornMintAddress: "5BoPdP8kTqHoqLnqP7qKqZqZqZqZqZqZqZqZqZqZqZ",
    date: "2024-01-25",
    rarity: "epic",
    imageGradient: ["#ff3366", "#ff6b35"],
  },
  {
    id: "6",
    name: "Sui Doods #256",
    originalChain: "Sui",
    chainColor: "#6FBCF0",
    chainIcon: "◎",
    tokenId: "256",
    originalContract: "0xa1b2...a1b2",
    rebornMintAddress: "7CpPeP8kTqHoqLnqP7qKqZqZqZqZqZqZqZqZqZqZqZ",
    date: "2024-01-28",
    rarity: "rare",
    imageGradient: ["#00ff88", "#6FBCF0"],
  },
];

const RARITY_CONFIG = {
  common: { label: "COMMON", color: "#8b8b8b", glow: "none" },
  rare: { label: "RARE", color: "#00ccff", glow: "0 0 12px rgba(0,204,255,0.3)" },
  epic: { label: "EPIC", color: "#ffd700", glow: "0 0 12px rgba(255,215,0,0.3)" },
  legendary: { label: "LEGENDARY", color: "#ff3366", glow: "0 0 20px rgba(255,51,102,0.4)" },
};

function truncateAddress(address: string, chars = 6): string {
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

function GalleryCard({ nft, onClick }: { nft: RebornNFT; onClick: () => void }) {
  const rarity = RARITY_CONFIG[nft.rarity];
  
  return (
    <motion.div
      whileHover={{ y: -4, scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="cursor-pointer group"
    >
      <div
        className="relative bg-[#0f0a1a] border border-faded-spirit/20 overflow-hidden transition-all duration-300 group-hover:border-ritual-gold/50"
        style={{ boxShadow: rarity.glow }}
      >
        {/* Image area with gradient placeholder */}
        <div
          className="h-48 relative overflow-hidden"
          style={{
            background: `linear-gradient(135deg, ${nft.imageGradient[0]}33, ${nft.imageGradient[1]}33)`,
          }}
        >
          {/* Centered Ika mascot as placeholder */}
          <div className="absolute inset-0 flex items-center justify-center opacity-30">
            <Image src="/art/ika-mascot-v2.png" alt="" width={80} height={80} className="pixelated" />
          </div>
          
          {/* Reborn badge */}
          <div className="absolute top-2 right-2 bg-spectral-green/20 border border-spectral-green/40 px-2 py-0.5">
            <span className="font-pixel text-spectral-green text-[8px]">✦ REBORN</span>
          </div>

          {/* Rarity stripe */}
          <div
            className="absolute bottom-0 left-0 right-0 h-1"
            style={{ backgroundColor: rarity.color }}
          />
        </div>

        {/* Card info */}
        <div className="p-3">
          <h3 className="font-pixel text-ghost-white text-[11px] mb-2 truncate">
            {nft.name}
          </h3>
          <div className="flex items-center justify-between">
            <span
              className="font-pixel text-[8px] px-2 py-0.5 border"
              style={{
                color: nft.chainColor,
                borderColor: `${nft.chainColor}44`,
                backgroundColor: `${nft.chainColor}11`,
              }}
            >
              {nft.chainIcon} {nft.originalChain.toUpperCase()}
            </span>
            <span
              className="font-pixel text-[7px]"
              style={{ color: rarity.color }}
            >
              {rarity.label}
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default function GalleryPage() {
  const [filter, setFilter] = useState<string>("All");
  const [selectedNFT, setSelectedNFT] = useState<RebornNFT | null>(null);

  const chains = ["All", ...Array.from(new Set(MOCK_NFTS.map(n => n.originalChain)))];
  const filteredNFTs = filter === "All" ? MOCK_NFTS : MOCK_NFTS.filter(n => n.originalChain === filter);

  const handleShare = (nft: RebornNFT) => {
    const text = `✦ ${nft.name} has been reborn on Solana!\n\nSealed from ${nft.originalChain} → Reborn via @IkaTensei\n\n#IkaTensei #NFTReborn`;
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, "_blank");
  };

  return (
    <div className="min-h-screen bg-void-purple p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <h1 className="font-pixel text-ritual-gold text-lg mb-1">✦ Reborn Gallery</h1>
          <p className="font-silk text-faded-spirit text-xs">Your sealed and reincarnated NFTs</p>
        </motion.div>

        {/* Filter tabs */}
        <div className="flex gap-2 mb-8">
          {chains.map(chain => (
            <button
              key={chain}
              onClick={() => setFilter(chain)}
              className={`font-pixel text-[10px] px-3 py-1.5 border transition-all ${
                filter === chain
                  ? "border-ritual-gold/60 bg-ritual-gold/10 text-ritual-gold"
                  : "border-faded-spirit/20 text-faded-spirit hover:border-faded-spirit/40"
              }`}
            >
              {chain === "All" ? "🌐 All" : chain === "Ethereum" ? "⟐ ETH" : `◎ ${chain.toUpperCase()}`}
            </button>
          ))}
        </div>

        {/* Grid */}
        {filteredNFTs.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-20">
            <Image src="/art/ika-mascot-v2.png" alt="Ika" width={80} height={80} className="pixelated mx-auto mb-4 opacity-40" />
            <p className="font-pixel text-faded-spirit text-xs mb-4">No reborn NFTs yet...</p>
            <Link href="/seal">
              <PixelButton variant="primary" size="sm">Seal Your First NFT →</PixelButton>
            </Link>
          </motion.div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredNFTs.map((nft, i) => (
              <motion.div
                key={nft.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <GalleryCard nft={nft} onClick={() => setSelectedNFT(nft)} />
              </motion.div>
            ))}
          </div>
        )}

        {/* Detail modal */}
        <AnimatePresence>
          {selectedNFT && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-void-purple/90 backdrop-blur-sm z-50 flex items-center justify-center p-4"
              onClick={() => setSelectedNFT(null)}
            >
              <motion.div
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                onClick={e => e.stopPropagation()}
                className="bg-[#0a0a14] border border-ritual-gold/30 p-6 max-w-md w-full"
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h2 className="font-pixel text-ghost-white text-sm">{selectedNFT.name}</h2>
                    <div className="flex items-center gap-2 mt-1">
                      <span
                        className="font-pixel text-[8px] px-2 py-0.5 border"
                        style={{
                          color: selectedNFT.chainColor,
                          borderColor: `${selectedNFT.chainColor}44`,
                        }}
                      >
                        {selectedNFT.chainIcon} {selectedNFT.originalChain}
                      </span>
                      <span className="font-mono text-faded-spirit text-[10px]">{selectedNFT.date}</span>
                    </div>
                  </div>
                  <span
                    className="font-pixel text-[8px] px-2 py-0.5"
                    style={{
                      color: RARITY_CONFIG[selectedNFT.rarity].color,
                      border: `1px solid ${RARITY_CONFIG[selectedNFT.rarity].color}44`,
                    }}
                  >
                    {RARITY_CONFIG[selectedNFT.rarity].label}
                  </span>
                </div>

                {/* Image placeholder */}
                <div
                  className="h-40 mb-4 flex items-center justify-center"
                  style={{
                    background: `linear-gradient(135deg, ${selectedNFT.imageGradient[0]}22, ${selectedNFT.imageGradient[1]}22)`,
                    border: `1px solid ${RARITY_CONFIG[selectedNFT.rarity].color}33`,
                  }}
                >
                  <Image src="/art/ika-mascot-v2.png" alt="" width={64} height={64} className="pixelated opacity-30" />
                </div>

                {/* Details */}
                <div className="space-y-3 mb-6">
                  <div>
                    <p className="font-pixel text-ritual-gold text-[8px] mb-0.5">ORIGINAL CONTRACT</p>
                    <p className="font-mono text-soul-cyan text-[10px]">{truncateAddress(selectedNFT.originalContract, 10)}</p>
                  </div>
                  <div>
                    <p className="font-pixel text-ritual-gold text-[8px] mb-0.5">TOKEN ID</p>
                    <p className="font-mono text-faded-spirit text-[10px]">#{selectedNFT.tokenId}</p>
                  </div>
                  <div>
                    <p className="font-pixel text-ritual-gold text-[8px] mb-0.5">REBORN MINT</p>
                    <p className="font-mono text-spectral-green text-[10px]">{truncateAddress(selectedNFT.rebornMintAddress, 10)}</p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                  <PixelButton variant="primary" className="flex-1" onClick={() => handleShare(selectedNFT)}>
                    🐦 Share
                  </PixelButton>
                  <PixelButton variant="dark" onClick={() => setSelectedNFT(null)}>
                    Close
                  </PixelButton>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
