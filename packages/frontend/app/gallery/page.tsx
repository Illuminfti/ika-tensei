"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PixelCard } from "@/components/ui/PixelCard";
import { PixelButton } from "@/components/ui/PixelButton";
import { DialogueBox } from "@/components/ui/DialogueBox";

interface RebornNFT {
  id: string;
  name: string;
  emoji: string;
  bgColor: string;
  originalChain: "Ethereum" | "Sui";
  originalContract: string;
  originalTokenId: string;
  rebornMintAddress: string;
  rebornSolanaAddress: string;
  date: string;
}

const MOCK_NFTS: RebornNFT[] = [
  {
    id: "1",
    name: "Cryptopunk #7842",
    emoji: "🦋",
    bgColor: "from-purple-500 to-pink-500",
    originalChain: "Ethereum",
    originalContract: "0xb47e3cd837dDF8e4c57F05d70Ab865de6e193BBB",
    originalTokenId: "7842",
    rebornMintAddress: "CXwpmrmqF7DqMX5Zk3mLp5XqG7Uf8xJkYzPYjRqRqRqR",
    rebornSolanaAddress: "5W9FLZBmCqhoqLnqP7qKqZqZqZqZqZqZqZqZqZqZqZqZ",
    date: "2024-01-15",
  },
  {
    id: "2",
    name: "Sui Frens #1024",
    emoji: "🐙",
    bgColor: "from-blue-500 to-cyan-500",
    originalChain: "Sui",
    originalContract: "0x8474a6e7d5f6b6b6b6b6b6b6b6b6b6b6b6b6b6b6",
    originalTokenId: "1024",
    rebornMintAddress: "8XqLbP8kTqHoqLnqP7qKqZqZqZqZqZqZqZqZqZqZqZq",
    rebornSolanaAddress: "3R8FFZqZqZqZqZqZqZqZqZqZqZqZqZqZqZqZqZqZ",
    date: "2024-01-18",
  },
  {
    id: "3",
    name: "BoredApe #3399",
    emoji: "🐒",
    bgColor: "from-yellow-500 to-orange-500",
    originalChain: "Ethereum",
    originalContract: "0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D",
    originalTokenId: "3399",
    rebornMintAddress: "9YmNbP9kTqHoqLnqP7qKqZqZqZqZqZqZqZqZqZqZqZq",
    rebornSolanaAddress: "7K9GEZmqZqZqZqZqZqZqZqZqZqZqZqZqZqZqZqZq",
    date: "2024-01-20",
  },
  {
    id: "4",
    name: "Sui Capys #777",
    emoji: "🦦",
    bgColor: "from-teal-500 to-green-500",
    originalChain: "Sui",
    originalContract: "0x9586b6e7d5f6b6b6b6b6b6b6b6b6b6b6b6b6b6b6",
    originalTokenId: "777",
    rebornMintAddress: "2AnOcP8kTqHoqLnqP7qKqZqZqZqZqZqZqZqZqZqZqZ",
    rebornSolanaAddress: "4L7DEZlqZqZqZqZqZqZqZqZqZqZqZqZqZqZqZqZ",
    date: "2024-01-22",
  },
  {
    id: "5",
    name: "Azuki #8821",
    emoji: "🏮",
    bgColor: "from-red-500 to-purple-500",
    originalChain: "Ethereum",
    originalContract: "0xED5AF388653567Af2F388E6224dC7C4b3241C544",
    originalTokenId: "8821",
    rebornMintAddress: "5BoPdP8kTqHoqLnqP7qKqZqZqZqZqZqZqZqZqZqZqZ",
    rebornSolanaAddress: "6C8FEamqZqZqZqZqZqZqZqZqZqZqZqZqZqZqZqZ",
    date: "2024-01-25",
  },
  {
    id: "6",
    name: "Sui Doods #256",
    emoji: "👻",
    bgColor: "from-indigo-500 to-purple-500",
    originalChain: "Sui",
    originalContract: "0xa1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
    originalTokenId: "256",
    rebornMintAddress: "7CpPeP8kTqHoqLnqP7qKqZqZqZqZqZqZqZqZqZqZqZ",
    rebornSolanaAddress: "8D9GFbmqZqZqZqZqZqZqZqZqZqZqZqZqZqZqZqZ",
    date: "2024-01-28",
  },
];

function truncateAddress(address: string, chars = 6): string {
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

export default function GalleryPage() {
  const [filter, setFilter] = useState<"All" | "Ethereum" | "Sui">("All");
  const [selectedNFT, setSelectedNFT] = useState<RebornNFT | null>(null);

  const filteredNFTs = MOCK_NFTS.filter((nft) => {
    if (filter === "All") return true;
    return nft.originalChain === filter;
  });

  const handleShare = (nft: RebornNFT) => {
    const text = `🎨 Just reborn ${nft.name} from ${nft.originalChain} to Solana via @IkaTensei!\n\n🆔 Reborn: ${nft.rebornMintAddress}\n\n#NFT #IkaTensei #Web3`;
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank");
  };

  return (
    <div className="min-h-screen bg-void-purple p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="font-pixel text-blood-pink text-xl mb-2">
            🖼️ Reborn Gallery
          </h1>
          <p className="font-silk text-faded-spirit text-sm">
            Your reincarnated NFT collection
          </p>
        </motion.div>

        {/* Filter Bar */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex gap-3 mb-8"
        >
          {(["All", "Ethereum", "Sui"] as const).map((f) => (
            <PixelButton
              key={f}
              variant={filter === f ? "primary" : "dark"}
              size="sm"
              onClick={() => setFilter(f)}
            >
              {f === "All" && "🌐 "}
              {f === "Ethereum" && "⟐ "}
              {f === "Sui" && "◎ "}
              {f}
            </PixelButton>
          ))}
        </motion.div>

        {/* NFT Grid or Empty State */}
        {filteredNFTs.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <DialogueBox
              text="No reborn NFTs here... try another filter?"
              speaker="Ika"
              portrait="worried"
            />
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredNFTs.map((nft, index) => (
              <motion.div
                key={nft.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <PixelCard
                  hover
                  onClick={() => setSelectedNFT(nft)}
                  className="group relative overflow-hidden"
                >
                  {/* NFT Image Placeholder */}
                  <div
                    className={`h-40 w-full bg-gradient-to-br ${nft.bgColor} flex items-center justify-center text-6xl mb-4 relative`}
                  >
                    {nft.emoji}
                    {/* Before Overlay */}
                    <div className="absolute inset-0 bg-void-purple/90 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <div className="text-center">
                        <p className="font-pixel text-ritual-gold text-xs mb-2">BEFORE</p>
                        <p className="font-silk text-faded-spirit text-xs">
                          {nft.originalChain}
                        </p>
                        <p className="font-mono text-soul-cyan text-[10px] mt-1">
                          {truncateAddress(nft.originalContract, 8)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* NFT Info */}
                  <div className="space-y-2">
                    <h3 className="font-pixel text-ghost-white text-xs truncate">
                      {nft.name}
                    </h3>

                    <div className="flex items-center justify-between">
                      {/* Chain Badge */}
                      <span
                        className={`nes-btn is-small ${
                          nft.originalChain === "Ethereum"
                            ? "!bg-blue-600"
                            : "!bg-violet-600"
                        } !text-white !text-[8px] !py-1 !px-2`}
                      >
                        {nft.originalChain === "Ethereum" ? "⟐ ETH" : "◎ SUI"}
                      </span>

                      {/* Truncated Solana Address */}
                      <span className="font-mono text-faded-spirit text-[10px]">
                        {truncateAddress(nft.rebornSolanaAddress)}
                      </span>
                    </div>

                    {/* Share Button */}
                    <div onClick={(e) => e.stopPropagation()}>
                      <PixelButton
                        variant="dark"
                        size="sm"
                        className="w-full mt-3"
                        onClick={() => handleShare(nft)}
                      >
                        🐦 Share on Twitter
                      </PixelButton>
                    </div>
                  </div>
                </PixelCard>
              </motion.div>
            ))}
          </div>
        )}

        {/* Detail Modal */}
        <AnimatePresence>
          {selectedNFT && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-void-purple/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
              onClick={() => setSelectedNFT(null)}
            >
              <motion.div
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                onClick={(e) => e.stopPropagation()}
                className="nes-container is-dark max-w-lg w-full"
              >
                {/* Modal Header */}
                <div className="flex items-center justify-between mb-6">
                  <h2 className="font-pixel text-blood-pink text-sm">
                    NFT Details
                  </h2>
                  <button
                    onClick={() => setSelectedNFT(null)}
                    className="text-faded-spirit hover:text-ghost-white transition-colors"
                  >
                    ✕
                  </button>
                </div>

                {/* NFT Image */}
                <div
                  className={`h-48 w-full bg-gradient-to-br ${selectedNFT.bgColor} flex items-center justify-center text-7xl mb-6 rounded`}
                >
                  {selectedNFT.emoji}
                </div>

                {/* Details */}
                <div className="space-y-4">
                  <div>
                    <p className="font-pixel text-ritual-gold text-[10px] mb-1">NAME</p>
                    <p className="font-silk text-ghost-white text-sm">
                      {selectedNFT.name}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="font-pixel text-ritual-gold text-[10px] mb-1">ORIGINAL CHAIN</p>
                      <span
                        className={`nes-btn is-small ${
                          selectedNFT.originalChain === "Ethereum"
                            ? "!bg-blue-600"
                            : "!bg-violet-600"
                        } !text-white !text-[8px] !py-1 !px-2`}
                      >
                        {selectedNFT.originalChain}
                      </span>
                    </div>
                    <div>
                      <p className="font-pixel text-ritual-gold text-[10px] mb-1">DATE</p>
                      <p className="font-mono text-faded-spirit text-xs">
                        {selectedNFT.date}
                      </p>
                    </div>
                  </div>

                  <div>
                    <p className="font-pixel text-ritual-gold text-[10px] mb-1">ORIGINAL CONTRACT</p>
                    <p className="font-mono text-soul-cyan text-xs break-all">
                      {selectedNFT.originalContract}
                    </p>
                  </div>

                  <div>
                    <p className="font-pixel text-ritual-gold text-[10px] mb-1">TOKEN ID</p>
                    <p className="font-mono text-faded-spirit text-xs">
                      {selectedNFT.originalTokenId}
                    </p>
                  </div>

                  <div>
                    <p className="font-pixel text-ritual-gold text-[10px] mb-1">REBORN MINT ADDRESS</p>
                    <p className="font-mono text-spectral-green text-xs break-all">
                      {selectedNFT.rebornMintAddress}
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3 mt-6">
                  <PixelButton
                    variant="primary"
                    className="flex-1"
                    onClick={() => handleShare(selectedNFT)}
                  >
                    🐦 Share on Twitter
                  </PixelButton>
                  <PixelButton
                    variant="dark"
                    onClick={() => setSelectedNFT(null)}
                  >
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
