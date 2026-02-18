"use client";

import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useSealFlow, STATUS_ORDER, STATUS_LABELS } from "@/hooks/useSealFlow";
import { useWalletStore } from "@/stores/wallet";
import { getChainById, DYNAMIC_ENV_ID } from "@/lib/constants";
import { SummoningCircle } from "@/components/ui/SummoningCircle";
import { DialogueBox } from "@/components/ui/DialogueBox";
import { BackgroundAtmosphere } from "@/components/ui/BackgroundAtmosphere";
import { ChainSelector } from "@/components/ui/ChainSelector";
import { DepositAddress } from "@/components/ui/DepositAddress";
import { SolanaConnectInner, DevModeConnect } from "@/components/wallet/SolanaConnect";
import { IkaSprite } from "@/components/ui/PixelSprite";

// ─── Step breadcrumb ──────────────────────────────────────────────────────────

const STEPS = ["Connect", "Select Chain", "Deposit", "Summoning", "Complete"] as const;

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center justify-center gap-1 md:gap-2">
      {STEPS.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div key={label} className="flex items-center gap-1">
            <div className="flex flex-col items-center gap-1">
              <motion.div
                animate={active ? { boxShadow: ["0 0 4px #ffd700", "0 0 12px #ffd700", "0 0 4px #ffd700"] } : {}}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="w-4 h-4 flex items-center justify-center"
                style={{
                  background: done ? "#00ff88" : active ? "#ffd700" : "transparent",
                  border: `2px solid ${done ? "#00ff88" : active ? "#ffd700" : "#3a2850"}`,
                }}
              >
                {done && (
                  <span style={{ fontSize: 8, color: "#000" }}>✓</span>
                )}
              </motion.div>
              <span
                className="font-pixel hidden md:block"
                style={{
                  fontSize: 7,
                  color: done ? "#00ff88" : active ? "#ffd700" : "#3a2850",
                  whiteSpace: "nowrap",
                }}
              >
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className="w-6 md:w-8 h-px mb-4"
                style={{ background: i < current ? "#00ff88" : "#3a2850" }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Step index map ───────────────────────────────────────────────────────────

function stepToIndex(step: string): number {
  switch (step) {
    case "connect": return 0;
    case "select_chain": return 1;
    case "deposit": return 2;
    case "waiting": return 3;
    case "complete": return 4;
    default: return 0;
  }
}

// ─── Panel wrapper ────────────────────────────────────────────────────────────

function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.3 }}
      className={`border-2 border-sigil-border bg-card-purple/90 p-6 ${className}`}
    >
      {children}
    </motion.div>
  );
}

// ─── Step 1: Connect Wallet ───────────────────────────────────────────────────

function ConnectStep({ onConnect }: { onConnect: (pk: string) => void }) {
  return (
    <Panel>
      <DialogueBox
        speaker="Ika"
        portrait="neutral"
        text="The ritual begins with your Solana wallet. Connect Phantom, Backpack, or Solflare to begin."
        variant="normal"
      />
      <div className="mt-6">
        {DYNAMIC_ENV_ID ? (
          <SolanaConnectInner onConnect={onConnect} />
        ) : (
          <DevModeConnect onConnect={onConnect} />
        )}
      </div>
    </Panel>
  );
}

// ─── Step 2: Select Source Chain ─────────────────────────────────────────────

function SelectChainStep({
  selectedChain,
  onSelect,
  onConfirm,
  isLoading,
  error,
  onBack,
}: {
  selectedChain: string | null;
  onSelect: (id: string) => void;
  onConfirm: () => void;
  isLoading: boolean;
  error: string | null;
  onBack: () => void;
}) {
  return (
    <Panel>
      <div className="mb-4">
        <DialogueBox
          speaker="Ika"
          portrait="excited"
          text="Which chain holds your NFT? Choose the source realm..."
          variant="normal"
        />
      </div>

      <ChainSelector selected={selectedChain} onSelect={onSelect} />

      {error && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-3 font-pixel text-[9px] text-demon-red text-center"
        >
          ⚠ {error}
        </motion.p>
      )}

      <div className="flex gap-3 justify-between mt-6">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onBack}
          className="nes-btn is-dark font-pixel text-[10px] !py-2 !px-4"
        >
          ← Back
        </motion.button>

        <motion.button
          whileHover={selectedChain && !isLoading ? { scale: 1.05 } : {}}
          whileTap={selectedChain && !isLoading ? { scale: 0.95 } : {}}
          onClick={onConfirm}
          disabled={!selectedChain || isLoading}
          className={`nes-btn font-pixel text-[10px] !py-2 !px-6 ${
            !selectedChain || isLoading ? "opacity-50 cursor-not-allowed" : "is-primary"
          }`}
        >
          {isLoading ? "⏳ Preparing..." : "Get Deposit Address →"}
        </motion.button>
      </div>
    </Panel>
  );
}

// ─── Step 3: Show Deposit Address ─────────────────────────────────────────────

function DepositStep({
  address,
  chainId,
  onConfirmSent,
  onBack,
}: {
  address: string;
  chainId: string;
  onConfirmSent: () => void;
  onBack: () => void;
}) {
  const chain = getChainById(chainId);

  if (!chain) return null;

  return (
    <Panel>
      <div className="mb-5">
        <DialogueBox
          speaker="Ika"
          portrait="excited"
          text={`Your sacred deposit address is ready! Send your NFT from ${chain.name} to this address.`}
          variant="normal"
        />
      </div>

      <DepositAddress
        address={address}
        chain={chain}
        onConfirmSent={onConfirmSent}
      />

      <div className="mt-4 flex">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onBack}
          className="nes-btn is-dark font-pixel text-[10px] !py-2 !px-4"
        >
          ← Back
        </motion.button>
      </div>
    </Panel>
  );
}

// ─── Step 4: Waiting (Summoning Circle + Status) ──────────────────────────────

function WaitingStep({
  sealStatus,
  chainId,
  depositAddress,
}: {
  sealStatus: string | null;
  chainId: string | null;
  depositAddress: string | null;
}) {
  const currentStatusIdx = sealStatus
    ? STATUS_ORDER.indexOf(sealStatus as (typeof STATUS_ORDER)[number])
    : 0;

  // Circle phase based on status
  const circlePhase =
    sealStatus === "complete"
      ? "overload"
      : sealStatus === "minting" || sealStatus === "uploading"
      ? "active"
      : sealStatus === "detected" || sealStatus === "fetching_metadata"
      ? "charging"
      : "idle";

  return (
    <Panel>
      <h2 className="font-pixel text-center text-ritual-gold text-sm mb-6">
        ✦ The Summoning Is In Progress ✦
      </h2>

      {/* Summoning circle */}
      <div className="flex justify-center mb-6">
        <SummoningCircle phase={circlePhase} size={240} />
      </div>

      {/* Current status text */}
      <div className="mb-6">
        <DialogueBox
          speaker="Ritual"
          portrait="neutral"
          variant="system"
          text={
            sealStatus
              ? STATUS_LABELS[sealStatus as keyof typeof STATUS_LABELS] ??
                "Processing..."
              : "Waiting for your NFT to arrive at the deposit address..."
          }
        />
      </div>

      {/* Status step progression */}
      <div className="space-y-2 mb-6">
        {STATUS_ORDER.filter((s) => s !== "error").map((status, i) => {
          const done = i < currentStatusIdx;
          const active = i === currentStatusIdx;
          return (
            <div key={status} className="flex items-center gap-3">
              <motion.div
                animate={
                  active
                    ? {
                        boxShadow: [
                          "0 0 4px #ffd700",
                          "0 0 12px #ffd700",
                          "0 0 4px #ffd700",
                        ],
                      }
                    : {}
                }
                transition={{ duration: 1.5, repeat: Infinity }}
                className="w-4 h-4 flex-shrink-0 flex items-center justify-center"
                style={{
                  background: done
                    ? "#00ff88"
                    : active
                    ? "#ffd70033"
                    : "transparent",
                  border: `2px solid ${
                    done ? "#00ff88" : active ? "#ffd700" : "#3a2850"
                  }`,
                }}
              >
                {done && (
                  <span style={{ fontSize: 8, color: "#000" }}>✓</span>
                )}
                {active && (
                  <motion.div
                    animate={{ opacity: [1, 0.3, 1] }}
                    transition={{ duration: 0.8, repeat: Infinity }}
                    className="w-2 h-2"
                    style={{ background: "#ffd700" }}
                  />
                )}
              </motion.div>
              <span
                className="font-pixel text-[9px]"
                style={{
                  color: done
                    ? "#00ff88"
                    : active
                    ? "#ffd700"
                    : "rgba(200,190,220,0.3)",
                }}
              >
                {STATUS_LABELS[status]}
              </span>
            </div>
          );
        })}
      </div>

      {/* Deposit address reminder */}
      {depositAddress && chainId && (
        <div
          className="p-3 text-center"
          style={{ border: "1px solid #3a285066", background: "rgba(13,10,26,0.5)" }}
        >
          <p className="font-pixel text-[8px] text-faded-spirit mb-1">
            Deposit address ({getChainById(chainId)?.name})
          </p>
          <p className="font-mono text-[10px] text-ghost-white break-all">
            {depositAddress.slice(0, 10)}...{depositAddress.slice(-8)}
          </p>
        </div>
      )}
    </Panel>
  );
}

// ─── Step 5: Complete ─────────────────────────────────────────────────────────

function CompleteStep({
  rebornNFT,
  chainId,
  onReset,
}: {
  rebornNFT: { mint: string; name: string; image: string } | null;
  chainId: string | null;
  onReset: () => void;
}) {
  const chain = chainId ? getChainById(chainId) : null;

  // Sparkle particles
  const particles = Array.from({ length: 16 }, (_, i) => ({
    color: ["#00ff88", "#ffd700", "#ff3366", "#9945ff"][i % 4],
    left: `${(i * 6.25 + Math.random() * 5) % 100}%`,
    duration: 2 + (i % 3) * 0.5,
    delay: (i % 8) * 0.15,
  }));

  return (
    <Panel>
      {/* Confetti */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        {particles.map((p, i) => (
          <motion.div
            key={i}
            className="absolute w-2 h-2"
            style={{ backgroundColor: p.color, left: p.left, bottom: "20%" }}
            animate={{
              y: [0, -400],
              x: [0, (i % 2 === 0 ? 1 : -1) * 40],
              opacity: [1, 0],
              scale: [1, 0.3],
            }}
            transition={{
              duration: p.duration,
              delay: p.delay,
              repeat: Infinity,
              repeatDelay: p.duration * 0.5,
            }}
          />
        ))}
      </div>

      <motion.h2
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", damping: 8 }}
        className="font-pixel text-center text-3xl text-spectral-green mb-6"
        style={{ textShadow: "0 0 20px #00ff88" }}
      >
        RITUAL COMPLETE!
      </motion.h2>

      <div className="flex justify-center mb-6">
        <motion.div
          animate={{ y: [0, -10, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <IkaSprite size={80} expression="excited" />
        </motion.div>
      </div>

      <DialogueBox
        speaker="Ika"
        portrait="excited"
        variant="normal"
        text={
          rebornNFT
            ? `${rebornNFT.name} has been reborn on Solana! Your NFT has transcended chains and lives again.`
            : "Your NFT has been reborn on Solana! The ritual is complete."
        }
      />

      {/* Reborn NFT card */}
      {rebornNFT && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mt-6 p-4 border-2 border-spectral-green/50 bg-black/30"
        >
          {rebornNFT.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={rebornNFT.image}
              alt={rebornNFT.name}
              className="w-32 h-32 mx-auto mb-3 pixelated object-contain"
              style={{ imageRendering: "pixelated" }}
            />
          )}

          <h3
            className="font-pixel text-center text-sm text-ritual-gold mb-1"
            style={{ textShadow: "0 0 8px #ffd700" }}
          >
            {rebornNFT.name}
          </h3>

          {/* Mint address */}
          <p className="font-mono text-[9px] text-faded-spirit text-center break-all mb-4">
            {rebornNFT.mint}
          </p>

          {/* Explorer links */}
          <div className="flex gap-3 justify-center flex-wrap">
            <a
              href={`https://explorer.solana.com/address/${rebornNFT.mint}?cluster=devnet`}
              target="_blank"
              rel="noopener noreferrer"
              className="nes-btn is-success font-pixel text-[9px] !py-2 !px-3"
            >
              Solana Explorer
            </a>
            <a
              href={`https://magiceden.io/item-details/${rebornNFT.mint}`}
              target="_blank"
              rel="noopener noreferrer"
              className="nes-btn is-primary font-pixel text-[9px] !py-2 !px-3"
            >
              Magic Eden
            </a>
            <a
              href={`https://www.tensor.trade/item/${rebornNFT.mint}`}
              target="_blank"
              rel="noopener noreferrer"
              className="nes-btn is-dark font-pixel text-[9px] !py-2 !px-3"
            >
              Tensor
            </a>
          </div>
        </motion.div>
      )}

      {/* Source chain seal info */}
      {chain && (
        <p className="font-silk text-xs text-faded-spirit text-center mt-4">
          Original NFT permanently sealed on{" "}
          <span style={{ color: chain.color }}>{chain.name}</span> via IKA
          dWallet
        </p>
      )}

      {/* Seal another */}
      <div className="flex justify-center mt-8">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onReset}
          className="nes-btn is-warning font-pixel text-[10px] !py-3 !px-8"
        >
          ✦ Seal Another NFT
        </motion.button>
      </div>
    </Panel>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SealPage() {
  const { connected, publicKey, connect } = useWalletStore();
  const flow = useSealFlow();

  // When wallet connects, advance the flow step
  const handleWalletConnect = (pk: string) => {
    connect(pk);
    if (flow.step === "connect") {
      flow.onWalletConnected();
    }
  };

  // If wallet is already connected and flow is on "connect" step, auto-advance
  // (handles page refresh with persisted wallet)
  const effectiveStep =
    connected && flow.step === "connect" ? "select_chain" : flow.step;

  const stepIndex = stepToIndex(effectiveStep);

  return (
    <div className="min-h-screen bg-void-purple relative overflow-hidden">
      <BackgroundAtmosphere mood="mystical" />

      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center pt-8 pb-6 relative z-10"
      >
        <h1
          className="font-pixel text-3xl md:text-4xl text-ritual-gold mb-2 tracking-wider"
          style={{ textShadow: "0 0 16px #ffd70066" }}
        >
          ✦ THE SOUL SEAL RITUAL ✦
        </h1>
        <p className="font-silk text-faded-spirit text-xs tracking-widest">
          NFT Reincarnation · Powered by IKA dWallet
        </p>
      </motion.header>

      {/* Step indicator */}
      <div className="relative z-10 px-4 mb-6">
        <div className="max-w-2xl mx-auto">
          <StepIndicator current={stepIndex} />
        </div>
      </div>

      {/* Main content */}
      <div className="relative z-10 max-w-2xl mx-auto px-4 pb-16">
        <AnimatePresence mode="wait">
          {effectiveStep === "connect" && (
            <ConnectStep key="connect" onConnect={handleWalletConnect} />
          )}

          {effectiveStep === "select_chain" && (
            <SelectChainStep
              key="select_chain"
              selectedChain={flow.sourceChain}
              onSelect={(id) => flow.selectChain(id, publicKey ?? "")}
              onConfirm={() => {
                if (flow.sourceChain && publicKey) {
                  // selectChain is called via onSelect; confirm just re-calls
                  // if no pending request is in flight
                  if (!flow.isLoading && !flow.depositAddress) {
                    flow.selectChain(flow.sourceChain, publicKey);
                  }
                }
              }}
              isLoading={flow.isLoading}
              error={flow.error}
              onBack={flow.goBack}
            />
          )}

          {effectiveStep === "deposit" && flow.depositAddress && (
            <DepositStep
              key="deposit"
              address={flow.depositAddress}
              chainId={flow.sourceChain!}
              onConfirmSent={flow.startWaiting}
              onBack={flow.goBack}
            />
          )}

          {effectiveStep === "waiting" && (
            <WaitingStep
              key="waiting"
              sealStatus={flow.sealStatus}
              chainId={flow.sourceChain}
              depositAddress={flow.depositAddress}
            />
          )}

          {effectiveStep === "complete" && (
            <CompleteStep
              key="complete"
              rebornNFT={flow.rebornNFT}
              chainId={flow.sourceChain}
              onReset={flow.reset}
            />
          )}
        </AnimatePresence>

        {/* Back to home */}
        <div className="text-center mt-8">
          <Link
            href="/"
            className="font-pixel text-[9px] text-faded-spirit hover:text-ghost-white transition-colors"
          >
            ← Return to the Sanctum
          </Link>
        </div>
      </div>
    </div>
  );
}
