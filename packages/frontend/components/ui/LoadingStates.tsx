"use client";

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

// ============================================================================
// TYPES
// ============================================================================

interface FullPageLoaderProps {
  message?: string;
}

interface SkeletonCardProps {
  className?: string;
}

interface SkeletonTextProps {
  width?: string;
  className?: string;
}

interface ButtonSpinnerProps {
  className?: string;
}

interface InlineLoaderProps {
  className?: string;
}

// ============================================================================
// ANIMATION KEYFRAMES (inline styles)
// ============================================================================

const spinnerKeyframes = `
  @keyframes spin-rune {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  @keyframes typewriter-cursor {
    0%, 100% { opacity: 1; }
    50% { opacity: 0; }
  }
  @keyframes shimmer {
    0% { background-position: -200% 0; }
    100% { background-position: 200% 0; }
  }
  @keyframes orb-bounce {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-6px); }
  }
  @keyframes summon-pulse {
    0%, 100% { opacity: 0.4; transform: scale(1); }
    50% { opacity: 1; transform: scale(1.02); }
  }
`;

// ============================================================================
// FULL PAGE LOADER (Summoning Circle)
// ============================================================================

export const FullPageLoader: React.FC<FullPageLoaderProps> = ({
  message = "Channeling mana..."
}) => {
  const [displayedText, setDisplayedText] = useState('');

  // Typewriter effect
  useEffect(() => {
    if (displayedText.length < message.length) {
      const timeout = setTimeout(() => {
        setDisplayedText(message.slice(0, displayedText.length + 1));
      }, 35 + Math.random() * 50);
      return () => clearTimeout(timeout);
    }
  }, [displayedText, message]);

  const runes = ['ᚠ', 'ᚢ', 'ᚦ', 'ᚨ', 'ᚱ', 'ᚲ', 'ᚷ', 'ᚹ', 'ᚺ', 'ᚾ', 'ᛁ', 'ᛃ'];

  return (
    <>
      <style>{spinnerKeyframes}</style>
      <div className="fixed inset-0 bg-void-purple flex flex-col items-center justify-center z-50">
        {/* Star field background */}
        <div className="absolute inset-0 overflow-hidden">
          {[...Array(40)].map((_, i) => (
            <div
              key={i}
              className="absolute bg-ghost-white rounded-full"
              style={{
                width: Math.random() * 2 + 1,
                height: Math.random() * 2 + 1,
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                opacity: Math.random() * 0.4 + 0.15,
                animation: `summon-pulse ${3 + Math.random() * 3}s ease-in-out infinite`,
                animationDelay: `${Math.random() * 2}s`,
              }}
            />
          ))}
        </div>

        {/* Summoning Circle */}
        <div className="relative w-64 h-64 md:w-80 md:h-80">
          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 200 200">
            {/* Outer ring */}
            <circle
              cx="100"
              cy="100"
              r="95"
              fill="none"
              stroke="#8b5cf6"
              strokeWidth="2"
              strokeDasharray="8 4"
              style={{ animation: 'summon-pulse 3s ease-in-out infinite' }}
            />
            {/* Middle ring */}
            <circle
              cx="100"
              cy="100"
              r="70"
              fill="none"
              stroke="#a78bfa"
              strokeWidth="1.5"
              strokeDasharray="4 8"
              style={{ animation: 'summon-pulse 3s ease-in-out infinite 0.5s' }}
            />
            {/* Inner ring */}
            <circle
              cx="100"
              cy="100"
              r="45"
              fill="none"
              stroke="#c4b5fd"
              strokeWidth="1"
              style={{ animation: 'summon-pulse 3s ease-in-out infinite 1s' }}
            />
            {/* Pentagram */}
            <g stroke="#c4b5fd" strokeWidth="1.5" fill="none">
              <path d="M100 20 L125 80 L190 80 L140 120 L160 180 L100 145 L40 180 L60 120 L10 80 L75 80 Z" />
            </g>
            {/* Runes around circle */}
            {runes.map((rune, i) => {
              const angle = (i * 30 - 90) * (Math.PI / 180);
              const x = 100 + 85 * Math.cos(angle);
              const y = 100 + 85 * Math.sin(angle);
              return (
                <text
                  key={i}
                  x={x}
                  y={y}
                  fill="#a78bfa"
                  fontSize="11"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  style={{
                    animation: `summon-pulse ${1.5 + i * 0.08}s ease-in-out infinite`,
                    animationDelay: `${i * 0.15}s`,
                  }}
                >
                  {rune}
                </text>
              );
            })}
          </svg>

          {/* Center glow */}
          <motion.div
            className="absolute inset-0 flex items-center justify-center"
            animate={{ scale: [1, 1.1, 1], opacity: [0.4, 0.7, 0.4] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-indigo-700 rounded-full blur-xl" />
          </motion.div>
        </div>

        {/* Typewriter text */}
        <div className="mt-8 text-center">
          <p className="text-purple-300 text-lg md:text-xl font-pixel">
            {displayedText}
            <span
              className="inline-block w-0.5 h-5 bg-purple-400 ml-1"
              style={{ animation: 'typewriter-cursor 0.7s steps(1) infinite' }}
            />
          </p>
        </div>
      </div>
    </>
  );
};

// ============================================================================
// SKELETON CARD (Pulsing Pixel Card Placeholder)
// ============================================================================

export const SkeletonCard: React.FC<SkeletonCardProps> = ({ className = '' }) => {
  return (
    <>
      <style>{spinnerKeyframes}</style>
      <div
        className={`relative overflow-hidden bg-rune-purple rounded-lg border border-sigil-border ${className}`}
        style={{ minHeight: '120px' }}
      >
        {/* Shimmer overlay */}
        <div
          className="absolute inset-0 bg-gradient-to-r from-transparent via-ghost-white/20 to-transparent"
          style={{
            animation: 'shimmer 2s infinite',
            backgroundSize: '200% 100%',
          }}
        />
        {/* Rune pattern background */}
        <div className="absolute inset-0 flex items-center justify-center opacity-30">
          <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 6v6l4 2" />
          </svg>
        </div>
      </div>
    </>
  );
};

// ============================================================================
// SKELETON TEXT (Pulsing Text Line Placeholder)
// ============================================================================

export const SkeletonText: React.FC<SkeletonTextProps> = ({
  width = '100%',
  className = ''
}) => {
  return (
    <>
      <style>{spinnerKeyframes}</style>
      <div
        className={`h-4 rounded bg-rune-purple overflow-hidden relative ${className}`}
        style={{ width, minWidth: '60px' }}
      >
        <div
          className="absolute inset-0 bg-gradient-to-r from-transparent via-ghost-white/15 to-transparent"
          style={{
            animation: 'shimmer 1.8s infinite',
            backgroundSize: '200% 100%',
          }}
        />
      </div>
    </>
  );
};

// ============================================================================
// BUTTON SPINNER (Small Spinning Rune Icon)
// ============================================================================

export const ButtonSpinner: React.FC<ButtonSpinnerProps> = ({ className = '' }) => {
  return (
    <>
      <style>{spinnerKeyframes}</style>
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={`text-ghost-white ${className}`}
        style={{ animation: 'spin-rune 1s linear infinite' }}
      >
        <circle cx="12" cy="12" r="10" />
        <path d="M12 6v6l4 2" />
      </svg>
    </>
  );
};

// ============================================================================
// INLINE LOADER (Bouncing Pixel Dots)
// ============================================================================

export const InlineLoader: React.FC<InlineLoaderProps> = ({ className = '' }) => {
  return (
    <>
      <style>{spinnerKeyframes}</style>
      <div className={`flex gap-1 ${className}`}>
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="w-2 h-2 bg-purple-400 rounded-sm"
            animate={{ y: [0, -6, 0] }}
            transition={{
              duration: 0.5,
              repeat: Infinity,
              delay: i * 0.15,
              ease: 'easeInOut',
            }}
          />
        ))}
      </div>
    </>
  );
};

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  FullPageLoader,
  SkeletonCard,
  SkeletonText,
  ButtonSpinner,
  InlineLoader,
};
