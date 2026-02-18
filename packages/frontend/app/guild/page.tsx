"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { PixelButton } from "@/components/ui/PixelButton";
import { PixelProgress } from "@/components/ui/PixelProgress";
import { PixelCard } from "@/components/ui/PixelCard";

type Tab = "proposals" | "treasury" | "members";

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
    progress: 85,
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
    progress: 58,
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
    progress: 33,
  },
];

const TREASURY = [
  { icon: "◎", amount: "142.5", symbol: "SOL", value: "$42,750" },
  { icon: "$", amount: "1,250", symbol: "USDC", value: "$1,250" },
];

const MEMBERS = [
  { rank: 1, name: "WhaleKing", votes: 3, nfts: 3 },
  { rank: 2, name: "SquadLeader", votes: 2, nfts: 2 },
  { rank: 3, name: "PixelMage", votes: 2, nfts: 2 },
  { rank: 4, name: "NFTHunter", votes: 2, nfts: 2 },
  { rank: 5, name: "ChainWalker", votes: 1, nfts: 1 },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

export default function GuildPage() {
  const [activeTab, setActiveTab] = useState<Tab>("proposals");
  const [votedProposals, setVotedProposals] = useState<Set<number>>(new Set());

  const handleVote = (proposalId: number) => {
    setVotedProposals((prev) => new Set(prev).add(proposalId));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "passed":
        return "text-spectral-green";
      case "active":
        return "text-ritual-gold";
      case "defeated":
        return "text-blood-pink";
      default:
        return "text-faded-spirit";
    }
  };

  return (
    <div className="min-h-screen bg-void-purple px-4 py-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <h1 className="font-pixel text-2xl md:text-4xl text-ritual-gold mb-2">
            ⚔️ Adventurer&apos;s Guild
          </h1>
          <p className="font-silk text-sm text-faded-spirit">
            The DAO where reborn NFT holders shape the future
          </p>
        </motion.div>

        {/* Voting Power Display */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="nes-container is-dark mb-8 text-center"
        >
          <span className="font-silk text-faded-spirit text-xs block mb-2">YOUR VOTING POWER</span>
          <span className="font-pixel text-4xl text-ritual-gold block mb-1">12 votes</span>
          <span className="font-silk text-xs text-faded-spirit">(from 12 reborn NFTs)</span>
        </motion.div>

        {/* Tab Navigation */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="flex gap-3 mb-8 justify-center flex-wrap"
        >
          {(["proposals", "treasury", "members"] as Tab[]).map((tab) => (
            <PixelButton
              key={tab}
              variant={activeTab === tab ? "primary" : "dark"}
              onClick={() => setActiveTab(tab)}
              className="capitalize"
            >
              {tab === "proposals" && "📜 "}
              {tab === "treasury" && "💰 "}
              {tab === "members" && "👥 "}
              {tab}
            </PixelButton>
          ))}
        </motion.div>

        {/* Content */}
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {/* Proposals Tab */}
          {activeTab === "proposals" && (
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="space-y-6"
            >
              {PROPOSALS.map((proposal) => (
                <motion.div key={proposal.id} variants={itemVariants}>
                  <PixelCard hover={false} className="p-6">
                    {/* Proposal Header */}
                    <div className="flex justify-between items-start mb-4">
                      <h3 className="font-pixel text-sm text-ghost-white flex-1 pr-4">
                        {proposal.title}
                      </h3>
                      <span
                        className={`font-pixel text-xs px-3 py-1 nes-container is-rounded ${getStatusColor(
                          proposal.status
                        )}`}
                      >
                        {proposal.status.toUpperCase()}
                      </span>
                    </div>

                    {/* Description */}
                    <p className="font-silk text-xs text-faded-spirit mb-4">
                      {proposal.description}
                    </p>

                    {/* Progress Bar */}
                    <div className="mb-4">
                      <PixelProgress
                        value={proposal.progress}
                        label="Votes For"
                        variant={proposal.status === "passed" ? "success" : proposal.status === "defeated" ? "warning" : "primary"}
                      />
                    </div>

                    {/* Vote Stats */}
                    <div className="flex gap-6 mb-4 font-silk text-xs">
                      <div>
                        <span className="text-spectral-green">✓ For:</span>{" "}
                        <span className="text-ghost-white">{proposal.votesFor}%</span>
                      </div>
                      <div>
                        <span className="text-blood-pink">✗ Against:</span>{" "}
                        <span className="text-ghost-white">{proposal.votesAgainst}%</span>
                      </div>
                      <div>
                        <span className="text-faded-spirit">○ Abstain:</span>{" "}
                        <span className="text-ghost-white">{proposal.votesAbstain}%</span>
                      </div>
                    </div>

                    {/* Time Remaining */}
                    <div className="font-silk text-xs text-faded-spirit mb-4">
                      ⏱ {proposal.timeRemaining}
                    </div>

                    {/* Vote Buttons */}
                    {proposal.status === "active" && !votedProposals.has(proposal.id) && (
                      <div className="flex gap-3 flex-wrap">
                        <PixelButton
                          variant="success"
                          size="sm"
                          onClick={() => handleVote(proposal.id)}
                        >
                          ⚔️ For
                        </PixelButton>
                        <PixelButton
                          variant="warning"
                          size="sm"
                          onClick={() => handleVote(proposal.id)}
                        >
                          🛡️ Against
                        </PixelButton>
                        <PixelButton
                          variant="dark"
                          size="sm"
                          onClick={() => handleVote(proposal.id)}
                        >
                          💤 Abstain
                        </PixelButton>
                      </div>
                    )}

                    {votedProposals.has(proposal.id) && (
                      <div className="font-pixel text-xs text-spectral-green animate-pulse">
                        ✓ Vote Cast!
                      </div>
                    )}
                  </PixelCard>
                </motion.div>
              ))}
            </motion.div>
          )}

          {/* Treasury Tab */}
          {activeTab === "treasury" && (
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="grid md:grid-cols-2 gap-6"
            >
              {TREASURY.map((item) => (
                <motion.div key={item.symbol} variants={itemVariants}>
                  <PixelCard hover={false} className="text-center p-8">
                    <div className="text-5xl mb-4">{item.icon}</div>
                    <div className="font-pixel text-3xl text-ritual-gold mb-2">
                      {item.amount}
                    </div>
                    <div className="font-silk text-lg text-faded-spirit mb-2">
                      {item.symbol}
                    </div>
                    <div className="font-silk text-xs text-faded-spirit">
                      ≈ {item.value}
                    </div>
                  </PixelCard>
                </motion.div>
              ))}

              {/* Total */}
              <motion.div variants={itemVariants} className="md:col-span-2">
                <PixelCard hover={false} className="text-center p-6 border-2 border-ritual-gold">
                  <span className="font-silk text-faded-spirit text-xs">TOTAL TREASURY</span>
                  <div className="font-pixel text-2xl text-ritual-gold mt-2">$44,000</div>
                </PixelCard>
              </motion.div>
            </motion.div>
          )}

          {/* Members Tab */}
          {activeTab === "members" && (
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="space-y-4"
            >
              {MEMBERS.map((member) => (
                <motion.div key={member.rank} variants={itemVariants}>
                  <PixelCard hover={false} className="p-4 flex items-center gap-4">
                    {/* Rank */}
                    <div className="font-pixel text-lg w-10 text-center">
                      {member.rank === 1 && "🥇"}
                      {member.rank === 2 && "🥈"}
                      {member.rank === 3 && "🥉"}
                      {member.rank > 3 && `#${member.rank}`}
                    </div>

                    {/* Name */}
                    <div className="flex-1">
                      <div className="font-pixel text-sm text-ghost-white">
                        {member.name}
                      </div>
                      <div className="font-silk text-xs text-faded-spirit">
                        {member.nfts} NFT{member.nfts > 1 ? "s" : ""}
                      </div>
                    </div>

                    {/* Votes */}
                    <div className="text-right">
                      <div className="font-pixel text-lg text-ritual-gold">
                        {member.votes}
                      </div>
                      <div className="font-silk text-[10px] text-faded-spirit">
                        votes
                      </div>
                    </div>
                  </PixelCard>
                </motion.div>
              ))}

              {/* Your Rank */}
              <motion.div variants={itemVariants}>
                <PixelCard
                  hover={false}
                  className="p-4 flex items-center gap-4 border-2 border-blood-pink"
                >
                  <div className="font-pixel text-lg w-10 text-center text-blood-pink">
                    #
                  </div>
                  <div className="flex-1">
                    <div className="font-pixel text-sm text-ghost-white">You</div>
                    <div className="font-silk text-xs text-faded-spirit">12 NFTs</div>
                  </div>
                  <div className="text-right">
                    <div className="font-pixel text-lg text-blood-pink">12</div>
                    <div className="font-silk text-[10px] text-faded-spirit">votes</div>
                  </div>
                </PixelCard>
              </motion.div>
            </motion.div>
          )}
        </motion.div>

        {/* Footer */}
        <footer className="border-t border-sigil-border mt-16 pt-8 text-center">
          <p className="font-silk text-[10px] text-faded-spirit">
            🦑 Powered by IKA dWallets • Built on Solana
          </p>
        </footer>
      </div>
    </div>
  );
}
