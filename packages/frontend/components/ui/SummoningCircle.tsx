"use client";

import { motion } from "framer-motion";

export function SummoningCircle({ active = false, size = 400 }: { active?: boolean; size?: number }) {
  const runeChars = "ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛋᛏᛒᛖᛗᛚᛝᛞᛟ";
  
  return (
    <div className="relative" style={{ width: size, height: size }}>
      {/* Outer glow */}
      <div 
        className="absolute inset-0 rounded-full"
        style={{
          background: `radial-gradient(circle, ${active ? '#ff336622' : '#9b59b611'} 0%, transparent 70%)`,
        }}
      />
      
      {/* Outer ring */}
      <motion.svg
        viewBox="0 0 400 400"
        className="absolute inset-0"
        animate={{ rotate: 360 }}
        transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
      >
        <circle cx="200" cy="200" r="190" fill="none" stroke="#3a2850" strokeWidth="2" strokeDasharray="4 8" />
        <circle cx="200" cy="200" r="180" fill="none" stroke={active ? "#ff3366" : "#3a2850"} strokeWidth="1" />
        
        {/* Rune positions around outer ring */}
        {Array.from({ length: 12 }).map((_, i) => {
          const angle = (i * 30 - 90) * (Math.PI / 180);
          const x = 200 + 170 * Math.cos(angle);
          const y = 200 + 170 * Math.sin(angle);
          return (
            <text
              key={i}
              x={x}
              y={y}
              textAnchor="middle"
              dominantBaseline="middle"
              fill={active ? "#ffd700" : "#3a2850"}
              fontSize="14"
              fontFamily="serif"
              opacity={active ? 1 : 0.5}
            >
              {runeChars[i % runeChars.length]}
            </text>
          );
        })}
      </motion.svg>
      
      {/* Inner ring - counter rotate */}
      <motion.svg
        viewBox="0 0 400 400"
        className="absolute inset-0"
        animate={{ rotate: -360 }}
        transition={{ duration: 45, repeat: Infinity, ease: "linear" }}
      >
        <circle cx="200" cy="200" r="140" fill="none" stroke={active ? "#9b59b6" : "#231832"} strokeWidth="1" strokeDasharray="2 6" />
        
        {/* Sigil triangles */}
        <polygon
          points="200,70 310,270 90,270"
          fill="none"
          stroke={active ? "#ff336666" : "#3a285033"}
          strokeWidth="1"
        />
        <polygon
          points="200,330 90,130 310,130"
          fill="none"
          stroke={active ? "#ff336666" : "#3a285033"}
          strokeWidth="1"
        />
      </motion.svg>
      
      {/* Center pentacle */}
      <motion.svg
        viewBox="0 0 400 400"
        className="absolute inset-0"
        animate={{ rotate: 360 }}
        transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
      >
        <circle cx="200" cy="200" r="80" fill="none" stroke={active ? "#ffd700" : "#3a2850"} strokeWidth="1" />
        
        {/* Star points */}
        {Array.from({ length: 5 }).map((_, i) => {
          const outerAngle = (i * 72 - 90) * (Math.PI / 180);
          const innerAngle = ((i * 72 + 36) - 90) * (Math.PI / 180);
          const ox = 200 + 80 * Math.cos(outerAngle);
          const oy = 200 + 80 * Math.sin(outerAngle);
          const ix = 200 + 35 * Math.cos(innerAngle);
          const iy = 200 + 35 * Math.sin(innerAngle);
          const nextOuter = ((i + 1) % 5 * 72 - 90) * (Math.PI / 180);
          const nox = 200 + 80 * Math.cos(nextOuter);
          const noy = 200 + 80 * Math.sin(nextOuter);
          return (
            <polygon
              key={i}
              points={`${ox},${oy} ${ix},${iy} ${nox},${noy}`}
              fill="none"
              stroke={active ? "#ffd70088" : "#3a285044"}
              strokeWidth="1"
            />
          );
        })}
        
        {/* Center dot */}
        <circle cx="200" cy="200" r="4" fill={active ? "#ff3366" : "#3a2850"} />
      </motion.svg>
      
      {/* Pulsing glow when active */}
      {active && (
        <motion.div
          className="absolute inset-0 rounded-full"
          animate={{ opacity: [0.1, 0.3, 0.1] }}
          transition={{ duration: 2, repeat: Infinity }}
          style={{
            background: "radial-gradient(circle, #ff336633 0%, transparent 60%)",
          }}
        />
      )}
    </div>
  );
}
