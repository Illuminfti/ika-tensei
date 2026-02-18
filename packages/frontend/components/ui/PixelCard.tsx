"use client";

import { motion } from "framer-motion";

interface PixelCardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  onClick?: () => void;
  glowColor?: string;
}

export function PixelCard({ children, className = "", hover = true, onClick, glowColor }: PixelCardProps) {
  return (
    <motion.div
      whileHover={hover ? { y: -4 } : undefined}
      whileTap={onClick ? { scale: 0.98 } : undefined}
      onClick={onClick}
      className={`pixel-card p-4 transition-all duration-200 ${onClick ? "cursor-pointer" : ""} ${className}`}
      style={glowColor ? { borderColor: glowColor, boxShadow: `0 0 15px ${glowColor}22` } : undefined}
    >
      {children}
    </motion.div>
  );
}
