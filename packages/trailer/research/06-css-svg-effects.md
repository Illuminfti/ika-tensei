# CSS/SVG Animation Techniques for React/Remotion Cinematic Effects

Research compiled for Ika Tensei trailer development. All techniques are implementable in React/Remotion.

---

## 1. Glitch/Distortion Effects (RGB Split, Noise, Scan Lines)

### CSS Text Glitch Effect (Clip-Path Method)

The classic glitch effect uses three copies of text with pseudo-elements, offset positions, and animated clip-paths.

```tsx
// React/Remotion component
const GlitchText = ({ text, className = "" }: { text: string; className?: string }) => {
  return (
    <div className={`glitch ${className}`} data-text={text}>
      {text}
    </div>
  );
};

// CSS (can be used in styled-components, CSS modules, or Tailwind)
const glitchCSS = `
.glitch {
  position: relative;
  color: white;
  font-size: 4rem;
  font-weight: bold;
  text-transform: uppercase;
}

.glitch::before,
.glitch::after {
  content: attr(data-text);
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: #0a0a0a; /* match background */
}

.glitch::before {
  left: 2px;
  text-shadow: -1px 0 #ff00c1;
  clip-path: inset(44% 0 61% 0);
  animation: glitch-anim-1 2s infinite linear alternate-reverse;
}

.glitch::after {
  left: -2px;
  text-shadow: -1px 0 #00fff9;
  clip-path: inset(50% 0 30% 0);
  animation: glitch-anim-2 2.5s infinite linear alternate-reverse;
}

@keyframes glitch-anim-1 {
  0% { clip-path: inset(40% 0 61% 0); }
  20% { clip-path: inset(92% 0 1% 0); }
  40% { clip-path: inset(43% 0 1% 0); }
  60% { clip-path: inset(25% 0 58% 0); }
  80% { clip-path: inset(54% 0 7% 0); }
  100% { clip-path: inset(58% 0 43% 0); }
}

@keyframes glitch-anim-2 {
  0% { clip-path: inset(20% 0 80% 0); }
  20% { clip-path: inset(60% 0 10% 0); }
  40% { clip-path: inset(40% 0 50% 0); }
  60% { clip-path: inset(80% 0 5% 0); }
  80% { clip-path: inset(10% 0 70% 0); }
  100% { clip-path: inset(30% 0 20% 0); }
}
`;
```

### RGB Split with text-shadow

A simpler chromatic aberration-style glitch:

```tsx
const RGBGlitch = ({ text }: { text: string }) => {
  return (
    <span
      style={{
        color: "white",
        textShadow: `
          2px 0 #ff0000,
          -2px 0 #00ffff,
          4px 0 #00ff00,
          -4px 0 #ff00ff
        `,
        animation: "rgb-shimmer 0.3s infinite",
      }}
    >
      {text}
    </span>
  );
};

const keyframes = `
@keyframes rgb-shimmer {
  0%, 100% { text-shadow: 2px 0 #ff0000, -2px 0 #00ffff; }
  25% { text-shadow: -2px 0 #ff0000, 2px 0 #00ffff; }
  50% { text-shadow: 2px 2px #ff0000, -2px -2px #00ffff; }
  75% { text-shadow: -2px 2px #ff0000, 2px -2px #00ffff; }
}
`;
```

---

## 2. CRT Monitor Effects (Curvature, Scanlines, Phosphor Glow)

### Full CRT Overlay Component

```tsx
const CRTOverlay = () => {
  return (
    <div className="crt-overlay">
      <div className="scanlines" />
      <div className="screen-glow" />
    </div>
  );
};

const crtCSS = `
.crt-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  pointer-events: none;
  z-index: 9999;
}

/* Static scanlines */
.scanlines {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: linear-gradient(
    to bottom,
    rgba(255,255,255,0),
    rgba(255,255,255,0) 50%,
    rgba(0,0,0,0.2) 50%,
    rgba(0,0,0,0.2)
  );
  background-size: 100% 4px;
  animation: scanline-move 8s linear infinite;
}

/* Moving scanline beam */
.scanlines::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100px;
  background: linear-gradient(
    to bottom,
    rgba(255,255,255,0),
    rgba(255,255,255,0.1) 50%,
    rgba(255,255,255,0)
  );
  animation: scan-beam 6s linear infinite;
  opacity: 0.5;
}

@keyframes scanline-move {
  0% { background-position: 0 0; }
  100% { background-position: 0 100%; }
}

@keyframes scan-beam {
  0% { transform: translateY(-100%); }
  100% { transform: translateY(100vh); }
}

/* Screen flicker */
.screen-glow {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(18, 16, 16, 0.1);
  animation: flicker 0.15s infinite;
}

@keyframes flicker {
  0% { opacity: 0.95; }
  50% { opacity: 1; }
  100% { opacity: 0.92; }
}
`;
```

### CRT Curvature (Vignette + Barrel Distortion)

```tsx
const CRTContainer = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="crt-container">
      {children}
      <div className="crt-vignette" />
      <div className="crt-curve" />
    </div>
  );
};

const crtCurveCSS = `
.crt-container {
  position: relative;
  overflow: hidden;
}

/* Vignette darkening at edges */
.crt-vignette {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: radial-gradient(
    circle at center,
    transparent 50%,
    rgba(0,0,0,0.4) 100%
  );
  pointer-events: none;
}

/* Screen curvature effect */
.crt-curve {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  box-shadow: inset 0 0 100px rgba(0,0,0,0.9);
  pointer-events: none;
}
`;
```

---

## 3. SVG Path Morphing for Smooth Shape Transitions

### Using Framer Motion for SVG Morph

```tsx
import { motion } from "framer-motion";

const morphPaths = {
  circle: "M50,5 A45,45 0 1,1 50,95 A45,45 0 1,1 50,5",
  star: "M50,5 L61,35 L95,35 L68,55 L79,85 L50,65 L21,85 L32,55 L5,35 L39,35 Z",
  diamond: "M50,5 L95,50 L50,95 L5,50 Z",
};

const MorphingShape = () => {
  return (
    <svg viewBox="0 0 100 100" width="200" height="200">
      <motion.path
        d={morphPaths.circle}
        fill="#ff6b6b"
        initial={false}
        animate={{ d: morphPaths.star }}
        transition={{ duration: 0.8, ease: "easeInOut" }}
      />
    </svg>
  );
};
```

### Custom React Hook for Path Interpolation

```tsx
import { useState, useEffect } from "react";

const usePathMorph = (
  paths: string[],
  duration: number = 1000
) => {
  const [pathIndex, setPathIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setPathIndex((prev) => (prev + 1) % paths.length);
    }, duration);
    return () => clearInterval(interval);
  }, [paths.length, duration]);

  return paths[pathIndex];
};

// Usage
const AnimatedSeal = () => {
  const path = usePathMorph([
    "M50,10 L90,90 L10,90 Z", // triangle
    "M50,10 C80,10 90,40 90,50 C90,80 50,90 50,90 C50,90 10,80 10,50 C10,40 20,10 50,10", // modified
    "M50,10 L90,50 L50,90 L10,50 Z", // diamond
  ], 2000);

  return (
    <svg viewBox="0 0 100 100">
      <motion.path d={path} animate={{ d: path }} />
    </svg>
  );
};
```

---

## 4. Canvas-Based Particle Systems in React

### Particle System Hook

```tsx
import { useRef, useEffect, useCallback } from "react";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
}

const useParticleSystem = (
  canvasRef: React.RefObject<HTMLCanvasElement>,
  particleCount: number = 100
) => {
  const particlesRef = useRef<Particle[]>([]);
  const animationRef = useRef<number>();

  const createParticle = useCallback((width: number, height: number): Particle => ({
    x: Math.random() * width,
    y: Math.random() * height,
    vx: (Math.random() - 0.5) * 2,
    vy: (Math.random() - 0.5) * 2,
    life: 0,
    maxLife: 100 + Math.random() * 100,
    size: Math.random() * 3 + 1,
    color: `hsl(${Math.random() * 60 + 180}, 100%, 70%)`, // cyan to blue
  }), []);

  const update = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear with fade effect
    ctx.fillStyle = "rgba(0, 0, 0, 0.1)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Update and draw particles
    particlesRef.current.forEach((p, i) => {
      p.x += p.vx;
      p.y += p.vy;
      p.life++;

      if (p.life > p.maxLife || p.x < 0 || p.x > canvas.width || p.y < 0 || p.y > canvas.height) {
        particlesRef.current[i] = createParticle(canvas.width, canvas.height);
      }

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = 1 - p.life / p.maxLife;
      ctx.fill();
      ctx.globalAlpha = 1;
    });

    animationRef.current = requestAnimationFrame(update);
  }, [canvasRef, createParticle]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Initialize particles
    particlesRef.current = Array.from(
      { length: particleCount },
      () => createParticle(canvas.width, canvas.height)
    );

    animationRef.current = requestAnimationFrame(update);

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [canvasRef, particleCount, createParticle, update]);

  return particlesRef;
};

// Component usage
const StarField = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useParticleSystem(canvasRef, 200);

  return (
    <canvas
      ref={canvasRef}
      width={1920}
      height={1080}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        background: "#000",
      }}
    />
  );
};
```

---

## 5. Shader-Like Effects Using CSS Filters & Blend Modes

### Film Grain + Color Grading

```tsx
const FilmGrainOverlay = () => {
  return <div className="film-grain" />;
};

const filmGrainCSS = `
.film-grain {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 9998;
  opacity: 0.08;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");
  animation: grain 0.5s steps(10) infinite;
}

@keyframes grain {
  0%, 100% { transform: translate(0, 0); }
  10% { transform: translate(-5%, -10%); }
  20% { transform: translate(-15%, 5%); }
  30% { transform: translate(7%, -25%); }
  40% { transform: translate(-5%, 25%); }
  50% { transform: translate(-15%, 10%); }
  60% { transform: translate(15%, 0%); }
  70% { transform: translate(0%, 15%); }
  80% { transform: translate(3%, 35%); }
  90% { transform: translate(-10%, 10%); }
}
`;
```

### CSS Blend Mode Effects

```tsx
// Layered compositing for cinematic look
const CinematicLayer = () => {
  return (
    <div className="cinematic-stack">
      <div className="background-layer" />
      <div className="content-layer" style={{ mixBlendMode: "screen" }} />
      <div className="glow-layer" style={{ mixBlendMode: "lighten" }} />
    </div>
  );
};

const blendModesCSS = `
.cinematic-stack {
  position: relative;
}

.background-layer {
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
}

.content-layer {
  /* Contents will blend with background */
}

.glow-layer {
  background: radial-gradient(circle at 50% 50%, rgba(255,100,100,0.3), transparent 70%);
}
`;
```

---

## 6. Text Scramble/Decode Animation (Matrix-Style)

### React Text Scramble Component

```tsx
import { useState, useEffect, useRef } from "react";

const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()";

const useTextScramble = (text: string, duration: number = 30) => {
  const [displayText, setDisplayText] = useState(text);
  const frameRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);

  useEffect(() => {
    let mounted = true;
    
    const scramble = (timestamp: number) => {
      if (!startTimeRef.current) startTimeRef.current = timestamp;
      const progress = timestamp - startTimeRef.current;
      const frame = Math.floor(progress / duration);

      if (frame > frameRef.current) {
        frameRef.current = frame;
        
        const scrambled = text
          .split("")
          .map((char, i) => {
            if (i < frame / 3) return char; // Reveal progressively
            return chars[Math.floor(Math.random() * chars.length)];
          })
          .join("");
        
        if (mounted) setDisplayText(scrambled);
      }

      if (frame / 3 < text.length && mounted) {
        requestAnimationFrame(scramble);
      } else if (mounted) {
        setDisplayText(text); // Ensure final state
      }
    };

    frameRef.current = 0;
    startTimeRef.current = 0;
    requestAnimationFrame(scramble);

    return () => { mounted = false; };
  }, [text, duration]);

  return displayText;
};

// Component
const ScrambleText = ({ text }: { text: string }) => {
  const scrambledText = useTextScramble(text);
  return <span style={{ fontFamily: "monospace" }}>{scrambledText}</span>;
};

// Usage
const MatrixReveal = () => {
  return (
    <div>
      <ScrambleText text="SYSTEM BREACH" />
    </div>
  );
};
```

---

## 7. Chromatic Aberration Using CSS text-shadow

### Simple RGB Offset Effect

```tsx
const ChromaticText = ({ text, offset = 3 }: { text: string; offset?: number }) => {
  return (
    <span
      className="chromatic-text"
      style={{
        "--offset": `${offset}px`,
      } as React.CSSProperties}
    >
      {text}
    </span>
  );
};

const chromaticCSS = `
.chromatic-text {
  color: white;
  position: relative;
  text-shadow: 
    var(--offset) 0 0 rgba(255, 0, 0, 0.8),
    calc(var(--offset) * -1) 0 0 rgba(0, 255, 255, 0.8),
    0 0 10px rgba(255, 255, 255, 0.3);
  animation: chromatic-pulse 3s ease-in-out infinite;
}

@keyframes chromatic-pulse {
  0%, 100% {
    text-shadow: 
      3px 0 0 rgba(255, 0, 0, 0.8),
      -3px 0 0 rgba(0, 255, 255, 0.8);
  }
  50% {
    text-shadow: 
      5px 0 0 rgba(255, 0, 0, 0.5),
      -5px 0 0 rgba(0, 255, 255, 0.5);
  }
}
`;
```

### Chromatic Aberration on Images

```tsx
const ChromaticImage = ({ src, alt }: { src: string; alt: string }) => {
  return (
    <div className="chromatic-image-container">
      <img src={src} alt={alt} className="chromatic-base" />
      <img src={src} alt={alt} className="chromatic-red" />
      <img src={src} alt={alt} className="chromatic-cyan" />
    </div>
  );
};

const chromaticImageCSS = `
.chromatic-image-container {
  position: relative;
  display: inline-block;
}

.chromatic-image-container img {
  display: block;
  width: 100%;
  height: auto;
}

.chromatic-base {
  position: relative;
  z-index: 1;
}

.chromatic-red {
  position: absolute;
  top: 0;
  left: 0;
  z-index: 2;
  mix-blend-mode: screen;
  filter: url(#chromatic-red-filter);
}

.chromatic-cyan {
  position: absolute;
  top: 0;
  left: 0;
  z-index: 3;
  mix-blend-mode: screen;
  filter: url(#chromatic-cyan-filter);
}

/* SVG filter definition to add to your JSX */
const svgFilters = `
<svg style={{ position: 'absolute', width: 0, height: 0 }}>
  <defs>
    <filter id="chromatic-red-filter">
      <feColorMatrix type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" />
      <feOffset dx="-4" dy="0" />
    </filter>
    <filter id="chromatic-cyan-filter">
      <feColorMatrix type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1 0" />
      <feOffset dx="4" dy="0" />
    </filter>
  </defs>
</svg>
`;
`;
```

---

## Summary: Recommended Stack for Ika Tensei Trailer

| Effect | Implementation | Library/Approach |
|--------|----------------|------------------|
| Glitch text | CSS clip-path + pseudo-elements | Pure CSS or Framer Motion |
| CRT overlay | Fixed position div with animations | Pure CSS |
| SVG morphing | Framer Motion `d` prop | framer-motion |
| Particle system | Canvas + useRef | Custom hook |
| Film grain | CSS background image with SVG noise | Pure CSS |
| Text scramble | requestAnimationFrame | Custom hook |
| Chromatic aberration | text-shadow + mix-blend-mode | Pure CSS |

### Integration with Remotion

All these effects work in Remotion because Remotion is React. Use:
- `useAnimatedValue` / `useAnimationFrame` for time-based effects
- CSS keyframes work directly in Remotion `<Preload>` or styled components
- Canvas effects can be rendered in `<Canvas>` component from `@remotion/three` or native `<canvas>`

---

*Research compiled: 2026-02-18*
