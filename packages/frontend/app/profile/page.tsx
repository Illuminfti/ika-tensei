"use client";

import { motion } from "framer-motion";
import { PixelProgress } from "@/components/ui/PixelProgress";
import { useState } from "react";

// Mock data
const CONNECTED_WALLETS = [
  { id: "eth", chain: "ETH", address: "0x1234...abcd", emoji: "🟢" },
  { id: "sol", chain: "SOL", address: "FKab...xyz", emoji: "🟢" },
];

const PENDING_SEALS = [
  { id: 1, name: "Bored Ape #8842", chain: "ETH", progress: 65, status: "Sealing in vault..." },
  { id: 2, name: "Degen #0127", chain: "SUI", progress: 30, status: "Awaiting confirmation..." },
];

const COMPLETED_REINCARNATIONS: { id: number; name: string; newName: string; date: string; tx: string; explorer: string }[] = [
  { id: 1, name: "Cosmic Jelly #001", newName: "Cosmic Jelly (Sol)", date: "Feb 15, 2026", tx: "5xK7m...nP2q", explorer: "solscan.io/tx/5xK7m" },
  { id: 2, name: "Pixel Squid #042", newName: "Squid Lord (Sol)", date: "Feb 12, 2026", tx: "3aB9c...mL4k", explorer: "solscan.io/tx/3aB9c" },
  { id: 3, name: "Void Walker #777", newName: "Void Walker (Sol)", date: "Feb 10, 2026", tx: "8pQ2r...tY6z", explorer: "solscan.io/tx/8pQ2r" },
  { id: 4, name: "Ghost Spirit #888", newName: "Ghost King (Sol)", date: "Feb 8, 2026", tx: "1mN4s...wX9a", explorer: "solscan.io/tx/1mN4s" },
];

const TRANSACTION_HISTORY = [
  { id: 1, date: "Feb 15, 2026", action: "Reincarnation Complete", explorer: "solscan.io/tx/5xK7m" },
  { id: 2, date: "Feb 14, 2026", action: "Seal Initiated", explorer: "etherscan.io/tx/0xabcd" },
  { id: 3, date: "Feb 12, 2026", action: "Reincarnation Complete", explorer: "solscan.io/tx/3aB9c" },
  { id: 4, date: "Feb 11, 2026", action: "Wallet Connected", explorer: null },
  { id: 5, date: "Feb 10, 2026", action: "Reincarnation Complete", explorer: "solscan.io/tx/8pQ2r" },
];

const SETTINGS = [
  { id: "sound", label: "Sound Effects", default: true },
  { id: "music", label: "Ambient Music", default: false },
  { id: "scanlines", label: "Scanlines", default: true },
  { id: "motion", label: "Reduced Motion", default: false },
];

const SectionTitle = ({ children }: { children: React.ReactNode }) => (
  <h2 className="font-pixel text-sm text-ritual-gold mb-4 flex items-center gap-2">
    {children}
  </h2>
);

const SectionContainer = ({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5, delay }}
    className="nes-container is-dark mb-6"
  >
    {children}
  </motion.div>
);

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

  return (
    <div className="min-h-screen py-8 px-4 max-w-3xl mx-auto">
      {/* Profile Header */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="nes-container is-dark text-center mb-8"
      >
        <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-card-purple border-4 border-blood-pink flex items-center justify-center text-5xl">
          🦑
        </div>
        <h1 className="font-pixel text-xl text-ghost-white mb-2">Adventurer</h1>
        <p className="font-silk text-xs text-faded-spirit">Member since Feb 2026</p>
      </motion.div>

      {/* Connected Wallets */}
      <SectionContainer delay={0.1}>
        <SectionTitle>⚔️ Connected Wallets</SectionTitle>
        <div className="space-y-3">
          {CONNECTED_WALLETS.map((wallet) => (
            <div
              key={wallet.id}
              className="flex items-center justify-between bg-ritual-dark p-3 rounded"
            >
              <div className="flex items-center gap-3">
                <span className="text-lg">{wallet.emoji}</span>
                <div>
                  <div className="font-silk text-xs text-ghost-white">
                    {wallet.chain}: {wallet.address}
                  </div>
                </div>
              </div>
              <button
                onClick={() => disconnectWallet(wallet.id)}
                className="nes-btn is-error !py-1 !px-2 text-[8px]"
              >
                Disconnect
              </button>
            </div>
          ))}
          <button className="nes-btn is-primary w-full !py-2 text-[10px]">
            + Add Wallet
          </button>
        </div>
      </SectionContainer>

      {/* Pending Seals */}
      <SectionContainer delay={0.2}>
        <SectionTitle>🔮 Pending Seals</SectionTitle>
        <div className="space-y-4">
          {PENDING_SEALS.map((seal) => (
            <div key={seal.id} className="bg-ritual-dark p-3 rounded">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <div className="font-silk text-xs text-ghost-white">{seal.name}</div>
                  <div className="font-silk text-[10px] text-faded-spirit">
                    Source: {seal.chain}
                  </div>
                </div>
                <div className="font-pixel text-[8px] text-blood-pink">{seal.status}</div>
              </div>
              <PixelProgress value={seal.progress} variant="warning" />
            </div>
          ))}
        </div>
      </SectionContainer>

      {/* Completed Reincarnations */}
      <SectionContainer delay={0.3}>
        <SectionTitle>✨ Completed Reincarnations</SectionTitle>
        <div className="space-y-3">
          {COMPLETED_REINCARNATIONS.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between bg-ritual-dark p-3 rounded"
            >
              <div>
                <div className="font-silk text-xs text-ghost-white">{item.newName}</div>
                <div className="font-silk text-[10px] text-faded-spirit">
                  Was: {item.name} • {item.date}
                </div>
              </div>
              <a
                href={`https://solscan.io/tx/${item.tx}`}
                target="_blank"
                rel="noopener noreferrer"
                className="nes-btn is-success !py-1 !px-2 text-[8px]"
              >
                View on Solscan
              </a>
            </div>
          ))}
        </div>
      </SectionContainer>

      {/* Transaction History */}
      <SectionContainer delay={0.4}>
        <SectionTitle>📜 Transaction History</SectionTitle>
        <div className="space-y-2">
          {TRANSACTION_HISTORY.map((tx) => (
            <div
              key={tx.id}
              className="flex items-center justify-between bg-ritual-dark p-3 rounded"
            >
              <div>
                <div className="font-silk text-xs text-ghost-white">{tx.action}</div>
                <div className="font-silk text-[10px] text-faded-spirit">{tx.date}</div>
              </div>
              {tx.explorer ? (
                <a
                  href={`https://${tx.explorer}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-pixel text-[8px] text-soul-cyan hover:underline"
                >
                  [Explorer]
                </a>
              ) : (
                <span className="font-pixel text-[8px] text-faded-spirit">—</span>
              )}
            </div>
          ))}
        </div>
      </SectionContainer>

      {/* Settings */}
      <SectionContainer delay={0.5}>
        <SectionTitle>⚙️ Settings</SectionTitle>
        <div className="space-y-3">
          {SETTINGS.map((setting) => (
            <div
              key={setting.id}
              className="flex items-center justify-between bg-ritual-dark p-3 rounded"
            >
              <span className="font-silk text-xs text-ghost-white">{setting.label}</span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings[setting.id]}
                  onChange={() => toggleSetting(setting.id)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-sigil-border rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-ghost-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blood-pink"></div>
              </label>
            </div>
          ))}
        </div>
      </SectionContainer>
    </div>
  );
}
