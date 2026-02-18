"use client";

import { motion } from "framer-motion";
import { useMemo } from "react";

// Color palette
const COLORS = {
  voidPurple: "#0d0a1a",
  bloodPink: "#ff3366",
  ritualGold: "#ffd700",
  mysticPurple: "#9b59b6",
  soulCyan: "#00ccff",
  sigilBorder: "#3a2850",
  idleFill: "#231832",
};

// Elder Futhark runes (first 24)
const RUNES = "ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛋᛏᛒᛖᛗᛚᛝᛞᛟ";

export type CirclePhase = "idle" | "charging" | "active" | "overload";

export interface SummoningCircleProps {
  phase?: CirclePhase;
  size?: number;
}

export function SummoningCircle({ phase = "idle", size = 400 }: SummoningCircleProps) {
  const cx = size / 2;
  const cy = size / 2;
  const maxRadius = size * 0.48;

  // Speed multipliers per phase
  const speedMultiplier = useMemo(() => {
    switch (phase) {
      case "charging": return 2;
      case "active": return 3;
      case "overload": return 5;
      default: return 1;
    }
  }, [phase]);

  // Get colors based on phase
  const getPhaseColors = () => {
    switch (phase) {
      case "charging":
        return {
          border: COLORS.ritualGold,
          fill: COLORS.idleFill,
          rune: COLORS.ritualGold,
          center: COLORS.ritualGold,
          glow: COLORS.ritualGold,
        };
      case "active":
        return {
          border: COLORS.bloodPink,
          fill: COLORS.voidPurple,
          rune: COLORS.ritualGold,
          center: COLORS.soulCyan,
          glow: COLORS.bloodPink,
        };
      case "overload":
        return {
          border: "#ffffff",
          fill: COLORS.bloodPink,
          rune: "#ffffff",
          center: COLORS.ritualGold,
          glow: "#ffffff",
        };
      default:
        return {
          border: COLORS.sigilBorder,
          fill: COLORS.idleFill,
          rune: COLORS.sigilBorder,
          center: COLORS.mysticPurple,
          glow: COLORS.mysticPurple,
        };
    }
  };

  const colors = getPhaseColors();

  // Pulse animation for center
  const pulseDuration = phase === "overload" ? 0.2 : phase === "active" ? 0.4 : phase === "charging" ? 0.8 : 2;

  // Screen shake for overload
  const shakeClass = phase === "overload" ? "animate-shake" : "";

  return (
    <div className={`relative ${shakeClass}`} style={{ width: size, height: size }}>
      {/* Radial glow background for active/overload */}
      {phase !== "idle" && (
        <motion.div
          className="absolute inset-0 rounded-full"
          animate={{
            boxShadow: `0 0 ${size * 0.3}px ${colors.glow}44, inset 0 0 ${size * 0.4}px ${colors.glow}22`,
          }}
          transition={{ duration: 0.5 }}
        />
      )}

      {/* ===== RING 1: Outer dashed circle with runes (counter-clockwise) ===== */}
      <motion.svg
        viewBox={`0 0 ${size} ${size}`}
        className="absolute inset-0"
        animate={{ rotate: -360 }}
        transition={{ duration: 60 / speedMultiplier, repeat: Infinity, ease: "linear" }}
      >
        {/* Outer dashed ring */}
        <circle
          cx={cx}
          cy={cy}
          r={maxRadius}
          fill="none"
          stroke={colors.border}
          strokeWidth="2"
          strokeDasharray="8 6"
          opacity={phase === "idle" ? 0.4 : 0.8}
        />
        
        {/* Rune characters */}
        {Array.from({ length: 24 }).map((_, i) => {
          const angle = (i / 24) * Math.PI * 2 - Math.PI / 2;
          const x = cx + maxRadius * 0.92 * Math.cos(angle);
          const y = cy + maxRadius * 0.92 * Math.sin(angle);
          
          return (
            <text
              key={`rune-${i}`}
              x={x}
              y={y}
              textAnchor="middle"
              dominantBaseline="middle"
              fill={phase === "idle" ? colors.rune : (phase === "charging" || phase === "active") ? COLORS.ritualGold : colors.rune}
              fontSize={size * 0.04}
              fontFamily="serif"
              opacity={phase === "idle" ? 0.5 : phase === "overload" ? 1 : 0.9}
            >
              {RUNES[i]}
            </text>
          );
        })}
      </motion.svg>

      {/* ===== RING 2: Thin counter-rotating ring ===== */}
      <motion.svg
        viewBox={`0 0 ${size} ${size}`}
        className="absolute inset-0"
        animate={{ rotate: 360 }}
        transition={{ duration: 45 / speedMultiplier, repeat: Infinity, ease: "linear" }}
      >
        <circle
          cx={cx}
          cy={cy}
          r={maxRadius * 0.82}
          fill="none"
          stroke={colors.border}
          strokeWidth="1"
          strokeDasharray="4 12"
          opacity={phase === "idle" ? 0.3 : 0.7}
        />
      </motion.svg>

      {/* ===== RING 3: Hexagram (two overlapping triangles, counter-rotating) ===== */}
      <motion.svg
        viewBox={`0 0 ${size} ${size}`}
        className="absolute inset-0"
        animate={{ rotate: -360 }}
        transition={{ duration: 30 / speedMultiplier, repeat: Infinity, ease: "linear" }}
      >
        {/* Triangle 1 (pointing up) */}
        <polygon
          points={Array.from({ length: 3 }).map((_, i) => {
            const angle = (i * 120 - 90) * (Math.PI / 180);
            return `${cx + maxRadius * 0.65 * Math.cos(angle)},${cy + maxRadius * 0.65 * Math.sin(angle)}`;
          }).join(" ")}
          fill="none"
          stroke={colors.border}
          strokeWidth="1.5"
          opacity={phase === "idle" ? 0.4 : 0.8}
        />
        
        {/* Triangle 2 (pointing down) */}
        <polygon
          points={Array.from({ length: 3 }).map((_, i) => {
            const angle = (i * 120 + 90) * (Math.PI / 180);
            return `${cx + maxRadius * 0.65 * Math.cos(angle)},${cy + maxRadius * 0.65 * Math.sin(angle)}`;
          }).join(" ")}
          fill="none"
          stroke={colors.border}
          strokeWidth="1.5"
          opacity={phase === "idle" ? 0.4 : 0.8}
        />
      </motion.svg>

      {/* ===== RING 4: Pentacle (5-pointed star inside circle) ===== */}
      <motion.svg
        viewBox={`0 0 ${size} ${size}`}
        className="absolute inset-0"
        animate={{ rotate: 360 }}
        transition={{ duration: 20 / speedMultiplier, repeat: Infinity, ease: "linear" }}
      >
        {/* Circle around pentagram */}
        <circle
          cx={cx}
          cy={cy}
          r={maxRadius * 0.48}
          fill="none"
          stroke={colors.border}
          strokeWidth="1.5"
          opacity={phase === "idle" ? 0.5 : 0.9}
        />
        
        {/* Pentagram */}
        <polygon
          points={Array.from({ length: 5 }).map((_, i) => {
            const angle = (i * 72 - 90) * (Math.PI / 180);
            return `${cx + maxRadius * 0.48 * Math.cos(angle)},${cy + maxRadius * 0.48 * Math.sin(angle)}`;
          }).join(" ")}
          fill="none"
          stroke={colors.border}
          strokeWidth="2"
          opacity={phase === "idle" ? 0.4 : 0.8}
        />
        
        {/* Connect all points */}
        {Array.from({ length: 5 }).map((_, i) => {
          const angle1 = (i * 72 - 90) * (Math.PI / 180);
          const angle2 = ((i + 2) * 72 - 90) * (Math.PI / 180);
          return (
            <line
              key={`pent-line-${i}`}
              x1={cx + maxRadius * 0.48 * Math.cos(angle1)}
              y1={cy + maxRadius * 0.48 * Math.sin(angle1)}
              x2={cx + maxRadius * 0.48 * Math.cos(angle2)}
              y2={cy + maxRadius * 0.48 * Math.sin(angle2)}
              stroke={colors.border}
              strokeWidth="1.5"
              opacity={phase === "idle" ? 0.4 : 0.8}
            />
          );
        })}
      </motion.svg>

      {/* ===== RING 5: Center glowing orb ===== */}
      <div className="absolute inset-0 flex items-center justify-center">
        <motion.div
          className="rounded-full"
          style={{
            width: maxRadius * 0.25,
            height: maxRadius * 0.25,
            background: `radial-gradient(circle, ${colors.center} 0%, ${colors.glow}66 40%, transparent 70%)`,
          }}
          animate={{
            scale: phase === "overload" 
              ? [1, 1.5, 1] 
              : phase === "active" 
                ? [1, 1.2, 1]
                : phase === "charging"
                  ? [1, 1.1, 1]
                  : [1, 1.05, 1],
            opacity: phase === "overload" 
              ? [0.8, 1, 0.8]
              : phase === "active"
                ? [0.6, 1, 0.6]
                : phase === "charging"
                  ? [0.5, 0.8, 0.5]
                  : [0.4, 0.6, 0.4],
          }}
          transition={{
            duration: pulseDuration,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
        
        {/* Inner core */}
        <motion.div
          className="absolute rounded-full"
          style={{
            width: maxRadius * 0.12,
            height: maxRadius * 0.12,
            background: colors.center,
            boxShadow: `0 0 ${maxRadius * 0.15}px ${colors.glow}, 0 0 ${maxRadius * 0.3}px ${colors.glow}`,
          }}
          animate={{
            scale: phase === "overload"
              ? [0.8, 1.2, 0.8]
              : phase === "active"
                ? [0.9, 1.1, 0.9]
                : 1,
          }}
          transition={{
            duration: pulseDuration * 0.7,
            repeat: Infinity,
          }}
        />
      </div>

      {/* Screen shake keyframes for overload */}
      <style jsx>{`
        @keyframes shake {
          0%, 100% { transform: translate(0, 0); }
          10% { transform: translate(-2px, -2px); }
          20% { transform: translate(2px, 2px); }
          30% { transform: translate(-2px, 2px); }
          40% { transform: translate(2px, -2px); }
          50% { transform: translate(-1px, 1px); }
          60% { transform: translate(1px, -1px); }
          70% { transform: translate(-1px, -1px); }
          80% { transform: translate(1px, 1px); }
          90% { transform: translate(-2px, 0); }
        }
        .animate-shake {
          animation: shake 0.3s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}

export default SummoningCircle;
