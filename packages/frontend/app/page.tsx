"use client";

import { motion } from "framer-motion";
import { PixelButton } from "@/components/ui/PixelButton";
import { DialogueBox } from "@/components/ui/DialogueBox";
import { StatsCounter } from "@/components/ui/StatsCounter";
import { SummoningCircle } from "@/components/ui/SummoningCircle";
import { IkaSprite, SealIcon } from "@/components/ui/PixelSprite";
import { BackgroundStars } from "@/components/ui/BackgroundStars";

const STEPS = [
  { icon: <SealIcon size={48} />, title: "Seal", desc: "Deposit your NFT into the sacred vault on Ethereum or Sui" },
  { icon: <span className="text-4xl">⚡</span>, title: "Reborn", desc: "Your NFT transcends chains via IKA dWallet 2PC-MPC signing" },
  { icon: <span className="text-4xl">⚔️</span>, title: "Join Guild", desc: "Your reborn NFT grants entry to the Adventurer's Guild DAO" },
];

export default function Home() {
  return (
    <div className="min-h-screen relative">
      <BackgroundStars />
      
      {/* Hero Section */}
      <section className="relative flex flex-col items-center justify-center min-h-[100vh] px-4 overflow-hidden">
        {/* Summoning circle behind mascot */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[55%]">
          <SummoningCircle size={500} active={false} />
        </div>

        {/* Pixel squid mascot */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: "easeOut" }}
          className="relative z-10 mb-4"
          style={{ filter: "drop-shadow(0 0 20px #9b59b644)" }}
        >
          <motion.div
            animate={{ y: [0, -8, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          >
            <IkaSprite size={96} expression="smug" />
          </motion.div>
        </motion.div>

        {/* Title */}
        <motion.h1
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.3 }}
          className="font-pixel text-4xl md:text-6xl text-center mb-2 relative z-10"
        >
          <span className="text-blood-pink text-glow-pink">イカ</span>
          <span className="text-ritual-gold text-glow-gold">転生</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="font-pixel text-[10px] tracking-[0.3em] text-faded-spirit mb-10 relative z-10"
        >
          NFT REINCARNATION PROTOCOL
        </motion.p>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9 }}
          className="text-center mb-12 relative z-10 max-w-md"
        >
          <p className="font-silk text-base text-ghost-white leading-relaxed">
            Seal your NFTs on <span className="text-soul-cyan">Ethereum</span> &amp; <span className="text-soul-cyan">Sui</span>
          </p>
          <p className="font-silk text-base text-ritual-gold mt-1">
            Reborn them on Solana
          </p>
          <p className="font-silk text-xs text-faded-spirit mt-2">
            Powered by IKA dWallet 2PC-MPC cryptography
          </p>
        </motion.div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.2 }}
          className="relative z-10"
        >
          <div className="animate-pulse-glow rounded">
            <PixelButton variant="primary" size="lg" onClick={() => window.location.href = "/seal"}>
              ⚔ Begin the Ritual
            </PixelButton>
          </div>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5 }}
          className="flex gap-10 mt-20 relative z-10"
        >
          <StatsCounter target={12847} label="Sealed" icon={<SealIcon size={20} />} />
          <StatsCounter target={10234} label="Reborn" icon="✨" />
          <StatsCounter target={3} label="Chains" icon="⛓" />
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2 }}
          className="absolute bottom-8 z-10"
        >
          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="font-pixel text-xs text-faded-spirit"
          >
            ▼
          </motion.div>
        </motion.div>
      </section>

      {/* How It Works */}
      <section className="py-24 px-4 relative z-10">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="font-pixel text-xl text-center text-ritual-gold text-glow-gold mb-4"
        >
          The Sacred Ritual
        </motion.h2>
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="font-silk text-xs text-center text-faded-spirit mb-16"
        >
          Three steps to transcendence
        </motion.p>
        
        <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {STEPS.map((step, i) => (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.15 }}
              viewport={{ once: true }}
              className="pixel-card p-6 text-center group"
            >
              <div className="mb-4 flex justify-center opacity-60 group-hover:opacity-100 transition-opacity">
                {step.icon}
              </div>
              <div className="font-pixel text-[10px] text-faded-spirit mb-2">
                STEP {i + 1}
              </div>
              <h3 className="font-pixel text-sm text-blood-pink mb-3">
                {step.title}
              </h3>
              <p className="font-silk text-xs text-faded-spirit leading-relaxed">
                {step.desc}
              </p>
            </motion.div>
          ))}
        </div>

        {/* Connecting lines between steps */}
        <div className="hidden md:flex justify-center items-center max-w-4xl mx-auto -mt-[140px] mb-[100px] pointer-events-none">
          <div className="flex-1" />
          <div className="w-16 h-px bg-gradient-to-r from-sigil-border to-transparent" />
          <div className="w-16 h-px bg-gradient-to-l from-sigil-border to-transparent" />
          <div className="flex-1" />
          <div className="w-16 h-px bg-gradient-to-r from-sigil-border to-transparent" />
          <div className="w-16 h-px bg-gradient-to-l from-sigil-border to-transparent" />
          <div className="flex-1" />
        </div>
      </section>

      {/* Dialogue teaser */}
      <section className="py-16 px-4 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <DialogueBox
            text="Greetings, adventurer... I sense you carry treasures from distant chains. The ritual of reincarnation awaits those brave enough to cross the void between worlds."
            speaker="Ika"
            portrait="smug"
          />
        </motion.div>
      </section>

      {/* Supported Chains */}
      <section className="py-20 px-4 relative z-10">
        <div className="max-w-xl mx-auto">
          <h3 className="font-pixel text-xs text-center text-faded-spirit mb-8 tracking-widest">
            SUPPORTED CHAINS
          </h3>
          <div className="flex justify-center gap-16 items-center">
            {[
              { name: "Ethereum", color: "#627eea" },
              { name: "Sui", color: "#4da2ff" },
              { name: "Solana", color: "#9945ff" },
            ].map((chain, i) => (
              <motion.div
                key={chain.name}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                viewport={{ once: true }}
                className="text-center group"
              >
                <div 
                  className="w-10 h-10 mx-auto mb-2 rounded border border-sigil-border flex items-center justify-center group-hover:border-opacity-100 transition-all"
                  style={{ borderColor: chain.color + "44", boxShadow: `0 0 10px ${chain.color}11` }}
                >
                  <div className="w-4 h-4 rounded-sm" style={{ backgroundColor: chain.color }} />
                </div>
                <div className="font-silk text-[10px] text-faded-spirit">{chain.name}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-sigil-border py-10 px-4 text-center relative z-10">
        <div className="flex justify-center mb-3">
          <IkaSprite size={32} expression="neutral" />
        </div>
        <p className="font-pixel text-[10px] text-faded-spirit">
          Ika Tensei
        </p>
        <p className="font-silk text-[10px] text-sigil-border mt-2">
          Cross-Chain NFT Reincarnation via IKA dWallets &amp; Wormhole
        </p>
        <div className="flex justify-center gap-4 mt-4">
          <a href="https://github.com/Illuminfti/ika-tensei" target="_blank" className="font-silk text-[10px] text-faded-spirit hover:text-ghost-white transition-colors">GitHub</a>
          <span className="text-sigil-border">·</span>
          <a href="/guild" className="font-silk text-[10px] text-faded-spirit hover:text-ghost-white transition-colors">Guild</a>
          <span className="text-sigil-border">·</span>
          <a href="https://twitter.com/ika_tensei" target="_blank" className="font-silk text-[10px] text-faded-spirit hover:text-ghost-white transition-colors">Twitter</a>
        </div>
      </footer>
    </div>
  );
}
