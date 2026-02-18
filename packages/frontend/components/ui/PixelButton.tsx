"use client";

import { motion } from "framer-motion";

interface PixelButtonProps {
  children: React.ReactNode;
  variant?: "primary" | "warning" | "success" | "dark";
  size?: "sm" | "md" | "lg";
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}

export function PixelButton({ children, variant = "primary", size = "md", onClick, disabled, className = "" }: PixelButtonProps) {
  const sizeClasses = {
    sm: "!py-1 !px-3 text-[10px]",
    md: "!py-2 !px-6 text-xs",
    lg: "!py-3 !px-8 text-sm",
  };

  const variantClass = variant === "dark" ? "is-dark" : `is-${variant}`;

  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className={`nes-btn ${variantClass} ${sizeClasses[size]} font-pixel ${className}`}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </motion.button>
  );
}
