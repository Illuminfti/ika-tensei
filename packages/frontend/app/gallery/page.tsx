"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { NFTCard, Chain } from "@/components/ui/NFTCard";
import { PixelButton } from "@/components/ui/PixelButton";
import { DialogueBox } from "@/components/ui/DialogueBox";

interface RebornNFT {
  id: string;
  name: string;
  chain: "Ethereum" | "Sui";
  tokenId: string;
  originalContract: string;
  rebornMintAddress: string;
  rebornSolanaAddress: string;
  date: string;
}

const MOCK_NFTS: RebornNFT[] = [
  {
    id: "1",
    name: "Cryptopunk #7842",
    chain: "Ethereum",
    tokenId: "7842",
    originalContract: "0xb47e3cd837dDF8e4c57F05d70Ab865de6e193BBB",
    rebornMintAddress: "CXwpmrmqF7DqMX5Zk3mLp5XqG7Uf8xJkYzPYjRqRqRqR",
    rebornSolanaAddress: "5W9FLZBmCqhoqLnqP7qKqZqZqZqZqZqZqZqZqZqZqZqZ",
    date: "2024-01-15",
  },
  {
    id: "2",
    name: "Sui Frens #1024",
    chain: "Sui",
    tokenId: "1024",
    originalContract: "0x8474a6e7d5f6b6b6b6b6b6b6b6b6b6b6b6b6b6",
    rebornMintAddress: "8XqLbP8kTqHoqLnqP7qKqZqZqZqZqZqZqZqZqZqZqZq",
    rebornSolanaAddress: "3R8FFZqZqZqZqZqZqZqZqZqZqZqZqZqZqZqZqZqZ",
    date: "2024-01-18",
  },
  {
    id: "3",
    name: "BoredApe #3399",
    chain: "Ethereum",
    tokenId: "3399",
    originalContract: "0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D",
    rebornMintAddress: "9YmNbP9kTqHoqLnqP7qKqZqZqZqZqZqZqZqZqZqZqZq",
    rebornSolanaAddress: "7K9GEZmqZqZqZqZqZqZqZqZqZqZqZqZqZqZqZqZq",
    date: "2024-01-20",
  },
  {
    id: "4",
    name: "Sui Capys #777",
    chain: "Sui",
    tokenId: "777",
    originalContract: "0x9586b6e7d5f6b6b6b6b6b6b6b6b6b6b6b6b6b6",
    rebornMintAddress: "2AnOcP8kTqHoqLnqP7qKqZqZqZqZqZqZqZqZqZqZqZ",
    rebornSolanaAddress: "4L7DEZlqZqZqZqZqZqZqZqZqZqZqZqZqZqZqZqZ",
    date: "2024-01-22",
  },
  {
    id: "5",
    name: "Azuki #8821",
    chain: "Ethereum",
    tokenId: "8821",
    originalContract: "0xED5AF388653567Af2F388E6224dC7C4b3241C544",
    rebornMintAddress: "5BoPdP8kTqHoqLnqP7qKqZqZqZqZqZqZqZqZqZqZqZ",
    rebornSolanaAddress: "6C8FEamqZqZqZqZqZqZqZqZqZqZqZqZqZqZqZqZ",
    date: "2024-01-25",
  },
  {
    id: "6",
    name: "Sui Doods #256",
    chain: "Sui",
    tokenId: "256",
    originalContract: "0xa1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
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
    return nft.chain === filter;
  });

  const handleShare = (nft: RebornNFT) => {
    const text = `🎨 Just reborn ${nft.name}!\n\nOriginal: ${nft.originalContract}\nReborn: ${nft.rebornMintAddress}\n\n#IkaTensei #NFTReborn`;
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
          <PixelButton
            variant={filter === "All" ? "primary" : "dark"}
            size="sm"
            onClick={() => setFilter("All")}
          >
            🌐 All
          </PixelButton>
          <PixelButton
            variant={filter === "Ethereum" ? "primary" : "dark"}
            size="sm"
            onClick={() => setFilter("Ethereum")}
          >
            ⟐ ETH
          </PixelButton>
          <PixelButton
            variant={filter === "Sui" ? "primary" : "dark"}
            size="sm"
            onClick={() => setFilter("Sui")}
          >
            ◎ SUI
          </PixelButton>
        </motion.div>

        {/* NFT Grid or Empty State */}
        {filteredNFTs.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <DialogueBox
              text="No reborn NFTs here..."
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
                <NFTCard
                  name={nft.name}
                  tokenId={nft.tokenId}
                  chain={nft.chain.toLowerCase() as Chain}
                  status="reborn"
                  onClick={() => setSelectedNFT(nft)}
                />
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
                className="bg-[#0a0a14] border-2 border-ritual-gold/30 p-6 max-w-lg w-full"
              >
                {/* NFT Image Area - taller */}
                <div className="h-56 flex items-center justify-center bg-black/30 mb-6 rounded-lg border border-faded-spirit/10">
                  <NFTCard
                    name={selectedNFT.name}
                    tokenId={selectedNFT.tokenId}
                    chain={selectedNFT.chain.toLowerCase() as Chain}
                    status="reborn"
                  />
                </div>

                {/* Name, Chain Badge, Date */}
                <div className="mb-6">
                  <h2 className="font-pixel text-ghost-white text-lg mb-3">
                    {selectedNFT.name}
                  </h2>
                  <div className="flex items-center gap-3">
                    <span
                      className={`nes-btn is-small ${
                        selectedNFT.chain === "Ethereum"
                          ? "!bg-blue-600"
                          : "!bg-violet-600"
                      } !text-white !text-[8px] !py-1 !px-2`}
                    >
                      {selectedNFT.chain === "Ethereum" ? "⟐ ETH" : "◎ SUI"}
                    </span>
                    <span className="font-mono text-faded-spirit text-xs">
                      {selectedNFT.date}
                    </span>
                  </div>
                </div>

                {/* Original Contract */}
                <div className="mb-4">
                  <p className="font-pixel text-ritual-gold text-[10px] mb-1">
                    ORIGINAL CONTRACT
                  </p>
                  <p className="font-mono text-soul-cyan text-xs break-all">
                    {truncateAddress(selectedNFT.originalContract, 8)}
                  </p>
                </div>

                {/* Token ID */}
                <div className="mb-4">
                  <p className="font-pixel text-ritual-gold text-[10px] mb-1">
                    TOKEN ID
                  </p>
                  <p className="font-mono text-faded-spirit text-xs">
                    #{selectedNFT.tokenId}
                  </p>
                </div>

                {/* Reborn Mint Address */}
                <div className="mb-6">
                  <p className="font-pixel text-ritual-gold text-[10px] mb-1">
                    REBORN MINT ADDRESS
                  </p>
                  <p className="font-mono text-spectral-green text-xs break-all">
                    {truncateAddress(selectedNFT.rebornMintAddress, 8)}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex gap-3">
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
