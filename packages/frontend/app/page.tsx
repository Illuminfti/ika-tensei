"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import { IkaSprite, SealIcon, SoulOrb, ShieldIcon, ChainBadge } from "@/components/ui/PixelSprite";
import { SummoningCircle } from "@/components/ui/SummoningCircle";
import { BackgroundAtmosphere } from "@/components/ui/BackgroundAtmosphere";
import { DialogueBox } from "@/components/ui/DialogueBox";
import { PixelButton } from "@/components/ui/PixelButton";
import { StatsCounter } from "@/components/ui/StatsCounter";

export default function Home() {
  const STEPS = [
    {
      icon: <SealIcon size={48} />,
      title: "Seal",
      desc: "Deposit your NFT into the sacred vault on Ethereum or Sui. Your soul绑定 awaits.",
    },
    {
      icon: <SoulOrb size={48} />,
      title: "Reborn",
      desc: "Your NFT transcends chains via IKA dWallet 2PC-MPC signing. Transcendence awaits.",
    },
    {
      icon: <ShieldIcon size={48} />,
      title: "Join Guild",
      desc: "Your reborn NFT grants entry to the Adventurer's Guild DAO. Rise together.",
    },
  ];

  const CHAINS = [
    { name: "Ethereum", color: "#627eea" },
    { name: "Sui", color: "#6fb8ff" },
    { name: "Solana", color: "#9945ff" },
  ];

  return (
    <div className="min-h-screen relative">
      <BackgroundAtmosphere mood="calm" />

      {/* SECTION 1 - HERO */}
      <section className="relative flex flex-col items-center justify-center min-h-[100vh] px-4 overflow-hidden">
        {/* Hero background art - mirrored on both sides for symmetry */}
        <div className="absolute inset-0 z-0 opacity-25 overflow-hidden">
          {/* Left side */}
          <div className="absolute inset-y-0 left-0 w-1/2">
            <Image
              src="/art/hero-wide.png"
              alt=""
              fill
              className="object-cover object-right scale-x-[-1]"
              priority
            />
          </div>
          {/* Right side */}
          <div className="absolute inset-y-0 right-0 w-1/2">
            <Image
              src="/art/hero-wide.png"
              alt=""
              fill
              className="object-cover object-left"
              priority
            />
          </div>
          <div className="absolute inset-0 bg-gradient-to-b from-void-purple/60 via-transparent to-void-purple" />
          {/* Center fade so text is readable */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-void-purple/80 to-transparent" />
        </div>

        {/* Summoning Circle - centered, slightly above middle */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[55%] z-[1]">
          <SummoningCircle size={500} phase="idle" />
        </div>

        {/* Mascot - pixel art goddess with bobbing animation */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="relative z-10 mb-6"
          style={{ filter: "drop-shadow(0 8px 24px rgba(255, 51, 102, 0.3))" }}
        >
          <motion.div
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          >
            <Image
              src="/art/ika-chibi.png"
              alt="Ika - Squid Goddess"
              width={200}
              height={200}
              className="pixelated"
              style={{ imageRendering: "pixelated" }}
              priority
            />
          </motion.div>
        </motion.div>

        {/* Title with staggered entrance */}
        <motion.h1
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="font-pixel text-4xl md:text-6xl text-center mb-4 relative z-10 flex gap-3"
        >
          <motion.span
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="text-blood-pink text-glow-pink"
          >
            イカ
          </motion.span>
          <motion.span
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.6 }}
            className="text-ritual-gold text-glow-gold"
          >
            転生
          </motion.span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.7 }}
          className="font-pixel text-[10px] tracking-[0.3em] text-faded-spirit mb-6 relative z-10"
        >
          NFT REINCARNATION PROTOCOL
        </motion.p>

        {/* Description */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.9 }}
          className="text-center mb-10 relative z-10"
        >
          <p className="font-silk text-base text-ghost-white">
            Seal your NFTs on Ethereum & Sui / Reborn them on Solana
          </p>
        </motion.div>

        {/* CTA with pulse-glow wrapper */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 1.1 }}
          className="relative z-10"
        >
          <div className="animate-pulse-glow rounded-lg">
            <Link href="/seal">
              <PixelButton variant="primary" size="lg">
                ⚔ Begin the Ritual
              </PixelButton>
            </Link>
          </div>
        </motion.div>

        {/* Stats row */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 1.3 }}
          className="flex gap-8 md:gap-12 mt-16 relative z-10"
        >
          <StatsCounter target={12847} label="Sealed" icon={<SealIcon size={20} />} />
          <StatsCounter target={10234} label="Reborn" icon={<SoulOrb size={20} />} />
          <StatsCounter target={3} label="Chains" icon={<ChainBadge chain="ethereum" size={20} />} />
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 1.5 }}
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

      {/* SECTION 2 - HOW IT WORKS */}
      <section className="py-24 px-4 relative z-10">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="font-pixel text-xl text-center text-ritual-gold text-glow-gold mb-4"
        >
          The Sacred Ritual
        </motion.h2>
        
        <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto mt-12">
          {STEPS.map((step, i) => (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.15 }}
              className="pixel-card p-6 text-center hover:lift transition-transform duration-300"
            >
              <div className="mb-4 flex justify-center">{step.icon}</div>
              <h3 className="font-pixel text-sm text-blood-pink mb-2">{step.title}</h3>
              <p className="font-silk text-xs text-faded-spirit">{step.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* SECTION 3 - DIALOGUE */}
      <section className="py-16 px-4 relative z-10">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <DialogueBox
            speaker="Ika"
            portrait="smug"
            text="The ancient seals have been broken. Your NFTs lie dormant on foreign chains, waiting for rebirth. Through the sacred ritual of the IKA dWallet, their souls shall be reborn on Solana, granting them eternal life within the Guild. Will you answer the call?"
          />
        </motion.div>
      </section>

      {/* SECTION 4 - SUPPORTED CHAINS */}
      <section className="py-16 px-4 relative z-10">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="font-pixel text-lg text-center text-faded-spirit mb-8"
        >
          Supported Realms
        </motion.h2>
        
        <div className="flex justify-center gap-6 md:gap-10">
          {CHAINS.map((chain, i) => (
            <motion.div
              key={chain.name}
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.1 }}
              className="flex flex-col items-center gap-2 group cursor-default"
            >
              <ChainBadge chain={chain.name.toLowerCase() as "ethereum" | "sui" | "solana"} size={48} />
              <span 
                className="font-pixel text-xs text-faded-spirit transition-all duration-300"
                style={{ 
                  textShadow: `0 0 10px ${chain.color}40`,
                }}
              >
                {chain.name}
              </span>
            </motion.div>
          ))}
        </div>
      </section>

      {/* FOOTER */}
      <footer className="py-12 px-4 relative z-10 border-t border-sigil-border/30">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <IkaSprite size={32} expression="smug" />
            <div>
              <h3 className="font-pixel text-sm text-ritual-gold">Ika Tensei</h3>
              <p className="font-silk text-xs text-faded-spirit">NFT Reincarnation Protocol</p>
            </div>
          </div>
          
          <div className="flex gap-6">
            <a 
              href="https://github.com/Illuminfti/ika-tensei" 
              target="_blank" 
              rel="noopener noreferrer"
              className="font-silk text-xs text-faded-spirit hover:text-ghost-white transition-colors"
            >
              GitHub
            </a>
            <a 
              href="/guild" 
              className="font-silk text-xs text-faded-spirit hover:text-ghost-white transition-colors"
            >
              Guild
            </a>
            <a 
              href="https://twitter.com" 
              target="_blank" 
              rel="noopener noreferrer"
              className="font-silk text-xs text-faded-spirit hover:text-ghost-white transition-colors"
            >
              Twitter
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
