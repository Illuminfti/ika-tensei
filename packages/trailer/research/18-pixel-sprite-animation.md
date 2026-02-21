# Pixel Art Sprite Animation — Techniques for React & Remotion

Research conducted: 2026-02-18  
Focus: Applicable to the Ika Tensei trailer + mascot animation system

---

## TL;DR

This document is the deep dive on **sprite animation mechanics** — how to make pixel art move in React/Remotion in ways that feel like classic JRPGs and 90s arcade games. Key insights:

1. **CSS `steps()` is the magic key** — it jumps between frames discretely (no interpolation), exactly like real sprite animation
2. **In Remotion, use `Math.floor(frame / frameDuration) % totalFrames`** — deterministic frame cycling
3. **Pixel art "squash" = removing 1 row, "stretch" = adding 1 row** — it's discrete, not smooth
4. **Anticipation requires only 1-2 frames** — tiny wind-up makes huge visual difference
5. **Dithering animation** = cycling between 2-3 dither patterns, creates color shimmer
6. **Magic effects** = radial particle burst → trail → fade (4–8 frames each phase)
7. **Fire** = upward-moving color gradient cycles, 6-8 frames, infinite loop
8. **All mascot states** can be achieved with 4–12 frame sprite strips

---

## 1. Sprite Sheet Animation in React

### The Core Concept

A sprite sheet is a single image containing all animation frames side by side. You show one frame at a time by clipping the view window and shifting the background position.

```
| Frame 0 | Frame 1 | Frame 2 | Frame 3 | Frame 4 | Frame 5 |
|  64px   |  64px   |  64px   |  64px   |  64px   |  64px   |
```

The viewport is `64px × 64px`. You animate by moving `background-position-x` from `0` to `-384px` in 6 discrete steps.

### Method 1: Pure CSS `steps()` (no JS required)

```css
.sprite {
  width: 64px;
  height: 64px;
  background-image: url('/sprites/ika-idle.png');
  background-repeat: no-repeat;
  /* steps(N) jumps between N frames with NO interpolation */
  animation: sprite-walk 0.6s steps(6) infinite;
}

@keyframes sprite-walk {
  from { background-position-x: 0px; }
  to   { background-position-x: -384px; } /* 64px × 6 frames */
}
```

**Key:** `steps(6)` means 6 discrete jumps — no easing, no blending. This IS pixel art animation.

**Variant — `steps(N, end)` vs `steps(N, start)`:**
- `steps(6, end)` — shows frame 0 first, frame 5 last (default, most common)
- `steps(6, start)` — shows frame 1 first, skips frame 0

### Method 2: React Hook with `useInterval`

For state-driven animations (trigger on event, stop on condition):

```tsx
import { useState, useEffect, useRef } from 'react';

interface SpriteConfig {
  frameCount: number;
  frameWidth: number;
  frameHeight: number;
  fps: number;
  loop?: boolean;
  onComplete?: () => void;
}

function useSprite({
  frameCount,
  frameWidth,
  frameHeight,
  fps,
  loop = true,
  onComplete,
}: SpriteConfig) {
  const [frame, setFrame] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const ms = 1000 / fps;
    intervalRef.current = setInterval(() => {
      setFrame((prev) => {
        if (prev >= frameCount - 1) {
          if (!loop) {
            clearInterval(intervalRef.current!);
            onComplete?.();
            return prev;
          }
          return 0;
        }
        return prev + 1;
      });
    }, ms);

    return () => clearInterval(intervalRef.current!);
  }, [frameCount, fps, loop, onComplete]);

  return {
    style: {
      backgroundPositionX: `-${frame * frameWidth}px`,
      width: `${frameWidth}px`,
      height: `${frameHeight}px`,
    } as React.CSSProperties,
    frame,
  };
}

// Usage:
function IkaMascot({ state = 'idle' }) {
  const spriteMap = {
    idle:     { frameCount: 6, fps: 8  },
    cast:     { frameCount: 8, fps: 12 },
    powerup:  { frameCount: 10, fps: 16 },
    celebrate:{ frameCount: 12, fps: 14 },
  };

  const config = spriteMap[state];
  const { style } = useSprite({
    ...config,
    frameWidth: 64,
    frameHeight: 64,
    loop: state === 'idle',
  });

  return (
    <div
      className="sprite"
      style={{
        ...style,
        backgroundImage: `url('/sprites/ika-${state}.png')`,
        imageRendering: 'pixelated', // CRITICAL — no browser smoothing
      }}
    />
  );
}
```

**Critical CSS:** Always set `image-rendering: pixelated` (or `crisp-edges` in Firefox) — without it browsers will blur the sprite and destroy the pixel art aesthetic.

### Method 3: Canvas-Based (For Complex Compositing)

```tsx
import { useEffect, useRef } from 'react';

function PixelCanvas({ spriteSheet, frameWidth, frameHeight, fps, frameCount }: {
  spriteSheet: HTMLImageElement;
  frameWidth: number;
  frameHeight: number;
  fps: number;
  frameCount: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    // Disable smoothing — essential for pixel art
    ctx.imageSmoothingEnabled = false;

    const interval = setInterval(() => {
      ctx.clearRect(0, 0, frameWidth, frameHeight);
      ctx.drawImage(
        spriteSheet,
        frameRef.current * frameWidth, 0,  // source x, y
        frameWidth, frameHeight,             // source width, height
        0, 0,                                // dest x, y
        frameWidth, frameHeight              // dest width, height
      );
      frameRef.current = (frameRef.current + 1) % frameCount;
    }, 1000 / fps);

    return () => clearInterval(interval);
  }, [spriteSheet, frameWidth, frameHeight, fps, frameCount]);

  return <canvas ref={canvasRef} width={frameWidth} height={frameHeight} />;
}
```

Canvas gives you pixel-level compositing: you can layer effects, apply palette swaps, and draw particles on top.

### Method 4: Remotion Frame-Based Sprite Cycling

In Remotion, time is deterministic (no `setInterval`). Use `useCurrentFrame()`:

```tsx
import { useCurrentFrame } from 'remotion';

interface RemotionSpriteProps {
  spriteUrl: string;
  frameCount: number;
  frameWidth: number;
  frameHeight: number;
  fps: number; // animation fps (may differ from video fps)
  startFrame?: number;
  loop?: boolean;
}

export function PixelSprite({
  spriteUrl,
  frameCount,
  frameWidth,
  frameHeight,
  fps,
  startFrame = 0,
  loop = true,
}: RemotionSpriteProps) {
  const frame = useCurrentFrame();
  // Video is 30fps, animation is 8fps: update every 30/8 ≈ 3.75 video frames
  const { fps: videoFps } = useVideoConfig();
  const frameDuration = Math.round(videoFps / fps); // video frames per sprite frame

  const adjustedFrame = frame - startFrame;
  let spriteFrame: number;

  if (loop) {
    spriteFrame = Math.floor(Math.max(0, adjustedFrame) / frameDuration) % frameCount;
  } else {
    spriteFrame = Math.min(
      Math.floor(Math.max(0, adjustedFrame) / frameDuration),
      frameCount - 1
    );
  }

  return (
    <div
      style={{
        width: frameWidth,
        height: frameHeight,
        backgroundImage: `url(${spriteUrl})`,
        backgroundPositionX: `-${spriteFrame * frameWidth}px`,
        backgroundRepeat: 'no-repeat',
        imageRendering: 'pixelated',
      }}
    />
  );
}
```

---

## 2. Classic Pixel Art Animation Principles

### The 12 Principles at Pixel Scale

These are Disney's 12 principles adapted for the constraints of pixel art (discrete pixels, limited frames, no interpolation).

#### 1. Squash & Stretch — The Pixel Way

In smooth animation, squash/stretch happens continuously. In pixel art, it's discrete: **remove or add 1–2 pixel rows**.

**Bouncing Ball — pixel squash frames:**
```
Frame 0 (still):    ●●●   (3×3 circle)
                    ●●●
                    ●●●

Frame 1 (contact):  ●●●●●  (5 wide, 2 tall — squashed)
                    ●●●●●

Frame 2 (rising):   ●●     (2 wide, 4 tall — stretched)
                    ●●
                    ●●
                    ●●
```

**Rule:** When squashing, widen. When stretching, narrow. **Total pixel count stays roughly constant.**

For a character landing:
- Normal: 32×32 pixels
- Squash on impact: 36×28 pixels (wider, shorter)
- Stretch on jump: 28×38 pixels (narrower, taller)

#### 2. Anticipation — The Wind-Up Frame

**1–2 frames** of movement in the OPPOSITE direction before the main action. Tiny but critical.

```
Cast Animation (8 frames total):
[0] Neutral pose
[1] Arm drops slightly (anticipation wind-up)     ← 1 frame is enough
[2] Body leans back, arm raises
[3] Arm at max reach, magic circle appears
[4] Release — arm thrusts forward
[5] Impact flash / spell fires
[6] Follow-through, arm extended
[7] Return to neutral
```

In code (Remotion), trigger anticipation before an event:
```tsx
const castStartFrame = 60; // spell fires at frame 60
// Show anticipation 8 video frames before cast
const inAnticipation = frame >= castStartFrame - 8 && frame < castStartFrame;
```

#### 3. Follow-Through & Overlapping Action

Body parts don't stop at the same time. **Secondary parts (hair, accessories, tentacles) lag behind the main body by 2–4 frames.**

For Ika's squid tentacles:
- Body stops → tentacles keep moving 3–4 more frames
- Head tilts right → antenna leans left first, then follows right

In CSS, simulate with animation-delay:
```css
.body     { animation: bounce 0.8s ease-in-out infinite; }
.hair     { animation: bounce 0.8s ease-in-out infinite; animation-delay: 50ms; }
.tentacle { animation: sway  1.2s ease-in-out infinite; animation-delay: 120ms; }
```

#### 4. Slow In / Slow Out (Easing at Pixel Level)

In pixel art, easing means **fewer pixels per frame at start and end, more in the middle.**

```
Move right across 8 pixels over 8 frames:
Frame: 1  2  3  4  5  6  7  8
Delta: 0  1  1  2  1  1  1  0   ← slow out at end
Delta: 0  0  1  2  2  1  1  0   ← ease in AND out
```

For Remotion: use the `spring()` function or custom easing:
```tsx
import { interpolate, useCurrentFrame } from 'remotion';

const frame = useCurrentFrame();
// Ease-in-out over 20 frames
const x = interpolate(frame, [0, 10, 20], [0, 80, 100], {
  easing: (t) => t < 0.5 ? 2*t*t : -1+(4-2*t)*t, // custom ease-in-out
  extrapolateRight: 'clamp',
});
```

#### 5. Secondary Action

The MAIN action is the spell being cast. Secondary actions that add life:
- Sparks fly off the hand during charging
- Hair sways from the energy
- Eyes glow brighter
- Small ambient particles orbit

These should be **subtle** — they support the main action, don't compete.

#### 6. Timing — Frame Duration is Everything

Same frames, different timing = completely different feel:

| Frame Duration | Feel |
|---------------|------|
| 80ms (12fps) | Smooth, modern |
| 120ms (8fps) | Classic SNES/GBA feel |
| 200ms (5fps) | NES/Game Boy feel |
| Mixed durations | Dramatic — hold key poses longer |

**Hold key frames longer:**
- Impact frame: 2–3x normal duration
- Charge pose: 4–8x normal (building tension)
- Return to idle: 1.5x (easing back)

---

## 3. Idle Animation — The Mascot Bob

The idle animation is the most important: it plays 95% of the time and defines the character's personality.

### Classic "Idle Bob" — Breathing Cycle

A **6–8 frame loop** where the character gently bobs up and down 1–2 pixels, as if breathing:

```
Frame  0: Y=0  (neutral)
Frame  1: Y=0  (hold, feeling natural)
Frame  2: Y=-1 (1 pixel up — inhale)
Frame  3: Y=-1 (hold up)
Frame  4: Y=0  (return)
Frame  5: Y=+1 (1 pixel down — exhale/settle)
Frame  6: Y=0  (return to neutral)
Frame  7: Y=0  (hold, complete cycle)
```

The total movement is only **2 pixels** — barely visible, but makes the character feel alive vs. a static image.

### Enhanced Idle — Ika Mascot Specific

Add secondary motion for Ika's features:

```
Frame  0: Neutral. Eyes open.
Frame  1: Body +0px. Hair slight right.
Frame  2: Body -1px. Hair neutral. Tentacles sway left slightly.
Frame  3: Body -1px. Eyes half-close (blink start).
Frame  4: Body -1px. Eyes closed (blink peak).
Frame  5: Body -1px. Eyes open.
Frame  6: Body 0px. Hair slight left.
Frame  7: Body +1px. Tentacles sway right slightly.
Frame  8: Body 0px. Back to neutral.
```

**Random blinks:** Don't blink on every cycle. Randomly skip the blink (80% of cycles, blink every ~3rd).

```tsx
// In React — randomize blink timing
const [blinkFrame, setBlinkFrame] = useState<number | null>(null);

useEffect(() => {
  const scheduleNextBlink = () => {
    const delay = 2000 + Math.random() * 4000; // blink every 2-6 seconds
    setTimeout(() => {
      setBlinkFrame(Date.now());
      scheduleNextBlink();
    }, delay);
  };
  scheduleNextBlink();
}, []);
```

### CSS-Only Idle Bob

```css
.mascot-idle {
  animation:
    bob 1.2s steps(8) infinite,
    blink 4s steps(1) infinite;
}

@keyframes bob {
  from { background-position-x: 0px; }
  to   { background-position-x: -512px; } /* 64px × 8 frames */
}

/* Blink overlay — separate sprite sheet strip */
@keyframes blink {
  0%, 90%, 100% { background-position-y: 0px; }    /* eyes open */
  92%, 96% { background-position-y: -64px; }       /* half close */
  94%       { background-position-y: -128px; }     /* fully closed */
}
```

---

## 4. Magic Spell Effects

### Phase Breakdown — Casting Animation

```
Total: ~16-24 frames at 12fps ≈ 1.3-2 seconds

Phase 1: CHARGE (frames 0-6, 6 frames)
  - Small energy particles appear around hand
  - Color: Teal/cyan for Ika's water/ink magic
  - Particles are 1-2px dots, orbiting inward
  - Screen slightly brightens in radius around hand

Phase 2: PEAK CHARGE (frames 7-9, 3 frames — hold longer)
  - Large magic circle materializes
  - Outer ring of runes/sigils pulse
  - Hand/arm glows brightest
  - Background slightly dims (energy focus)

Phase 3: RELEASE (frames 10-12, 3 frames)
  - Projectile launches or effect emanates
  - Flash frame on frame 10 (maximum brightness)
  - Particles scatter outward

Phase 4: AFTERMATH (frames 13-18, 6 frames)
  - Smoke/dissipation particles rise
  - Magic circle fades
  - Arm follow-through
  - Return to rest
```

### Magic Circle — Animated via CSS/SVG

```tsx
// Rotating runic circle — SVG + CSS
function MagicCircle({ active }: { active: boolean }) {
  return (
    <div className={`magic-circle ${active ? 'active' : ''}`}>
      <svg viewBox="0 0 100 100" width={128} height={128}>
        {/* Outer ring */}
        <circle cx="50" cy="50" r="45" stroke="#00ffcc" strokeWidth="1"
                fill="none" strokeDasharray="4 2" />
        {/* Inner ring */}
        <circle cx="50" cy="50" r="30" stroke="#0088ff" strokeWidth="1"
                fill="none" />
        {/* Runes — small symbols on the outer ring */}
        {[0,45,90,135,180,225,270,315].map((angle, i) => (
          <text
            key={i}
            x={50 + 42 * Math.cos(angle * Math.PI/180)}
            y={50 + 42 * Math.sin(angle * Math.PI/180)}
            fontSize="6"
            fill="#00ffcc"
            textAnchor="middle"
            dominantBaseline="middle"
          >
            {['ᚠ','ᚢ','ᚦ','ᚨ','ᚱ','ᚲ','ᚷ','ᚹ'][i]}
          </text>
        ))}
      </svg>
    </div>
  );
}
```

```css
.magic-circle {
  opacity: 0;
  transition: opacity 0.2s;
}
.magic-circle.active {
  opacity: 1;
  animation: magic-spin 2s linear infinite;
}
@keyframes magic-spin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}
```

### Spark Particles — Canvas Implementation

```tsx
interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  life: number;        // 0-1
  size: number;        // 1-3 pixels
  color: string;
}

function useSparkParticles(active: boolean, x: number, y: number) {
  const particlesRef = useRef<Particle[]>([]);

  const tick = useCallback((ctx: CanvasRenderingContext2D) => {
    ctx.imageSmoothingEnabled = false;

    // Spawn new particles
    if (active && particlesRef.current.length < 30) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.5 + Math.random() * 1.5;
      particlesRef.current.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1, // slight upward bias
        life: 1,
        size: Math.random() < 0.7 ? 1 : 2,
        color: ['#00ffcc', '#0088ff', '#ffffff', '#88ffee'][
          Math.floor(Math.random() * 4)
        ],
      });
    }

    // Update & draw
    particlesRef.current = particlesRef.current.filter(p => p.life > 0);
    for (const p of particlesRef.current) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.05; // gravity
      p.life -= 0.04;

      const alpha = Math.round(p.life * 4) / 4; // quantize to 0.25 steps
      ctx.fillStyle = p.color;
      ctx.globalAlpha = alpha;
      // Draw as discrete pixel block
      ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
    }
    ctx.globalAlpha = 1;
  }, [active, x, y]);

  return tick;
}
```

**Pixel Art Particle Rules:**
- Always `Math.round()` positions — particles snap to pixel grid
- Quantize alpha: `Math.round(alpha * 4) / 4` gives 25% opacity steps
- Size is always integer pixels (1, 2, or 3)
- Color palette is limited: 3-5 colors max per effect

### Remotion Magic Effect

```tsx
import { interpolate, useCurrentFrame, spring, useVideoConfig } from 'remotion';

export function MagicCastSequence({ startAt = 0 }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const elapsed = frame - startAt;

  // Phase timing (at 30fps video):
  const chargeStart = 0;
  const chargeEnd = 18;     // 0.6s charge
  const releaseFrame = 18;
  const flashEnd = 21;      // 3 frame flash
  const fadeEnd = 48;       // 1s aftermath

  // Charge scale — spring animation
  const chargeProgress = spring({
    frame: elapsed,
    fps,
    config: { stiffness: 80, damping: 20 },
    durationInFrames: chargeEnd,
  });
  const circleScale = interpolate(chargeProgress, [0, 1], [0, 1]);

  // Flash frame
  const isFlashFrame = elapsed >= releaseFrame && elapsed < flashEnd;
  const flashOpacity = interpolate(elapsed, [releaseFrame, flashEnd], [1, 0], {
    extrapolateRight: 'clamp',
  });

  // Particle burst after release
  const burstRadius = interpolate(elapsed, [releaseFrame, fadeEnd], [0, 80], {
    extrapolateRight: 'clamp',
    easing: (t) => 1 - Math.pow(1 - t, 3), // ease-out cubic
  });
  const burstOpacity = interpolate(elapsed, [releaseFrame, fadeEnd], [1, 0], {
    extrapolateRight: 'clamp',
  });

  return (
    <div style={{ position: 'relative', width: 200, height: 200 }}>
      {/* Magic circle */}
      {elapsed >= chargeStart && (
        <div style={{
          transform: `scale(${circleScale}) rotate(${elapsed * 3}deg)`,
          opacity: elapsed < fadeEnd ? 1 : 0,
        }}>
          <MagicCircle active />
        </div>
      )}

      {/* Flash overlay */}
      {isFlashFrame && (
        <div style={{
          position: 'absolute', inset: -50,
          background: 'white',
          opacity: flashOpacity,
          mixBlendMode: 'screen',
        }} />
      )}

      {/* Burst ring */}
      {elapsed >= releaseFrame && (
        <div style={{
          position: 'absolute',
          top: '50%', left: '50%',
          width: burstRadius * 2,
          height: burstRadius * 2,
          marginLeft: -burstRadius,
          marginTop: -burstRadius,
          borderRadius: '50%',
          border: '2px solid #00ffcc',
          opacity: burstOpacity,
        }} />
      )}
    </div>
  );
}
```

---

## 5. Pixel Art Explosion Animation — Frame Breakdown

Classic pixel art explosions follow a strict 3-phase structure:

### Phase 1: Flash Frame (1–2 frames)
- **Single bright frame**, often pure white or saturated yellow
- Radiates from impact center
- Creates visual "punch" — even 1 frame reads clearly at speed
- Size: slightly larger than the character/projectile

### Phase 2: Burst Expansion (4–6 frames)
```
Frame 0: Small ring (5px radius, solid orange)
Frame 1: Medium ring (10px radius, yellow-orange, inner darkens)
Frame 2: Larger ring (15px radius, orange-red, center becomes black smoke)
Frame 3: Peak ring (20px radius, red-orange fading)
Frame 4: Smoke cloud beginning (ring fades, dark grey puffs emerge)
Frame 5: Debris pixels scatter outward (1-2px sparks)
```

**Color palette for explosion:**
```
#ffffff → #ffff00 → #ff8800 → #ff4400 → #cc0000 → #442200 → #222222 → #000000
  Flash     Core       Inner     Mid      Outer     Smoke     Dark       Gone
```

### Phase 3: Debris & Dissipation (6–10 frames)
- Small pixel clusters scatter in arc patterns
- Rise and fade (simulating smoke)
- 2–3 pixel "embers" that slowly drift up
- Use fewer, brighter pixels to imply light within smoke

### React Explosion Component

```tsx
function PixelExplosion({
  x, y,
  size = 32,
  onComplete,
}: {
  x: number; y: number; size: number;
  onComplete?: () => void;
}) {
  // Explosion is a sprite sheet: 8 frames × 64px wide
  const { style, frame } = useSprite({
    frameCount: 8,
    frameWidth: 64,
    frameHeight: 64,
    fps: 14,   // ~70ms per frame = punchy
    loop: false,
    onComplete,
  });

  return (
    <div
      style={{
        position: 'absolute',
        left: x - 32,
        top: y - 32,
        ...style,
        backgroundImage: "url('/sprites/explosion-sheet.png')",
        imageRendering: 'pixelated',
        transform: `scale(${size / 64})`,
      }}
    />
  );
}
```

### Generating Explosion Frames Programmatically

Instead of a hand-drawn sprite sheet, generate explosion frames on canvas:

```tsx
function generateExplosionFrame(
  ctx: CanvasRenderingContext2D,
  frameIndex: number,
  totalFrames: number,
  cx: number,
  cy: number,
  maxRadius: number
) {
  const progress = frameIndex / totalFrames;
  ctx.imageSmoothingEnabled = false;

  if (frameIndex === 0) {
    // Flash frame — fill circle with white
    ctx.fillStyle = '#ffffff';
    drawPixelCircle(ctx, cx, cy, maxRadius * 0.3);
  } else {
    const radius = Math.round(progress * maxRadius);
    const innerRadius = Math.round(radius * 0.6);

    // Outer ring color based on progress
    const colors = ['#ffff00','#ff8800','#ff4400','#cc2200','#882200','#442200','#222222'];
    const colorIdx = Math.min(Math.floor(progress * colors.length), colors.length - 1);

    ctx.fillStyle = colors[colorIdx];
    drawPixelRing(ctx, cx, cy, radius, Math.max(0, radius - 3));

    // Dark smoke center
    if (progress > 0.3) {
      ctx.fillStyle = '#333333';
      drawPixelCircle(ctx, cx, cy, innerRadius * 0.5);
    }

    // Scatter debris pixels
    if (progress > 0.4) {
      const debris = Math.round((progress - 0.4) * 12);
      for (let i = 0; i < debris; i++) {
        const angle = (i / debris) * Math.PI * 2;
        const dist = radius * (0.8 + Math.random() * 0.4);
        const px = Math.round(cx + Math.cos(angle) * dist);
        const py = Math.round(cy + Math.sin(angle) * dist);
        ctx.fillStyle = i % 3 === 0 ? '#ff8800' : '#884400';
        ctx.fillRect(px, py, 2, 2);
      }
    }
  }
}

// Draw a pixelated circle (midpoint algorithm, fills as pixel blocks)
function drawPixelCircle(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, radius: number
) {
  for (let y = -radius; y <= radius; y++) {
    for (let x = -radius; x <= radius; x++) {
      if (x*x + y*y <= radius*radius) {
        ctx.fillRect(Math.round(cx + x), Math.round(cy + y), 1, 1);
      }
    }
  }
}
```

---

## 6. Mascot Animation States — Ika Tensei

### State Machine

```
         ┌─────────┐
    ┌───►│  IDLE   │◄────────────────┐
    │    │ 6 frames│                 │
    │    └────┬────┘                 │
    │         │ trigger              │
    │    ┌────▼────┐  charge done ┌──┴──────┐
    │    │CHARGING │─────────────►│  CAST   │
    │    │ 4 frames│              │ 8 frames│
    │    └─────────┘              └────┬────┘
    │                                 │ on complete
    │    ┌─────────┐                  │
    └────│ RECOVER │◄─────────────────┘
         │ 4 frames│
         └─────────┘
```

### Idle State (6 frames, 8fps, loop)

```
Sprite strip — 6 × 64px = 384px wide:
[0] Neutral, eyes open
[1] Body +0, slight hair drift right
[2] Body -1px, eyes begin squint
[3] Body -1px, eyes closed (blink)
[4] Body -1px, eyes open
[5] Body 0px, hair drift left, tentacles sway
```

- Bob amplitude: 1–2 pixels
- Energy: calm, cute, present
- Occasional blink every 2–4 seconds

### Charging State (4 frames, 12fps, loop until cast)

```
[0] Arms raise slightly, small sparkle on hand
[1] Arms at shoulder height, 3-5 pixel aura appears
[2] Arms above head, aura grows, hair whips back
[3] Maximum charge pose, full aura glow, hold this frame for power
```

- Visual: increasing particle density, color saturation
- Hold frame 3 for "charging" duration
- Add screen glow: `box-shadow: 0 0 20px rgba(0, 255, 204, 0.6)`

### Cast State (8 frames, 14fps, no loop)

```
[0] Flash frame — brief whiteout
[1] Arm thrust forward, magic circle at max
[2] Projectile leaves hand, smoke behind it
[3] Follow-through: arm extended, body leans
[4] Recoil: body jerks back slightly
[5] Arms settle down
[6] Hair settles
[7] Back to near-neutral
```

### Power-Up State (10 frames, 12fps, no loop)

```
[0] Normal pose
[1] Slight crouch (squash anticipation)
[2] Arms burst upward, body stretches tall
[3] Peak stretch — 2px taller than normal
[4] Aura explodes outward (star burst pattern)
[5-8] Hold power pose with pulsing aura
[9] Settle back to enhanced idle
```

Visual differences in enhanced idle after power-up:
- Persistent small glow aura
- Eyes glow
- Hair has minor spark particles

### Celebrate State (12 frames, 10fps, loop 2–3 times then return to idle)

```
[0-2] Jump up (stretch, peak, squash on land)
[3-4] Arms raise in victory
[5-6] Bounce back up
[7-8] Spin (use rotation transform, same sprite)
[9-10] Peace sign / cute gesture
[11]  Landing, settle
```

For spin: instead of drawing every spin frame, just `transform: rotateY()`:
```css
@keyframes coin-spin {
  from { transform: rotateY(0deg); }
  to   { transform: rotateY(360deg); }
}
```

---

## 7. Pixel Art UI Element Animations

### Health Bar

Classic pixel art health bar — two layers:

```tsx
function PixelHealthBar({
  current,
  max,
  width = 100,
}: {
  current: number; max: number; width: number;
}) {
  const pct = current / max;
  const color = pct > 0.5 ? '#44cc44' : pct > 0.25 ? '#ffcc00' : '#cc2222';

  return (
    <div style={{
      width,
      height: 8,
      background: '#222222',
      border: '1px solid #555555',
      position: 'relative',
      imageRendering: 'pixelated',
    }}>
      {/* Drain bar (yellow, slightly behind — shows recent damage) */}
      <div style={{
        position: 'absolute',
        width: `${pct * 100}%`,
        height: '100%',
        background: '#ffaa00',
        transition: 'width 0.8s ease-out',
      }} />
      {/* Main health bar */}
      <div style={{
        position: 'absolute',
        width: `${pct * 100}%`,
        height: '100%',
        background: color,
        transition: 'width 0.1s steps(1)', // snappy health change
      }} />
      {/* Pixel highlight strip on top */}
      <div style={{
        position: 'absolute',
        top: 0, left: 0,
        width: `${pct * 100}%`,
        height: 2,
        background: 'rgba(255,255,255,0.4)',
      }} />
    </div>
  );
}
```

**Key techniques:**
- `steps(1)` transition = instant pixel drop, no smooth interpolation
- Two-layer drain (yellow behind) = classic JRPG damage visualization
- Color changes at thresholds: green → yellow → red
- Animate the bar pulsing red at low health:

```css
.health-critical {
  animation: danger-pulse 0.5s steps(2) infinite;
}
@keyframes danger-pulse {
  from { background-color: #cc2222; }
  to   { background-color: #ff4444; }
}
```

### Mana Bar — Magic Shimmer

```css
.mana-bar {
  background: linear-gradient(
    90deg,
    #0044cc, #0088ff, #00ccff, #0088ff, #0044cc
  );
  background-size: 200% 100%;
  animation: mana-shimmer 2s linear infinite;
}
@keyframes mana-shimmer {
  from { background-position: 200% 0; }
  to   { background-position: -200% 0; }
}
```

For pixel-perfect shimmer, use a sprite sheet with 4 frames of the bar texture:
```css
.mana-fill {
  background-image: url('/sprites/mana-bar-sheet.png');
  background-size: 400% 100%;
  animation: mana-frames 0.4s steps(4) infinite;
}
```

### XP Counter — Number Pop

When XP is gained, the number should animate in a satisfying "pop":

```tsx
function XPCounter({ value }: { value: number }) {
  const [display, setDisplay] = useState(value);
  const [popping, setPopping] = useState(false);

  useEffect(() => {
    if (display !== value) {
      setPopping(true);
      // Tick up quickly, then settle
      const diff = value - display;
      const steps = Math.min(Math.abs(diff), 20);
      const stepSize = diff / steps;

      let step = 0;
      const interval = setInterval(() => {
        setDisplay(prev => {
          const next = prev + stepSize;
          if (Math.abs(next - value) < Math.abs(stepSize)) {
            clearInterval(interval);
            setPopping(false);
            return value;
          }
          return Math.round(next);
        });
        step++;
      }, 50); // 20fps tick-up
    }
  }, [value]);

  return (
    <div className={`xp-counter ${popping ? 'pop' : ''}`}>
      {display}
    </div>
  );
}
```

```css
.xp-counter.pop {
  animation: xp-pop 0.3s steps(3) forwards;
}
@keyframes xp-pop {
  0%   { transform: scale(1); color: #ffff00; }
  50%  { transform: scale(1.4); }
  100% { transform: scale(1); color: inherit; }
}
```

### Level Up Flash

Full-screen 2-frame flash + text pop:

```css
.level-up-flash {
  animation:
    level-flash 0.2s steps(1) 3,  /* flash 3 times */
    level-text  0.5s steps(4) forwards;
}
@keyframes level-flash {
  from { background: rgba(255, 255, 200, 0.8); }
  to   { background: transparent; }
}
@keyframes level-text {
  0%   { transform: scale(0); opacity: 1; }
  60%  { transform: scale(1.3); }
  100% { transform: scale(1); }
}
```

---

## 8. Dithering Animation Effects

Dithering is the pixel art technique of alternating pixel patterns to simulate color gradients or transparency. **Animated dithering** cycles between patterns to create shimmer, energy, or transition effects.

### Basic Dither Patterns

```
Checkerboard (50%):     Bayer 2×2 (25%/75%):   Diagonal:
█ ░ █ ░                 ░ ░ █ ░                 █ ░ ░ ░
░ █ ░ █                 ░ ░ ░ ░                 ░ █ ░ ░
█ ░ █ ░                 █ ░ ░ ░                 ░ ░ █ ░
░ █ ░ █                 ░ ░ ░ ░                 ░ ░ ░ █
```

### Animated Dither Transition (Wipe Effect)

Pixel art scene transitions often use a dither wipe:
- Frame 0: 0% dithered (scene A fully visible)
- Frame 4: 25% dithered (checkerboard at corners)
- Frame 8: 50% dithered (full checkerboard)
- Frame 12: 75% dithered (inverted checkerboard, mostly B)
- Frame 16: 100% scene B

```tsx
// Dither overlay — alternates which pixels show through
function DitherWipe({ progress }: { progress: number }) {
  // Generate SVG pattern based on progress (0-1)
  const ditherLevel = Math.floor(progress * 4) / 4; // quantize to 25% steps

  const patternId = `dither-${Math.round(ditherLevel * 4)}`;
  const patterns = {
    0:   null,          // no overlay
    0.25: '10101010...',  // corners
    0.5: '01010101...',  // checkerboard
    0.75: '11011101...',  // mostly covered
    1:   'full',
  };

  return (
    <svg style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      <defs>
        <pattern id={patternId} x="0" y="0" width="2" height="2" patternUnits="userSpaceOnUse">
          {ditherLevel >= 0.5 && <rect x="0" y="0" width="1" height="1" fill="black" />}
          {ditherLevel >= 0.25 && <rect x="1" y="1" width="1" height="1" fill="black" />}
          {ditherLevel >= 0.75 && <rect x="1" y="0" width="1" height="1" fill="black" />}
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${patternId})`} />
    </svg>
  );
}
```

### Shimmering Energy / Aura Dither

Magic auras shimmer by cycling between 2 dither patterns rapidly:

```css
.magic-aura {
  /* Two different dither overlay images, alternating */
  animation: aura-shimmer 0.1s steps(2) infinite;
}
@keyframes aura-shimmer {
  0%   { background-image: url('/sprites/dither-a.png'); }
  50%  { background-image: url('/sprites/dither-b.png'); }
  100% { background-image: url('/sprites/dither-a.png'); }
}
```

This creates a visual oscillation between 2 states at 10fps — classic SNES/GBA magical effect.

### CSS-Only Pixel Dither Gradient

Instead of images, create a dither gradient with CSS repeating patterns:

```css
.pixel-fade {
  background-image:
    repeating-linear-gradient(
      0deg,
      transparent 0px,
      transparent 1px,
      rgba(0,0,0,0.5) 1px,
      rgba(0,0,0,0.5) 2px
    ),
    repeating-linear-gradient(
      90deg,
      transparent 0px,
      transparent 1px,
      rgba(0,0,0,0.5) 1px,
      rgba(0,0,0,0.5) 2px
    );
  image-rendering: pixelated;
}
```

---

## 9. Fire, Smoke & Energy Effects

### Pixel Art Fire — Frame Structure

Classic fire uses an upward-scrolling color gradient with noise. **6–8 frame loop:**

```
Frame progression (bottom to top per column):
██████  ← dark red/black smoke (y=top)
▓▓▓▓▓▓  ← red-orange middle flames
░░░░░░  ← bright orange-yellow
██████  ← white/yellow hot core (y=bottom)
```

Each frame, the pattern shifts up by 1–2 pixels, and new hot pixels appear at the base:

```tsx
function generateFireFrame(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  previousHeat: number[][],
  frameIndex: number
): number[][] {
  const palette = [
    '#000000', '#220000', '#440000', '#880000',
    '#cc2200', '#ff4400', '#ff8800', '#ffcc00',
    '#ffff00', '#ffffff',
  ];

  const heat = previousHeat.map(row => [...row]);

  // Seed new fire at bottom
  for (let x = 0; x < width; x++) {
    heat[height - 1][x] = 9; // max heat at bottom
  }

  // Spread upward with cooling
  for (let y = height - 2; y >= 0; y--) {
    for (let x = 0; x < width; x++) {
      const spread = (
        heat[y + 1][Math.max(0, x - 1)] +
        heat[y + 1][x] +
        heat[y + 1][Math.min(width - 1, x + 1)] +
        heat[y + 1][x]
      ) / 4;
      const cooled = spread - (Math.random() < 0.4 ? 1 : 0);
      heat[y][x] = Math.max(0, Math.round(cooled));
    }
  }

  // Render
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const val = heat[y][x];
      if (val > 0) {
        ctx.fillStyle = palette[val];
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }

  return heat;
}
```

**Pre-bake:** Run this algorithm once at build time to generate a sprite sheet. Don't run it in realtime (too expensive for smooth animation).

### Smoke Effect — Rising Puffs

Smoke uses large pixel blobs (3×3 to 5×5) that:
1. Rise slowly (1px/frame)
2. Expand slightly (add 1px to radius every 4 frames)
3. Fade from dark grey → light grey → transparent

```
Color progression per puff:
#333333 → #555555 → #777777 → #999999 → #bbbbbb → transparent
  Frame 0    Frame 2    Frame 4    Frame 6    Frame 8    Frame 10
```

**Smoke puff positions are staggered** — new puff spawns every 3 frames, offset horizontally.

### Energy/Lightning Effect

Pixel lightning uses a branching random path:

```tsx
function drawPixelLightning(
  ctx: CanvasRenderingContext2D,
  x1: number, y1: number,
  x2: number, y2: number,
  seed: number
) {
  // Midpoint displacement algorithm at pixel scale
  function lightning(x1: number, y1: number, x2: number, y2: number, depth: number) {
    if (depth === 0 || Math.abs(x2-x1) + Math.abs(y2-y1) < 2) {
      ctx.fillRect(x1, y1, 1, 1);
      return;
    }
    const mx = Math.round((x1 + x2) / 2) + Math.round((Math.random() - 0.5) * depth * 3);
    const my = Math.round((y1 + y2) / 2) + Math.round((Math.random() - 0.5) * depth * 2);
    lightning(x1, y1, mx, my, depth - 1);
    lightning(mx, my, x2, y2, depth - 1);
  }

  ctx.fillStyle = '#ffffff';
  lightning(x1, y1, x2, y2, 4);

  // Core — slightly narrower, yellow-white
  ctx.fillStyle = '#ffffaa';
  lightning(x1, y1, x2, y2, 3);
}
```

**Animate:** Call with different random seeds per frame for the flickering effect. Use 3-4 different seeds cycling at 8fps.

### Energy Orb — Pulsing Glow

```css
.energy-orb {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: radial-gradient(circle, #ffffff 10%, #00ffcc 40%, #0044ff 80%, transparent);
  animation:
    orb-pulse 0.5s steps(4) infinite,
    orb-glow  0.5s steps(4) infinite;
  image-rendering: pixelated;
}
@keyframes orb-pulse {
  0%   { transform: scale(1.0); }
  25%  { transform: scale(1.05); }
  50%  { transform: scale(1.1); }
  75%  { transform: scale(1.05); }
  100% { transform: scale(1.0); }
}
@keyframes orb-glow {
  0%   { box-shadow: 0 0 4px  2px rgba(0, 255, 204, 0.6); }
  50%  { box-shadow: 0 0 12px 6px rgba(0, 255, 204, 0.8); }
  100% { box-shadow: 0 0 4px  2px rgba(0, 255, 204, 0.6); }
}
```

---

## 10. Aseprite Export for Web

### Sprite Sheet Export Settings

**File → Export Sprite Sheet:**

```json
{
  "type": "Horizontal",         // frames side by side
  "padding": 0,                 // no padding between frames (simplifies math)
  "format": "PNG",              // lossless
  "trim": false,                // keep full frame size (for consistent positioning)
  "extrude": 0,                 // no extrude (game engines need it, web doesn't)
  "output": "ika-idle.png",
  "dataFile": "ika-idle.json"   // export JSON metadata too
}
```

### JSON Metadata Format

Aseprite exports frame data as JSON:

```json
{
  "frames": {
    "ika-idle 0": {
      "frame": { "x": 0,   "y": 0, "w": 64, "h": 64 },
      "duration": 120
    },
    "ika-idle 1": {
      "frame": { "x": 64,  "y": 0, "w": 64, "h": 64 },
      "duration": 120
    },
    "ika-idle 2": {
      "frame": { "x": 128, "y": 0, "w": 64, "h": 64 },
      "duration": 120
    }
  },
  "meta": {
    "size": { "w": 384, "h": 64 },
    "frameTags": [
      { "name": "idle",    "from": 0, "to": 5, "direction": "forward" },
      { "name": "cast",    "from": 6, "to": 13, "direction": "forward" },
      { "name": "powerup", "from": 14, "to": 23, "direction": "forward" }
    ]
  }
}
```

**Use a single sprite sheet for all states** — place different animations in a vertical stack or horizontal strip, reference by Y offset.

### Loading Aseprite Data in React

```tsx
import spriteData from './sprites/ika.json';

interface AsepriteData {
  frames: Record<string, { frame: { x: number; y: number; w: number; h: number }; duration: number }>;
  meta: { frameTags: Array<{ name: string; from: number; to: number }> };
}

function useAsepriteAnimation(data: AsepriteData, tagName: string) {
  const tag = data.meta.frameTags.find(t => t.name === tagName)!;
  const frames = Object.values(data.frames).slice(tag.from, tag.to + 1);
  const [frameIdx, setFrameIdx] = useState(0);

  useEffect(() => {
    const currentFrame = frames[frameIdx];
    const timer = setTimeout(() => {
      setFrameIdx((prev) => (prev + 1) % frames.length);
    }, currentFrame.duration);
    return () => clearTimeout(timer);
  }, [frameIdx, frames]);

  const { frame } = frames[frameIdx];
  return {
    backgroundPositionX: `-${frame.x}px`,
    backgroundPositionY: `-${frame.y}px`,
    width: `${frame.w}px`,
    height: `${frame.h}px`,
  };
}
```

This approach **respects per-frame timing** from Aseprite — hold frames can be set exactly in the tool.

---

## 11. Implementation Recipes

### A. Remotion PixelSprite Component (Production-Ready)

```tsx
import { useCurrentFrame, useVideoConfig, interpolate } from 'remotion';

interface SpriteAnimation {
  url: string;
  frameCount: number;
  frameWidth: number;
  frameHeight: number;
  animationFps: number;    // target animation speed
  rowIndex?: number;       // for vertical sprite sheets (0-indexed)
  startDelay?: number;     // video frames before animation starts
  loop?: boolean;
}

export const PixelSpriteSheet: React.FC<SpriteAnimation> = ({
  url,
  frameCount,
  frameWidth,
  frameHeight,
  animationFps,
  rowIndex = 0,
  startDelay = 0,
  loop = true,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const framesPerSpriteFrame = fps / animationFps;
  const elapsed = Math.max(0, frame - startDelay);

  const spriteIndex = loop
    ? Math.floor(elapsed / framesPerSpriteFrame) % frameCount
    : Math.min(Math.floor(elapsed / framesPerSpriteFrame), frameCount - 1);

  return (
    <div
      style={{
        width: frameWidth,
        height: frameHeight,
        backgroundImage: `url(${url})`,
        backgroundRepeat: 'no-repeat',
        backgroundPositionX: `-${spriteIndex * frameWidth}px`,
        backgroundPositionY: `-${rowIndex * frameHeight}px`,
        imageRendering: 'pixelated',
        // Scale up without blurring
        transform: 'scale(2)',
        transformOrigin: 'top left',
      }}
    />
  );
};
```

### B. Screen Shake in Remotion

```tsx
import { useCurrentFrame, interpolate } from 'remotion';

export function ScreenShake({
  children,
  startFrame,
  duration = 15,
  intensity = 4,
}: {
  children: React.ReactNode;
  startFrame: number;
  duration?: number;
  intensity?: number;
}) {
  const frame = useCurrentFrame();
  const elapsed = frame - startFrame;

  if (elapsed < 0 || elapsed > duration) {
    return <>{children}</>;
  }

  const decay = 1 - elapsed / duration; // 1 → 0 over duration
  const shakeX = Math.round(Math.sin(elapsed * 2.3) * intensity * decay);
  const shakeY = Math.round(Math.cos(elapsed * 1.7) * intensity * decay * 0.5);

  return (
    <div style={{ transform: `translate(${shakeX}px, ${shakeY}px)` }}>
      {children}
    </div>
  );
}
```

### C. Pixel Art Text Pop

Text that appears with a classic JRPG letter-by-letter reveal + bounce:

```tsx
function PixelTypewriter({
  text,
  fps,
  charsPerSecond = 20,
}: {
  text: string; fps: number; charsPerSecond: number;
}) {
  const frame = useCurrentFrame();
  const charsPerFrame = charsPerSecond / fps;
  const visibleChars = Math.floor(frame * charsPerFrame);

  return (
    <div style={{ fontFamily: '"Press Start 2P"', imageRendering: 'pixelated' }}>
      {text.split('').map((char, i) => (
        <span
          key={i}
          style={{
            opacity: i < visibleChars ? 1 : 0,
            display: 'inline-block',
            // Tiny bounce on appearance
            transform: i < visibleChars && i === visibleChars - 1
              ? 'translateY(-2px)'
              : 'translateY(0)',
          }}
        >
          {char}
        </span>
      ))}
    </div>
  );
}
```

---

## 12. Quick Reference Card

| Effect | Frames | FPS | Key Technique |
|--------|--------|-----|---------------|
| Idle bob | 6–8 | 8 | 1–2px vertical movement, blink variation |
| Walk cycle | 8 | 12 | Leg alternation, body bob |
| Charge | 4 | 10 | Particle density increase, hold last frame |
| Spell cast | 8 | 14 | Anticipation + flash frame + follow-through |
| Explosion | 8 | 14 | Flash → expand → debris → smoke |
| Fire | 6–8 | 12 | Upward color gradient cycling |
| Sparks | 6–10 | 16 | Radial outward scatter, gravity |
| Dither transition | 4 | 8 | Checkerboard pattern cycling |
| Lightning | 4 | 16 | New random seed each frame |
| Celebrate | 12 | 10 | Jump + spin + settle |
| Hit flash | 2 | 30 | 1 white frame, then recovery |
| Level up | 4 | 10 | Scale pop + color flash + screen strobe |

### Frame Timing for Pixel Art FPS

| Target FPS | ms per frame | `steps()` count | Feel |
|-----------|-------------|-----------------|------|
| 24 fps | 42ms | steps(24) | Smooth — modern |
| 12 fps | 83ms | steps(12) | Classic SNES |
| 8 fps  | 125ms | steps(8) | Classic NES/GB |
| 5 fps  | 200ms | steps(5) | Very retro/chunky |

### Must-Have CSS Rules

```css
/* Apply to ALL pixel art elements */
.pixel {
  image-rendering: pixelated;       /* Chrome/Safari */
  image-rendering: crisp-edges;     /* Firefox */
  -ms-interpolation-mode: nearest-neighbor; /* IE (legacy) */
}

/* Pixel art font rendering */
.pixel-text {
  font-family: 'Press Start 2P', monospace;
  -webkit-font-smoothing: none;
  -moz-osx-font-smoothing: unset;
}
```

---

## Sources & References

- Pedro Medeiros (saint11) — Celeste animator, Pixel Grimoire tutorials (saint11.art)
- Chris Totten — "12 Principles for Game Animation" (Medium, 2021)
- LogRocket Blog — "Making CSS animations using a sprite sheet"
- MDN Web Docs — CSS `animation`, `steps()` timing function
- Remotion Docs — `interpolate()`, `spring()`, `useCurrentFrame()`
- Aseprite Docs — Export Sprite Sheet, JSON format
- SLYNYRD PixelBlog — Pixel art character design and animation principles
- Lospec — Pixel art palette and tutorial community

---

*Written for the Ika Tensei trailer pipeline — Remotion + React stack, occult/JRPG aesthetic.*
