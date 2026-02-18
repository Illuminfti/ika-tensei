"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PixelCard } from "@/components/ui/PixelCard";
import { PixelButton } from "@/components/ui/PixelButton";
import { PixelProgress } from "@/components/ui/PixelProgress";
import { DialogueBox } from "@/components/ui/DialogueBox";

// Mock NFT data
const MOCK_NFTS = [
  { id: 1, name: "Cosmic Squid #42", image: "🦑", collection: "Cosmic Creatures" },
  { id: 2, name: "Pixel Dragon #7", image: "🐉", collection: "Pixel Beasts" },
  { id: 3, name: "Ghostly Cat #99", image: "👻", collection: "Spectral Pets" },
  { id: 4, name: "Neon Owl #23", image: "🦉", collection: "Neon Wildlife" },
  { id: 5, name: "Cyber Fox #56", image: "🦊", collection: "Cyber fauna" },
  { id: 6, name: "Void Bear #11", image: "🐻‍❄️", collection: "Void Walkers" },
  { id: 7, name: "Crystal Wolf #88", image: "🐺", collection: "Crystal Pack" },
  { id: 8, name: "Mystic Serpent #33", image: "🐍", collection: "Mystic Realms" },
];

// Ritual steps
const RITUAL_STEPS = [
  { label: "Drawing the summoning circle...", dialogue: "The ancient circle begins to glow with ethereal light... Can you feel the mana gathering?" },
  { label: "Sealing your NFT in the vault...", dialogue: "Your precious NFT is being bound to the mystical vault... The spirits watch over it now!" },
  { label: "Generating your reborn identity...", dialogue: "A new identity emerges from the void... Your reborn self takes shape!" },
  { label: "Minting on Solana...", dialogue: "The blockchain resonates with your presence... Solana burns the seal into the ledger!" },
  { label: "The ritual is complete!", dialogue: "✨ SUCCESS! ✨ Your soul is now bound to the chain forever! The Ika Tensei ritual has blessed you!" },
];

// Pixel sparkle component for success
function PixelSparkles() {
  const sparkles = Array.from({ length: 20 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    delay: Math.random() * 2,
    size: Math.random() * 8 + 8,
    duration: Math.random() * 2 + 2,
  }));

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {sparkles.map((sparkle) => (
        <motion.div
          key={sparkle.id}
          className="absolute bg-spectral-green"
          style={{
            left: `${sparkle.x}%`,
            width: sparkle.size,
            height: sparkle.size,
            boxShadow: `0 0 ${sparkle.size}px #00ff88`,
          }}
          initial={{ y: "100%", opacity: 0 }}
          animate={{
            y: "-100%",
            opacity: [0, 1, 1, 0],
            rotate: [0, 90, 180, 270, 360],
          }}
          transition={{
            duration: sparkle.duration,
            delay: sparkle.delay,
            repeat: Infinity,
            ease: "linear",
          }}
        />
      ))}
    </div>
  );
}

export default function SealPage() {
  const [walletConnected, setWalletConnected] = useState(false);
  const [selectedNft, setSelectedNft] = useState<typeof MOCK_NFTS[0] | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [ritualActive, setRitualActive] = useState(false);
  const [ritualStep, setRitualStep] = useState(0);
  const [showSuccess, setShowSuccess] = useState(false);

  // Handle wallet connection
  const handleConnect = () => {
    setWalletConnected(true);
  };

  // Handle NFT selection
  const handleNftClick = (nft: typeof MOCK_NFTS[0]) => {
    if (!walletConnected) return;
    setSelectedNft(nft);
    setShowConfirm(true);
  };

  // Handle ritual start
  const handleConfirmSeal = () => {
    setShowConfirm(false);
    setRitualActive(true);
    setRitualStep(0);
  };

  // Auto-advance ritual steps
  useEffect(() => {
    if (!ritualActive) return;

    if (ritualStep < RITUAL_STEPS.length - 1) {
      const timer = setTimeout(() => {
        setRitualStep((prev) => prev + 1);
      }, 3000);
      return () => clearTimeout(timer);
    } else {
      const timer = setTimeout(() => {
        setShowSuccess(true);
        setRitualActive(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [ritualStep, ritualActive]);

  // Reset everything
  const handleReset = () => {
    setWalletConnected(false);
    setSelectedNft(null);
    setShowConfirm(false);
    setRitualActive(false);
    setRitualStep(0);
    setShowSuccess(false);
  };

  return (
    <div className="min-h-screen bg-void-purple text-ghost-white font-silk p-8">
      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-12"
      >
        <h1 className="font-pixel text-4xl md:text-5xl text-ritual-gold mb-2 tracking-wider">
          🔮 IKA TENSEI 🔮
        </h1>
        <p className="font-silk text-faded-spirit text-sm">
          The Soul Seal Ritual
        </p>
      </motion.header>

      <AnimatePresence mode="wait">
        {/* Wallet Connection State */}
        {!walletConnected && !ritualActive && !showSuccess && (
          <motion.div
            key="wallet"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="max-w-md mx-auto"
          >
            <div className="nes-container is-dark text-center py-12">
              <div className="text-6xl mb-6">🦑</div>
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

        {/* NFT Selection Grid */}
        {walletConnected && !ritualActive && !showSuccess && !showConfirm && (
          <motion.div
            key="grid"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <DialogueBox
              text="Welcome, seeker! Choose an NFT to bind to the chain. The ritual awaits..."
              speaker="Ika"
              portrait="excited"
            />
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8 max-w-4xl mx-auto">
              {MOCK_NFTS.map((nft, index) => (
                <motion.div
                  key={nft.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <PixelCard onClick={() => handleNftClick(nft)}>
                    <div className="text-center p-4">
                      <div className="text-5xl mb-3">{nft.image}</div>
                      <h3 className="font-pixel text-xs text-ritual-gold mb-1">
                        {nft.name}
                      </h3>
                      <p className="font-silk text-[10px] text-faded-spirit">
                        {nft.collection}
                      </p>
                    </div>
                  </PixelCard>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Confirmation Modal */}
        {showConfirm && selectedNft && (
          <motion.div
            key="confirm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
            onClick={() => setShowConfirm(false)}
          >
            <motion.div
              initial={{ scale: 0.8, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg"
            >
              <DialogueBox
                text={`Are you ready to seal ${selectedNft.name}? This ritual binds your NFT to the eternal chain. There is no turning back...`}
                speaker="Ika"
                portrait="worried"
              />
              
              <div className="flex gap-4 mt-6 justify-center">
                <PixelButton
                  onClick={() => setShowConfirm(false)}
                  variant="dark"
                  size="md"
                >
                  Cancel
                </PixelButton>
                <PixelButton
                  onClick={handleConfirmSeal}
                  variant="warning"
                  size="md"
                >
                  Seal My Soul
                </PixelButton>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Ritual Progress */}
        {ritualActive && !showSuccess && (
          <motion.div
            key="ritual"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="max-w-2xl mx-auto"
          >
            <DialogueBox
              text={RITUAL_STEPS[ritualStep].dialogue}
              speaker="Ika"
              portrait={ritualStep === 4 ? "excited" : "neutral"}
            />
            
            <div className="nes-container is-dark mt-8 p-6">
              <div className="mb-4">
                <span className="font-pixel text-sm text-blood-pink">
                  ⚡ RITUAL IN PROGRESS
                </span>
              </div>
              
              <PixelProgress
                value={((ritualStep + 1) / RITUAL_STEPS.length) * 100}
                label={RITUAL_STEPS[ritualStep].label}
                variant="primary"
              />
              
              <div className="mt-6 flex justify-between">
                {RITUAL_STEPS.map((step, index) => (
                  <div
                    key={index}
                    className={`flex flex-col items-center ${
                      index <= ritualStep ? "text-spectral-green" : "text-faded-spirit"
                    }`}
                  >
                    <div
                      className={`w-3 h-3 mb-1 ${
                        index <= ritualStep ? "bg-spectral-green" : "bg-faded-spirit"
                      }`}
                      style={{
                        boxShadow: index <= ritualStep ? "0 0 8px #00ff88" : "none",
                      }}
                    />
                    <span className="font-silk text-[8px] text-center hidden md:block">
                      {step.label.split("...")[0]}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* Success Screen */}
        {showSuccess && (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-2xl mx-auto text-center relative"
          >
            <PixelSparkles />
            
            <div className="nes-container is-dark p-8 relative z-10">
              <div className="text-6xl mb-6">🎉✨🧿✨🎉</div>
              <h2 className="font-pixel text-2xl text-spectral-green mb-4">
                RITUAL COMPLETE!
              </h2>
              
              <DialogueBox
                text="Your soul has been bound to the chain! Your NFT now exists in the eternal digital realm. The Ika Tensei has accepted you!"
                speaker="Ika"
                portrait="excited"
              />
              
              <div className="mt-8">
                <PixelButton onClick={handleReset} variant="success" size="lg">
                  Seal Another Soul
                </PixelButton>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
