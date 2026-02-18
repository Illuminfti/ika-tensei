"use client";

import { useState, useEffect } from "react";
import { IkaSprite } from "./PixelSprite";

interface DialogueBoxProps {
  text: string;
  speaker?: string;
  portrait?: "excited" | "worried" | "neutral" | "smug";
  onComplete?: () => void;
  speed?: number;
}

export function DialogueBox({ text, speaker = "Ika", portrait = "neutral", onComplete, speed = 30 }: DialogueBoxProps) {
  const [displayedText, setDisplayedText] = useState("");
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    setDisplayedText("");
    setIsComplete(false);
    let i = 0;
    const interval = setInterval(() => {
      if (i < text.length) {
        setDisplayedText(text.slice(0, i + 1));
        i++;
      } else {
        setIsComplete(true);
        clearInterval(interval);
        onComplete?.();
      }
    }, speed);
    return () => clearInterval(interval);
  }, [text, speed, onComplete]);

  return (
    <div className="dialogue-box max-w-2xl mx-auto">
      {/* Speaker name tag */}
      <div className="absolute -top-3 left-4 bg-ritual-dark px-3 py-1 border border-sigil-border">
        <span className="font-pixel text-[10px] text-ritual-gold">{speaker}</span>
      </div>
      
      <div className="flex gap-5 items-start pt-2">
        {/* Pixel art portrait */}
        <div className="flex-shrink-0 bg-card-purple border border-sigil-border p-2 relative">
          <IkaSprite size={48} expression={portrait} />
          {/* Portrait frame corners */}
          <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-ritual-gold" />
          <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-ritual-gold" />
          <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-ritual-gold" />
          <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-ritual-gold" />
        </div>
        
        {/* Text area */}
        <div className="flex-1 min-h-[60px]">
          <p className="font-silk text-sm leading-relaxed text-ghost-white">
            {displayedText}
            {!isComplete && <span className="typewriter-cursor" />}
          </p>
          {isComplete && (
            <div className="mt-2 text-right">
              <span className="font-pixel text-[8px] text-faded-spirit animate-pulse">▼</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
