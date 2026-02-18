"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import { SealIcon, SoulOrb, ShieldIcon, ChainBadge, PortalIcon, ScrollIcon, CrownIcon } from "@/components/ui/PixelSprite";
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

  return (
    <div className="min-h-screen relative">
      <BackgroundAtmosphere mood="calm" />

      {/* SECTION 1 - HERO */}
      <section className="relative flex flex-col items-center justify-center min-h-[100vh] px-4 overflow-hidden">
        {/* Hero background art - mirrored on both sides, center clear for content */}
        <div className="absolute inset-0 z-0 opacity-30 overflow-hidden">
          {/* Left side - flipped so statue faces outward left */}
          <div className="absolute inset-y-0 left-0 w-[60%]" style={{ maskImage: 'linear-gradient(to right, black 30%, black 50%, transparent 100%)', WebkitMaskImage: 'linear-gradient(to right, black 30%, black 50%, transparent 100%)' }}>
            <Image
              src="/art/hero-wide.png"
              alt=""
              fill
              className="object-cover object-center"
              style={{ transform: 'scaleX(-1)' }}
              priority
            />
          </div>
          {/* Right side - normal orientation, statue faces outward right */}
          <div className="absolute inset-y-0 right-0 w-[60%]" style={{ maskImage: 'linear-gradient(to left, black 30%, black 50%, transparent 100%)', WebkitMaskImage: 'linear-gradient(to left, black 30%, black 50%, transparent 100%)' }}>
            <Image
              src="/art/hero-wide.png"
              alt=""
              fill
              className="object-cover object-center"
              priority
            />
          </div>
          <div className="absolute inset-0 bg-gradient-to-b from-void-purple/40 via-transparent to-void-purple" />
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

      {/* ═══════════════════════════════════════════════════════════════════════
           SECTION 2 - HOW IT WORKS (Visual Step Flow)
           ═══════════════════════════════════════════════════════════════════════ */}
      <section className="py-24 px-4 relative z-10">
        {/* Section divider glow line */}
        <div className="w-full max-w-lg mx-auto h-px mb-16" style={{ background: 'linear-gradient(90deg, transparent, #ffd700, transparent)' }} />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-4"
        >
          <span className="font-pixel text-[9px] tracking-[0.4em] text-faded-spirit uppercase">How It Works</span>
        </motion.div>
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="font-pixel text-xl md:text-2xl text-center text-ritual-gold text-glow-gold mb-16"
        >
          The Sacred Ritual
        </motion.h2>
        
        {/* Step flow - vertical on mobile, horizontal on desktop */}
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-0 relative">
            {/* Connecting line (desktop only) */}
            <div className="hidden md:block absolute top-[60px] left-[16%] right-[16%] h-[2px]" style={{ background: 'linear-gradient(90deg, #3a2850, #ffd700, #ff3366, #ffd700, #3a2850)' }} />

            {STEPS.map((step, i) => (
              <motion.div
                key={step.title}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: i * 0.2 }}
                className="flex flex-col items-center text-center relative"
              >
                {/* Step number circle */}
                <div className="relative z-10 mb-4">
                  <motion.div
                    whileHover={{ scale: 1.1, boxShadow: '0 0 30px rgba(255, 215, 0, 0.4)' }}
                    className="w-[120px] h-[120px] flex flex-col items-center justify-center"
                    style={{
                      background: 'linear-gradient(135deg, #1a1025, #231832)',
                      border: '2px solid #3a2850',
                      boxShadow: '0 0 20px rgba(255, 215, 0, 0.1), inset 0 0 20px rgba(13, 10, 26, 0.8)',
                    }}
                  >
                    <span className="font-pixel text-[8px] text-faded-spirit mb-1">STEP {i + 1}</span>
                    <div className="mb-1">{step.icon}</div>
                  </motion.div>
                </div>

                <h3 className="font-pixel text-sm text-blood-pink mb-2">{step.title}</h3>
                <p className="font-silk text-xs text-faded-spirit max-w-[220px] leading-relaxed">{step.desc}</p>

                {/* Arrow between steps (mobile only) */}
                {i < STEPS.length - 1 && (
                  <motion.div
                    animate={{ y: [0, 4, 0] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                    className="md:hidden my-3 text-ritual-gold font-pixel text-lg"
                  >
                    ▼
                  </motion.div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
           SECTION 3 - WHY IKA TENSEI (Feature Grid)
           ═══════════════════════════════════════════════════════════════════════ */}
      <section className="py-24 px-4 relative z-10">
        <div className="w-full max-w-lg mx-auto h-px mb-16" style={{ background: 'linear-gradient(90deg, transparent, #ff3366, transparent)' }} />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-4"
        >
          <span className="font-pixel text-[9px] tracking-[0.4em] text-faded-spirit uppercase">Why Choose Us</span>
        </motion.div>
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="font-pixel text-xl md:text-2xl text-center text-blood-pink mb-16"
        >
          Power of Reincarnation
        </motion.h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-3xl mx-auto">
          {[
            {
              icon: <ShieldIcon size={36} />,
              title: "Trustless Security",
              desc: "IKA dWallet 2PC-MPC cryptography. Your NFT never touches a centralized bridge. No multisigs. No trust assumptions.",
              accent: "#00ff88",
            },
            {
              icon: <SoulOrb size={36} />,
              title: "Metadata Preserved",
              desc: "Every trait, every attribute, every piece of history travels with your NFT. Nothing lost in reincarnation.",
              accent: "#00ccff",
            },
            {
              icon: <PortalIcon size={36} />,
              title: "17+ Chains Supported",
              desc: "Ethereum, Polygon, Arbitrum, Base, Sui, Aptos, NEAR and more. If it has NFTs, we can seal it.",
              accent: "#a855f7",
            },
            {
              icon: <CrownIcon size={36} />,
              title: "Guild Access",
              desc: "Every reborn NFT grants membership to the Adventurer's Guild DAO. Vote, earn, and shape the protocol.",
              accent: "#ffd700",
            },
            {
              icon: <SealIcon size={36} />,
              title: "Permanent Storage",
              desc: "Reborn NFTs are stored on Arweave. Permanent. Immutable. Your art lives forever, not on someone's S3 bucket.",
              accent: "#ff6b35",
            },
            {
              icon: <ScrollIcon size={36} open />,
              title: "Open Source",
              desc: "Fully audited. All code public on GitHub. Verify every line. We have nothing to hide.",
              accent: "#ff3366",
            },
          ].map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, x: i % 2 === 0 ? -20 : 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="group p-5 transition-all duration-300 cursor-default"
              style={{
                background: 'rgba(13, 10, 26, 0.6)',
                border: '1px solid #3a285066',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = feature.accent + '66';
                e.currentTarget.style.boxShadow = `0 0 20px ${feature.accent}15`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#3a285066';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 mt-1">{feature.icon}</div>
                <div>
                  <h3 className="font-pixel text-[11px] mb-2" style={{ color: feature.accent }}>{feature.title}</h3>
                  <p className="font-silk text-[11px] text-faded-spirit leading-relaxed">{feature.desc}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
           SECTION 4 - SUPPORTED CHAINS (Expanded Grid)
           ═══════════════════════════════════════════════════════════════════════ */}
      <section className="py-24 px-4 relative z-10">
        <div className="w-full max-w-lg mx-auto h-px mb-16" style={{ background: 'linear-gradient(90deg, transparent, #6fb8ff, transparent)' }} />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-4"
        >
          <span className="font-pixel text-[9px] tracking-[0.4em] text-faded-spirit uppercase">Cross-Chain</span>
        </motion.div>
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="font-pixel text-xl md:text-2xl text-center text-ghost-white mb-4"
        >
          Supported Realms
        </motion.h2>
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
          className="font-silk text-xs text-faded-spirit text-center mb-12 max-w-md mx-auto"
        >
          Seal NFTs from any of these chains. One Solana wallet is all you need.
        </motion.p>

        <div className="max-w-3xl mx-auto">
          {/* EVM chains */}
          <div className="flex flex-wrap justify-center gap-3 mb-6">
            {[
              { name: "Ethereum", abbr: "ETH", color: "#627eea" },
              { name: "Polygon", abbr: "POL", color: "#8247e5" },
              { name: "Arbitrum", abbr: "ARB", color: "#28a0f0" },
              { name: "Base", abbr: "BASE", color: "#0052ff" },
              { name: "Optimism", abbr: "OP", color: "#ff0420" },
              { name: "BNB Chain", abbr: "BNB", color: "#f0b90b" },
              { name: "Avalanche", abbr: "AVAX", color: "#e84142" },
              { name: "Fantom", abbr: "FTM", color: "#1969ff" },
              { name: "Moonbeam", abbr: "GLMR", color: "#53cbc9" },
              { name: "Celo", abbr: "CELO", color: "#35d07f" },
              { name: "Scroll", abbr: "SCR", color: "#c39b78" },
              { name: "Blast", abbr: "BLAST", color: "#fcfc03" },
              { name: "Linea", abbr: "LINE", color: "#61dfff" },
              { name: "Gnosis", abbr: "GNO", color: "#048a81" },
            ].map((chain, i) => (
              <motion.div
                key={chain.name}
                initial={{ opacity: 0, scale: 0 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.03, type: "spring", stiffness: 300 }}
                className="flex items-center gap-2 px-3 py-2"
                style={{
                  background: `${chain.color}10`,
                  border: `1px solid ${chain.color}33`,
                }}
              >
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ background: chain.color, boxShadow: `0 0 6px ${chain.color}66` }}
                />
                <span className="font-pixel text-[8px]" style={{ color: chain.color }}>{chain.abbr}</span>
              </motion.div>
            ))}
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3 mb-6">
            <div className="flex-1 h-px bg-sigil-border/40" />
            <span className="font-pixel text-[8px] text-faded-spirit">+</span>
            <div className="flex-1 h-px bg-sigil-border/40" />
          </div>

          {/* Non-EVM chains - larger */}
          <div className="flex justify-center gap-4">
            {[
              { name: "Sui", color: "#6fb8ff" },
              { name: "Aptos", color: "#00d4c2" },
              { name: "NEAR", color: "#00c08b" },
            ].map((chain, i) => (
              <motion.div
                key={chain.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.4 + i * 0.1 }}
                className="flex items-center gap-2 px-4 py-3"
                style={{
                  background: `${chain.color}10`,
                  border: `1px solid ${chain.color}44`,
                }}
              >
                <div
                  className="w-4 h-4 rounded-full"
                  style={{ background: chain.color, boxShadow: `0 0 8px ${chain.color}66` }}
                />
                <span className="font-pixel text-[10px]" style={{ color: chain.color }}>{chain.name}</span>
              </motion.div>
            ))}
          </div>

          {/* Destination */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.7 }}
            className="text-center mt-8"
          >
            <div className="inline-flex items-center gap-3 px-6 py-3" style={{ border: '2px solid #9945ff44', background: 'rgba(153, 69, 255, 0.08)' }}>
              <motion.div
                animate={{ rotate: [0, 360] }}
                transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
              >
                <SoulOrb size={20} />
              </motion.div>
              <span className="font-pixel text-[10px] text-ghost-white">Reborn on</span>
              <span className="font-pixel text-[11px]" style={{ color: '#9945ff' }}>SOLANA</span>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
           SECTION 5 - SECURITY & TRUST
           ═══════════════════════════════════════════════════════════════════════ */}
      <section className="py-24 px-4 relative z-10">
        <div className="w-full max-w-lg mx-auto h-px mb-16" style={{ background: 'linear-gradient(90deg, transparent, #00ff88, transparent)' }} />

        <div className="max-w-3xl mx-auto">
          <div className="p-8 relative" style={{ background: 'rgba(0, 255, 136, 0.03)', border: '1px solid rgba(0, 255, 136, 0.15)' }}>
            {/* Corner runes */}
            <div className="absolute top-2 left-3 font-pixel text-[8px] text-spectral-green/40">◆</div>
            <div className="absolute top-2 right-3 font-pixel text-[8px] text-spectral-green/40">◆</div>
            <div className="absolute bottom-2 left-3 font-pixel text-[8px] text-spectral-green/40">◆</div>
            <div className="absolute bottom-2 right-3 font-pixel text-[8px] text-spectral-green/40">◆</div>

            <h2 className="font-pixel text-lg text-center text-spectral-green mb-8">Security First</h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-center">
              {[
                { label: "Audited", detail: "9 HIGH findings fixed", icon: "🛡️" },
                { label: "Open Source", detail: "github.com/Illuminfti", icon: "📖" },
                { label: "dWallet MPC", detail: "2PC-MPC cryptography", icon: "🔐" },
              ].map((item, i) => (
                <motion.div
                  key={item.label}
                  initial={{ opacity: 0, y: 15 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.15 }}
                >
                  <div className="text-2xl mb-2">{item.icon}</div>
                  <h3 className="font-pixel text-[11px] text-spectral-green mb-1">{item.label}</h3>
                  <p className="font-silk text-[10px] text-faded-spirit">{item.detail}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
           SECTION 6 - DIALOGUE + FINAL CTA
           ═══════════════════════════════════════════════════════════════════════ */}
      <section className="py-24 px-4 relative z-10">
        <div className="w-full max-w-lg mx-auto h-px mb-16" style={{ background: 'linear-gradient(90deg, transparent, #ffd700, transparent)' }} />

        <div className="max-w-2xl mx-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
          >
            <DialogueBox
              speaker="Ika"
              portrait="smug"
              text="Your NFTs are scattered across a dozen chains, collecting dust. Bring them home. The ritual awaits, and I've been waiting for you~"
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
            className="text-center mt-12"
          >
            <div className="animate-pulse-glow inline-block rounded-lg">
              <Link href="/seal">
                <PixelButton variant="primary" size="lg">
                  ⚔ Begin the Ritual
                </PixelButton>
              </Link>
            </div>
            <p className="font-silk text-[10px] text-faded-spirit mt-4">
              Connect your Solana wallet. Select a chain. Seal your NFT. Done.
            </p>
          </motion.div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
           FOOTER
           ═══════════════════════════════════════════════════════════════════════ */}
      <footer className="py-12 px-4 relative z-10 border-t border-sigil-border/30">
        <div className="max-w-4xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-8">
            <div className="flex items-center gap-3">
              <Image src="/art/ika-mascot-v2.png" alt="Ika" width={40} height={40} className="pixelated" style={{ imageRendering: 'pixelated' }} />
              <div>
                <h3 className="font-pixel text-sm text-ritual-gold">イカ転生</h3>
                <p className="font-silk text-[10px] text-faded-spirit">NFT Reincarnation Protocol</p>
              </div>
            </div>
            
            <div className="flex gap-8">
              <a href="https://github.com/Illuminfti/ika-tensei" target="_blank" rel="noopener noreferrer" className="font-pixel text-[9px] text-faded-spirit hover:text-ghost-white transition-colors">
                GitHub
              </a>
              <Link href="/seal" className="font-pixel text-[9px] text-faded-spirit hover:text-blood-pink transition-colors">
                Seal
              </Link>
              <Link href="/gallery" className="font-pixel text-[9px] text-faded-spirit hover:text-soul-cyan transition-colors">
                Gallery
              </Link>
              <Link href="/guild" className="font-pixel text-[9px] text-faded-spirit hover:text-ritual-gold transition-colors">
                Guild
              </Link>
              <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" className="font-pixel text-[9px] text-faded-spirit hover:text-ghost-white transition-colors">
                Twitter
              </a>
            </div>
          </div>
          
          <div className="text-center">
            <p className="font-silk text-[9px] text-faded-spirit/50">
              Powered by IKA dWallet Network · Metaplex Core · Arweave
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
