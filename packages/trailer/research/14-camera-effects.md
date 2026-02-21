# 14 — Camera Effects & Cinematic Movement in Remotion

> Simulating a physical camera in 2D motion graphics: shake, zoom, parallax, dolly, blur, focus pull, and impact.

---

## Table of Contents

1. [Core Concepts](#core-concepts)
2. [Camera Shake via Noise](#1-camera-shake-via-noise)
3. [Dramatic Zoom (Scale + Translate)](#2-dramatic-zoom-scale--translate)
4. [Parallax Depth Layers](#3-parallax-depth-layers)
5. [Dolly Zoom / Vertigo Effect](#4-dolly-zoom--vertigo-effect)
6. [Slow Pan (Ken Burns)](#5-slow-pan-ken-burns)
7. [Quick Zoom with Motion Blur](#6-quick-zoom-with-motion-blur)
8. [Focus Pull Effect](#7-focus-pull-effect)
9. [Impact Zoom + Screen Flash](#8-impact-zoom--screen-flash)
10. [CameraRig Wrapper Component](#9-camerarig-wrapper-component)
11. [Compositing Effects Together](#10-compositing-effects-together)
12. [Timing Cheat Sheet](#timing-cheat-sheet)

---

## Core Concepts

### How Remotion Animation Works

Every camera effect is a **pure function of the current frame**. There are no CSS transitions or setInterval calls — everything is derived from `useCurrentFrame()`.

```tsx
import { useCurrentFrame, useVideoConfig, interpolate, spring, Easing } from 'remotion';
import { noise2D, noise3D } from '@remotion/noise';

const frame = useCurrentFrame();
const { fps, durationInFrames, width, height } = useVideoConfig();
```

### Install Dependencies

```bash
pnpm add @remotion/noise
```

### The Camera Model

Think of all effects as operating on a **virtual camera**:
- **Position (X, Y)**: `translateX` / `translateY` on a wrapper div
- **Zoom (Z)**: `scale` on the scene container
- **Rotation**: `rotate` for dutch angle / tilt
- **Blur**: `filter: blur()` for focus/depth of field

All transforms applied to a single **scene wrapper** simulate camera movement without moving individual elements.

```tsx
// Pattern: Camera wrapper that contains the entire scene
<div style={{ transform: `
  scale(${zoom})
  translateX(${panX}px)
  translateY(${panY}px)
  rotate(${tilt}deg)
` }}>
  <Scene />
</div>
```

---

## 1. Camera Shake via Noise

**Technique**: Use Simplex noise (smooth, continuous random values) with `frame * speed` as the time dimension. Using two different seeds for X and Y gives independent axes.

### Why Noise Over Random?

`Math.random()` produces frame-discontinuous values → the camera teleports every frame.  
`noise2D(seed, x, y)` produces smooth organic movement → feels like a real handheld camera.

### Basic Shake

```tsx
import { noise2D } from '@remotion/noise';
import { useCurrentFrame } from 'remotion';

const CameraShake: React.FC<{
  intensity?: number;   // pixels of max displacement
  frequency?: number;  // how fast the shake cycles (0.05 = slow, 0.3 = rapid)
  rotationAmount?: number; // degrees of max rotation
}> = ({ intensity = 20, frequency = 0.1, rotationAmount = 0.5 }) => {
  const frame = useCurrentFrame();

  // Unique seeds so X, Y, rotation are independent
  const shakeX = noise2D('shakeX', frame * frequency, 0) * intensity;
  const shakeY = noise2D('shakeY', 0, frame * frequency) * intensity;
  const shakeRot = noise2D('shakeRot', frame * frequency, frame * frequency * 0.7) * rotationAmount;

  return (
    <div style={{
      transform: `translateX(${shakeX}px) translateY(${shakeY}px) rotate(${shakeRot}deg)`,
      width: '100%',
      height: '100%',
    }}>
      {/* Your scene goes here */}
    </div>
  );
};
```

### Trauma-Based Shake (Decreasing Intensity)

Game devs use a "trauma" system: shake intensity decays over time after an impact.

```tsx
import { noise2D } from '@remotion/noise';
import { interpolate, useCurrentFrame } from 'remotion';

// Shake that starts strong and decays over `decayFrames`
export const traumaShake = (
  frame: number,
  startFrame: number,
  decayFrames: number,
  maxIntensity: number = 30,
  frequency: number = 0.12
) => {
  const elapsed = frame - startFrame;
  if (elapsed < 0 || elapsed > decayFrames) return { x: 0, y: 0, rot: 0 };

  // Trauma decays squared for natural feel (game dev convention)
  const trauma = Math.max(0, 1 - elapsed / decayFrames);
  const shake = trauma * trauma; // squared for more aggressive falloff

  const intensity = shake * maxIntensity;
  return {
    x: noise2D('tx', elapsed * frequency, 0) * intensity,
    y: noise2D('ty', 0, elapsed * frequency) * intensity,
    rot: noise2D('tr', elapsed * frequency, elapsed * frequency) * (intensity * 0.05),
  };
};

// Usage in component:
const ImpactShake: React.FC<{ impactFrame: number }> = ({ impactFrame }) => {
  const frame = useCurrentFrame();
  const { x, y, rot } = traumaShake(frame, impactFrame, 45, 25, 0.15);

  return (
    <div style={{ transform: `translateX(${x}px) translateY(${y}px) rotate(${rot}deg)` }}>
      {/* scene */}
    </div>
  );
};
```

### Frequency Bands (Multi-octave Shake)

Combine slow drift + fast jitter for cinematic depth:

```tsx
export const multiOctaveShake = (frame: number, intensity: number) => {
  // Slow drift (big, sweeping movements)
  const driftX = noise2D('dX', frame * 0.03, 0) * intensity * 0.6;
  const driftY = noise2D('dY', 0, frame * 0.03) * intensity * 0.6;

  // Fast jitter (high frequency, small amplitude)
  const jitterX = noise2D('jX', frame * 0.25, 0) * intensity * 0.3;
  const jitterY = noise2D('jY', 0, frame * 0.25) * intensity * 0.3;

  // Micro-vibration
  const microX = noise2D('mX', frame * 0.8, 0) * intensity * 0.1;
  const microY = noise2D('mY', 0, frame * 0.8) * intensity * 0.1;

  return {
    x: driftX + jitterX + microX,
    y: driftY + jitterY + microY,
  };
};
```

---

## 2. Dramatic Zoom (Scale + Translate)

**Technique**: Use `spring()` for elastic overshoot or `interpolate()` with aggressive easing for a hard smash-in.

### Spring Zoom (Elastic, Satisfying)

```tsx
import { spring, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';

const DramaticZoom: React.FC<{
  targetScale?: number;
  startFrame?: number;
  targetX?: number; // pan toward this point (0 = center, -0.5 = left edge)
  targetY?: number;
}> = ({ targetScale = 2.5, startFrame = 0, targetX = 0, targetY = 0 }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  const progress = spring({
    fps,
    frame: frame - startFrame,
    config: {
      stiffness: 200,    // High stiffness = snappy
      damping: 20,       // Low damping = some overshoot
      mass: 0.8,
    },
    durationInFrames: 40,
  });

  const scale = interpolate(progress, [0, 1], [1, targetScale]);

  // Translate toward target point (compensate for zoom origin)
  // When zooming into a point, translate = (center - target) * (scale - 1)
  const panX = targetX * width * (scale - 1);
  const panY = targetY * height * (scale - 1);

  return (
    <div style={{
      transform: `scale(${scale}) translateX(${panX}px) translateY(${panY}px)`,
      transformOrigin: 'center center',
      width: '100%',
      height: '100%',
    }}>
      {/* scene */}
    </div>
  );
};
```

### Hard Smash Zoom (No Overshoot)

```tsx
import { interpolate, Easing, useCurrentFrame } from 'remotion';

const SmashZoom: React.FC<{ startFrame: number; duration?: number }> = ({
  startFrame,
  duration = 8, // 8 frames at 30fps = very fast
}) => {
  const frame = useCurrentFrame();

  const scale = interpolate(
    frame,
    [startFrame, startFrame + duration],
    [1, 3.5],
    {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: Easing.out(Easing.exp), // Exponential out: instant start, hard stop
    }
  );

  return (
    <div style={{ transform: `scale(${scale})`, transformOrigin: 'center center' }}>
      {/* scene */}
    </div>
  );
};
```

### Zoom Into Specific Element

```tsx
// Zoom into a token card at position (x%, y%) of the viewport
const ZoomToElement: React.FC<{
  elementCenterX: number; // 0-1 relative to viewport width
  elementCenterY: number; // 0-1 relative to viewport height
  zoomFactor: number;
  startFrame: number;
}> = ({ elementCenterX, elementCenterY, zoomFactor, startFrame }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  const progress = spring({
    fps,
    frame: frame - startFrame,
    config: { stiffness: 180, damping: 25 },
    durationInFrames: 50,
  });

  const scale = 1 + progress * (zoomFactor - 1);

  // Calculate translation to keep element centered
  // Origin is viewport center, element is at (elementCenterX, elementCenterY)
  const offsetX = (0.5 - elementCenterX) * width;
  const offsetY = (0.5 - elementCenterY) * height;

  const translateX = offsetX * progress;
  const translateY = offsetY * progress;

  return (
    <div style={{
      transform: `scale(${scale}) translate(${translateX / scale}px, ${translateY / scale}px)`,
      transformOrigin: 'center center',
    }}>
      {/* scene with element at (elementCenterX, elementCenterY) */}
    </div>
  );
};
```

---

## 3. Parallax Depth Layers

**Technique**: Different elements move at different speeds relative to a global pan value. Foreground moves fast, background moves slow. Creates illusion of 3D depth on a 2D canvas.

### Parallax Speed Rules

| Layer | Speed Multiplier | Movement |
|-------|-----------------|----------|
| Sky / Far BG | 0.1–0.2× | Barely moves |
| Mid BG | 0.3–0.5× | Slow |
| Mid ground | 0.6–0.8× | Medium |
| Subject | 1.0× | Reference speed |
| Foreground | 1.2–1.5× | Faster than camera |

### Full Parallax Scene

```tsx
import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion';

interface ParallaxLayer {
  content: React.ReactNode;
  depth: number;    // 0 = background, 1 = foreground
  zIndex: number;
}

const ParallaxScene: React.FC<{
  layers: ParallaxLayer[];
  panRange?: number;      // total pixels the camera pans
  startFrame?: number;
  duration?: number;
}> = ({ layers, panRange = 200, startFrame = 0, duration = 90 }) => {
  const frame = useCurrentFrame();

  // Master camera pan (linear progress across the shot)
  const cameraPan = interpolate(
    frame,
    [startFrame, startFrame + duration],
    [0, panRange],
    {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: (t) => t, // linear; swap for ease-in-out if desired
    }
  );

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
      {layers.map((layer, i) => {
        // Background (depth=0) barely moves, foreground (depth=1) moves most
        const speedMultiplier = 0.1 + layer.depth * 1.4;
        const translateX = -cameraPan * speedMultiplier;

        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: layer.zIndex,
              transform: `translateX(${translateX}px)`,
              // Overscan foreground layers so edges don't show
              width: layer.depth > 0.7 ? '130%' : '110%',
              left: layer.depth > 0.7 ? '-15%' : '-5%',
            }}
          >
            {layer.content}
          </div>
        );
      })}
    </div>
  );
};

// Usage:
const IkaParallaxScene = () => (
  <ParallaxScene
    panRange={300}
    startFrame={0}
    duration={120}
    layers={[
      { content: <StarfieldBg />, depth: 0, zIndex: 0 },
      { content: <CityHorizon />, depth: 0.25, zIndex: 1 },
      { content: <MidgroundRunes />, depth: 0.5, zIndex: 2 },
      { content: <MainCharacter />, depth: 0.75, zIndex: 3 },
      { content: <ForegroundParticles />, depth: 1.0, zIndex: 4 },
    ]}
  />
);
```

### Parallax + Vertical Drift (Breathing Effect)

```tsx
// Add vertical parallax for depth when camera tilts
const VerticalParallax: React.FC<{ depth: number; frame: number }> = ({ depth, frame }) => {
  // Slow sinusoidal vertical breathing — deeper = more movement
  const breathY = Math.sin(frame * 0.04) * 15 * depth;
  const breathX = Math.sin(frame * 0.025) * 8 * depth;

  return (
    <div style={{ transform: `translate(${breathX}px, ${breathY}px)` }}>
      {/* layer content */}
    </div>
  );
};
```

---

## 4. Dolly Zoom / Vertigo Effect

**What it is**: The subject stays the same size on screen while the background dramatically zooms in or out. Achieved in real cameras by physically moving (dollying) while simultaneously zooming the lens in the opposite direction.

**In 2D**: We simulate this by:
1. Scaling the **background layer** up/out
2. Keeping the **foreground subject** at its natural size (or scaling the inverse amount)

### Classic Vertigo Pull-back

```tsx
import { interpolate, Easing, useCurrentFrame, useVideoConfig } from 'remotion';

const DollyZoom: React.FC<{
  startFrame: number;
  duration: number;
  direction?: 'push' | 'pull'; // push = bg zooms in, pull = bg zooms out
}> = ({ startFrame, duration, direction = 'pull' }) => {
  const frame = useCurrentFrame();

  const progress = interpolate(
    frame,
    [startFrame, startFrame + duration],
    [0, 1],
    {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: Easing.inOut(Easing.quad),
    }
  );

  // Background: aggressively zoom
  const bgScale = direction === 'pull'
    ? interpolate(progress, [0, 1], [1, 2.5])   // BG zooms IN as camera pulls back
    : interpolate(progress, [0, 1], [2.5, 1]);  // BG zooms OUT as camera pushes in

  // Subject: counter-scale to remain constant visual size
  // If BG scale is 2.5, subject needs to be at 1/2.5 ≈ 0.4 relative to parent
  const subjectScale = 1 / bgScale;

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>

      {/* Background layer — scales aggressively */}
      <div style={{
        position: 'absolute',
        inset: 0,
        transform: `scale(${bgScale})`,
        transformOrigin: 'center center',
      }}>
        <BackgroundScene />
      </div>

      {/* Subject — counter-scales to stay same apparent size */}
      <div style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <div style={{
          transform: `scale(${subjectScale})`,
          transformOrigin: 'center center',
        }}>
          <Subject />
        </div>
      </div>

    </div>
  );
};
```

### Vertigo with FOV Simulation

For a more convincing effect, add perspective distortion to the background:

```tsx
const VertigoWithPerspective: React.FC<{
  progress: number; // 0 to 1
}> = ({ progress }) => {
  // Simulate changing focal length by warping perspective
  const perspective = interpolate(progress, [0, 1], [800, 200]); // px
  const bgScale = interpolate(progress, [0, 1], [1, 3]);

  return (
    <div style={{ perspective: `${perspective}px`, perspectiveOrigin: 'center center' }}>
      <div style={{
        transform: `scale(${bgScale}) translateZ(0)`,
        transformOrigin: 'center center',
        transformStyle: 'preserve-3d',
      }}>
        <BackgroundScene />
      </div>
    </div>
  );
};
```

---

## 5. Slow Pan (Ken Burns)

**Ken Burns Effect**: Slow, imperceptible pan + subtle zoom across a static image or scene. Used in documentaries to bring static images to life.

### Classic Ken Burns

```tsx
import { interpolate, Easing, useCurrentFrame, useVideoConfig } from 'remotion';

interface KenBurnsConfig {
  // Start state
  startScale: number;       // e.g. 1.1
  startX: number;          // % from center, e.g. -5 (pan right)
  startY: number;          // % from center, e.g. 2

  // End state
  endScale: number;        // e.g. 1.3
  endX: number;           // e.g. 5
  endY: number;           // e.g. -3
}

const KenBurns: React.FC<KenBurnsConfig & {
  startFrame?: number;
  duration?: number;
}> = ({
  startScale = 1.1, startX = -3, startY = 0,
  endScale = 1.35, endX = 3, endY = -2,
  startFrame = 0,
  duration = 150, // 5 seconds at 30fps
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  const progress = interpolate(
    frame,
    [startFrame, startFrame + duration],
    [0, 1],
    {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: Easing.inOut(Easing.sin), // Very smooth for documentary feel
    }
  );

  const scale = interpolate(progress, [0, 1], [startScale, endScale]);
  const translateX = interpolate(progress, [0, 1], [startX, endX]);
  const translateY = interpolate(progress, [0, 1], [startY, endY]);

  return (
    <div style={{
      width: '100%',
      height: '100%',
      overflow: 'hidden',
    }}>
      <div style={{
        width: '100%',
        height: '100%',
        transform: `scale(${scale}) translate(${translateX}%, ${translateY}%)`,
        transformOrigin: 'center center',
      }}>
        {/* Scene or image */}
      </div>
    </div>
  );
};

// Preset Ken Burns configurations for variety
export const kenBurnsPresets = {
  // Slow pan right + zoom in
  zoomInPanRight: { startScale: 1.05, startX: -5, startY: 0, endScale: 1.3, endX: 5, endY: 0 },
  // Pull back and pan left
  pullBackPanLeft: { startScale: 1.3, startX: 5, startY: 0, endScale: 1.05, endX: -3, endY: 0 },
  // Zoom into top-left corner
  zoomTopLeft: { startScale: 1.0, startX: 0, startY: 0, endScale: 1.4, endX: -8, endY: -5 },
  // Diagonal drift
  diagonalDrift: { startScale: 1.1, startX: -4, startY: -3, endScale: 1.25, endX: 4, endY: 3 },
};
```

### Multi-Shot Ken Burns Sequence

```tsx
// Sequence multiple Ken Burns shots with cross-dissolve
const KenBurnsSequence: React.FC<{
  shots: Array<{ image: string; config: KenBurnsConfig }>;
  shotDuration?: number;
  transitionDuration?: number;
}> = ({ shots, shotDuration = 150, transitionDuration = 20 }) => {
  const frame = useCurrentFrame();
  const totalPerShot = shotDuration + transitionDuration;

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {shots.map((shot, i) => {
        const shotStart = i * totalPerShot;
        const shotEnd = shotStart + shotDuration + transitionDuration;

        const opacity = interpolate(
          frame,
          [shotStart, shotStart + transitionDuration, shotEnd - transitionDuration, shotEnd],
          [0, 1, 1, 0],
          { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
        );

        if (opacity <= 0) return null;

        return (
          <div key={i} style={{ position: 'absolute', inset: 0, opacity }}>
            <KenBurns {...shot.config} startFrame={shotStart} duration={shotDuration} />
          </div>
        );
      })}
    </div>
  );
};
```

---

## 6. Quick Zoom with Motion Blur Simulation

**Technique**: Combine a fast scale change with a `filter: blur()` that peaks during the fastest moment of movement. The blur is highest at peak velocity.

### Velocity-Based Blur

```tsx
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

// Calculate velocity (derivative of position) for blur amount
const getVelocity = (frame: number, fps: number, scale: (f: number) => number): number => {
  if (frame <= 0) return 0;
  return Math.abs(scale(frame) - scale(frame - 1));
};

const QuickZoomBlur: React.FC<{
  fromScale?: number;
  toScale?: number;
  startFrame: number;
  zoomDuration?: number;
  maxBlur?: number; // px of blur at peak velocity
}> = ({
  fromScale = 1,
  toScale = 2.5,
  startFrame = 0,
  zoomDuration = 12,
  maxBlur = 8,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Fast interpolation with sharp ease-out
  const scaleProgress = (f: number) => interpolate(
    f,
    [startFrame, startFrame + zoomDuration],
    [fromScale, toScale],
    {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: Easing.out(Easing.cubic),
    }
  );

  const scale = scaleProgress(frame);

  // Blur proportional to rate of scale change (velocity)
  const velocity = getVelocity(frame, fps, scaleProgress);
  // Normalize velocity to blur amount (calibrate maxBlur to taste)
  const blur = Math.min(maxBlur, velocity * 100);

  return (
    <div style={{
      transform: `scale(${scale})`,
      transformOrigin: 'center center',
      filter: blur > 0.1 ? `blur(${blur}px)` : 'none',
      willChange: 'transform, filter',
    }}>
      {/* scene */}
    </div>
  );
};
```

### Directional Radial Blur (SVG Filter)

For a more cinematic zoom blur, use an SVG blur filter that simulates radial motion:

```tsx
const RadialMotionBlurFilter: React.FC<{ intensity: number; id: string }> = ({
  intensity,
  id,
}) => (
  <svg width="0" height="0" style={{ position: 'absolute' }}>
    <defs>
      <filter id={id}>
        {/* Zoom blur: scale multiple layers at different opacities */}
        <feGaussianBlur
          stdDeviation={`${intensity} ${intensity * 0.3}`}
          edgeMode="duplicate"
        />
        <feComposite in="SourceGraphic" />
      </filter>
    </defs>
  </svg>
);

const ZoomWithRadialBlur: React.FC<{ intensity: number }> = ({ intensity }) => {
  const filterId = 'zoom-blur-filter';

  return (
    <>
      <RadialMotionBlurFilter intensity={intensity} id={filterId} />
      <div style={{ filter: `url(#${filterId})` }}>
        {/* Zooming content */}
      </div>
    </>
  );
};
```

### Zoom Smear (Multiple Scaled Ghosts)

Simulate motion blur by stacking semi-transparent copies at intermediate scales:

```tsx
const ZoomSmear: React.FC<{
  fromScale: number;
  toScale: number;
  frame: number;
  startFrame: number;
  duration: number;
  samples?: number; // number of ghost frames
}> = ({ fromScale, toScale, frame, startFrame, duration, samples = 6 }) => {
  const progress = interpolate(frame, [startFrame, startFrame + duration], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

  const currentScale = interpolate(progress, [0, 1], [fromScale, toScale]);

  // Generate ghost samples behind current position
  const ghosts = Array.from({ length: samples }, (_, i) => {
    const ghostProgress = Math.max(0, progress - (i + 1) * (1 / (samples * 2)));
    const ghostScale = interpolate(ghostProgress, [0, 1], [fromScale, toScale]);
    const opacity = (1 - i / samples) * 0.15; // trailing ghosts get more transparent
    return { scale: ghostScale, opacity };
  });

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {/* Render ghost trail behind */}
      {ghosts.map((ghost, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            inset: 0,
            transform: `scale(${ghost.scale})`,
            opacity: ghost.opacity,
            transformOrigin: 'center center',
          }}
        >
          <Scene />
        </div>
      ))}
      {/* Main frame on top */}
      <div style={{
        position: 'absolute',
        inset: 0,
        transform: `scale(${currentScale})`,
        transformOrigin: 'center center',
      }}>
        <Scene />
      </div>
    </div>
  );
};
```

---

## 7. Focus Pull Effect

**Technique**: Blur one layer while simultaneously un-blurring another. Simulates pulling focus from background to foreground (or vice versa). Use `filter: blur()` driven by `interpolate()`.

### Background ↔ Foreground Focus Swap

```tsx
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

const FocusPull: React.FC<{
  startFrame: number;
  direction?: 'bg-to-fg' | 'fg-to-bg';
  maxBlur?: number;
}> = ({ startFrame, direction = 'bg-to-fg', maxBlur = 12 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = spring({
    fps,
    frame: frame - startFrame,
    config: { stiffness: 60, damping: 20 }, // Slow, cinematic spring
    durationInFrames: 40,
  });

  // bg-to-fg: start with bg in focus (fg blurred), end with fg in focus (bg blurred)
  const bgBlur = direction === 'bg-to-fg'
    ? interpolate(progress, [0, 1], [0, maxBlur])
    : interpolate(progress, [0, 1], [maxBlur, 0]);

  const fgBlur = direction === 'bg-to-fg'
    ? interpolate(progress, [0, 1], [maxBlur, 0])
    : interpolate(progress, [0, 1], [0, maxBlur]);

  // Brightness shift: out-of-focus gets slightly dimmer
  const bgBrightness = interpolate(bgBlur, [0, maxBlur], [1, 0.7]);
  const fgBrightness = interpolate(fgBlur, [0, maxBlur], [1, 0.7]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {/* Background layer */}
      <div style={{
        position: 'absolute',
        inset: 0,
        zIndex: 1,
        filter: `blur(${bgBlur}px) brightness(${bgBrightness})`,
        transition: 'none', // Always driven by frame, never CSS transitions
      }}>
        <BackgroundScene />
      </div>

      {/* Foreground subject */}
      <div style={{
        position: 'absolute',
        inset: 0,
        zIndex: 2,
        filter: `blur(${fgBlur}px) brightness(${fgBrightness})`,
      }}>
        <ForegroundSubject />
      </div>
    </div>
  );
};
```

### Depth-of-Field with Multiple Layers

```tsx
// 3-layer DOF: bg blurred, mid sharp, fg slightly blurred
const DepthOfField: React.FC<{
  focalLayer: 'bg' | 'mid' | 'fg'; // which layer is in focus
  transitionProgress: number;       // 0 to 1
  maxBlur?: number;
}> = ({ focalLayer, transitionProgress, maxBlur = 10 }) => {
  const layerBlurs = {
    bg: {
      bg: { start: 0, end: 0 },
      mid: { start: 8, end: 0 },  // bg focus: mid starts blurry
      fg: { start: maxBlur, end: 0 }, // fg blurry
    },
    mid: {
      bg: { start: 0, end: maxBlur * 0.6 },
      mid: { start: 0, end: 0 },  // mid in focus: always sharp
      fg: { start: 0, end: maxBlur * 0.4 },
    },
    fg: {
      bg: { start: 0, end: maxBlur },
      mid: { start: 0, end: maxBlur * 0.5 },
      fg: { start: 0, end: 0 },   // fg in focus: sharp
    },
  };

  const blurs = layerBlurs[focalLayer];

  const getBlur = (layer: 'bg' | 'mid' | 'fg') =>
    interpolate(transitionProgress, [0, 1], [blurs[layer].start, blurs[layer].end]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div style={{ position: 'absolute', inset: 0, filter: `blur(${getBlur('bg')}px)`, zIndex: 1 }}>
        <BgLayer />
      </div>
      <div style={{ position: 'absolute', inset: 0, filter: `blur(${getBlur('mid')}px)`, zIndex: 2 }}>
        <MidLayer />
      </div>
      <div style={{ position: 'absolute', inset: 0, filter: `blur(${getBlur('fg')}px)`, zIndex: 3 }}>
        <FgLayer />
      </div>
    </div>
  );
};
```

---

## 8. Impact Zoom + Screen Flash

**Technique**: Fast zoom in + white/chromatic flash overlay + camera shake. The flash opacity peaks on the impact frame then decays. The zoom uses extreme easing (instant start, hard stop).

### Full Impact Sequence

```tsx
import { interpolate, useCurrentFrame, useVideoConfig, Easing } from 'remotion';
import { noise2D } from '@remotion/noise';

const ImpactZoom: React.FC<{
  impactFrame: number;
  zoomAmount?: number;  // how much to zoom in (1 = no zoom, 3 = 3×)
  flashColor?: string;  // 'white' or 'rgba(255,100,0,0.8)' for fire flash
  shakeDuration?: number;
  shakeIntensity?: number;
}> = ({
  impactFrame,
  zoomAmount = 2.2,
  flashColor = 'white',
  shakeDuration = 30,
  shakeIntensity = 25,
}) => {
  const frame = useCurrentFrame();

  // === ZOOM ===
  // Fast zoom in over 6 frames (like a punch)
  const zoomIn = interpolate(
    frame,
    [impactFrame - 2, impactFrame + 6],
    [1, zoomAmount],
    {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: Easing.out(Easing.exp), // Explosive acceleration
    }
  );

  // Slow zoom out back to normal over 20 frames
  const zoomOut = interpolate(
    frame,
    [impactFrame + 6, impactFrame + 26],
    [zoomAmount, 1],
    {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: Easing.inOut(Easing.quad),
    }
  );

  // Combine: use zoomIn before peak, zoomOut after
  const scale = frame < impactFrame + 6 ? zoomIn : zoomOut;

  // === SCREEN FLASH ===
  // Flash hits instantly on impact frame, decays over ~15 frames
  const flashOpacity = interpolate(
    frame,
    [impactFrame, impactFrame + 1, impactFrame + 15],
    [0, 0.95, 0],
    {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: Easing.out(Easing.cubic),
    }
  );

  // === CHROMATIC ABERRATION (optional) ===
  // Slight RGB channel split during impact using CSS drop-shadow trick
  const chromaticAmount = interpolate(
    frame,
    [impactFrame, impactFrame + 3, impactFrame + 8],
    [0, 6, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  // === CAMERA SHAKE ===
  const elapsed = frame - impactFrame;
  const trauma = Math.max(0, 1 - elapsed / shakeDuration);
  const shakeAmt = trauma * trauma * shakeIntensity;
  const shakeX = noise2D('isx', elapsed * 0.15, 0) * shakeAmt;
  const shakeY = noise2D('isy', 0, elapsed * 0.15) * shakeAmt;
  const shakeRot = noise2D('isr', elapsed * 0.1, elapsed * 0.1) * shakeAmt * 0.04;

  const chromaticFilter = chromaticAmount > 0
    ? `drop-shadow(${chromaticAmount}px 0 0 rgba(255,0,0,0.5)) drop-shadow(-${chromaticAmount}px 0 0 rgba(0,100,255,0.5))`
    : 'none';

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>

      {/* Main scene with zoom + shake */}
      <div style={{
        width: '100%',
        height: '100%',
        transform: `scale(${scale}) translateX(${shakeX}px) translateY(${shakeY}px) rotate(${shakeRot}deg)`,
        transformOrigin: 'center center',
        filter: chromaticFilter,
      }}>
        {/* Your scene */}
      </div>

      {/* Screen flash overlay */}
      {flashOpacity > 0 && (
        <div style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: flashColor,
          opacity: flashOpacity,
          pointerEvents: 'none',
          zIndex: 9999,
        }} />
      )}

    </div>
  );
};
```

### Chromatic Aberration Effect (More Realistic)

```tsx
// Split RGB channels using positioned clones with mix-blend-mode
const ChromaticAberration: React.FC<{
  amount: number; // pixels of channel separation
  children: React.ReactNode;
}> = ({ amount, children }) => {
  if (amount < 0.5) return <>{children}</>;

  return (
    <div style={{ position: 'relative' }}>
      {/* Red channel offset left */}
      <div style={{
        position: 'absolute',
        inset: 0,
        transform: `translateX(-${amount}px)`,
        mixBlendMode: 'screen',
        filter: 'url(#red-channel)',
        opacity: 0.7,
      }}>
        {children}
      </div>

      {/* Blue channel offset right */}
      <div style={{
        position: 'absolute',
        inset: 0,
        transform: `translateX(${amount}px)`,
        mixBlendMode: 'screen',
        filter: 'url(#blue-channel)',
        opacity: 0.7,
      }}>
        {children}
      </div>

      {/* Main/green channel */}
      {children}

      {/* SVG filters for channel isolation */}
      <svg width="0" height="0" style={{ position: 'absolute' }}>
        <defs>
          <filter id="red-channel">
            <feColorMatrix type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" />
          </filter>
          <filter id="blue-channel">
            <feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" />
          </filter>
        </defs>
      </svg>
    </div>
  );
};
```

---

## 9. CameraRig Wrapper Component

Combine all effects into a single composable component:

```tsx
import { useCurrentFrame, useVideoConfig, interpolate, spring, Easing } from 'remotion';
import { noise2D } from '@remotion/noise';

interface CameraRigProps {
  children: React.ReactNode;

  // Shake
  shakeIntensity?: number;     // px, 0 = no shake
  shakeFrequency?: number;     // noise speed
  shakeRotation?: number;      // degrees max

  // Zoom
  zoomStart?: number;          // scale at start
  zoomEnd?: number;            // scale at end
  zoomEasing?: (t: number) => number;
  zoomDuration?: number;       // frames

  // Pan
  panXStart?: number;          // % translate
  panXEnd?: number;
  panYStart?: number;
  panYEnd?: number;
  panDuration?: number;

  // Blur (DOF)
  blur?: number;               // px

  // Overall timeline
  startFrame?: number;
}

export const CameraRig: React.FC<CameraRigProps> = ({
  children,
  shakeIntensity = 0,
  shakeFrequency = 0.1,
  shakeRotation = 0,
  zoomStart = 1,
  zoomEnd = 1,
  zoomEasing = Easing.inOut(Easing.quad),
  zoomDuration = 60,
  panXStart = 0,
  panXEnd = 0,
  panYStart = 0,
  panYEnd = 0,
  panDuration = 60,
  blur = 0,
  startFrame = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const elapsed = frame - startFrame;

  // Zoom
  const zoomProgress = interpolate(elapsed, [0, zoomDuration], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: zoomEasing,
  });
  const scale = interpolate(zoomProgress, [0, 1], [zoomStart, zoomEnd]);

  // Pan
  const panProgress = interpolate(elapsed, [0, panDuration], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.sin),
  });
  const translateX = interpolate(panProgress, [0, 1], [panXStart, panXEnd]);
  const translateY = interpolate(panProgress, [0, 1], [panYStart, panYEnd]);

  // Shake
  const shakeX = shakeIntensity > 0
    ? noise2D('cx', elapsed * shakeFrequency, 0) * shakeIntensity : 0;
  const shakeY = shakeIntensity > 0
    ? noise2D('cy', 0, elapsed * shakeFrequency) * shakeIntensity : 0;
  const shakeRot = shakeRotation > 0
    ? noise2D('cr', elapsed * shakeFrequency, elapsed * shakeFrequency * 0.7) * shakeRotation : 0;

  const totalX = translateX + shakeX;
  const totalY = translateY + shakeY;

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        filter: blur > 0 ? `blur(${blur}px)` : 'none',
      }}
    >
      <div
        style={{
          width: '100%',
          height: '100%',
          transform: `scale(${scale}) translate(${totalX / scale}px, ${totalY / scale}px) rotate(${shakeRot}deg)`,
          transformOrigin: 'center center',
        }}
      >
        {children}
      </div>
    </div>
  );
};
```

---

## 10. Compositing Effects Together

### Ika Tensei Trailer: "SEAL SEQUENCE" Example

```tsx
// Full cinematic beat: 
// Frame 0-30: Parallax pan across dark world
// Frame 30: IMPACT - flash + zoom + shake
// Frame 35-60: Zoom into seal card (Ken Burns)
// Frame 60-90: Focus pull from seal to world
// Frame 90+: Slow drift with noise shake

const SealRevealSequence: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // --- Phase 1: Pre-impact pan (0-29) ---
  const panPhase = Math.min(1, frame / 30);
  const cameraX = interpolate(panPhase, [0, 1], [0, -150], {
    easing: Easing.inOut(Easing.quad),
  });

  // --- Phase 2: Impact (frame 30) ---
  const impactProgress = Math.max(0, frame - 30);
  const impactTrauma = Math.max(0, 1 - impactProgress / 25);
  const impactShake = impactTrauma * impactTrauma * 20;
  const shakeX = noise2D('sx', impactProgress * 0.18, 0) * impactShake;
  const shakeY = noise2D('sy', 0, impactProgress * 0.18) * impactShake;

  // --- Phase 3: Zoom to seal (30-60) ---
  const sealZoom = spring({
    fps,
    frame: frame - 30,
    config: { stiffness: 250, damping: 22 },
    durationInFrames: 30,
  });
  const scale = interpolate(sealZoom, [0, 1], [1, 2.8]);

  // --- Phase 4: Focus pull (60-90) ---
  const focusProgress = interpolate(frame, [60, 90], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.sin),
  });
  const bgBlur = interpolate(focusProgress, [0, 1], [0, 10]);
  const sealBlur = interpolate(focusProgress, [0, 1], [10, 0]);

  // --- Phase 5: Ambient drift (90+) ---
  const driftX = frame > 90 ? noise2D('dx', (frame - 90) * 0.02, 0) * 8 : 0;
  const driftY = frame > 90 ? noise2D('dy', 0, (frame - 90) * 0.02) * 5 : 0;

  // --- Flash ---
  const flashOpacity = interpolate(
    frame,
    [30, 31, 45],
    [0, 0.9, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  const totalX = cameraX + shakeX + driftX;
  const totalY = shakeY + driftY;

  return (
    <AbsoluteFill>
      {/* Scene container with camera transform */}
      <div style={{
        width: '100%',
        height: '100%',
        transform: `scale(${scale}) translate(${totalX / scale}px, ${totalY / scale}px)`,
        transformOrigin: 'center center',
        overflow: 'hidden',
      }}>
        {/* BG with focus blur */}
        <div style={{ position: 'absolute', inset: 0, filter: `blur(${bgBlur}px)`, zIndex: 1 }}>
          <DarkWorldBackground />
        </div>

        {/* Seal card with DOF blur */}
        <div style={{ position: 'absolute', inset: 0, filter: `blur(${sealBlur}px)`, zIndex: 2 }}>
          <SealCard />
        </div>

        {/* Particle foreground - parallax faster */}
        <div style={{
          position: 'absolute',
          inset: 0,
          zIndex: 3,
          transform: `translateX(${-totalX * 0.3}px)`, // counter-move for parallax
        }}>
          <ForgroundParticles />
        </div>
      </div>

      {/* Flash overlay */}
      {flashOpacity > 0 && (
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(circle, rgba(255,255,200,1) 0%, rgba(255,200,100,0.8) 50%, transparent 100%)',
          opacity: flashOpacity,
          zIndex: 9998,
          pointerEvents: 'none',
        }} />
      )}
    </AbsoluteFill>
  );
};
```

---

## Timing Cheat Sheet

### FPS Reference (30fps)

| Duration | Frames | Feel |
|----------|--------|------|
| 1 frame  | 1      | Single flash / subliminal |
| 3–6 frames | 0.1–0.2s | Impact hit / smash cut |
| 8–12 frames | 0.25–0.4s | Quick zoom punch |
| 15–20 frames | 0.5–0.67s | Snappy reveal |
| 30 frames | 1s | Standard transition |
| 45–60 frames | 1.5–2s | Ken Burns, cinematic |
| 90–120 frames | 3–4s | Slow dramatic push |

### Spring Config Presets

```ts
// SNAP: instantaneous pop, strong overshoot
const snapSpring = { stiffness: 400, damping: 15, mass: 0.6 };

// DRAMATIC: heavy but controlled
const dramaticSpring = { stiffness: 200, damping: 20, mass: 1.0 };

// CINEMATIC: smooth, barely any overshoot
const cinematicSpring = { stiffness: 100, damping: 28, mass: 1.2 };

// ELASTIC: bouncy, playful
const elasticSpring = { stiffness: 300, damping: 10, mass: 0.8 };

// SLOW REVEAL: documental, heavy
const slowSpring = { stiffness: 60, damping: 25, mass: 2.0 };
```

### Easing Presets for Common Effects

```ts
import { Easing } from 'remotion';

// Anime smash-in: instant start, hard stop
const smashIn = Easing.out(Easing.exp);

// Dramatic reveal: slow start, burst to end
const dramaticReveal = Easing.in(Easing.cubic);

// Documentary pan: smooth sine
const docPan = Easing.inOut(Easing.sin);

// Elastic overshoot
const elastic = Easing.elastic(1.5);

// Ease with anticipation (backs up slightly before moving)
const anticipation = Easing.back(2.5);

// Custom Bezier (use https://cubic-bezier.com)
const customEase = Easing.bezier(0.22, 1, 0.36, 1); // "ease-out expo" CSS equivalent
```

### Camera Shake Frequency Guide

| Effect | Frequency | Intensity | Notes |
|--------|-----------|-----------|-------|
| Handheld cam | 0.03–0.06 | 2–5px | Slow drift, almost imperceptible |
| Nervous/tense | 0.08–0.12 | 8–15px | Like a thriller scene |
| Explosion near | 0.15–0.20 | 20–40px | Fast, aggressive |
| Direct impact | 0.20–0.30 | 30–60px | Extreme, paired with trauma decay |
| Ethereal float | 0.02–0.04 | 3–8px | Slow sinusoidal, other-worldly |

---

## Package Reference

```ts
// Required
import { useCurrentFrame, useVideoConfig, interpolate, spring, Easing, AbsoluteFill } from 'remotion';

// Noise (install: pnpm add @remotion/noise)
import { noise2D, noise3D, noise4D } from '@remotion/noise';
// noise2D(seed, x, y) → -1 to 1
// noise3D(seed, x, y, z) → -1 to 1  ← use z for time dimension
// noise4D(seed, x, y, z, w) → -1 to 1

// All functions are deterministic for same inputs → renders correctly
// Multiple seeds = independent random axes
```

---

*Research compiled 2026-02-18. Covers: @remotion/noise simplex noise for shake, spring() physics, interpolate() with Easing for zoom/pan, CSS filter for blur/DOF, SVG filters for chromatic aberration, and the parallax depth model.*
