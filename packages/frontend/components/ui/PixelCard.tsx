"use client";

import { motion } from "framer-motion";

interface PixelCardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  onClick?: () => void;
}

export function PixelCard({ children, className = "", hover = true, onClick }: PixelCardProps) {
  return (
    <motion.div
      whileHover={hover ? { y: -4, boxShadow: "0 0 20px #9b59b644" } : undefined}
      onClick={onClick}
      className={`
        nes-container is-dark 
        bg-card-purple border-sigil-border
        cursor-pointer transition-all
        ${className}
      `}
    >
      {children}
    </motion.div>
  );
}
