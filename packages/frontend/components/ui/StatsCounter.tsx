"use client";

import { useEffect, useState, ReactNode } from "react";

interface StatsCounterProps {
  target: number;
  label: string;
  icon: ReactNode;
  duration?: number;
}

export function StatsCounter({ target, label, icon, duration = 2000 }: StatsCounterProps) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const steps = 60;
    const increment = target / steps;
    let current = 0;
    const interval = setInterval(() => {
      current += increment;
      if (current >= target) {
        setCount(target);
        clearInterval(interval);
      } else {
        setCount(Math.floor(current));
      }
    }, duration / steps);
    return () => clearInterval(interval);
  }, [target, duration]);

  return (
    <div className="flex items-center gap-3">
      <div className="opacity-60">{icon}</div>
      <div>
        <div className="font-pixel text-sm text-ritual-gold text-glow-gold">{count.toLocaleString()}</div>
        <div className="font-silk text-[10px] text-faded-spirit">{label}</div>
      </div>
    </div>
  );
}
