"use client";

import { motion } from "framer-motion";

interface PixelProgressProps {
  value: number; // 0-100
  label?: string;
  variant?: "primary" | "success" | "warning";
}

export function PixelProgress({ value, label, variant = "primary" }: PixelProgressProps) {
  const colorMap = {
    primary: "bg-blood-pink",
    success: "bg-spectral-green",
    warning: "bg-ritual-gold",
  };

  return (
    <div className="w-full">
      {label && (
        <div className="flex justify-between mb-1">
          <span className="font-silk text-xs text-faded-spirit">{label}</span>
          <span className="font-pixel text-xs text-ritual-gold">{Math.round(value)}%</span>
        </div>
      )}
      <div className="nes-progress">
        <motion.div
          className={`h-full ${colorMap[variant]}`}
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          style={{
            imageRendering: "pixelated",
            boxShadow: `0 0 8px ${variant === "primary" ? "#ff3366" : variant === "success" ? "#00ff88" : "#ffd700"}44`,
          }}
        />
      </div>
    </div>
  );
}
