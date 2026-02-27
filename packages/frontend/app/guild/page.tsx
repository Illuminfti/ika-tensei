"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { BackgroundAtmosphere } from "@/components/ui/BackgroundAtmosphere";
import { DialogueBox } from "@/components/ui/DialogueBox";
import { PixelProgress } from "@/components/ui/PixelProgress";
import { SummoningCircle } from "@/components/ui/SummoningCircle";

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

type GuildTab = "hall" | "quests" | "vault" | "council" | "rankings";

interface Proposal {
  id: number;
  title: string;
  description: string;
  proposer: string;
  status: "active" | "passed" | "defeated" | "pending";
  votesFor: number;
  votesAgainst: number;
  votesAbstain: number;
  quorum: number;
  timeRemaining: string;
  category: "treasury" | "protocol" | "partnership" | "emergency";
}

interface Quest {
  id: number;
  title: string;
  description: string;
  difficulty: "S" | "A" | "B" | "C" | "D";
  reward: string;
  participants: number;
  maxParticipants: number;
  timeLimit: string;
  status: "open" | "in_progress" | "completed";
  type: "seal" | "recruit" | "defend" | "explore";
}

interface GuildMember {
  rank: number;
  name: string;
  title: string;
  nfts: number;
  votes: number;
  questsCompleted: number;
  joinDate: string;
  class: "warrior" | "mage" | "rogue" | "healer" | "summoner";
}

// ═══════════════════════════════════════════════════════════════════════════════
// MOCK DATA
// ═══════════════════════════════════════════════════════════════════════════════

const PROPOSALS: Proposal[] = [
  {
    id: 1,
    title: "Expand to Monad Chain Support",
    description: "Add Monad as a supported source chain for NFT sealing. Requires deploying a new deposit detector and metadata resolver for Monad's EVM-compatible NFTs.",
    proposer: "GuildMaster.sol",
    status: "active",
    votesFor: 1847,
    votesAgainst: 423,
    votesAbstain: 89,
    quorum: 3000,
    timeRemaining: "2d 14h",
    category: "protocol",
  },
  {
    id: 2,
    title: "Treasury: Fund Liquidity on Tensor",
    description: "Allocate 50 SOL from guild treasury to seed liquidity for reborn NFTs on Tensor marketplace, improving price discovery.",
    proposer: "VaultKeeper",
    status: "active",
    votesFor: 2105,
    votesAgainst: 890,
    votesAbstain: 205,
    quorum: 3000,
    timeRemaining: "5d 8h",
    category: "treasury",
  },
  {
    id: 3,
    title: "Partnership: Mad Lads Collection",
    description: "Negotiate a co-marketing deal with Mad Lads for exclusive reborn variants. Their community gets priority sealing slots.",
    proposer: "DiplomatIka",
    status: "passed",
    votesFor: 3420,
    votesAgainst: 580,
    votesAbstain: 200,
    quorum: 3000,
    timeRemaining: "Enacted",
    category: "partnership",
  },
  {
    id: 4,
    title: "Emergency: Pause Base Sealing",
    description: "Temporary pause on Base source chain sealing due to RPC instability. Resume after network stabilizes.",
    proposer: "SecurityCouncil",
    status: "defeated",
    votesFor: 890,
    votesAgainst: 2450,
    votesAbstain: 160,
    quorum: 3000,
    timeRemaining: "Ended",
    category: "emergency",
  },
];

const QUESTS: Quest[] = [
  {
    id: 1,
    title: "The First Seal",
    description: "Seal your first NFT from any supported chain. Begin your journey as a Reborn Adventurer.",
    difficulty: "D",
    reward: "Guild Initiate Badge + 10 XP",
    participants: 847,
    maxParticipants: 0,
    timeLimit: "No limit",
    status: "open",
    type: "seal",
  },
  {
    id: 2,
    title: "Chain Hopper",
    description: "Seal NFTs from 3 different source chains. Prove your mastery of cross-chain travel.",
    difficulty: "B",
    reward: "Chain Walker Title + 50 XP",
    participants: 234,
    maxParticipants: 0,
    timeLimit: "No limit",
    status: "open",
    type: "seal",
  },
  {
    id: 3,
    title: "Recruit 5 Adventurers",
    description: "Bring 5 new wallets to complete their first seal using your referral link.",
    difficulty: "A",
    reward: "Herald of Rebirth Title + 100 XP + 5 SOL",
    participants: 67,
    maxParticipants: 0,
    timeLimit: "30 days",
    status: "open",
    type: "recruit",
  },
  {
    id: 4,
    title: "The Ethereum Exodus",
    description: "Seal 10 NFTs from Ethereum mainnet. Lead the great migration.",
    difficulty: "S",
    reward: "Ethereum Archon Title + 500 XP + Rare Badge NFT",
    participants: 12,
    maxParticipants: 100,
    timeLimit: "60 days",
    status: "in_progress",
    type: "seal",
  },
  {
    id: 5,
    title: "Guardian Duty",
    description: "Vote on 10 consecutive proposals without missing any. Demonstrate your dedication to the Guild.",
    difficulty: "C",
    reward: "Faithful Guardian Badge + 25 XP",
    participants: 445,
    maxParticipants: 0,
    timeLimit: "No limit",
    status: "open",
    type: "defend",
  },
];

const TOP_MEMBERS: GuildMember[] = [
  { rank: 1, name: "SolArchon", title: "Guild Master", nfts: 47, votes: 47, questsCompleted: 12, joinDate: "Day 1", class: "summoner" },
  { rank: 2, name: "EthExile", title: "Chain Walker", nfts: 35, votes: 35, questsCompleted: 9, joinDate: "Day 1", class: "warrior" },
  { rank: 3, name: "ChainSage", title: "Void Mage", nfts: 28, votes: 28, questsCompleted: 8, joinDate: "Day 3", class: "mage" },
  { rank: 4, name: "NFTomancer", title: "Seal Keeper", nfts: 22, votes: 22, questsCompleted: 7, joinDate: "Day 5", class: "rogue" },
  { rank: 5, name: "PixelPriest", title: "Healer", nfts: 19, votes: 19, questsCompleted: 11, joinDate: "Day 2", class: "healer" },
  { rank: 6, name: "ChainBreaker", title: "Adventurer", nfts: 15, votes: 15, questsCompleted: 5, joinDate: "Day 8", class: "warrior" },
  { rank: 7, name: "MintMaster", title: "Adventurer", nfts: 12, votes: 12, questsCompleted: 4, joinDate: "Day 12", class: "mage" },
  { rank: 8, name: "VoidWalker", title: "Adventurer", nfts: 10, votes: 10, questsCompleted: 6, joinDate: "Day 7", class: "rogue" },
];

const TREASURY_ASSETS = [
  { symbol: "SOL", amount: "342.5", value: "$51,375", icon: "◎", color: "#9945ff", coinStack: 8 },
  { symbol: "USDC", amount: "12,450", value: "$12,450", icon: "$", color: "#2775ca", coinStack: 5 },
  { symbol: "Reborn NFTs", amount: "1,247", value: "Floor: 2.4 SOL", icon: "🎴", color: "#ff3366", coinStack: 0 },
];

// Guild Rank Configuration
const RANK_CONFIG = {
  novice: { title: "Novice", icon: "🌱", color: "text-spectral-green", minVotes: 0, maxVotes: 2 },
  apprentice: { title: "Apprentice", icon: "🔥", color: "text-ritual-gold", minVotes: 3, maxVotes: 5 },
  adept: { title: "Adept", icon: "⚡", color: "text-soul-cyan", minVotes: 6, maxVotes: 10 },
  master: { title: "Master", icon: "👑", color: "text-blood-pink", minVotes: 11, maxVotes: 20 },
  grandmaster: { title: "Grandmaster", icon: "💎", color: "text-cursed-violet-bright", minVotes: 21, maxVotes: 999 },
};

// ═══════════════════════════════════════════════════════════════════════════════
// RESEARCH-BASED COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

// Guild Crest SVG from research
const GuildCrest = () => (
  <div className="mx-auto mb-4 w-28 h-28 md:w-36 md:h-36 relative">
    <Image src="/art/guild-banner.png" alt="Guild" fill className="object-contain pixelated" />
  </div>
);

// Animated Coin Stack from research
const CoinStack = ({ count }: { count: number }) => (
  <div className="flex items-end justify-center gap-1 h-12">
    {Array.from({ length: count }).map((_, i) => (
      <motion.div
        key={i}
        initial={{ scale: 0, y: -20 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ delay: i * 0.1, type: "spring" }}
        className="w-6 h-3 bg-ritual-gold border-2 border-yellow-600 rounded-full relative"
        style={{ marginBottom: i * 2 }}
      >
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[8px] text-yellow-800 font-bold">$</span>
        </div>
      </motion.div>
    ))}
  </div>
);

// Treasure Chest from research
const TreasureChest = () => (
  <div className="relative w-24 h-20 mx-auto">
    <div className="absolute bottom-0 w-24 h-14 bg-amber-900 border-4 border-amber-700 rounded-b-lg">
      <div className="absolute top-2 left-2 right-2 h-2 bg-amber-600"/>
      <div className="absolute top-4 left-1/2 -translate-x-1/2 w-4 h-5 bg-yellow-500 border-2 border-yellow-700 rounded">
        <div className="w-2 h-3 bg-yellow-700 mx-auto mt-0.5"/>
      </div>
    </div>
    <div className="absolute bottom-12 w-24 h-8 bg-amber-800 border-4 border-amber-600 rounded-t-lg">
      <div className="absolute top-1 left-2 right-2 h-1 bg-amber-700"/>
    </div>
    <motion.div
      animate={{ rotateX: [0, -30] }}
      transition={{ repeat: Infinity, duration: 2, repeatDelay: 1 }}
      className="absolute -top-4 left-2 right-2 h-6 bg-amber-700 rounded-t-xl origin-bottom"
    />
  </div>
);

// Wax Seal from research
const WaxSeal = ({ status }: { status: string }) => {
  const sealColor = status === "passed" ? "#8b0000" : status === "defeated" ? "#2f2f2f" : "#b8860b";
  return (
    <div className="relative w-12 h-12">
      <svg viewBox="0 0 40 40" className="w-full h-full">
        <circle cx="20" cy="20" r="18" fill={sealColor} stroke="#333" strokeWidth="2"/>
        <circle cx="20" cy="20" r="12" fill={sealColor} opacity={0.7}/>
        <path d="M20 8 L22 15 L28 12 L24 18 L30 20 L24 22 L28 28 L22 25 L20 32 L18 25 L12 28 L16 22 L10 20 L16 18 L12 12 L18 15 Z" fill="#8b0000" opacity={0.5}/>
        <text x="20" y="24" textAnchor="middle" fill="#c9a227" fontSize="10" fontWeight="bold">
          {status === "passed" ? "✓" : status === "defeated" ? "✗" : "⏳"}
        </text>
      </svg>
    </div>
  );
};

// Rank Badge from research
const RankBadge = ({ rank }: { rank: keyof typeof RANK_CONFIG }) => {
  const config = RANK_CONFIG[rank];
  return (
    <motion.div
      whileHover={{ scale: 1.1 }}
      className={`inline-flex items-center gap-1 px-2 py-1 ${config.color} bg-void-purple/50 border border-current/30`}
    >
      <span className="text-sm">{config.icon}</span>
      <span className="font-pixel text-[10px]">{config.title}</span>
    </motion.div>
  );
};

// Wooden Sign Tab Button from research
const WoodenSign = ({ active, onClick, label, icon, count }: { active: boolean; onClick: () => void; label: string; icon: string; count?: number }) => (
  <motion.button
    whileHover={{ scale: 1.05, y: -2 }}
    whileTap={{ scale: 0.95 }}
    onClick={onClick}
    className={`
      relative px-4 py-2 font-pixel text-[9px] transition-all
      ${active 
        ? "bg-amber-800 text-ritual-gold shadow-[0_4px_0_rgb(120,70,20),0_6px_12px_rgba(0,0,0,0.4)]" 
        : "bg-amber-900 text-faded-spirit hover:bg-amber-800"
      }
    `}
    style={{
      clipPath: "polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)",
    }}
  >
    <span className="mr-1">{icon}</span>
    {label}
    {count !== undefined && (
      <span className="ml-2 px-1.5 py-0.5 text-[7px] bg-amber-950 rounded">{count}</span>
    )}
  </motion.button>
);

// Parchment Quest Card from research
const ParchmentQuestCard = ({ 
  proposal, 
  onVote, 
  hasVoted 
}: { 
  proposal: Proposal; 
  onVote: (id: number) => void;
  hasVoted: boolean;
}) => {
  const getDifficultyColor = (cat: string) => {
    switch (cat) {
      case "emergency": return "text-blood-pink";
      case "partnership": return "text-ritual-gold";
      case "treasury": return "text-spectral-green";
      default: return "text-faded-spirit";
    }
  };
  
  return (
    <motion.div
      whileHover={{ scale: 1.01 }}
      className="relative"
    >
      {/* Torn paper effect */}
      <div className="absolute inset-0 bg-stone-800 rounded transform rotate-1 translate-x-1"/>
      <div className="absolute inset-0 bg-stone-700 rounded transform -rotate-1 -translate-x-1"/>
      
      {/* Main parchment */}
      <div className={`
        relative p-5 bg-[#f4e4bc] rounded
        before:absolute before:top-0 before:left-0 before:right-0 before:h-2
        before:bg-[#e8d4a8] before:clip-[polygon(0_0,5%_100%,10%_0,15%_100%,20%_0,25%_100%,30%_0,35%_100%,40%_0,45%_100%,50%_0,55%_100%,60%_0,65%_100%,70%_0,75%_100%,80%_0,85%_100%,90%_0,95%_100%,100%_0)]
        after:absolute after:bottom-0 after:left-0 after:right-0 after:h-2
        after:bg-[#e8d4a8] after:clip-[polygon(0_100%,5%_0,10%_100%,15%_0,20%_100%,25%_0,30%_100%,35%_0,40%_100%,45%_0,50%_100%,55%_0,60%_100%,65%_0,70%_100%,75%_0,80%_100%,85%_0,90%_100%,95%_0,100%_100%)]
      `}>
        {/* Quest header */}
        <div className="flex justify-between items-start mb-3 mt-1">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span className={`font-pixel text-[9px] px-2 py-0.5 bg-stone-800 ${getDifficultyColor(proposal.category)}`}>
                {proposal.category.toUpperCase()}
              </span>
              <span className="font-silk text-[8px] text-stone-600">
                Quest Giver: {proposal.proposer}
              </span>
            </div>
            <h3 className="font-pixel text-[11px] text-stone-900 leading-tight">
              {proposal.title}
            </h3>
          </div>
          <WaxSeal status={proposal.status}/>
        </div>

        {/* Quest description */}
        <p className="font-serif text-[9px] text-stone-700 mb-3 italic border-l-2 border-stone-400 pl-2">
          {proposal.description}
        </p>

        {/* Vote breakdown as quest rewards */}
        <div className="flex gap-3 mb-3 font-pixel text-[9px]">
          <div className="flex-1 bg-stone-200 p-2 rounded text-center">
            <span className="text-spectral-green">✓ For</span>
            <div className="text-stone-900">{proposal.votesFor.toLocaleString()}</div>
          </div>
          <div className="flex-1 bg-stone-200 p-2 rounded text-center">
            <span className="text-blood-pink">✗ Against</span>
            <div className="text-stone-900">{proposal.votesAgainst.toLocaleString()}</div>
          </div>
          <div className="flex-1 bg-stone-200 p-2 rounded text-center">
            <span className="text-faded-spirit">○ Abstain</span>
            <div className="text-stone-900">{proposal.votesAbstain.toLocaleString()}</div>
          </div>
        </div>

        {/* Quorum progress */}
        <div className="mb-3">
          <div className="flex justify-between items-center mb-1">
            <span className="font-pixel text-[8px] text-stone-600">COUNCIL QUORUM</span>
            <span className="font-pixel text-[9px] text-stone-700">
              {Math.round((proposal.votesFor + proposal.votesAgainst + proposal.votesAbstain) / proposal.quorum * 100)}%
            </span>
          </div>
          <div className="h-2 bg-stone-300 rounded-full overflow-hidden border border-stone-500">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, (proposal.votesFor + proposal.votesAgainst + proposal.votesAbstain) / proposal.quorum * 100)}%` }}
              transition={{ duration: 1, delay: 0.3 }}
              className={`h-full ${
                proposal.status === "passed" ? "bg-spectral-green" : 
                proposal.status === "defeated" ? "bg-blood-pink" : "bg-ritual-gold"
              }`}
            />
          </div>
        </div>

        {/* Time & Action */}
        <div className="flex justify-between items-center">
          <span className="font-silk text-[10px] text-stone-600">
            ⏱ {proposal.timeRemaining}
          </span>
          
          {proposal.status === "active" && !hasVoted && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => onVote(proposal.id)}
              className="relative px-4 py-2 bg-amber-700 text-ritual-gold font-pixel text-[9px] rounded border-2 border-amber-500 shadow-[2px_2px_0_#5c4020]"
            >
              <span className="mr-1">🩸</span>CAST VOTE
            </motion.button>
          )}
          
          {hasVoted && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="flex items-center gap-1 text-spectral-green font-pixel text-[9px]"
            >
              <span>✓</span> Vote Recorded
            </motion.div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

// Vote Ceremony Modal from research
const VoteCeremonyModal = ({ 
  isOpen, 
  proposal, 
  onVote, 
  onClose 
}: { 
  isOpen: boolean; 
  proposal: Proposal | null;
  onVote: (proposalId: number, _choice: "for" | "against" | "abstain") => void;
  onClose: () => void;
}) => (
  <AnimatePresence>
    {isOpen && proposal && (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.8, y: 50 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.8, y: 50 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-[#1a1a2e] border-4 border-ritual-gold rounded-lg p-6 max-w-md w-full"
        >
          <div className="text-center mb-6">
            <h3 className="font-pixel text-sm text-ritual-gold mb-2">🩸 CAST YOUR VOTE 🩸</h3>
            <p className="font-serif text-xs text-faded-spirit italic">
              {proposal.title}
            </p>
          </div>

          <div className="space-y-3 mb-6">
            <motion.button
              whileHover={{ scale: 1.02, x: 10 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onVote(proposal.id, "for")}
              className="w-full p-3 bg-spectral-green/20 border-2 border-spectral-green rounded-lg flex items-center gap-3 group"
            >
              <div className="w-10 h-10 bg-spectral-green rounded-full flex items-center justify-center">
                <span className="text-xl">⚔️</span>
              </div>
              <div className="text-left">
                <div className="font-pixel text-[10px] text-spectral-green">FORGE AHEAD</div>
                <div className="font-silk text-[9px] text-faded-spirit">Support this quest</div>
              </div>
              <span className="ml-auto text-xl group-hover:rotate-12 transition-transform">→</span>
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.02, x: 10 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onVote(proposal.id, "against")}
              className="w-full p-3 bg-blood-pink/20 border-2 border-blood-pink rounded-lg flex items-center gap-3 group"
            >
              <div className="w-10 h-10 bg-blood-pink rounded-full flex items-center justify-center">
                <span className="text-xl">🛡️</span>
              </div>
              <div className="text-left">
                <div className="font-pixel text-[10px] text-blood-pink">STAND GROUND</div>
                <div className="font-silk text-[9px] text-faded-spirit">Oppose this quest</div>
              </div>
              <span className="ml-auto text-xl group-hover:rotate-12 transition-transform">→</span>
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.02, x: 10 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onVote(proposal.id, "abstain")}
              className="w-full p-3 bg-faded-spirit/20 border-2 border-faded-spirit rounded-lg flex items-center gap-3 group"
            >
              <div className="w-10 h-10 bg-faded-spirit rounded-full flex items-center justify-center">
                <span className="text-xl">🏳️</span>
              </div>
              <div className="text-left">
                <div className="font-pixel text-[10px] text-faded-spirit">RAISE THE FLAG</div>
                <div className="font-silk text-[9px] text-faded-spirit">Abstain from this decision</div>
              </div>
              <span className="ml-auto text-xl group-hover:rotate-12 transition-transform">→</span>
            </motion.button>
          </div>

          <button
            onClick={onClose}
            className="w-full py-2 font-silk text-[9px] text-faded-spirit hover:text-ghost-white"
          >
            Cancel Ritual
          </button>
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
);

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER COMPONENTS (keeping from original)
// ═══════════════════════════════════════════════════════════════════════════════

function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`relative p-5 ${className}`}
      style={{
        background: "rgba(13, 10, 26, 0.85)",
        border: "1px solid #3a285066",
        backdropFilter: "blur(8px)",
      }}
    >
      <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-ritual-gold/40" />
      <div className="absolute top-0 right-0 w-3 h-3 border-t border-r border-ritual-gold/40" />
      <div className="absolute bottom-0 left-0 w-3 h-3 border-b border-l border-ritual-gold/40" />
      <div className="absolute bottom-0 right-0 w-3 h-3 border-b border-r border-ritual-gold/40" />
      {children}
    </div>
  );
}

function DifficultyBadge({ difficulty }: { difficulty: string }) {
  const colors: Record<string, { bg: string; text: string; glow: string }> = {
    S: { bg: "#ffd70022", text: "#ffd700", glow: "0 0 8px #ffd70044" },
    A: { bg: "#ff336622", text: "#ff3366", glow: "0 0 8px #ff336644" },
    B: { bg: "#a855f722", text: "#a855f7", glow: "0 0 8px #a855f744" },
    C: { bg: "#00ccff22", text: "#00ccff", glow: "0 0 8px #00ccff44" },
    D: { bg: "#00ff8822", text: "#00ff88", glow: "0 0 8px #00ff8844" },
  };
  const c = colors[difficulty] || colors.D;
  return (
    <span
      className="font-pixel text-[9px] px-2 py-1 inline-block"
      style={{ background: c.bg, color: c.text, boxShadow: c.glow, border: `1px solid ${c.text}33` }}
    >
      Rank {difficulty}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, { bg: string; color: string }> = {
    active: { bg: "rgba(255, 215, 0, 0.15)", color: "#ffd700" },
    passed: { bg: "rgba(0, 255, 136, 0.15)", color: "#00ff88" },
    defeated: { bg: "rgba(255, 51, 102, 0.15)", color: "#ff3366" },
    pending: { bg: "rgba(138, 122, 154, 0.15)", color: "#8a7a9a" },
    open: { bg: "rgba(0, 204, 255, 0.15)", color: "#00ccff" },
    in_progress: { bg: "rgba(255, 215, 0, 0.15)", color: "#ffd700" },
    completed: { bg: "rgba(0, 255, 136, 0.15)", color: "#00ff88" },
  };
  const s = styles[status] || styles.pending;
  return (
    <span
      className="font-pixel text-[7px] px-2 py-1 uppercase tracking-wider"
      style={{ background: s.bg, color: s.color, border: `1px solid ${s.color}33` }}
    >
      {status.replace("_", " ")}
    </span>
  );
}

function ClassIcon({ cls }: { cls: string }) {
  const icons: Record<string, { emoji: string; color: string }> = {
    warrior: { emoji: "⚔️", color: "#ff3366" },
    mage: { emoji: "🔮", color: "#a855f7" },
    rogue: { emoji: "🗡️", color: "#00ff88" },
    healer: { emoji: "💚", color: "#00d4aa" },
    summoner: { emoji: "🦑", color: "#ffd700" },
  };
  const c = icons[cls] || icons.warrior;
  return <span title={cls} style={{ filter: `drop-shadow(0 0 4px ${c.color}44)` }}>{c.emoji}</span>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════

export default function GuildPage() {
  const [activeTab, setActiveTab] = useState<GuildTab>("hall");
  const [votedProposals, setVotedProposals] = useState<Set<number>>(new Set());
  const [joinedQuests, setJoinedQuests] = useState<Set<number>>(new Set());
  const [guildLevel, setGuildLevel] = useState(0);
  const [votingProposal, setVotingProposal] = useState<Proposal | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setGuildLevel(7), 500);
    return () => clearTimeout(timer);
  }, []);

  const userStats = {
    name: "Reborn Hero",
    title: "Adventurer",
    class: "summoner" as const,
    nfts: 3,
    votes: 3,
    xp: 145,
    xpToNext: 200,
    questsCompleted: 2,
    rank: 42,
    joinDate: "Today",
  };

  const handleVoteClick = (proposalId: number) => {
    const proposal = PROPOSALS.find(p => p.id === proposalId);
    if (proposal) setVotingProposal(proposal);
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleVote = (proposalId: number, _choice: "for" | "against" | "abstain") => {
    // In production, this would submit the vote choice to the blockchain
    setVotedProposals((prev) => new Set(prev).add(proposalId));
    setVotingProposal(null);
  };

  const getRankFromVotes = (votes: number): keyof typeof RANK_CONFIG => {
    if (votes >= 21) return "grandmaster";
    if (votes >= 11) return "master";
    if (votes >= 6) return "adept";
    if (votes >= 3) return "apprentice";
    return "novice";
  };

  return (
    <div className="min-h-screen relative">
      <BackgroundAtmosphere mood="mystical" />

      {/* ─── GUILD HEADER ────────────────────────────────────────────────── */}
      <section className="relative pt-8 pb-6 px-4 overflow-hidden">
        {/* Torch light ambient effects */}
        <div className="absolute top-20 left-10 pointer-events-none">
          <motion.div
            animate={{
              opacity: [0.6, 0.9, 0.6],
              boxShadow: ['0 0 30px #ff6b35', '0 0 50px #ff6b35', '0 0 30px #ff6b35'],
            }}
            transition={{ duration: 2, repeat: Infinity }}
            className="w-4 h-40 bg-gradient-to-b from-amber-600/20 to-transparent"
            style={{ filter: 'blur(8px)' }}
          />
        </div>
        <div className="absolute top-20 right-10 pointer-events-none">
          <motion.div
            animate={{
              opacity: [0.5, 0.8, 0.5],
              boxShadow: ['0 0 30px #ff6b35', '0 0 50px #ff6b35', '0 0 30px #ff6b35'],
            }}
            transition={{ duration: 2.5, repeat: Infinity, delay: 0.5 }}
            className="w-4 h-40 bg-gradient-to-b from-amber-600/20 to-transparent"
            style={{ filter: 'blur(8px)' }}
          />
        </div>

        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-10">
          <SummoningCircle size={400} phase="idle" />
        </div>

        <div className="max-w-5xl mx-auto relative z-10">
          {/* Guild Banner + Title */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center text-center mb-6"
          >
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 200 }}
              className="mb-3"
              style={{ filter: "drop-shadow(0 4px 16px rgba(255, 215, 0, 0.3))" }}
            >
              <GuildCrest />
            </motion.div>

            <h1 className="font-pixel text-xl md:text-2xl text-ritual-gold text-glow-gold mb-1">
              冒険者ギルド
            </h1>
            <p className="font-pixel text-[8px] tracking-[0.3em] text-faded-spirit mb-4">
              ADVENTURER&apos;S GUILD
            </p>
            <p className="font-jp text-[10px] text-blood-pink/60 mb-4 tracking-wider">
              冒険者 の 集い
            </p>

            {/* Guild Level Bar */}
            <div className="w-full max-w-xs">
              <div className="flex justify-between mb-1">
                <span className="font-pixel text-[7px] text-faded-spirit">Guild Lv.</span>
                <span className="font-pixel text-[7px] text-ritual-gold">{guildLevel}</span>
              </div>
              <div className="h-2 w-full" style={{ background: "#1a1025", border: "1px solid #3a2850" }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${(guildLevel / 10) * 100}%` }}
                  transition={{ duration: 1, delay: 0.5 }}
                  className="h-full"
                  style={{ background: "linear-gradient(90deg, #ffd700, #ffaa00)" }}
                />
              </div>
            </div>
          </motion.div>

          {/* Quick Stats Row */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="flex flex-wrap justify-center gap-4 md:gap-8 mb-6"
          >
            {[
              { label: "Members", value: "1,247", color: "#ffd700" },
              { label: "NFTs Sealed", value: "4,891", color: "#ff3366" },
              { label: "Quests Done", value: "2,340", color: "#00ccff" },
              { label: "Treasury", value: "$63.8K", color: "#00ff88" },
            ].map((stat, i) => (
              <div key={stat.label} className="text-center">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.4 + i * 0.1, type: "spring" }}
                  className="font-pixel text-base md:text-lg"
                  style={{ color: stat.color }}
                >
                  {stat.value}
                </motion.div>
                <div className="font-pixel text-[6px] text-faded-spirit uppercase tracking-wider">{stat.label}</div>
              </div>
            ))}
          </motion.div>

          {/* User's Guild Card */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="max-w-md mx-auto"
          >
            <Panel className="!p-4">
              <div className="flex items-center gap-4">
                <div className="flex-shrink-0">
                  <Image
                    src="/art/ika-mascot-v2.png"
                    alt="Your Avatar"
                    width={48}
                    height={48}
                    className="pixelated"
                    style={{ imageRendering: "pixelated" }}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <ClassIcon cls={userStats.class} />
                    <span className="font-pixel text-[9px] text-ghost-white">{userStats.name}</span>
                    <RankBadge rank={getRankFromVotes(userStats.votes)} />
                  </div>
                  <div className="flex items-center gap-3 text-[7px]">
                    <span className="font-pixel text-ritual-gold">{userStats.nfts} NFTs</span>
                    <span className="font-pixel text-blood-pink">{userStats.votes} Votes</span>
                    <span className="font-pixel text-soul-cyan">{userStats.questsCompleted} Quests</span>
                  </div>
                  <div className="mt-2">
                    <div className="flex justify-between mb-0.5">
                      <span className="font-pixel text-[6px] text-faded-spirit">XP</span>
                      <span className="font-pixel text-[6px] text-faded-spirit">{userStats.xp}/{userStats.xpToNext}</span>
                    </div>
                    <div className="h-1.5 w-full" style={{ background: "#1a1025", border: "1px solid #3a2850" }}>
                      <div
                        className="h-full transition-all duration-1000"
                        style={{
                          width: `${(userStats.xp / userStats.xpToNext) * 100}%`,
                          background: "linear-gradient(90deg, #00ccff, #a855f7)",
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </Panel>
          </motion.div>
        </div>
      </section>

      {/* ─── TAB NAVIGATION (Wooden Signs from Research) ─────────────────── */}
      <div className="sticky top-0 z-30 px-4 py-3" style={{ background: "rgba(13, 10, 26, 0.95)", borderBottom: "1px solid #3a285033", backdropFilter: "blur(12px)" }}>
        <div className="max-w-5xl mx-auto flex gap-2 overflow-x-auto scrollbar-hide justify-center flex-wrap">
          <WoodenSign icon="🏰" label="Hall" active={activeTab === "hall"} onClick={() => setActiveTab("hall")} />
          <WoodenSign icon="⚔️" label="Quests" active={activeTab === "quests"} onClick={() => setActiveTab("quests")} count={QUESTS.filter((q) => q.status === "open").length} />
          <WoodenSign icon="💰" label="Vault" active={activeTab === "vault"} onClick={() => setActiveTab("vault")} />
          <WoodenSign icon="📜" label="Council" active={activeTab === "council"} onClick={() => setActiveTab("council")} count={PROPOSALS.filter((p) => p.status === "active").length} />
          <WoodenSign icon="🏆" label="Rankings" active={activeTab === "rankings"} onClick={() => setActiveTab("rankings")} />
        </div>
      </div>

      {/* ─── TAB CONTENT ──────────────────────────────────────────────────── */}
      <div className="px-4 py-8 relative z-10">
        <div className="max-w-5xl mx-auto">
          <AnimatePresence mode="wait">
            {activeTab === "hall" && (
              <motion.div
                key="hall"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                <DialogueBox
                  speaker="Guild Master"
                  portrait="neutral"
                  text="Welcome to the Adventurer's Guild, traveler. Here, reborn souls gather to shape the future of cross-chain NFTs. Browse the quest board, vote in council, or check your standing in the rankings."
                />

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { icon: "⚔️", label: "Accept Quest", desc: "Browse available missions", tab: "quests" as GuildTab },
                    { icon: "📜", label: "Vote Now", desc: "Active proposals await", tab: "council" as GuildTab },
                    { icon: "💰", label: "View Vault", desc: "Guild treasury status", tab: "vault" as GuildTab },
                    { icon: "🏆", label: "Rankings", desc: "Check the leaderboard", tab: "rankings" as GuildTab },
                  ].map((action, i) => (
                    <motion.button
                      key={action.label}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 + i * 0.1 }}
                      whileHover={{ y: -4, boxShadow: "0 0 20px rgba(255, 215, 0, 0.1)" }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setActiveTab(action.tab)}
                      className="p-4 text-center transition-all"
                      style={{
                        background: "rgba(13, 10, 26, 0.7)",
                        border: "1px solid #3a285066",
                      }}
                    >
                      <div className="text-2xl mb-2">{action.icon}</div>
                      <div className="font-pixel text-[9px] text-ghost-white mb-1">{action.label}</div>
                      <div className="font-silk text-[9px] text-faded-spirit">{action.desc}</div>
                    </motion.button>
                  ))}
                </div>

                <Panel>
                  <h3 className="font-pixel text-[9px] text-ritual-gold mb-4">📋 Recent Guild Activity</h3>
                  <div className="space-y-2">
                    {[
                      { time: "2m ago", text: "SolArchon sealed a Bored Ape from Ethereum", color: "#ff3366" },
                      { time: "15m ago", text: "Proposal #2 reached 66% quorum", color: "#ffd700" },
                      { time: "1h ago", text: "EthExile completed Quest: Chain Hopper", color: "#00ccff" },
                      { time: "3h ago", text: "Guild treasury received 12.5 SOL in fees", color: "#00ff88" },
                      { time: "6h ago", text: "New member NFTomancer joined the guild", color: "#a855f7" },
                    ].map((event, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.3 + i * 0.08 }}
                        className="flex items-start gap-3"
                      >
                        <div className="w-1.5 h-1.5 mt-1.5 rounded-full flex-shrink-0" style={{ background: event.color }} />
                        <div className="flex-1">
                          <p className="font-silk text-[9px] text-ghost-white">{event.text}</p>
                        </div>
                        <span className="font-pixel text-[6px] text-faded-spirit flex-shrink-0">{event.time}</span>
                      </motion.div>
                    ))}
                  </div>
                </Panel>

                <div className="text-center">
                  <Link href="/seal">
                    <motion.button
                      whileHover={{ scale: 1.05, boxShadow: "0 0 20px rgba(255, 51, 102, 0.3)" }}
                      whileTap={{ scale: 0.95 }}
                      className="font-pixel text-[9px] px-8 py-3 text-ghost-white"
                      style={{ background: "linear-gradient(135deg, #ff3366, #cc1144)", border: "2px solid #ff336666" }}
                    >
                      ⚔ Seal an NFT to Join
                    </motion.button>
                  </Link>
                  <p className="font-silk text-[9px] text-faded-spirit mt-2">Each reborn NFT = 1 vote in the council</p>
                </div>
              </motion.div>
            )}

            {activeTab === "quests" && (
              <motion.div
                key="quests"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                <div className="flex items-center justify-between mb-2">
                  <h2 className="font-pixel text-sm text-ritual-gold">Quest Board</h2>
                  <span className="font-pixel text-[7px] text-faded-spirit">
                    {QUESTS.filter((q) => q.status === "open").length} open quests
                  </span>
                </div>

                {QUESTS.map((quest, i) => (
                  <motion.div
                    key={quest.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.08 }}
                  >
                    <Panel className="!p-4">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <DifficultyBadge difficulty={quest.difficulty} />
                            <StatusBadge status={quest.status} />
                          </div>
                          <h3 className="font-pixel text-[10px] text-ghost-white">{quest.title}</h3>
                        </div>
                      </div>

                      <p className="font-silk text-[9px] text-faded-spirit mb-3 leading-relaxed">{quest.description}</p>

                      <div className="flex flex-wrap items-center gap-4 mb-3 text-[7px]">
                        <span className="font-pixel text-ritual-gold">🏆 {quest.reward}</span>
                        <span className="font-pixel text-faded-spirit">⏱ {quest.timeLimit}</span>
                        <span className="font-pixel text-faded-spirit">
                          👥 {quest.participants}{quest.maxParticipants > 0 ? `/${quest.maxParticipants}` : ""}
                        </span>
                      </div>

                      {quest.status === "in_progress" && quest.maxParticipants > 0 && (
                        <div className="mb-3">
                          <PixelProgress value={(quest.participants / quest.maxParticipants) * 100} />
                        </div>
                      )}

                      {quest.status === "open" && (
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => setJoinedQuests((prev) => new Set(prev).add(quest.id))}
                          disabled={joinedQuests.has(quest.id)}
                          className="font-pixel text-[9px] px-4 py-2 w-full transition-all"
                          style={{
                            background: joinedQuests.has(quest.id) ? "rgba(0, 255, 136, 0.1)" : "rgba(255, 215, 0, 0.1)",
                            border: joinedQuests.has(quest.id) ? "1px solid #00ff8844" : "1px solid #ffd70044",
                            color: joinedQuests.has(quest.id) ? "#00ff88" : "#ffd700",
                          }}
                        >
                          {joinedQuests.has(quest.id) ? "✓ Quest Accepted" : "Accept Quest"}
                        </motion.button>
                      )}
                    </Panel>
                  </motion.div>
                ))}
              </motion.div>
            )}

            {activeTab === "vault" && (
              <motion.div
                key="vault"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                <h2 className="font-pixel text-sm text-ritual-gold text-center">Guild Treasury</h2>

                {/* Treasure Chest Display */}
                <motion.div className="text-center">
                  <TreasureChest/>
                  <p className="font-silk text-[9px] text-faded-spirit mt-2">Accumulated from completed quests</p>
                </motion.div>

                {/* Total Value */}
                <Panel className="text-center">
                  <span className="font-pixel text-[7px] text-faded-spirit uppercase tracking-widest">Total Value</span>
                  <motion.div
                    initial={{ scale: 0.8 }}
                    animate={{ scale: 1 }}
                    className="font-pixel text-2xl text-ritual-gold mt-2 mb-1"
                  >
                    $63,825
                  </motion.div>
                  <p className="font-silk text-[9px] text-faded-spirit">Managed by Realms DAO multisig</p>
                </Panel>

                {/* Asset Cards with Coin Stacks */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {TREASURY_ASSETS.map((asset, i) => (
                    <motion.div
                      key={asset.symbol}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 + i * 0.1 }}
                    >
                      <Panel className="text-center !p-5">
                        {asset.coinStack > 0 && <CoinStack count={asset.coinStack} />}
                        {asset.coinStack === 0 && <div className="text-3xl mb-2 h-12 flex items-center justify-center">{asset.icon}</div>}
                        {asset.coinStack > 0 && <div className="text-3xl mb-2">{asset.icon}</div>}
                        <div className="font-pixel text-lg" style={{ color: asset.color }}>{asset.amount}</div>
                        <div className="font-pixel text-[9px] text-faded-spirit mb-1">{asset.symbol}</div>
                        <div className="font-silk text-[9px] text-faded-spirit">{asset.value}</div>
                      </Panel>
                    </motion.div>
                  ))}
                </div>

                {/* Revenue Breakdown */}
                <Panel>
                  <h3 className="font-pixel text-[9px] text-ritual-gold mb-4">Revenue Sources</h3>
                  {[
                    { label: "Seal Fees", value: "78%", color: "#ff3366", width: 78 },
                    { label: "NFT Royalties", value: "15%", color: "#a855f7", width: 15 },
                    { label: "Partnership Deals", value: "7%", color: "#00ccff", width: 7 },
                  ].map((source) => (
                    <div key={source.label} className="mb-3">
                      <div className="flex justify-between mb-1">
                        <span className="font-pixel text-[7px] text-faded-spirit">{source.label}</span>
                        <span className="font-pixel text-[7px]" style={{ color: source.color }}>{source.value}</span>
                      </div>
                      <div className="h-2" style={{ background: "#1a1025", border: "1px solid #3a285044" }}>
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${source.width}%` }}
                          transition={{ duration: 1, delay: 0.3 }}
                          className="h-full"
                          style={{ background: source.color }}
                        />
                      </div>
                    </div>
                  ))}
                </Panel>
              </motion.div>
            )}

            {activeTab === "council" && (
              <motion.div
                key="council"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                <div className="flex items-center justify-between mb-2">
                  <h2 className="font-pixel text-sm text-ritual-gold">Guild Council</h2>
                  <span className="font-pixel text-[7px] text-faded-spirit">
                    {PROPOSALS.filter((p) => p.status === "active").length} active proposals
                  </span>
                </div>

                {/* Parchment-style Proposal Cards */}
                <div className="space-y-6">
                  {PROPOSALS.map((proposal) => (
                    <ParchmentQuestCard
                      key={proposal.id}
                      proposal={proposal}
                      onVote={handleVoteClick}
                      hasVoted={votedProposals.has(proposal.id)}
                    />
                  ))}
                </div>
              </motion.div>
            )}

            {activeTab === "rankings" && (
              <motion.div
                key="rankings"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                <h2 className="font-pixel text-sm text-ritual-gold text-center mb-6">Guild Rankings</h2>

                {/* Top 3 Podium */}
                <div className="flex justify-center items-end gap-4 mb-8">
                  {[TOP_MEMBERS[1], TOP_MEMBERS[0], TOP_MEMBERS[2]].map((member, i) => {
                    const heights = [100, 140, 80];
                    const medals = ["🥈", "🥇", "🥉"];
                    const colors = ["#c0c0c0", "#ffd700", "#cd7f32"];
                    return (
                      <motion.div
                        key={member.rank}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 + i * 0.15 }}
                        className="text-center"
                      >
                        <div className="text-2xl mb-2">{medals[i]}</div>
                        <ClassIcon cls={member.class} />
                        <div className="font-pixel text-[9px] text-ghost-white mt-1">{member.name}</div>
                        <RankBadge rank={getRankFromVotes(member.votes)} />
                        <div
                          className="w-16 mx-auto flex items-end justify-center mt-2"
                          style={{
                            height: heights[i],
                            background: `linear-gradient(to top, ${colors[i]}22, transparent)`,
                            border: `1px solid ${colors[i]}44`,
                            borderBottom: "none",
                          }}
                        >
                          <span className="font-pixel text-[9px] pb-2" style={{ color: colors[i] }}>{member.nfts}</span>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>

                {/* Full Leaderboard */}
                <Panel>
                  <div className="space-y-0">
                    <div className="flex items-center gap-3 px-3 py-2 text-[6px] font-pixel text-faded-spirit uppercase tracking-wider" style={{ borderBottom: "1px solid #3a285033" }}>
                      <span className="w-8">#</span>
                      <span className="flex-1">Name</span>
                      <span className="w-12 text-center">NFTs</span>
                      <span className="w-12 text-center">Votes</span>
                      <span className="w-12 text-center">Quests</span>
                    </div>

                    {TOP_MEMBERS.map((member, i) => (
                      <motion.div
                        key={member.rank}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.1 + i * 0.05 }}
                        className="flex items-center gap-3 px-3 py-3 transition-colors"
                        style={{
                          borderBottom: "1px solid #3a285022",
                          background: i < 3 ? "rgba(255, 215, 0, 0.03)" : "transparent",
                        }}
                      >
                        <span className="w-8 font-pixel text-[9px]" style={{ color: i < 3 ? "#ffd700" : "#8a7a9a" }}>
                          {member.rank}
                        </span>
                        <div className="flex-1 flex items-center gap-2">
                          <ClassIcon cls={member.class} />
                          <div>
                            <span className="font-pixel text-[9px] text-ghost-white">{member.name}</span>
                            <span className="font-pixel text-[6px] text-faded-spirit ml-2">{member.title}</span>
                          </div>
                        </div>
                        <span className="w-12 text-center font-pixel text-[9px] text-blood-pink">{member.nfts}</span>
                        <span className="w-12 text-center font-pixel text-[9px] text-ritual-gold">{member.votes}</span>
                        <span className="w-12 text-center font-pixel text-[9px] text-soul-cyan">{member.questsCompleted}</span>
                      </motion.div>
                    ))}

                    {/* Your position */}
                    <div className="flex items-center gap-3 px-3 py-3 mt-2" style={{ borderTop: "2px solid #ff336633", background: "rgba(255, 51, 102, 0.05)" }}>
                      <span className="w-8 font-pixel text-[9px] text-blood-pink">{userStats.rank}</span>
                      <div className="flex-1 flex items-center gap-2">
                        <ClassIcon cls={userStats.class} />
                        <div>
                          <span className="font-pixel text-[9px] text-ghost-white">{userStats.name}</span>
                          <span className="font-pixel text-[6px] text-blood-pink ml-2">YOU</span>
                        </div>
                      </div>
                      <span className="w-12 text-center font-pixel text-[9px] text-blood-pink">{userStats.nfts}</span>
                      <span className="w-12 text-center font-pixel text-[9px] text-ritual-gold">{userStats.votes}</span>
                      <span className="w-12 text-center font-pixel text-[9px] text-soul-cyan">{userStats.questsCompleted}</span>
                    </div>
                  </div>
                </Panel>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Vote Ceremony Modal */}
      <VoteCeremonyModal
        isOpen={!!votingProposal}
        proposal={votingProposal}
        onVote={handleVote}
        onClose={() => setVotingProposal(null)}
      />
    </div>
  );
}
