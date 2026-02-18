"use client";

import { useEffect, useState } from "react";

interface StatsCounterProps {
  target: number;
  label: string;
  icon: string;
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
    <div className="flex items-center gap-2 font-pixel">
      <span className="text-lg">{icon}</span>
      <div>
        <div className="text-ritual-gold text-sm">{count.toLocaleString()}</div>
        <div className="text-faded-spirit text-[10px]">{label}</div>
      </div>
    </div>
  );
}
