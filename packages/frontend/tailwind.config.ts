import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        "void-purple": "#0d0a1a",
        "ritual-dark": "#1a1025",
        "card-purple": "#231832",
        "sigil-border": "#3a2850",
        "ghost-white": "#e8e0f0",
        "faded-spirit": "#8a7a9a",
        "blood-pink": "#ff3366",
        "ritual-gold": "#ffd700",
        "mystic-purple": "#9b59b6",
        "spectral-green": "#00ff88",
        "demon-red": "#ff4444",
        "soul-cyan": "#00ccff",
      },
      fontFamily: {
        pixel: ['"Press Start 2P"', "monospace"],
        silk: ['"Silkscreen"', "monospace"],
        jp: ['"Noto Sans JP"', "sans-serif"],
        mono: ['"JetBrains Mono"', "monospace"],
      },
      animation: {
        "pulse-glow": "pulse-glow 2s ease-in-out infinite",
        "float": "float 3s ease-in-out infinite",
        "typewriter": "typewriter 0.05s steps(1) infinite",
      },
      keyframes: {
        "pulse-glow": {
          "0%, 100%": { boxShadow: "0 0 5px #ff3366, 0 0 10px #ff336644" },
          "50%": { boxShadow: "0 0 15px #ff3366, 0 0 30px #ff336666" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-10px)" },
        },
      },
    },
  },
  plugins: [],
};
export default config;
