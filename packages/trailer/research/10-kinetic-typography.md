# 10. Kinetic Typography — Research & Code Reference

> How to make "イカ転生" look INSANELY cool on screen.
> Compiled 2026-02-18 for the Ika Tensei trailer system.

---

## Overview

Kinetic typography is the art of making text move in ways that carry emotional weight.
For a trailer — where every frame must hit — text animation is *the* cinematic tool.
This doc covers every major technique with copy-paste-ready implementations.

**Stack assumptions:** React + Framer Motion + GSAP (optional). CSS custom properties throughout.

---

## Table of Contents

1. [Character-by-Character Reveal](#1-character-by-character-reveal)
2. [Text Scramble / Decode Effect](#2-text-scramble--decode-effect)
3. [Kanji Stroke-by-Stroke SVG Reveal](#3-kanji-stroke-by-stroke-svg-reveal)
4. [Scale + Blur + Opacity Dramatic Entrance](#4-scale--blur--opacity-dramatic-entrance)
5. [Split Text — Words Flying In](#5-split-text--words-flying-in)
6. [Text With Particle Trails](#6-text-with-particle-trails)
7. [Neon / Glow Text Pulse](#7-neon--glow-text-pulse)
8. [Making "イカ転生" Look Insane — Full Sequence](#8-making-イカ転生-look-insane--full-sequence)
9. [Compositing & Timing Choreography](#9-compositing--timing-choreography)
10. [Tooling Quick Reference](#10-tooling-quick-reference)

---

## 1. Character-by-Character Reveal

### Core Principle
Split text into individual `<span>` nodes. Stagger their entrance with `animation-delay` or Framer Motion's `staggerChildren`. Each character gets its own entrance physics.

### The Classic Stagger (CSS)

```css
/* Base: each char starts invisible, shifted down */
.char {
  display: inline-block;
  opacity: 0;
  transform: translateY(20px);
  animation: charReveal 0.5s ease forwards;
}

@keyframes charReveal {
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

```jsx
// React component — splits any string into staggered chars
export function StaggerReveal({ text, delayPerChar = 0.04, startDelay = 0 }) {
  return (
    <span aria-label={text}>
      {text.split('').map((char, i) => (
        <span
          key={i}
          className="char"
          style={{
            animationDelay: `${startDelay + i * delayPerChar}s`,
            // preserve spaces
            display: char === ' ' ? 'inline' : 'inline-block',
          }}
        >
          {char === ' ' ? '\u00A0' : char}
        </span>
      ))}
    </span>
  );
}
```

### Framer Motion Variant (production-grade)

```jsx
import { motion } from 'framer-motion';

const containerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.1,
    },
  },
};

const charVariants = {
  hidden: {
    opacity: 0,
    y: 40,
    rotateX: -90,
  },
  visible: {
    opacity: 1,
    y: 0,
    rotateX: 0,
    transition: {
      type: 'spring',
      damping: 12,
      stiffness: 200,
    },
  },
};

export function MotionText({ text }) {
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      style={{ perspective: 400 }}
    >
      {text.split('').map((char, i) => (
        <motion.span
          key={i}
          variants={charVariants}
          style={{ display: 'inline-block' }}
        >
          {char === ' ' ? '\u00A0' : char}
        </motion.span>
      ))}
    </motion.div>
  );
}
```

### Timing Variations for Different Moods

| Effect | staggerChildren | damping | stiffness | Feel |
|--------|----------------|---------|-----------|------|
| Crisp action | 0.03 | 20 | 400 | Fast, sharp |
| Dramatic reveal | 0.08 | 10 | 100 | Slow, weighty |
| Bouncy playful | 0.05 | 8 | 150 | Energetic |
| Cinematic drop | 0.06 | 15 | 80 | Epic |
| **イカ style** | 0.07 | 12 | 120 | Mysterious, deliberate |

---

## 2. Text Scramble / Decode Effect

### Core Principle
While revealing text left-to-right, characters that haven't settled yet cycle through random glyphs.
The "lock in" moment is deeply satisfying. Used in sci-fi UIs, game trailers, hacker aesthetics.

### Pure JavaScript TextScrambler Class

```typescript
// scramble.ts — no dependencies, works with any DOM element
const CHARS = {
  latin: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*',
  katakana: 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン',
  kanji: '転生魂力斬撃烈炎氷嵐影光闇剣盾術技奥義秘伝極意境界',
  symbols: '░▒▓█▄▀■□▪▫▬▭▮▯△▲▷▽▼◁◀★☆♦♣♠♥',
  mixed: 'イカ転生!@#░▒▓アイウ0123456789',
};

interface ScrambleOptions {
  chars?: string;
  revealSpeed?: number; // chars revealed per frame
  scrambleSpeed?: number; // how fast random chars cycle (ms between updates)
  onComplete?: () => void;
}

export class TextScrambler {
  private el: HTMLElement;
  private chars: string;
  private queue: Array<{
    from: string;
    to: string;
    start: number;
    end: number;
    char?: string;
  }> = [];
  private frameReq: number = 0;
  private frame = 0;
  private resolve: (() => void) | null = null;

  constructor(el: HTMLElement, chars = CHARS.mixed) {
    this.el = el;
    this.chars = chars;
  }

  setText(newText: string): Promise<void> {
    const oldText = this.el.innerText;
    const length = Math.max(oldText.length, newText.length);
    const promise = new Promise<void>((resolve) => (this.resolve = resolve));

    this.queue = [];
    for (let i = 0; i < length; i++) {
      const from = oldText[i] || '';
      const to = newText[i] || '';
      // characters near the start of the string reveal sooner
      const start = Math.floor(Math.random() * 10);
      const end = start + Math.floor(Math.random() * 10);
      this.queue.push({ from, to, start, end });
    }

    cancelAnimationFrame(this.frameReq);
    this.frame = 0;
    this.update();
    return promise;
  }

  private update = () => {
    let output = '';
    let complete = 0;

    for (let i = 0, n = this.queue.length; i < n; i++) {
      let { from, to, start, end, char } = this.queue[i];

      if (this.frame >= end) {
        complete++;
        output += to;
      } else if (this.frame >= start) {
        if (!char || Math.random() < 0.28) {
          char = this.randomChar();
          this.queue[i].char = char;
        }
        output += `<span class="scramble-deco">${char}</span>`;
      } else {
        output += from;
      }
    }

    this.el.innerHTML = output;

    if (complete === this.queue.length) {
      this.resolve?.();
    } else {
      this.frameReq = requestAnimationFrame(this.update);
      this.frame++;
    }
  };

  private randomChar() {
    return this.chars[Math.floor(Math.random() * this.chars.length)];
  }
}
```

```css
/* Style the mid-scramble characters differently */
.scramble-deco {
  color: #00ffcc;
  opacity: 0.7;
  font-weight: 300;
}
```

```jsx
// React hook wrapper
import { useEffect, useRef } from 'react';
import { TextScrambler } from './scramble';

export function useScramble(text: string, chars?: string) {
  const elRef = useRef<HTMLSpanElement>(null);
  const scramblerRef = useRef<TextScrambler | null>(null);

  useEffect(() => {
    if (!elRef.current) return;
    if (!scramblerRef.current) {
      scramblerRef.current = new TextScrambler(elRef.current, chars);
    }
    scramblerRef.current.setText(text);
  }, [text]);

  return elRef;
}

// Usage:
// const ref = useScramble('イカ転生');
// <span ref={ref} className="title-text" />
```

### Katakana-Specific Scramble (for イカ転生)

```typescript
// Special version — scrambles through katakana before revealing
// Makes the Japanese title feel like it's being "decoded" from the void

const IKA_CHARS = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホイカ転生魂力';

export async function revealIkaTensei(el: HTMLElement) {
  const scrambler = new TextScrambler(el, IKA_CHARS);
  
  // Start with noise
  el.innerText = '　　　　'; // 4 ideographic spaces
  
  // Phase 1: scramble chaos (500ms)
  await new Promise(r => setTimeout(r, 100));
  
  // Phase 2: reveal with decode
  await scrambler.setText('イカ転生');
}
```

---

## 3. Kanji Stroke-by-Stroke SVG Reveal

### Core Principle
Convert kanji to SVG paths. Animate `stroke-dashoffset` from full path length → 0.
Each stroke "draws" itself. Combine with staggered timing for an ink-brush feel.

### SVG Path Animation — The Mechanism

```css
/* The core trick: SVG stroke animation */
.kanji-stroke {
  fill: none;
  stroke: #ffffff;
  stroke-width: 8;
  stroke-linecap: round;
  stroke-linejoin: round;
  
  /* Set dasharray = total path length, dashoffset = same (invisible) */
  stroke-dasharray: var(--path-length);
  stroke-dashoffset: var(--path-length);
  
  animation: drawStroke 0.8s ease forwards;
}

@keyframes drawStroke {
  to {
    stroke-dashoffset: 0;
  }
}
```

```jsx
// React SVG kanji component with measured path lengths
// Note: In production, pre-calculate path lengths or use getBoundingClientRect

export function KanjiDraw({ paths, strokeDelay = 0.15 }) {
  const pathRefs = useRef([]);

  useEffect(() => {
    // Measure actual path lengths and set CSS vars
    pathRefs.current.forEach((path, i) => {
      if (!path) return;
      const length = path.getTotalLength();
      path.style.setProperty('--path-length', `${length}px`);
      path.style.setProperty('stroke-dasharray', `${length}px`);
      path.style.setProperty('stroke-dashoffset', `${length}px`);
    });
  }, []);

  return (
    <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
      {paths.map((d, i) => (
        <path
          key={i}
          ref={el => pathRefs.current[i] = el}
          d={d}
          className="kanji-stroke"
          style={{
            animationDelay: `${i * strokeDelay}s`,
            animationFillMode: 'forwards',
          }}
        />
      ))}
    </svg>
  );
}
```

### Ink Brush Effect Enhancement

```css
/* After stroke draws, fill bleeds in like ink */
.kanji-char {
  position: relative;
}

.kanji-char .stroke-layer {
  /* Animated strokes on top */
  stroke: #e0e0e0;
  filter: url(#ink-blur);
}

.kanji-char .fill-layer {
  /* Solid fill bleeds in after stroke completes */
  fill: white;
  opacity: 0;
  animation: inkFill 0.4s ease forwards;
  animation-delay: var(--fill-delay);
}

@keyframes inkFill {
  from { opacity: 0; }
  to   { opacity: 1; }
}
```

```svg
<!-- SVG filter for ink texture -->
<defs>
  <filter id="ink-blur">
    <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" />
    <feDisplacementMap in="SourceGraphic" scale="3" />
  </filter>
  
  <filter id="ink-glow">
    <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="blur" />
    <feComposite in="SourceGraphic" in2="blur" operator="over" />
  </filter>
</defs>
```

### Getting Kanji SVG Paths

**Option A: KanjiVG database**
```bash
# KanjiVG has stroke-order SVGs for every kanji
# https://kanjivg.tagaini.net/
# Download: https://github.com/KanjiVG/kanjivg/releases

# For 転 (U+8EE2) → kanjivg/kanji/08ee2.svg
# For 生 (U+751F) → kanjivg/kanji/0751f.svg
# イ (U+30A4) → kanjivg/kanji/030a4.svg
# カ (U+30AB) → kanjivg/kanji/030ab.svg
```

**Option B: opentype.js path extraction**
```typescript
import opentype from 'opentype.js';

async function getGlyphPaths(fontPath: string, chars: string, size = 200) {
  const font = await opentype.load(fontPath);
  return chars.split('').map(char => {
    const glyph = font.charToGlyph(char);
    const path = glyph.getPath(0, size, size);
    return path.toSVG();
  });
}

// Usage with a Japanese font like Noto Serif JP
const paths = await getGlyphPaths('./NotoSerifJP-Bold.otf', 'イカ転生');
```

---

## 4. Scale + Blur + Opacity Dramatic Entrance

### Core Principle
Text slams in from extreme scale (10x) while blurred, then snaps to focus.
Or the opposite: starts tiny, sharp, and expands. Both feel cinematic.

### The "Slam In" Effect

```css
@keyframes slamIn {
  0% {
    opacity: 0;
    transform: scale(8);
    filter: blur(40px);
  }
  60% {
    opacity: 1;
    transform: scale(0.95);
    filter: blur(0px);
  }
  80% {
    transform: scale(1.02);
  }
  100% {
    opacity: 1;
    transform: scale(1);
    filter: blur(0px);
  }
}

.slam-text {
  animation: slamIn 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
```

### The "Focus Pull" Effect (blur-to-sharp)

```css
@keyframes focusPull {
  0% {
    opacity: 0.3;
    filter: blur(20px);
    letter-spacing: 0.5em;
  }
  100% {
    opacity: 1;
    filter: blur(0px);
    letter-spacing: 0.05em;
  }
}

.focus-text {
  animation: focusPull 1.2s cubic-bezier(0.4, 0, 0.2, 1) forwards;
}
```

### The "Shockwave" Entrance

```css
@keyframes shockwave {
  0% {
    opacity: 0;
    transform: scale(0.1) rotate(-5deg);
    filter: blur(60px) brightness(5);
    text-shadow: 0 0 100px #fff;
  }
  40% {
    opacity: 1;
    filter: blur(0px) brightness(1.5);
    text-shadow: 0 0 40px rgba(0, 255, 200, 0.8);
  }
  70% {
    transform: scale(1.05) rotate(0.5deg);
    text-shadow: 0 0 20px rgba(0, 255, 200, 0.4);
  }
  100% {
    opacity: 1;
    transform: scale(1) rotate(0deg);
    filter: blur(0px) brightness(1);
    text-shadow: 0 0 10px rgba(0, 255, 200, 0.2);
  }
}
```

### Framer Motion — Per-Word with Blur

```jsx
const wordVariants = {
  hidden: {
    opacity: 0,
    scale: 3,
    filter: 'blur(20px)',
    y: -20,
  },
  visible: (i: number) => ({
    opacity: 1,
    scale: 1,
    filter: 'blur(0px)',
    y: 0,
    transition: {
      delay: i * 0.12,
      duration: 0.7,
      ease: [0.16, 1, 0.3, 1], // expo out — snappy
    },
  }),
};

export function BlurReveal({ text }: { text: string }) {
  const words = text.split(' ');
  return (
    <motion.div initial="hidden" animate="visible" className="text-container">
      {words.map((word, i) => (
        <motion.span
          key={i}
          custom={i}
          variants={wordVariants}
          style={{ display: 'inline-block', marginRight: '0.25em' }}
        >
          {word}
        </motion.span>
      ))}
    </motion.div>
  );
}
```

---

## 5. Split Text — Words Flying In

### Core Principle
Each word (or character) has a completely independent entry vector.
Words can fly in from left/right/top/bottom, converge, and snap into place.
The asymmetry creates visual dynamism.

### Multi-Direction Split

```jsx
// Words fly in from different directions based on their position/index
const getDirection = (index: number, total: number) => {
  const patterns = [
    { x: -200, y: 0 },    // from left
    { x: 200, y: 0 },     // from right
    { x: 0, y: -150 },    // from top
    { x: 0, y: 150 },     // from bottom
    { x: -150, y: -100 }, // diagonal TL
    { x: 150, y: 100 },   // diagonal BR
  ];
  return patterns[index % patterns.length];
};

export function SplitFlyIn({ text, wordDelay = 0.08 }) {
  const words = text.split(' ');

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3em' }}
    >
      {words.map((word, i) => {
        const dir = getDirection(i, words.length);
        return (
          <motion.span
            key={i}
            initial={{
              opacity: 0,
              x: dir.x,
              y: dir.y,
              rotate: (Math.random() - 0.5) * 20,
            }}
            animate={{
              opacity: 1,
              x: 0,
              y: 0,
              rotate: 0,
            }}
            transition={{
              delay: i * wordDelay,
              type: 'spring',
              damping: 15,
              stiffness: 200,
              mass: 0.8,
            }}
            style={{ display: 'inline-block', fontWeight: 900 }}
          >
            {word}
          </motion.span>
        );
      })}
    </motion.div>
  );
}
```

### GSAP SplitText + Timeline Approach

```javascript
import gsap from 'gsap';
import SplitText from 'gsap/SplitText';

gsap.registerPlugin(SplitText);

function animateTitle(selector: string) {
  const el = document.querySelector(selector);
  const split = new SplitText(el, { type: 'words,chars' });

  const tl = gsap.timeline();

  // Words fly in from alternating sides
  split.words.forEach((word, i) => {
    const fromLeft = i % 2 === 0;
    tl.from(word, {
      x: fromLeft ? -300 : 300,
      y: (Math.random() - 0.5) * 100,
      rotation: (Math.random() - 0.5) * 30,
      opacity: 0,
      duration: 0.8,
      ease: 'power3.out',
    }, i * 0.1);
  });

  // Then chars shimmer
  tl.to(split.chars, {
    color: '#00ffcc',
    duration: 0.1,
    stagger: 0.02,
    yoyo: true,
    repeat: 1,
  }, '+=0.2');

  return tl;
}
```

---

## 6. Text With Particle Trails

### Core Principle
As text appears, particles burst from each character's position.
Or text leaves particle trails as it moves. Canvas + text mask = magic.

### Canvas Particle Burst on Text Reveal

```typescript
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

class TextParticleEffect {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private particles: Particle[] = [];
  private colors = ['#00ffcc', '#ff00aa', '#ffffff', '#7700ff'];

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
  }

  // Emit particles from a text position
  burst(x: number, y: number, count = 30) {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
      const speed = Math.random() * 4 + 1;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2, // upward bias
        life: 1,
        maxLife: 0.6 + Math.random() * 0.4,
        size: Math.random() * 4 + 1,
        color: this.colors[Math.floor(Math.random() * this.colors.length)],
      });
    }
  }

  // Emit particles along text bounds
  burstFromText(text: string, font: string, centerX: number, centerY: number) {
    const ctx = this.ctx;
    ctx.font = font;
    const width = ctx.measureText(text).width;
    const startX = centerX - width / 2;

    // Sample points along text baseline and above
    for (let i = 0; i < text.length; i++) {
      const charWidth = ctx.measureText(text[i]).width;
      const cx = startX + i * (width / text.length) + charWidth / 2;
      this.burst(cx, centerY, 15);
    }
  }

  update() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    this.particles = this.particles.filter(p => p.life > 0);

    for (const p of this.particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.15; // gravity
      p.vx *= 0.98; // drag
      p.life -= 1 / (60 * p.maxLife);

      const alpha = Math.max(0, p.life);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalAlpha = 1;
    requestAnimationFrame(() => this.update());
  }
}
```

### Text Mask + Particle Flow

```jsx
// Particles flow through the shape of the text using canvas masking

export function ParticleText({ text, fontSize = 120 }: { text: string; fontSize: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Draw text to get pixel data
    ctx.font = `900 ${fontSize}px "Noto Serif JP", serif`;
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imageData.data;

    // Collect text pixel positions
    const textPixels: Array<[number, number]> = [];
    for (let y = 0; y < canvas.height; y += 4) {
      for (let x = 0; x < canvas.width; x += 4) {
        const idx = (y * canvas.width + x) * 4;
        if (pixels[idx + 3] > 128) { // alpha channel
          textPixels.push([x, y]);
        }
      }
    }

    // Animate particles to text positions
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const particles = textPixels.map(([tx, ty]) => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      tx, ty,
      color: `hsl(${160 + Math.random() * 60}, 100%, ${60 + Math.random() * 30}%)`,
      size: 1.5 + Math.random(),
    }));

    let progress = 0;
    const animate = () => {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      progress = Math.min(1, progress + 0.012);
      const ease = 1 - Math.pow(1 - progress, 3); // cubic ease out

      for (const p of particles) {
        p.x += (p.tx - p.x) * 0.08;
        p.y += (p.ty - p.y) * 0.08;

        ctx.globalAlpha = ease;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }

      if (progress < 1) requestAnimationFrame(animate);
    };

    animate();
  }, [text, fontSize]);

  return <canvas ref={canvasRef} style={{ position: 'fixed', inset: 0 }} />;
}
```

---

## 7. Neon / Glow Text Pulse

### Core Principle
CSS `text-shadow` layered at different blur radii simulates neon tubes.
Animate the glow intensity for a "powering up" or "flickering" effect.

### The Full Neon Stack

```css
:root {
  --neon-primary: #00ffcc;    /* teal — Ika's color */
  --neon-secondary: #ff00aa;  /* magenta accent */
  --neon-white: #ffffff;
}

.neon-text {
  color: var(--neon-white);
  
  /* Layered shadows: each layer adds to the glow */
  text-shadow:
    /* Tight core */
    0 0 4px var(--neon-white),
    /* Inner neon */
    0 0 10px var(--neon-primary),
    0 0 20px var(--neon-primary),
    /* Mid glow */
    0 0 40px var(--neon-primary),
    0 0 80px var(--neon-primary),
    /* Outer bloom */
    0 0 120px rgba(0, 255, 200, 0.5);
}
```

### Neon Flicker — Powering Up

```css
@keyframes neonFlicker {
  0%, 100% {
    text-shadow:
      0 0 4px #fff,
      0 0 10px #00ffcc,
      0 0 20px #00ffcc,
      0 0 40px #00ffcc,
      0 0 80px #00ffcc;
    opacity: 1;
  }
  
  /* Flicker at specific frames */
  5% { opacity: 0.8; text-shadow: none; }
  10% { opacity: 1; }
  15% { opacity: 0.9; }
  
  30% {
    text-shadow:
      0 0 4px #fff,
      0 0 20px #00ffcc,
      0 0 60px #00ffcc;
  }
  
  /* Intense pulse */
  50% {
    text-shadow:
      0 0 4px #fff,
      0 0 10px #00ffcc,
      0 0 20px #00ffcc,
      0 0 40px #00ffcc,
      0 0 80px #00ffcc,
      0 0 120px #00ffcc,  /* extra range at peak */
      0 0 200px rgba(0, 255, 200, 0.3);
  }
  
  92% { opacity: 0.6; }
  94% { opacity: 1; }
  96% { opacity: 0.4; }
  98% { opacity: 1; }
}

.neon-power-on {
  animation: neonFlicker 2s ease-in-out forwards;
}
```

### Neon Pulse — Steady State

```css
@keyframes neonPulse {
  0%, 100% {
    text-shadow:
      0 0 4px #fff,
      0 0 10px #00ffcc,
      0 0 20px #00ffcc,
      0 0 40px #00ffcc;
  }
  50% {
    text-shadow:
      0 0 4px #fff,
      0 0 20px #00ffcc,
      0 0 40px #00ffcc,
      0 0 80px #00ffcc,
      0 0 120px rgba(0, 255, 200, 0.6);
  }
}

.neon-steady {
  animation: neonPulse 2.5s ease-in-out infinite;
}
```

### Dual-Color Neon (イカ teal + magenta)

```css
.neon-ika {
  /* Split character trick: teal on left, magenta on right via gradient */
  background: linear-gradient(135deg, #00ffcc 0%, #ffffff 50%, #ff00aa 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  
  /* The glow uses the colors blended */
  filter: drop-shadow(0 0 20px #00ffcc) drop-shadow(0 0 40px #7700ff);
  
  animation: ikaPulse 3s ease-in-out infinite;
}

@keyframes ikaPulse {
  0%, 100% { filter: drop-shadow(0 0 20px #00ffcc) drop-shadow(0 0 40px #7700ff); }
  50%       { filter: drop-shadow(0 0 40px #00ffcc) drop-shadow(0 0 80px #7700ff) drop-shadow(0 0 120px #ff00aa); }
}
```

---

## 8. Making "イカ転生" Look Insane — Full Sequence

### The Full Cinematic Sequence (3.5 seconds)

```
T+0.0s  — Black screen. Silence (or deep rumble starts).
T+0.3s  — Particle cloud assembles from center (chaos → convergence).
T+0.8s  — "イカ" slams in with shockwave. Frame flash (white).
T+1.2s  — "転生" draws stroke-by-stroke (kanji ink brush).
T+1.8s  — Both words glow. Scramble effect runs across all 4 chars briefly.
T+2.2s  — Chars settle. Neon teal glow stabilizes with slow pulse.
T+2.5s  — Tagline fades in below with stagger.
T+3.0s  — Everything breathes. Logo complete.
```

### Master Timeline Component

```tsx
import { useEffect, useRef, useState } from 'react';
import { motion, useAnimation, AnimatePresence } from 'framer-motion';

type Phase = 'idle' | 'particles' | 'ika' | 'tensei' | 'scramble' | 'settle' | 'complete';

export function IkaTenseiReveal({ onComplete }: { onComplete?: () => void }) {
  const [phase, setPhase] = useState<Phase>('idle');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ikaControls = useAnimation();
  const tenseiControls = useAnimation();

  useEffect(() => {
    const sequence = async () => {
      // Phase 1: Particles converge (0-800ms)
      setPhase('particles');
      await new Promise(r => setTimeout(r, 800));

      // Phase 2: イカ slams in
      setPhase('ika');
      await ikaControls.start({
        opacity: 1,
        scale: 1,
        filter: 'blur(0px)',
        transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] },
      });
      await new Promise(r => setTimeout(r, 400));

      // Phase 3: 転生 strokes draw in
      setPhase('tensei');
      await new Promise(r => setTimeout(r, 600));

      // Phase 4: Scramble pass
      setPhase('scramble');
      await new Promise(r => setTimeout(r, 400));

      // Phase 5: Settle
      setPhase('settle');
      await new Promise(r => setTimeout(r, 600));

      // Phase 6: Complete
      setPhase('complete');
      onComplete?.();
    };

    sequence();
  }, []);

  return (
    <div className="ika-reveal-container">
      {/* Particle layer */}
      <canvas ref={canvasRef} className="particle-canvas" />

      {/* Main title */}
      <div className="title-wrapper">
        {/* イカ — kana, slam in */}
        <motion.span
          className="ika-kana"
          initial={{ opacity: 0, scale: 8, filter: 'blur(40px)' }}
          animate={ikaControls}
        >
          イカ
        </motion.span>

        {/* 転生 — kanji, stroke reveal */}
        <AnimatePresence>
          {(phase === 'tensei' || phase === 'scramble' || phase === 'settle' || phase === 'complete') && (
            <KanjiReveal chars={['転', '生']} />
          )}
        </AnimatePresence>
      </div>

      {/* Tagline */}
      <AnimatePresence>
        {phase === 'complete' && (
          <motion.div
            className="tagline"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          >
            REINCARNATION PROTOCOL
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
```

### CSS for the イカ Title

```css
.ika-reveal-container {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100vh;
  background: #000;
  overflow: hidden;
}

.title-wrapper {
  display: flex;
  align-items: center;
  gap: 0.05em;
  font-family: 'Noto Serif JP', 'Yu Mincho', serif;
  font-size: clamp(80px, 15vw, 200px);
  font-weight: 900;
  letter-spacing: -0.02em;
}

.ika-kana {
  color: #ffffff;
  text-shadow:
    0 0 4px #fff,
    0 0 20px #00ffcc,
    0 0 40px #00ffcc,
    0 0 80px rgba(0, 255, 200, 0.5);
  
  /* Once settled, subtle animation */
  animation: ikaBreathe 4s ease-in-out infinite;
  animation-play-state: paused; /* start after sequence */
}

@keyframes ikaBreathe {
  0%, 100% {
    text-shadow:
      0 0 4px #fff,
      0 0 20px #00ffcc,
      0 0 40px #00ffcc;
    letter-spacing: -0.02em;
  }
  50% {
    text-shadow:
      0 0 4px #fff,
      0 0 20px #00ffcc,
      0 0 60px #00ffcc,
      0 0 100px rgba(0, 255, 200, 0.4);
    letter-spacing: 0em;
  }
}

.tagline {
  font-family: 'Orbitron', 'Space Mono', monospace;
  font-size: clamp(12px, 1.5vw, 18px);
  letter-spacing: 0.5em;
  text-transform: uppercase;
  color: rgba(0, 255, 200, 0.7);
  margin-top: 1.5em;
}

/* Flash effect when イカ hits */
.ika-flash {
  position: fixed;
  inset: 0;
  background: white;
  pointer-events: none;
  animation: flashOut 0.3s ease-out forwards;
}

@keyframes flashOut {
  0% { opacity: 0.8; }
  100% { opacity: 0; }
}
```

### The Most Cinematic Single-Effect: Convergence Scramble

```tsx
// This is THE money shot — particles converge, scramble, then lock in
export function IkaUltimateReveal() {
  const titleRef = useRef<HTMLDivElement>(null);
  const [showTitle, setShowTitle] = useState(false);
  const [scrambleText, setScrambleText] = useState('　　　　'); // blank
  const scramblerRef = useRef<TextScrambler | null>(null);

  useEffect(() => {
    // After particle animation (800ms), start scramble
    const t1 = setTimeout(() => {
      setShowTitle(true);
    }, 800);

    const t2 = setTimeout(async () => {
      if (!titleRef.current) return;
      
      // Initialize scrambler with katakana + kanji char set
      const charSet = 'アイウエオカキクケサシスセソタチツテトナニヌネノ転生魂力闇光';
      const scrambler = new TextScrambler(titleRef.current, charSet);
      scramblerRef.current = scrambler;

      // Set initial noise text
      titleRef.current.innerText = 'アアアア';

      // Scramble-reveal to final text
      await scrambler.setText('イカ転生');
    }, 900);

    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  return (
    <motion.div
      ref={titleRef}
      initial={{ opacity: 0 }}
      animate={showTitle ? { opacity: 1 } : {}}
      transition={{ duration: 0.1 }}
      className="ika-ultimate-title"
    />
  );
}
```

---

## 9. Compositing & Timing Choreography

### Layer Stack (z-index architecture)

```
z-index 10: Particle canvas (additive blend)
z-index 20: SVG kanji strokes
z-index 30: Kana text (イカ)
z-index 40: Glow overlay (mix-blend-mode: screen)
z-index 50: Flash layer
z-index 60: Tagline
```

```css
.glow-overlay {
  position: fixed;
  inset: 0;
  background: radial-gradient(
    ellipse at center,
    rgba(0, 255, 200, 0.15) 0%,
    transparent 70%
  );
  mix-blend-mode: screen;
  pointer-events: none;
  animation: glowPulse 3s ease-in-out infinite;
}

.particle-canvas {
  position: fixed;
  inset: 0;
  mix-blend-mode: screen; /* additive compositing — dark canvas is transparent */
  pointer-events: none;
}
```

### Easing Curves That Feel Cinematic

```typescript
// These easing functions change EVERYTHING
const easings = {
  // Snap! Sharp deceleration — for "hits"
  slamOut: [0.16, 1, 0.3, 1],           // cubic-bezier
  
  // Smooth and epic — for reveals
  epicIn: [0.4, 0, 0.2, 1],
  
  // Elastic snap back — for bouncy
  elastic: [0.68, -0.55, 0.265, 1.55],
  
  // Slow in, fast out — text building tension then releasing
  anticipate: [0.36, -0.15, 0.63, 1.2],
  
  // Custom spring-like — feels physical
  springy: { type: 'spring', damping: 10, stiffness: 150 },
};

// Frame Motion usage:
// transition={{ ease: easings.slamOut, duration: 0.4 }}
```

### Synchronizing With Audio

```typescript
// If using WebAudio API for trailer sound sync
class AudioSyncTimeline {
  private ctx: AudioContext;
  private callbacks: Map<number, (() => void)[]> = new Map();
  private startTime = 0;

  constructor() {
    this.ctx = new AudioContext();
  }

  // Register animation callbacks at beat positions
  at(timeSeconds: number, cb: () => void) {
    const existing = this.callbacks.get(timeSeconds) || [];
    this.callbacks.set(timeSeconds, [...existing, cb]);
    return this;
  }

  start() {
    this.startTime = this.ctx.currentTime;

    const tick = () => {
      const elapsed = this.ctx.currentTime - this.startTime;
      for (const [time, cbs] of this.callbacks) {
        if (elapsed >= time && elapsed < time + 0.016) { // within one frame
          cbs.forEach(cb => cb());
        }
      }
      requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);
  }
}

// Usage:
const timeline = new AudioSyncTimeline();
timeline
  .at(0.3, () => startParticles())
  .at(0.8, () => revealIka())
  .at(1.2, () => startKanjiStrokes())
  .at(2.5, () => showTagline())
  .start();
```

---

## 10. Tooling Quick Reference

### Libraries to Install

```bash
# Core animation
npm install framer-motion gsap

# GSAP plugins (club members)
# ScrambleText, SplitText, DrawSVG — require GSAP Club membership
# Free alternatives below

# Free text scramble
npm install scrambling-letters
# or
npm install use-scramble  # React hook

# Japanese font
npm install @fontsource/noto-serif-jp

# SVG stroke animation helper
npm install vivus  # lightweight SVG path animation

# For particle effects
# Use native Canvas API (no dependency needed)
```

### Font Loading for Japanese Text

```css
/* In global CSS or Tailwind's base layer */
@import url('https://fonts.googleapis.com/css2?family=Noto+Serif+JP:wght@700;900&family=Orbitron:wght@700;900&display=swap');

/* OR self-host via @fontsource */
```

```tsx
// Next.js 14 font optimization
import { Noto_Serif_JP, Orbitron } from 'next/font/google';

const notoSerifJP = Noto_Serif_JP({
  weight: ['700', '900'],
  subsets: ['latin'],
  display: 'swap',
  preload: false, // Japanese fonts are large — lazy load
});

const orbitron = Orbitron({
  weight: ['700', '900'],
  subsets: ['latin'],
  display: 'swap',
});
```

### KanjiVG Data for Stroke-by-Stroke

```bash
# Download KanjiVG dataset
curl -LO https://github.com/KanjiVG/kanjivg/releases/download/r20220427/kanjivg-20220427-all.zip
unzip kanjivg-20220427-all.zip -d kanjivg/

# Characters we need:
# イ = U+30A4 → kanjivg/kanji/030a4.svg
# カ = U+30AB → kanjivg/kanji/030ab.svg  
# 転 = U+8EE2 → kanjivg/kanji/08ee2.svg
# 生 = U+751F → kanjivg/kanji/0751f.svg
```

### Performance Checklist

- [ ] Use `will-change: transform, opacity` on animated elements
- [ ] Canvas uses `requestAnimationFrame`, not `setInterval`
- [ ] GSAP timelines cleared on unmount with `tl.kill()`
- [ ] Particle count capped at 2000 for 60fps
- [ ] Japanese fonts preloaded with `<link rel="preload">`
- [ ] `transform` and `opacity` only (no layout-triggering properties during animation)
- [ ] `mix-blend-mode: screen` for particle canvas (zero-cost transparency)

### Quick Win: One-Liner Glow

```css
/* Drop this on any element for instant neon feel */
.instant-neon {
  filter:
    drop-shadow(0 0 8px #00ffcc)
    drop-shadow(0 0 20px #00ffcc)
    drop-shadow(0 0 40px rgba(0, 255, 200, 0.5));
}
```

---

## Appendix: Recommended Sequence for Trailer

```
SCENE: Title Card "イカ転生"
Duration: ~3.5 seconds

[0.0–0.3s]  Silence + dark frame. Tension.
[0.3–0.8s]  Particle swarm assembles from random → center.
             Color: teal/cyan mix. Additive blend.
[0.8–0.85s] WHITE FLASH (single frame intensity).
[0.85–1.2s] "イカ" SLAMS in — scale 8→1, blur 40→0, spring bounce.
             Sound: deep impact thud.
[1.2–1.8s]  "転生" draws stroke by stroke (kanji brush).
             Sound: ink/draw sfx, subtle.
[1.8–2.2s]  SCRAMBLE PASS — all 4 chars cycle through katakana chaos.
             Then lock in. Feels like decryption.
[2.2–2.5s]  Neon glow stabilizes. All chars teal pulse.
             BGM swells.
[2.5–3.0s]  "REINCARNATION PROTOCOL" stagger-fades below.
             Letter spacing expands slightly.
[3.0–3.5s]  Breathe. Glow pulses slowly. 
             Particles dissipate.
             FADE TO BLACK or CUT TO GAMEPLAY.
```

---

*Research compiled by Ika for the Ika Tensei trailer system.*
*Stack: React + Framer Motion + Canvas API + GSAP (optional) + KanjiVG*
