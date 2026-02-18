"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import { PixelButton } from "@/components/ui/PixelButton";
import { PixelProgress } from "@/components/ui/PixelProgress";

// Types
type Tab = "proposals" | "treasury" | "members";

// Sample data
const PROPOSALS = [
  {
    id: 1,
    title: "Allocate 500 USDC for Marketing Campaign",
    description: "Fund a coordinated marketing push across Twitter and Discord to attract new adventurers.",
    status: "passed" as const,
    votesFor: 85,
    votesAgainst: 12,
    votesAbstain: 3,
    totalVotes: 12,
    timeRemaining: "Ended",
  },
  {
    id: 2,
    title: "Treasury Diversification: Add SOL Holdings",
    description: "Convert 25% of USDC treasury to SOL for better yield generation.",
    status: "active" as const,
    votesFor: 58,
    votesAgainst: 25,
    votesAbstain: 17,
    totalVotes: 12,
    timeRemaining: "3 days left",
  },
  {
    id: 3,
    title: "Partner Integration: TensorDAO",
    description: "Onboard TensorDAO as a strategic partner for secondary market support.",
    status: "defeated" as const,
    votesFor: 33,
    votesAgainst: 58,
    votesAbstain: 9,
    totalVotes: 12,
    timeRemaining: "Ended",
  },
];

const TREASURY = [
  { icon: "◎", amount: "142.5", symbol: "SOL", value: "$42,750" },
  { icon: "$", amount: "1,250", symbol: "USDC", value: "$1,250" },
];

const MEMBERS = [
  { rank: 1, name: "WhaleKing", votes: 3, nfts: 3, rankEmoji: "🥇" },
  { rank: 2, name: "SquadLeader", votes: 2, nfts: 2, rankEmoji: "🥈" },
  { rank: 3, name: "PixelMage", votes: 2, nfts: 2, rankEmoji: "🥉" },
  { rank: 4, name: "NFTHunter", votes: 2, nfts: 2, rankEmoji: "#4" },
  { rank: 5, name: "ChainWalker", votes: 1, nfts: 1, rankEmoji: "#5" },
];

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

// Helper functions
const getStatusColor = (status: string) => {
  switch (status) {
    case "passed":
      return "bg-spectral-green text-ghost-white";
    case "active":
      return "bg-ritual-gold text-void-purple";
    case "defeated":
      return "bg-blood-pink text-ghost-white";
    default:
      return "bg-faded-spirit text-ghost-white";
  }
};

export default function GuildPage() {
  const [activeTab, setActiveTab] = useState<Tab>("proposals");
  const [votedProposals, setVotedProposals] = useState<Set<number>>(new Set());

  // User's stats
  const userVotes = 12;
  const userNFTs = 12;

  const handleVote = (proposalId: number) => {
    setVotedProposals((prev) => new Set(prev).add(proposalId));
  };

  return (
    <div className="min-h-screen bg-void-purple px-4 py-8 relative overflow-hidden">
      {/* Background star field */}
      <div className="fixed inset-0 pointer-events-none">
        {Array.from({ length: 30 }).map((_, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.8, 0] }}
            transition={{
              duration: 2 + Math.random() * 3,
              repeat: Infinity,
              delay: Math.random() * 2,
            }}
            className="absolute w-0.5 h-0.5 bg-ghost-white rounded-full"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
            }}
          />
        ))}
      </div>

      <div className="max-w-4xl mx-auto relative z-10">
        {/* Header with Guild Banner */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-8"
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.6 }}
            className="mx-auto mb-4 w-32 h-32 relative"
            style={{ filter: "drop-shadow(0 4px 12px rgba(255, 215, 0, 0.3))" }}
          >
            <Image src="/art/guild-banner.png" alt="Guild Banner" fill className="object-contain pixelated" style={{ imageRendering: "pixelated" }} />
          </motion.div>
          <h1 className="font-pixel text-3xl md:text-4xl text-ritual-gold mb-2 tracking-wider">
            ADVENTURER&apos;S GUILD
          </h1>
          <p className="font-silk text-sm text-faded-spirit">
            A Decentralized Autonomous Organization for reborn souls
          </p>
        </motion.div>

        {/* Voting Power - Stat Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="mb-8"
        >
          <div className="inline-flex items-center gap-4 bg-[#0d0d1a] border-2 border-ritual-gold px-6 py-4 rounded-lg">
            <div className="text-4xl">⚔️</div>
            <div>
              <div className="font-silk text-xs text-faded-spirit uppercase tracking-wider">
                Your Voting Power
              </div>
              <div className="font-pixel text-2xl text-ritual-gold">
                {userVotes} votes
              </div>
            </div>
            <div className="text-sm text-faded-spirit">
              from {userNFTs} reborn NFTs
            </div>
          </div>
        </motion.div>

        {/* Tab Navigation */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="flex gap-3 mb-8 justify-center flex-wrap"
        >
          <PixelButton
            variant={activeTab === "proposals" ? "primary" : "dark"}
            onClick={() => setActiveTab("proposals")}
          >
            📜 Proposals
          </PixelButton>
          <PixelButton
            variant={activeTab === "treasury" ? "primary" : "dark"}
            onClick={() => setActiveTab("treasury")}
          >
            💰 Treasury
          </PixelButton>
          <PixelButton
            variant={activeTab === "members" ? "primary" : "dark"}
            onClick={() => setActiveTab("members")}
          >
            👥 Members
          </PixelButton>
        </motion.div>

        {/* Content */}
        <motion.div key={activeTab} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
          {/* Proposals Tab */}
          {activeTab === "proposals" && (
            <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-4">
              {PROPOSALS.map((proposal) => (
                <motion.div
                  key={proposal.id}
                  variants={itemVariants}
                  className="bg-[#0d0d1a] border-2 border-stone-700 rounded-lg p-4"
                >
                  {/* Title & Status */}
                  <div className="flex justify-between items-start mb-3">
                    <h3 className="font-pixel text-sm text-ghost-white flex-1 pr-4">
                      {proposal.title}
                    </h3>
                    <span
                      className={`font-pixel text-xs px-2 py-1 rounded ${getStatusColor(proposal.status)}`}
                    >
                      {proposal.status.toUpperCase()}
                    </span>
                  </div>

                  {/* Description */}
                  <p className="font-silk text-xs text-faded-spirit mb-4">{proposal.description}</p>

                  {/* Vote Progress */}
                  <div className="mb-3">
                    <div className="flex justify-between mb-1">
                      <span className="font-silk text-[10px] text-faded-spirit">Vote Progress</span>
                      <span className="font-pixel text-xs text-ghost-white">{proposal.votesFor}%</span>
                    </div>
                    <PixelProgress value={proposal.votesFor} />
                  </div>

                  {/* Vote Breakdown */}
                  <div className="flex gap-4 mb-3 text-xs">
                    <div className="flex-1 text-center">
                      <span className="font-silk text-spectral-green">For</span>
                      <div className="font-pixel text-ghost-white">{proposal.votesFor}%</div>
                    </div>
                    <div className="flex-1 text-center">
                      <span className="font-silk text-blood-pink">Against</span>
                      <div className="font-pixel text-ghost-white">{proposal.votesAgainst}%</div>
                    </div>
                    <div className="flex-1 text-center">
                      <span className="font-silk text-faded-spirit">Abstain</span>
                      <div className="font-pixel text-ghost-white">{proposal.votesAbstain}%</div>
                    </div>
                  </div>

                  {/* Time & Actions */}
                  <div className="flex justify-between items-center pt-3 border-t border-stone-700">
                    <span className="font-silk text-xs text-faded-spirit">
                      ⏱ {proposal.timeRemaining}
                    </span>

                    {proposal.status === "active" && !votedProposals.has(proposal.id) && (
                      <div className="flex gap-2">
                        <PixelButton variant="primary" onClick={() => handleVote(proposal.id)}>
                          For
                        </PixelButton>
                        <PixelButton variant="dark" onClick={() => handleVote(proposal.id)}>
                          Against
                        </PixelButton>
                        <PixelButton variant="dark" onClick={() => handleVote(proposal.id)}>
                          Abstain
                        </PixelButton>
                      </div>
                    )}

                    {votedProposals.has(proposal.id) && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="flex items-center gap-1 text-spectral-green font-pixel text-sm"
                      >
                        ✓ Vote Cast!
                      </motion.div>
                    )}
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}

          {/* Treasury Tab */}
          {activeTab === "treasury" && (
            <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
              {/* Treasury Grid */}
              <div className="grid md:grid-cols-2 gap-4">
                {TREASURY.map((item) => (
                  <motion.div
                    key={item.symbol}
                    variants={itemVariants}
                    className="bg-[#0d0d1a] border-2 border-stone-700 rounded-lg p-6 text-center"
                  >
                    <div className="text-5xl mb-3">{item.icon}</div>
                    <div className="font-pixel text-3xl text-ritual-gold">{item.amount}</div>
                    <div className="font-pixel text-lg text-faded-spirit mb-2">{item.symbol}</div>
                    <div className="font-silk text-sm text-faded-spirit">≈ {item.value}</div>
                  </motion.div>
                ))}
              </div>

              {/* Total Treasury */}
              <motion.div variants={itemVariants}>
                <div className="bg-[#0d0d1a] border-2 border-ritual-gold rounded-lg p-6 text-center">
                  <div className="font-silk text-xs text-faded-spirit uppercase tracking-widest mb-2">
                    Total Treasury
                  </div>
                  <div className="font-pixel text-3xl text-ritual-gold">$44,000</div>
                </div>
              </motion.div>
            </motion.div>
          )}

          {/* Members Tab */}
          {activeTab === "members" && (
            <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-3">
              {MEMBERS.map((member) => (
                <motion.div
                  key={member.rank}
                  variants={itemVariants}
                  className="bg-[#0d0d1a] border-2 border-stone-700 rounded-lg p-4 flex items-center gap-4"
                >
                  {/* Rank */}
                  <div className="w-10 text-center">
                    <span className="font-pixel text-xl">{member.rankEmoji}</span>
                  </div>

                  {/* Name & NFT Count */}
                  <div className="flex-1">
                    <div className="font-pixel text-sm text-ghost-white">{member.name}</div>
                    <div className="font-silk text-xs text-faded-spirit">
                      {member.nfts} NFT{member.nfts > 1 ? "s" : ""}
                    </div>
                  </div>

                  {/* Vote Count */}
                  <div className="text-right">
                    <div className="font-pixel text-xl text-ritual-gold">{member.votes}</div>
                    <div className="font-silk text-[10px] text-faded-spirit">votes</div>
                  </div>
                </motion.div>
              ))}

              {/* Your Card */}
              <motion.div variants={itemVariants} className="mt-6 pt-4 border-t-2 border-stone-700">
                <div className="font-pixel text-xs text-faded-spirit text-center mb-4">— YOUR RANK —</div>
                <div className="bg-[#0d0d1a] border-2 border-blood-pink rounded-lg p-4 flex items-center gap-4">
                  <div className="w-10 text-center">
                    <span className="font-pixel text-xl text-blood-pink">YOU</span>
                  </div>
                  <div className="flex-1">
                    <div className="font-pixel text-sm text-ghost-white">Reborn Hero</div>
                    <div className="font-silk text-xs text-faded-spirit">
                      {userNFTs} NFT{userNFTs > 1 ? "s" : ""}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-pixel text-xl text-blood-pink">{userVotes}</div>
                    <div className="font-silk text-[10px] text-faded-spirit">votes</div>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </motion.div>

        {/* Footer */}
        <footer className="mt-16 pt-8 text-center border-t border-stone-800">
          <p className="font-silk text-xs text-faded-spirit">
            🦑 Powered by IKA dWallets
          </p>
        </footer>
      </div>
    </div>
  );
}
