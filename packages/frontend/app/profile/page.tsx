"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import PixelSprites from "@/components/ui/PixelSprite";

const { IkaSprite } = PixelSprites;

// ============================================================================
// TYPES
// ============================================================================

interface Wallet {
  id: string;
  chain: "ETH" | "SOL" | "SUI";
  address: string;
  connected: boolean;
}

interface PendingSeal {
  id: number;
  name: string;
  chain: "ETH" | "SOL" | "SUI";
  progress: number;
  status: string;
}

interface CompletedReincarnation {
  id: number;
  name: string;
  newName: string;
  date: string;
  tx: string;
  explorer: string;
}

interface Transaction {
  id: number;
  date: string;
  action: string;
  type: "reincarnation" | "seal" | "wallet" | "guild" | "trade";
  explorer: string | null;
}

interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  earned: boolean;
  earnedDate?: string;
}

// ============================================================================
// MOCK DATA
// ============================================================================

const ACHIEVEMENTS: Achievement[] = [
  { id: "first_seal", name: "First Seal", description: "Completed your first seal", icon: "🏅", earned: true, earnedDate: "Feb 8, 2026" },
  { id: "multi_chain", name: "Multi-Chain Master", description: "Connected wallets on 3 chains", icon: "⛓️", earned: true, earnedDate: "Feb 10, 2026" },
  { id: "guild_veteran", name: "Guild Veteran", description: "Joined a guild", icon: "🏰", earned: false },
  { id: "soul_surgeon", name: "Soul Surgeon", description: "Reincarnated 10 NFTs", icon: "🗡️", earned: false },
  { id: "collector", name: "Arcane Collector", description: "Sealed 50 NFTs", icon: "📜", earned: false },
  { id: "ancient_one", name: "Ancient One", description: "Held a seal for 30 days", icon: "🔮", earned: false },
];

const CONNECTED_WALLETS: Wallet[] = [
  { id: "eth", chain: "ETH", address: "0x742d35Cc6634C0532925a3b844Bc9e7595f7a5E2", connected: true },
  { id: "sol", chain: "SOL", address: "FKab9x8v9YzP3nq2xL5kP7mN4pQ6rT8uV0wX1yZ3", connected: true },
  { id: "sui", chain: "SUI", address: "0x8f7...3a1b", connected: false },
];

const PENDING_SEALS: PendingSeal[] = [
  { id: 1, name: "Bored Ape #8842", chain: "ETH", progress: 65, status: "Sealing in vault..." },
  { id: 2, name: "Degen #0127", chain: "SOL", progress: 30, status: "Summoning..." },
];

const COMPLETED_REINCARNATIONS: CompletedReincarnation[] = [
  { id: 1, name: "Cosmic Jelly #001", newName: "Cosmic Jelly (Sol)", date: "Feb 15, 2026", tx: "5xK7m...nP2q", explorer: "solscan.io/tx/5xK7m" },
  { id: 2, name: "Pixel Squid #042", newName: "Squid Lord (Sol)", date: "Feb 12, 2026", tx: "3aB9c...mL4k", explorer: "solscan.io/tx/3aB9c" },
  { id: 3, name: "Void Walker #777", newName: "Void Walker (Sol)", date: "Feb 10, 2026", tx: "8pQ2r...tY6z", explorer: "solscan.io/tx/8pQ2r" },
  { id: 4, name: "Ghost Spirit #888", newName: "Ghost King (Sol)", date: "Feb 8, 2026", tx: "1mN4s...wX9a", explorer: "solscan.io/tx/1mN4s" },
];

const TRANSACTION_HISTORY: Transaction[] = [
  { id: 1, date: "Feb 15, 2026", action: "Reincarnation Complete", type: "reincarnation", explorer: "solscan.io/tx/5xK7m" },
  { id: 2, date: "Feb 14, 2026", action: "Seal Initiated", type: "seal", explorer: "etherscan.io/tx/0xabcd" },
  { id: 3, date: "Feb 12, 2026", action: "Reincarnation Complete", type: "reincarnation", explorer: "solscan.io/tx/3aB9c" },
  { id: 4, date: "Feb 11, 2026", action: "Wallet Connected", type: "wallet", explorer: null },
  { id: 5, date: "Feb 10, 2026", action: "Reincarnation Complete", type: "reincarnation", explorer: "solscan.io/tx/8pQ2r" },
  { id: 6, date: "Feb 9, 2026", action: "Guild Joined", type: "guild", explorer: null },
  { id: 7, date: "Feb 8, 2026", action: "Trade Executed", type: "trade", explorer: "solscan.io/tx/9kR8p" },
];

const SETTINGS = [
  { id: "sound", label: "Sound Effects", default: true, icon: "🔊" },
  { id: "music", label: "Ambient Music", default: false, icon: "🎵" },
  { id: "scanlines", label: "CRT Scanlines", default: true, icon: "📺" },
  { id: "motion", label: "Reduced Motion", default: false, icon: "✨" },
  { id: "particles", label: "Particle Effects", default: true, icon: "✦" },
  { id: "haptics", label: "Haptic Feedback", default: false, icon: "⚡" },
];

// Guild Rank Configuration
const RANK_CONFIG = {
  novice: { title: "Novice", icon: "🌱", color: "text-spectral-green", minVotes: 0, maxVotes: 2 },
  apprentice: { title: "Apprentice", icon: "🔥", color: "text-ritual-gold", minVotes: 3, maxVotes: 5 },
  adept: { title: "Adept", icon: "⚡", color: "text-soul-cyan", minVotes: 6, maxVotes: 10 },
  master: { title: "Master", icon: "👑", color: "text-blood-pink", minVotes: 11, maxVotes: 20 },
  grandmaster: { title: "Grandmaster", icon: "💎", color: "text-cursed-violet-bright", minVotes: 21, maxVotes: 999 },
};

// ============================================================================
// RESEARCH-BASED COMPONENTS
// ============================================================================

// Character Frame (D&D style)
const CharacterFrame = ({ children }: { children: React.ReactNode }) => (
  <div className="relative inline-block">
    <div className="absolute -inset-3 bg-gradient-to-br from-ritual-gold via-blood-pink to-ritual-gold rounded-lg opacity-80" />
    <div className="absolute -inset-2 bg-ritual-dark rounded-lg border-2 border-ritual-gold" />
    <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-ritual-gold" />
    <div className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-ritual-gold" />
    <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-ritual-gold" />
    <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-ritual-gold" />
    <div className="relative bg-ritual-dark border-2 border-ritual-gold/50 rounded p-2 m-1">
      {children}
    </div>
  </div>
);

// XP Bar from research
const XPBar = ({ current, max, level }: { current: number; max: number; level: number }) => {
  const percentage = (current / max) * 100;
  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-1">
        <span className="font-pixel text-[9px] text-ritual-gold">LVL {level}</span>
        <span className="font-pixel text-[9px] text-faded-spirit">{current}/{max} XP</span>
      </div>
      <div className="h-3 bg-ritual-dark border border-ritual-gold/30 rounded overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 1, delay: 0.5 }}
          className="h-full bg-gradient-to-r from-blood-pink via-ritual-gold to-soul-cyan"
        />
      </div>
    </div>
  );
};

// Chain Sigil
const ChainSigil = ({ chain }: { chain: string }) => {
  const sigils: Record<string, string> = { ETH: "⬡", SOL: "◎", SUI: "❂" };
  const colors: Record<string, string> = { ETH: "text-purple-400", SOL: "text-pink-400", SUI: "text-cyan-400" };
  return <span className={`text-lg ${colors[chain] || "text-ghost-white"}`}>{sigils[chain] || "◈"}</span>;
};

// Action Type Icons
const ActionIcon = ({ type }: { type: Transaction["type"] }) => {
  const icons: Record<Transaction["type"], string> = {
    reincarnation: "👻",
    seal: "⛤",
    wallet: "⬡",
    guild: "🏰",
    trade: "⚖️",
  };
  return <span className="text-sm">{icons[type]}</span>;
};

// Animated Ritual Circle
const RitualCircle = ({ progress, chain }: { progress: number; chain: string }) => {
  const circumference = 2 * Math.PI * 18;
  const strokeDashoffset = circumference - (progress / 100) * circumference;
  
  return (
    <div className="relative w-10 h-10">
      <svg className="w-10 h-10 transform -rotate-90">
        <circle cx="20" cy="20" r="18" fill="none" stroke="currentColor" strokeWidth="2" className="text-ritual-dark" />
        <motion.circle
          cx="20" cy="20" r="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset }}
          transition={{ duration: 1.5 }}
          className={chain === "ETH" ? "text-purple-500" : chain === "SOL" ? "text-pink-500" : "text-cyan-500"}
        />
        <motion.circle
          cx="20" cy="20" r="12" fill="none" stroke="currentColor" strokeWidth="1"
          className="text-ritual-gold"
          animate={{ opacity: [0.3, 0.8, 0.3] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <ChainSigil chain={chain} />
      </div>
    </div>
  );
};

// Pixel Toggle
const PixelToggle = ({ checked, onChange }: { checked: boolean; onChange: () => void }) => (
  <button
    onClick={onChange}
    className={`relative w-12 h-6 border-2 transition-all duration-200 ${checked ? "border-blood-pink bg-blood-pink/20" : "border-faded-spirit bg-ritual-dark/50"}`}
  >
    <div className="absolute top-0.5 left-0.5 w-2 h-2 bg-ritual-gold" />
    <div className="absolute top-0.5 right-0.5 w-2 h-2 bg-ritual-gold" />
    <div className="absolute bottom-0.5 left-0.5 w-2 h-2 bg-ritual-gold" />
    <div className="absolute bottom-0.5 right-0.5 w-2 h-2 bg-ritual-gold" />
    <motion.div
      animate={{ x: checked ? 22 : 2 }}
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
      className={`absolute top-1 w-4 h-4 border-2 ${checked ? "border-soul-cyan bg-soul-cyan" : "border-faded-spirit bg-faded-spirit/30"}`}
    />
  </button>
);

// Achievement Badge
const AchievementBadge = ({ achievement, delay }: { achievement: Achievement; delay: number }) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.8 }}
    animate={{ opacity: 1, scale: 1 }}
    transition={{ delay, duration: 0.4 }}
    className={`relative p-3 border-2 text-center cursor-pointer transition-all duration-300 ${
      achievement.earned ? "border-ritual-gold bg-ritual-gold/10 hover:bg-ritual-gold/20" : "border-faded-spirit/30 bg-ritual-dark/30 opacity-50"
    }`}
  >
    <div className="absolute top-0 left-0 w-1 h-1 bg-ritual-gold" />
    <div className="absolute top-0 right-0 w-1 h-1 bg-ritual-gold" />
    <div className="absolute bottom-0 left-0 w-1 h-1 bg-ritual-gold" />
    <div className="absolute bottom-0 right-0 w-1 h-1 bg-ritual-gold" />
    <div className="text-2xl mb-1">{achievement.icon}</div>
    <div className="font-pixel text-[7px] text-ghost-white mb-1">{achievement.name}</div>
    <div className="font-silk text-[6px] text-faded-spirit">{achievement.description}</div>
    {achievement.earned && achievement.earnedDate && (
      <div className="font-pixel text-[5px] text-ritual-gold mt-1">✓ {achievement.earnedDate}</div>
    )}
  </motion.div>
);

// Section Title
const SectionTitle = ({ children, icon }: { children: React.ReactNode; icon: string }) => (
  <h2 className="font-pixel text-[10px] text-ritual-gold mb-4 flex items-center gap-2">
    <span className="text-ritual-gold/50">{icon}</span>
    <span className="border-b border-ritual-gold/30 pb-1">{children}</span>
    <span className="text-ritual-gold/50">{icon.split("").reverse().join("")}</span>
  </h2>
);

// Section Container
const SectionContainer = ({ children, delay = 0, title, icon }: { children: React.ReactNode; delay?: number; title: string; icon: string }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5, delay }}
    className="relative mb-6"
  >
    <div className="absolute -inset-1 border border-ritual-gold/20" />
    <div className="relative bg-ritual-dark/80 backdrop-blur-sm p-5 border border-ritual-gold/30">
      <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-ritual-gold/50 to-transparent" />
      <SectionTitle icon={icon}>{title}</SectionTitle>
      {children}
    </div>
  </motion.div>
);

// Journal Entry (ancient book style)
const JournalEntry = ({ entry }: { entry: CompletedReincarnation }) => (
  <motion.div
    initial={{ opacity: 0, x: -10 }}
    animate={{ opacity: 1, x: 0 }}
    className="relative p-3 bg-ritual-dark/50 border-l-2 border-ritual-gold/50 hover:border-ritual-gold transition-colors"
  >
    <div className="absolute inset-0 bg-gradient-to-r from-ritual-gold/5 to-transparent pointer-events-none" />
    <div className="flex justify-between items-start gap-2">
      <div>
        <div className="font-pixel text-[8px] text-soul-cyan mb-1">↗ {entry.newName}</div>
        <div className="font-silk text-[7px] text-faded-spirit">← Was: {entry.name}</div>
        <div className="font-pixel text-[6px] text-ritual-gold/60 mt-1">✦ {entry.date}</div>
      </div>
      <a
        href={`https://${entry.explorer}`}
        target="_blank"
        rel="noopener noreferrer"
        className="font-pixel text-[6px] text-blood-pink hover:text-blood-pink/70 border border-blood-pink/30 px-2 py-1 hover:bg-blood-pink/10 transition-colors"
      >
        [View]
      </a>
    </div>
  </motion.div>
);

// Quest Entry
const QuestEntry = ({ quest }: { quest: Transaction }) => (
  <div className="flex items-center justify-between py-2 border-b border-ritual-gold/10 last:border-0">
    <div className="flex items-center gap-3">
      <ActionIcon type={quest.type} />
      <div>
        <div className="font-silk text-[9px] text-ghost-white">{quest.action}</div>
        <div className="font-pixel text-[6px] text-faded-spirit">{quest.date}</div>
      </div>
    </div>
    {quest.explorer ? (
      <a href={`https://${quest.explorer}`} target="_blank" rel="noopener noreferrer" className="font-pixel text-[6px] text-soul-cyan hover:underline">
        [Link]
      </a>
    ) : (
      <span className="font-pixel text-[6px] text-faded-spirit">—</span>
    )}
  </div>
);

// Rank Badge
const RankBadge = ({ rank }: { rank: keyof typeof RANK_CONFIG }) => {
  const config = RANK_CONFIG[rank];
  return (
    <motion.div whileHover={{ scale: 1.1 }} className={`inline-flex items-center gap-1 px-2 py-1 ${config.color} bg-void-purple/50 border border-current/30`}>
      <span className="text-sm">{config.icon}</span>
      <span className="font-pixel text-[9px]">{config.title}</span>
    </motion.div>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function ProfilePage() {
  const [settings, setSettings] = useState<Record<string, boolean>>(
    SETTINGS.reduce((acc, s) => ({ ...acc, [s.id]: s.default }), {})
  );

  const toggleSetting = (id: string) => {
    setSettings((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const disconnectWallet = (id: string) => {
    console.log("Disconnecting wallet:", id);
  };

  const earnedAchievements = ACHIEVEMENTS.filter(a => a.earned).length;

  // User stats
  const userStats = {
    name: "Squid Sage",
    title: "Sorcerer",
    subtitle: "Initiate of the Deep Arts • Seeker of Lost Souls",
    level: 12,
    xp: 2450,
    xpToNext: 5000,
    seals: 8,
    souls: 12,
    rank: 247,
    rankType: "adept" as keyof typeof RANK_CONFIG,
  };

  return (
    <div className="min-h-screen py-8 px-4 max-w-4xl mx-auto">
      {/* Background texture */}
      <div className="fixed inset-0 pointer-events-none opacity-30">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPgo8cmVjdCB3aWR0aD0iNCIgaGVpZ2h0PSI0IiBmaWxsPSIjMDAwIiBmaWxsLW9wYWNpdHk9IjAuMDUiLz4KPC9zdmc+')] opacity-20" />
      </div>

      <div className="relative z-10">
        {/* ========================================================================= */}
        {/* PROFILE HEADER - Character Sheet Style */}
        {/* ========================================================================= */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="mb-8"
        >
          <div className="flex flex-col md:flex-row items-center gap-6">
            {/* Character Portrait */}
            <CharacterFrame>
              <div className="w-28 h-28 bg-gradient-to-br from-purple-900/50 to-pink-900/50 border border-ritual-gold/30 flex items-center justify-center">
                <IkaSprite size={80} expression="neutral" />
              </div>
            </CharacterFrame>

            {/* Character Info */}
            <div className="flex-1 text-center md:text-left">
              <div className="flex items-center justify-center md:justify-start gap-3 mb-2">
                <h1 className="font-pixel text-lg text-ghost-white">{userStats.name}</h1>
                <RankBadge rank={userStats.rankType} />
              </div>
              
              <p className="font-silk text-[9px] text-faded-spirit mb-3">
                {userStats.subtitle}
              </p>

              {/* XP Bar */}
              <div className="max-w-xs">
                <XPBar current={userStats.xp} max={userStats.xpToNext} level={userStats.level} />
              </div>

              {/* Stats row */}
              <div className="flex justify-center md:justify-start gap-4 mt-3 font-pixel text-[7px]">
                <div className="text-faded-spirit">
                  <span className="text-soul-cyan">SEALS:</span> {userStats.seals}
                </div>
                <div className="text-faded-spirit">
                  <span className="text-blood-pink">SOULS:</span> {userStats.souls}
                </div>
                <div className="text-faded-spirit">
                  <span className="text-ritual-gold">RANK:</span> #{userStats.rank}
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* ========================================================================= */}
        {/* ACHIEVEMENT BADGES */}
        {/* ========================================================================= */}
        <SectionContainer delay={0.05} title="Achievements" icon="★">
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
            {ACHIEVEMENTS.map((achievement, index) => (
              <AchievementBadge key={achievement.id} achievement={achievement} delay={0.1 + index * 0.05} />
            ))}
          </div>
          <div className="mt-3 text-center">
            <span className="font-pixel text-[7px] text-faded-spirit">
              {earnedAchievements}/{ACHIEVEMENTS.length} Unlocked
            </span>
          </div>
        </SectionContainer>

        {/* ========================================================================= */}
        {/* SOUL BONDS - Connected Wallets */}
        {/* ========================================================================= */}
        <SectionContainer delay={0.1} title="Soul Bonds" icon="⚔">
          <div className="space-y-2">
            {CONNECTED_WALLETS.map((wallet, index) => (
              <motion.div
                key={wallet.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.15 + index * 0.05 }}
                className={`flex items-center justify-between p-3 border ${
                  wallet.connected ? "border-ritual-gold/30 bg-ritual-gold/5" : "border-faded-spirit/20 bg-ritual-dark/30"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 flex items-center justify-center border ${
                    wallet.connected ? "border-soul-cyan bg-soul-cyan/10" : "border-faded-spirit/30"
                  }`}>
                    <ChainSigil chain={wallet.chain} />
                  </div>
                  <div>
                    <div className="font-pixel text-[8px] text-ghost-white flex items-center gap-2">
                      {wallet.chain}
                      {wallet.connected && <span className="text-[7px] text-soul-cyan">● Bound</span>}
                    </div>
                    <div className="font-silk text-[7px] text-faded-spirit">
                      {wallet.address.slice(0, 8)}...{wallet.address.slice(-4)}
                    </div>
                  </div>
                </div>
                {wallet.connected ? (
                  <button
                    onClick={() => disconnectWallet(wallet.id)}
                    className="font-pixel text-[6px] px-2 py-1 border border-blood-pink/50 text-blood-pink hover:bg-blood-pink/10 transition-colors"
                  >
                    [Unbind]
                  </button>
                ) : (
                  <button className="font-pixel text-[6px] px-2 py-1 border border-soul-cyan/50 text-soul-cyan hover:bg-soul-cyan/10 transition-colors">
                    [Bind]
                  </button>
                )}
              </motion.div>
            ))}
          </div>
        </SectionContainer>

        {/* ========================================================================= */}
        {/* ACTIVE RITUALS - Pending Seals */}
        {/* ========================================================================= */}
        <SectionContainer delay={0.2} title="Active Rituals" icon="⛤">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {PENDING_SEALS.map((seal, index) => (
              <motion.div
                key={seal.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.25 + index * 0.1 }}
                className="relative p-4 border border-ritual-gold/20 bg-ritual-dark/50"
              >
                <div className="absolute -right-2 -top-2">
                  <RitualCircle progress={seal.progress} chain={seal.chain} />
                </div>

                <div className="pr-12">
                  <div className="font-pixel text-[8px] text-ghost-white mb-1">{seal.name}</div>
                  <div className="font-silk text-[7px] text-faded-spirit mb-2">
                    Source: <ChainSigil chain={seal.chain} /> {seal.chain}
                  </div>
                  
                  <div className="h-2 bg-ritual-dark border border-faded-spirit/20 mb-1">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${seal.progress}%` }}
                      transition={{ duration: 1, delay: 0.5 }}
                      className="h-full bg-gradient-to-r from-purple-600 to-pink-600"
                    />
                  </div>
                  <div className="flex justify-between">
                    <span className="font-pixel text-[6px] text-blood-pink">{seal.status}</span>
                    <span className="font-pixel text-[6px] text-faded-spirit">{seal.progress}%</span>
                  </div>
                </div>

                <motion.div
                  className="absolute bottom-1 left-1/2 -translate-x-1/2 font-pixel text-[7px] text-ritual-gold/30"
                  animate={{ opacity: [0.3, 0.7, 0.3] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  ᚠ ᚢ ᚦ ᚨ ᚱ ᚲ
                </motion.div>
              </motion.div>
            ))}
          </div>
        </SectionContainer>

        {/* ========================================================================= */}
        {/* JOURNAL OF SOULS - Completed Reincarnations (Ancient Book Style) */}
        {/* ========================================================================= */}
        <SectionContainer delay={0.3} title="Journal of Souls" icon="📖">
          <div className="relative">
            {/* Book spine effect */}
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-ritual-gold/30 via-ritual-gold/10 to-ritual-gold/30" />
            
            <div className="pl-4 space-y-2">
              {COMPLETED_REINCARNATIONS.map((entry, index) => (
                <motion.div
                  key={entry.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.35 + index * 0.05 }}
                >
                  <JournalEntry entry={entry} />
                </motion.div>
              ))}
            </div>

            <div className="mt-4 text-center">
              <span className="font-pixel text-[6px] text-faded-spirit">— ✦ Page {Math.floor(Math.random() * 50) + 1} ✦ —</span>
            </div>
          </div>
        </SectionContainer>

        {/* ========================================================================= */}
        {/* QUEST LOG - Transaction History */}
        {/* ========================================================================= */}
        <SectionContainer delay={0.4} title="Quest Log" icon="⚔">
          <div className="relative">
            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-ritual-gold/20">
              <span className="font-pixel text-[7px] text-faded-spirit w-8">Type</span>
              <span className="flex-1 font-pixel text-[7px] text-faded-spirit">Quest</span>
              <span className="font-pixel text-[7px] text-faded-spirit w-16 text-right">Status</span>
            </div>
            
            {TRANSACTION_HISTORY.map((quest, index) => (
              <motion.div
                key={quest.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.45 + index * 0.03 }}
              >
                <QuestEntry quest={quest} />
              </motion.div>
            ))}

            <div className="mt-4 text-center">
              <span className="font-pixel text-[6px] text-faded-spirit">
                ◆ Total Quests: {TRANSACTION_HISTORY.length} ◆
              </span>
            </div>
          </div>
        </SectionContainer>

        {/* ========================================================================= */}
        {/* CONFIGURATION GRIMOIRE - Settings */}
        {/* ========================================================================= */}
        <SectionContainer delay={0.5} title="Configuration Grimoire" icon="⚙">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {SETTINGS.map((setting, index) => (
              <motion.div
                key={setting.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.55 + index * 0.03 }}
                className="flex items-center justify-between p-3 border border-ritual-gold/20 bg-ritual-dark/30"
              >
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 flex items-center justify-center border border-faded-spirit/30 bg-ritual-dark">
                    {setting.icon}
                  </div>
                  <span className="font-silk text-[9px] text-ghost-white">{setting.label}</span>
                </div>
                <PixelToggle
                  checked={settings[setting.id]}
                  onChange={() => toggleSetting(setting.id)}
                />
              </motion.div>
            ))}
          </div>

          <div className="mt-4 pt-3 border-t border-ritual-gold/20 text-center">
            <div className="font-pixel text-[7px] text-faded-spirit">
              🔮 Grimoire of {settings.sound ? "Resonance" : "Silence"} 🔮
            </div>
          </div>
        </SectionContainer>

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="text-center mt-8 pb-8"
        >
          <div className="font-pixel text-[7px] text-faded-spirit/50">
            ✦ Ika Tensei • The Reincarnation Ritual ✦
          </div>
        </motion.div>
      </div>
    </div>
  );
}
