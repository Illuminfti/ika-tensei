"use client";

import { motion } from "framer-motion";
import { PixelButton } from "@/components/ui/PixelButton";
import { DialogueBox } from "@/components/ui/DialogueBox";
import { StatsCounter } from "@/components/ui/StatsCounter";
import { useState } from "react";

const STEPS = [
  { icon: "🔮", title: "Seal", desc: "Deposit your NFT into the sacred vault on ETH or SUI" },
  { icon: "⚡", title: "Reborn", desc: "Your NFT transcends chains via IKA dWallet signing" },
  { icon: "⚔️", title: "Join Guild", desc: "Your reborn NFT grants entry to the Adventurer's Guild" },
];

export default function Home() {
  const [showDialogue] = useState(true);

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative flex flex-col items-center justify-center min-h-[90vh] px-4 overflow-hidden">
        {/* Background sigils */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] border-2 border-mystic-purple rounded-full animate-spin" style={{ animationDuration: "60s" }} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] border border-blood-pink rounded-full animate-spin" style={{ animationDuration: "45s", animationDirection: "reverse" }} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[200px] h-[200px] border border-ritual-gold rounded-full animate-spin" style={{ animationDuration: "30s" }} />
        </div>

        {/* Pixel squid mascot */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-7xl mb-6 animate-float"
        >
          🦑
        </motion.div>

        {/* Title */}
        <motion.h1
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="font-pixel text-3xl md:text-5xl text-center mb-2"
        >
          <span className="text-blood-pink">イカ</span>
          <span className="text-ritual-gold">転生</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="font-pixel text-xs text-faded-spirit mb-8"
        >
          IKA TENSEI
        </motion.p>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="font-silk text-lg text-center text-ghost-white mb-12 max-w-lg"
        >
          Seal your NFTs on Ethereum & Sui.
          <br />
          <span className="text-ritual-gold">Reborn them on Solana.</span>
          <br />
          Join the Adventurer&apos;s Guild.
        </motion.p>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1 }}
        >
          <PixelButton variant="primary" size="lg" onClick={() => window.location.href = "/seal"}>
            Begin the Ritual
          </PixelButton>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.3 }}
          className="flex gap-8 mt-16 border-t border-sigil-border pt-6"
        >
          <StatsCounter target={12847} label="Sealed" icon="🔮" />
          <StatsCounter target={10234} label="Reborn" icon="✨" />
          <StatsCounter target={3} label="Chains" icon="⛓" />
        </motion.div>
      </section>

      {/* How It Works */}
      <section className="py-20 px-4">
        <h2 className="font-pixel text-xl text-center text-ritual-gold mb-16">
          The Sacred Ritual
        </h2>
        <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
          {STEPS.map((step, i) => (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.2 }}
              viewport={{ once: true }}
              className="nes-container is-dark text-center"
            >
              <div className="text-5xl mb-4">{step.icon}</div>
              <h3 className="font-pixel text-sm text-blood-pink mb-3">
                Step {i + 1}: {step.title}
              </h3>
              <p className="font-silk text-xs text-faded-spirit leading-relaxed">
                {step.desc}
              </p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Dialogue teaser */}
      <section className="py-16 px-4">
        {showDialogue && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <DialogueBox
              text="Greetings, adventurer... I sense you carry treasures from distant chains. Shall we begin the reincarnation ritual?"
              speaker="Ika"
              portrait="smug"
            />
          </motion.div>
        )}
      </section>

      {/* Supported Chains */}
      <section className="py-16 px-4 border-t border-sigil-border">
        <div className="flex justify-center gap-12 items-center">
          {[
            { name: "Ethereum", emoji: "⟠", color: "text-soul-cyan" },
            { name: "Sui", emoji: "💧", color: "text-soul-cyan" },
            { name: "Solana", emoji: "◎", color: "text-mystic-purple" },
          ].map((chain) => (
            <div key={chain.name} className="text-center">
              <div className={`text-3xl mb-2 ${chain.color}`}>{chain.emoji}</div>
              <div className="font-silk text-xs text-faded-spirit">{chain.name}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-sigil-border py-8 px-4 text-center">
        <p className="font-silk text-xs text-faded-spirit">
          🦑 Ika Tensei | Cross-Chain NFT Reincarnation Protocol
        </p>
        <p className="font-silk text-[10px] text-sigil-border mt-2">
          Powered by IKA dWallets & Wormhole
        </p>
      </footer>
    </div>
  );
}
