"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import { PixelProgress } from "@/components/ui/PixelProgress";
import PixelSprites from "@/components/ui/PixelSprite";

const { IkaSprite } = PixelSprites;

// ============================================================================
// TYPES
// ============================================================================

interface Wallet {
  id: string;
  chain: "ETH" | "SOL" | "SUI";
  address: string;
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
}

interface Transaction {
  id: number;
  date: string;
  action: string;
  explorer: string | null;
}

// ============================================================================
// MOCK DATA
// ============================================================================

const CONNECTED_WALLETS: Wallet[] = [
  { id: "eth", chain: "ETH", address: "0x742d35Cc6634C0532925a3b844Bc9e7595f7a5E2" },
  { id: "sol", chain: "SOL", address: "FKab9x8v9YzP3nq2xL5kP7mN4pQ6rT8uV0wX1yZ3" },
];

const PENDING_SEALS: PendingSeal[] = [
  { id: 1, name: "Bored Ape #8842", chain: "ETH", progress: 65, status: "Sealing in vault..." },
  { id: 2, name: "Degen #0127", chain: "SOL", progress: 30, status: "Summoning..." },
];

const COMPLETED_REINCARNATIONS: CompletedReincarnation[] = [
  { id: 1, name: "Cosmic Jelly #001", newName: "Cosmic Jelly (Sol)", date: "Feb 15, 2026", tx: "5xK7m...nP2q" },
  { id: 2, name: "Pixel Squid #042", newName: "Squid Lord (Sol)", date: "Feb 12, 2026", tx: "3aB9c...mL4k" },
  { id: 3, name: "Void Walker #777", newName: "Void Walker (Sol)", date: "Feb 10, 2026", tx: "8pQ2r...tY6z" },
  { id: 4, name: "Ghost Spirit #888", newName: "Ghost King (Sol)", date: "Feb 8, 2026", tx: "1mN4s...wX9a" },
];

const TRANSACTION_HISTORY: Transaction[] = [
  { id: 1, date: "Feb 15, 2026", action: "Reincarnation Complete", explorer: "solscan.io/tx/5xK7m" },
  { id: 2, date: "Feb 14, 2026", action: "Seal Initiated", explorer: "etherscan.io/tx/0xabcd" },
  { id: 3, date: "Feb 12, 2026", action: "Reincarnation Complete", explorer: "solscan.io/tx/3aB9c" },
  { id: 4, date: "Feb 11, 2026", action: "Wallet Connected", explorer: null },
  { id: 5, date: "Feb 10, 2026", action: "Reincarnation Complete", explorer: "solscan.io/tx/8pQ2r" },
];

// ============================================================================
// COMPONENTS
// ============================================================================

// Section title with decorative elements
const SectionTitle = ({ children, icon }: { children: React.ReactNode; icon: string }) => (
  <h2 className="font-pixel text-sm text-ritual-gold mb-4 flex items-center gap-2">
    <span>{icon}</span>
    <span className="border-b border-ritual-gold/30 pb-1">{children}</span>
    <span>{icon.split("").reverse().join("")}</span>
  </h2>
);

// Section container with motion entrance
const SectionContainer = ({ children, delay = 0, title, icon }: { children: React.ReactNode; delay?: number; title: string; icon: string }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5, delay }}
    className="nes-container is-dark mb-6"
  >
    <SectionTitle icon={icon}>{title}</SectionTitle>
    {children}
  </motion.div>
);

// Chain badge component
const ChainBadge = ({ chain }: { chain: string }) => {
  const colors: Record<string, string> = {
    ETH: "text-purple-400",
    SOL: "text-soul-cyan",
    SUI: "text-cyan-400",
  };
  const bgColors: Record<string, string> = {
    ETH: "bg-purple-900/30",
    SOL: "bg-cyan-900/30",
    SUI: "bg-cyan-900/30",
  };
  const sigils: Record<string, string> = {
    ETH: "⬡",
    SOL: "◎",
    SUI: "❂",
  };
  
  return (
    <span className={`inline-flex items-center justify-center w-6 h-6 ${bgColors[chain]} border border-${colors[chain].replace('text-', '')}/50 rounded`}>
      <span className={`text-xs ${colors[chain]}`}>{sigils[chain]}</span>
    </span>
  );
};

// Custom pixel toggle switch
const PixelToggle = ({ checked, onChange }: { checked: boolean; onChange: () => void }) => (
  <label className="relative inline-flex items-center cursor-pointer">
    <input
      type="checkbox"
      className="sr-only peer"
      checked={checked}
      onChange={onChange}
    />
    <div className="w-11 h-6 bg-ritual-dark border-2 border-faded-spirit/50 rounded peer-checked:border-blood-pink peer-checked:bg-blood-pink/20 transition-all">
      {/* Toggle indicator */}
      <div className={`
        absolute top-0.5 w-4 h-4 border-2 transition-all duration-200
        ${checked 
          ? "left-[22px] border-soul-cyan bg-soul-cyan" 
          : "left-0.5 border-faded-spirit bg-faded-spirit/30"
        }
      `}>
        {/* Pixel corners */}
        <div className="absolute -top-0.5 -left-0.5 w-1 h-1 bg-ritual-gold" />
        <div className="absolute -top-0.5 -right-0.5 w-1 h-1 bg-ritual-gold" />
        <div className="absolute -bottom-0.5 -left-0.5 w-1 h-1 bg-ritual-gold" />
        <div className="absolute -bottom-0.5 -right-0.5 w-1 h-1 bg-ritual-gold" />
      </div>
    </div>
  </label>
);

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function ProfilePage() {
  const [settings, setSettings] = useState({
    sound: true,
    music: false,
    scanlines: true,
    motion: false,
  });

  const toggleSetting = (key: keyof typeof settings) => {
    setSettings((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const disconnectWallet = (id: string) => {
    console.log("Disconnecting wallet:", id);
  };

  return (
    <div className="min-h-screen py-8 px-4 max-w-4xl mx-auto">
      <div className="relative z-10">
        
        {/* ========================================================================= */}
        {/* PROFILE HEADER */}
        {/* ========================================================================= */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="nes-container is-dark text-center mb-8"
        >
          {/* Avatar Area */}
          <div className="flex justify-center mb-4">
            <div className="w-24 h-24 rounded-full bg-card-purple border-4 border-blood-pink flex items-center justify-center">
              <IkaSprite size={64} expression="neutral" />
            </div>
          </div>
          
          {/* Name */}
          <h1 className="font-pixel text-xl text-ghost-white mb-1">Adventurer</h1>
          
          {/* Subtitle */}
          <p className="font-silk text-xs text-faded-spirit mb-4">Member since Feb 2026</p>
          
          {/* Level/XP */}
          <div className="max-w-xs mx-auto">
            <div className="font-pixel text-sm text-ritual-gold mb-2">Level 4</div>
            <PixelProgress value={45} variant="primary" />
            <div className="font-pixel text-[10px] text-faded-spirit mt-1">45% to next level</div>
          </div>
        </motion.div>

        {/* ========================================================================= */}
        {/* SOUL BONDS - Connected Wallets */}
        {/* ========================================================================= */}
        <SectionContainer delay={0.1} title="Soul Bonds" icon="⚔">
          <div className="space-y-3">
            {CONNECTED_WALLETS.map((wallet, index) => (
              <motion.div
                key={wallet.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.15 + index * 0.05 }}
                className="flex items-center justify-between p-3 border border-ritual-gold/30 bg-card-purple/30"
              >
                <div className="flex items-center gap-3">
                  {/* Green dot indicator */}
                  <div className="w-2 h-2 rounded-full bg-spectral-green" />
                  
                  {/* Chain badge */}
                  <ChainBadge chain={wallet.chain} />
                  
                  {/* Address */}
                  <div>
                    <div className="font-pixel text-[10px] text-ghost-white">
                      {wallet.chain}
                    </div>
                    <div className="font-silk text-xs text-faded-spirit">
                      {wallet.address.slice(0, 6)}...{wallet.address.slice(-4)}
                    </div>
                  </div>
                </div>
                
                {/* Disconnect button */}
                <button
                  onClick={() => disconnectWallet(wallet.id)}
                  className="font-pixel text-[10px] px-3 py-1 border border-blood-pink text-blood-pink hover:bg-blood-pink/10 nes-btn is-error transition-colors"
                >
                  Disconnect
                </button>
              </motion.div>
            ))}
            
            {/* Add Wallet Button */}
            <button className="w-full font-pixel text-sm px-4 py-2 border-2 border-soul-cyan text-soul-cyan hover:bg-soul-cyan/10 nes-btn is-primary transition-colors">
              + Add Wallet
            </button>
          </div>
        </SectionContainer>

        {/* ========================================================================= */}
        {/* ACTIVE RITUALS - Pending Seals */}
        {/* ========================================================================= */}
        <SectionContainer delay={0.2} title="Active Rituals" icon="⛤">
          <div className="space-y-4">
            {PENDING_SEALS.map((seal, index) => (
              <motion.div
                key={seal.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.25 + index * 0.1 }}
                className="p-4 border border-ritual-gold/20 bg-card-purple/30"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <ChainBadge chain={seal.chain} />
                    <span className="font-pixel text-xs text-ghost-white">{seal.name}</span>
                  </div>
                  <span className="font-silk text-xs text-faded-spirit">{seal.chain}</span>
                </div>
                
                {/* Progress bar */}
                <PixelProgress value={seal.progress} variant="warning" />
                
                {/* Status text */}
                <div className="flex justify-between mt-2">
                  <span className="font-pixel text-[10px] text-blood-pink">{seal.status}</span>
                  <span className="font-pixel text-[10px] text-ritual-gold">{seal.progress}%</span>
                </div>
              </motion.div>
            ))}
          </div>
        </SectionContainer>

        {/* ========================================================================= */}
        {/* JOURNAL OF SOULS - Completed Reincarnations */}
        {/* ========================================================================= */}
        <SectionContainer delay={0.3} title="Journal of Souls" icon="📖">
          <div className="space-y-3">
            {COMPLETED_REINCARNATIONS.map((entry, index) => (
              <motion.div
                key={entry.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.35 + index * 0.05 }}
                className="flex items-center justify-between p-3 bg-card-purple/20 border-l-2 border-ritual-gold"
              >
                {/* Entry info */}
                <div>
                  <div className="font-pixel text-xs text-ghost-white mb-1">
                    → {entry.newName}
                  </div>
                  <div className="font-silk text-[10px] text-faded-spirit">
                    ← Was: {entry.name}
                  </div>
                  <div className="font-pixel text-[9px] text-ritual-gold/60 mt-1">
                    ✦ {entry.date} • {entry.tx}
                  </div>
                </div>
                
                {/* View button */}
                <a
                  href={`https://solscan.io/tx/${entry.tx}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-pixel text-[10px] px-3 py-1 border border-spectral-green text-spectral-green hover:bg-spectral-green/10 nes-btn is-success transition-colors"
                >
                  View on Solscan
                </a>
              </motion.div>
            ))}
          </div>
        </SectionContainer>

        {/* ========================================================================= */}
        {/* QUEST LOG - Transaction History */}
        {/* ========================================================================= */}
        <SectionContainer delay={0.4} title="Quest Log" icon="⚔">
          <div className="space-y-2">
            {TRANSACTION_HISTORY.map((tx, index) => (
              <motion.div
                key={tx.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.45 + index * 0.03 }}
                className="flex items-center justify-between py-2 border-b border-ritual-gold/10 last:border-0"
              >
                <div className="flex items-center gap-3">
                  <div>
                    <div className="font-silk text-xs text-ghost-white">{tx.action}</div>
                    <div className="font-pixel text-[8px] text-faded-spirit">{tx.date}</div>
                  </div>
                </div>
                {tx.explorer ? (
                  <a
                    href={`https://${tx.explorer}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-pixel text-[9px] text-soul-cyan hover:underline"
                  >
                    [Link]
                  </a>
                ) : (
                  <span className="font-pixel text-[9px] text-faded-spirit">—</span>
                )}
              </motion.div>
            ))}
          </div>
        </SectionContainer>

        {/* ========================================================================= */}
        {/* CONFIGURATION - Settings */}
        {/* ========================================================================= */}
        <SectionContainer delay={0.5} title="Configuration" icon="⚙">
          <div className="space-y-3">
            {/* Sound Effects */}
            <div className="flex items-center justify-between p-3 border border-ritual-gold/20 bg-card-purple/20">
              <span className="font-silk text-sm text-ghost-white">Sound Effects</span>
              <PixelToggle
                checked={settings.sound}
                onChange={() => toggleSetting("sound")}
              />
            </div>
            
            {/* Ambient Music */}
            <div className="flex items-center justify-between p-3 border border-ritual-gold/20 bg-card-purple/20">
              <span className="font-silk text-sm text-ghost-white">Ambient Music</span>
              <PixelToggle
                checked={settings.music}
                onChange={() => toggleSetting("music")}
              />
            </div>
            
            {/* Scanlines */}
            <div className="flex items-center justify-between p-3 border border-ritual-gold/20 bg-card-purple/20">
              <span className="font-silk text-sm text-ghost-white">Scanlines</span>
              <PixelToggle
                checked={settings.scanlines}
                onChange={() => toggleSetting("scanlines")}
              />
            </div>
            
            {/* Reduced Motion */}
            <div className="flex items-center justify-between p-3 border border-ritual-gold/20 bg-card-purple/20">
              <span className="font-silk text-sm text-ghost-white">Reduced Motion</span>
              <PixelToggle
                checked={settings.motion}
                onChange={() => toggleSetting("motion")}
              />
            </div>
          </div>
        </SectionContainer>

      </div>
    </div>
  );
}
