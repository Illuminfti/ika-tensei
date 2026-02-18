"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { NFTCard } from "@/components/ui/NFTCard";
import { PixelButton } from "@/components/ui/PixelButton";
import { PixelProgress } from "@/components/ui/PixelProgress";
import { DialogueBox } from "@/components/ui/DialogueBox";
import { SummoningCircle } from "@/components/ui/SummoningCircle";
import { IkaSprite } from "@/components/ui/PixelSprite";

// Mock NFT data with chain info
const MOCK_NFTS = [
  { id: "1", name: "Cosmic Squid #42", tokenId: "42", chain: "sui" as const, collection: "Cosmic Creatures", status: "available" as const },
  { id: "2", name: "Pixel Dragon #7", tokenId: "7", chain: "ethereum" as const, collection: "Pixel Beasts", status: "available" as const },
  { id: "3", name: "Ghostly Cat #99", tokenId: "99", chain: "solana" as const, collection: "Spectral Pets", status: "available" as const },
  { id: "4", name: "Neon Owl #23", tokenId: "23", chain: "sui" as const, collection: "Neon Wildlife", status: "available" as const },
  { id: "5", name: "Cyber Fox #56", tokenId: "56", chain: "ethereum" as const, collection: "Cyber Fauna", status: "available" as const },
  { id: "6", name: "Void Bear #11", tokenId: "11", chain: "solana" as const, collection: "Void Walkers", status: "available" as const },
  { id: "7", name: "Crystal Wolf #88", tokenId: "88", chain: "sui" as const, collection: "Crystal Pack", status: "available" as const },
  { id: "8", name: "Mystic Serpent #33", tokenId: "33", chain: "ethereum" as const, collection: "Mystic Realms", status: "available" as const },
];

// Ritual steps
const RITUAL_STEPS = [
  { label: "Drawing circle...", text: "The ancient runes begin to materialize..." },
  { label: "Sealing NFT...", text: "Your NFT is being bound to the eternal vault..." },
  { label: "Generating identity...", text: "A new reborn identity emerges from the void..." },
  { label: "Minting on Solana...", text: "The soul is being inscribed on the blockchain..." },
  { label: "Complete!", text: "The ritual is complete. Your soul is now eternal." },
];

type RitualState = "connect" | "select" | "confirm" | "ritual" | "success";

export default function SealPage() {
  const [state, setState] = useState<RitualState>("connect");
  const [selectedNft, setSelectedNft] = useState<typeof MOCK_NFTS[0] | null>(null);
  const [ritualStep, setRitualStep] = useState(0);

  // Handle wallet connection
  const handleConnect = () => {
    setState("select");
  };

  // Handle NFT selection
  const handleNftSelect = (nft: typeof MOCK_NFTS[0]) => {
    setSelectedNft(nft);
    setState("confirm");
  };

  // Handle confirmation
  const handleConfirmSeal = () => {
    setState("ritual");
    setRitualStep(0);
  };

  // Handle cancel
  const handleCancel = () => {
    setSelectedNft(null);
    setState("select");
  };

  // Auto-advance ritual steps
  useEffect(() => {
    if (state !== "ritual") return;

    if (ritualStep < RITUAL_STEPS.length - 1) {
      const timer = setTimeout(() => {
        setRitualStep((prev) => prev + 1);
      }, 3000);
      return () => clearTimeout(timer);
    } else {
      const timer = setTimeout(() => {
        setState("success");
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [ritualStep, state]);

  // Reset everything
  const handleReset = () => {
    setState("connect");
    setSelectedNft(null);
    setRitualStep(0);
  };

  // Get circle phase based on step
  const getCirclePhase = () => {
    if (state !== "ritual") return "idle";
    if (ritualStep === 0) return "charging";
    if (ritualStep === RITUAL_STEPS.length - 1) return "active";
    return "active";
  };

  return (
    <div className="min-h-screen bg-void-purple relative overflow-hidden">
      {/* Background atmosphere */}
      <div 
        className="fixed inset-0 pointer-events-none"
        style={{
          background: `
            radial-gradient(ellipse at 50% 0%, rgba(139, 0, 0, 0.15) 0%, transparent 50%),
            radial-gradient(ellipse at 80% 80%, rgba(0, 100, 50, 0.1) 0%, transparent 40%),
            radial-gradient(ellipse at 20% 90%, rgba(75, 0, 130, 0.1) 0%, transparent 40%)
          `,
        }}
      />

      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center pt-8 pb-4 relative z-10"
      >
        <h1 className="font-pixel text-4xl md:text-5xl text-ritual-gold mb-2 tracking-wider">
          THE SOUL SEAL RITUAL
        </h1>
        <p className="font-silk text-faded-spirit text-sm tracking-widest">
          Bind your NFT to the eternal chain
        </p>
      </motion.header>

      <AnimatePresence mode="wait">
        {/* WALLET CONNECTION STATE */}
        {state === "connect" && (
          <motion.div
            key="connect"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="max-w-md mx-auto relative z-10 px-4"
          >
            <div className="border-2 border-sigil-border bg-card-purple/80 p-8 text-center">
              {/* IkaSprite */}
              <div className="flex justify-center mb-6">
                <IkaSprite size={64} expression="neutral" />
              </div>
              
              <h2 className="font-pixel text-xl text-ritual-gold mb-4">
                Connect Your Wallet
              </h2>
              <p className="font-silk text-faded-spirit mb-8 text-sm">
                Connect your wallet to begin the soul seal ritual
              </p>
              <PixelButton onClick={handleConnect} variant="primary" size="lg">
                Connect Wallet
              </PixelButton>
            </div>
          </motion.div>
        )}

        {/* NFT SELECTION GRID */}
        {state === "select" && (
          <motion.div
            key="select"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="max-w-4xl mx-auto px-4 pb-8 relative z-10"
          >
            <DialogueBox
              text="Choose an NFT to bind to the chain..."
              speaker="Ika"
              portrait="neutral"
            />
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
              {MOCK_NFTS.map((nft, index) => (
                <motion.div
                  key={nft.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <NFTCard
                    name={nft.name}
                    tokenId={nft.tokenId}
                    chain={nft.chain}
                    status={nft.status}
                    collection={nft.collection}
                    onClick={() => handleNftSelect(nft)}
                  />
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* CONFIRMATION MODAL */}
        {state === "confirm" && selectedNft && (
          <motion.div
            key="confirm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
            onClick={handleCancel}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ type: "spring", damping: 15 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md"
            >
              <DialogueBox
                text={`Are you ready to seal ${selectedNft.name}?`}
                speaker="Ika"
                portrait="worried"
                variant="dramatic"
              />
              
              <div className="flex gap-4 justify-center mt-6">
                <PixelButton onClick={handleCancel} variant="dark" size="lg">
                  Cancel
                </PixelButton>
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <PixelButton 
                    onClick={handleConfirmSeal} 
                    variant="warning" 
                    size="lg"
                    className="animate-pulse"
                  >
                    Seal My Soul
                  </PixelButton>
                </motion.div>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* RITUAL PROGRESS */}
        {state === "ritual" && (
          <motion.div
            key="ritual"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="max-w-2xl mx-auto px-4 pb-8 relative z-10"
          >
            {/* Summoning Circle */}
            <div className="py-4 flex justify-center">
              <SummoningCircle 
                phase={getCirclePhase()}
                size={280}
              />
            </div>

            {/* Progress Bar */}
            <div className="my-6">
              <PixelProgress 
                value={((ritualStep + 1) / RITUAL_STEPS.length) * 100}
                label={RITUAL_STEPS[ritualStep].label}
                variant="warning"
              />
            </div>

            {/* Step Dialogue */}
            <DialogueBox
              text={RITUAL_STEPS[ritualStep].text}
              speaker="Ritual"
              portrait="neutral"
              variant="system"
            />

            {/* Step Indicators */}
            <div className="flex justify-center gap-2 mt-8">
              {RITUAL_STEPS.map((_, index) => (
                <motion.div
                  key={index}
                  className={`w-3 h-3 rounded-sm ${
                    index <= ritualStep 
                      ? "bg-spectral-green" 
                      : "bg-void-purple border border-faded-spirit/30"
                  }`}
                  animate={index === ritualStep ? {
                    boxShadow: ["0 0 5px #00ff88", "0 0 15px #00ff88", "0 0 5px #00ff88"],
                  } : {}}
                  transition={{ duration: 1, repeat: Infinity }}
                />
              ))}
            </div>
          </motion.div>
        )}

        {/* SUCCESS SCREEN */}
        {state === "success" && (
          <motion.div
            key="success"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="max-w-2xl mx-auto px-4 pb-8 text-center relative z-10"
          >
            {/* Sparkle Particles */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden">
              {Array.from({ length: 20 }).map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute w-2 h-2"
                  style={{
                    backgroundColor: ["#00ff88", "#ffd700", "#ff3366", "#9945ff"][i % 4],
                    left: `${Math.random() * 100}%`,
                    bottom: "20%",
                  }}
                  animate={{
                    y: [0, -window.innerHeight * 0.8],
                    x: [0, (Math.random() - 0.5) * 100],
                    opacity: [1, 0],
                    scale: [1, 0.5],
                  }}
                  transition={{
                    duration: 2 + Math.random(),
                    delay: Math.random() * 0.5,
                    repeat: Infinity,
                    repeatDelay: Math.random() * 2,
                  }}
                />
              ))}
            </div>

            {/* Success Title */}
            <motion.h2
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", damping: 10 }}
              className="font-pixel text-4xl text-spectral-green mb-6"
            >
              RITUAL COMPLETE!
            </motion.h2>

            {/* Celebration Dialogue */}
            <DialogueBox
              text={`Your soul has been bound! ${selectedNft?.name} now exists eternally on the chain.`}
              speaker="Ika"
              portrait="excited"
              variant="system"
            />

            {/* Reset Button */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="mt-8"
            >
              <PixelButton onClick={handleReset} variant="success" size="lg">
                Seal Another Soul
              </PixelButton>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
