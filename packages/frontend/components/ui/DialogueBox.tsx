"use client";

import { useState, useEffect } from "react";

interface DialogueBoxProps {
  text: string;
  speaker?: string;
  portrait?: "excited" | "worried" | "neutral" | "smug";
  onComplete?: () => void;
  speed?: number;
}

const PORTRAITS: Record<string, string> = {
  excited: "🦑✨",
  worried: "🦑💦",
  neutral: "🦑",
  smug: "🦑💜",
};

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
    <div className="nes-container is-dark with-title max-w-2xl mx-auto">
      <p className="title font-pixel text-ritual-gold text-xs">{speaker}</p>
      <div className="flex gap-4 items-start">
        <div className="text-4xl flex-shrink-0 animate-float">
          {PORTRAITS[portrait]}
        </div>
        <div className="flex-1">
          <p className="font-silk text-sm leading-relaxed text-ghost-white">
            {displayedText}
            {!isComplete && <span className="typewriter-cursor" />}
          </p>
        </div>
      </div>
    </div>
  );
}
