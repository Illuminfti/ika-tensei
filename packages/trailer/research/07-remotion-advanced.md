# Remotion Advanced Techniques & Ecosystem

Advanced animation techniques, ecosystem packages, and performance optimization for professional video generation with Remotion.

## Table of Contents

1. [Core Animation Primitives](#core-animation-primitives)
2. [Easing Beyond spring()](#easing-beyond-spring)
3. [@remotion/transitions Package](#remotiontransitions-package)
4. [@remotion/noise Package](#remotionnoise-package)
5. [@remotion/paths Package](#remotionpaths-package)
6. [Frame-Based Particle Systems](#frame-based-particle-systems)
7. [Compositing Multiple Animated Layers](#compositing-multiple-animated-layers)
8. [Performance Tips](#performance-tips)
9. [Audio Sync Techniques](#audio-sync-techniques)

---

## Core Animation Primitives

Remotion provides three fundamental animation primitives that form the foundation of all advanced animations:

### `useCurrentFrame()`

The core hook that returns the current frame number (0-indexed):

```tsx
import { useCurrentFrame, AbsoluteFill } from 'remotion';

export const FrameCounter = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
      Frame: {frame}
    </AbsoluteFill>
  );
};
```

**Key insight**: A video is a function of images over time. If you change content every frame, you'll end up with an animation.

### `interpolate()`

Maps input ranges to output ranges with optional easing:

```tsx
import { interpolate, useCurrentFrame } from 'remotion';

const frame = useCurrentFrame();

// Simple fade-in (frame 0-20 → opacity 0-1)
const opacity = interpolate(frame, [0, 20], [0, 1]);

// Fade in and out
const { durationInFrames } = useVideoConfig();
const fadeOpacity = interpolate(
  frame,
  [0, 20, durationInFrames - 20, durationInFrames],
  [0, 1, 1, 0]
);

// With clamping to prevent values exceeding range
const scale = interpolate(frame, [0, 20], [0, 1], {
  extrapolateRight: 'clamp'
});
```

### `spring()`

Physics-based animation with configurable mass, stiffness, and damping:

```tsx
import { spring, useCurrentFrame, useVideoConfig } from 'remotion';

const frame = useCurrentFrame();
const { fps } = useVideoConfig();

const value = spring({
  frame,
  fps,
  config: {
    stiffness: 100,  // Spring stiffness (default: 100)
    damping: 10,     // How hard it decelerates (default: 10)
    mass: 1,         // Weight of spring (default: 1)
  }
});

// Use with interpolate for custom ranges
const position = interpolate(value, [0, 1], [0, 200]);
```

---

## Easing Beyond spring()

Remotion's `Easing` module provides comprehensive easing functions beyond physics-based springs:

### Built-in Easing Functions

```tsx
import { Easing, interpolate, useCurrentFrame } from 'remotion';

const frame = useCurrentFrame();

// Custom bezier curve (like CSS transitions)
const eased = interpolate(frame, [0, 100], [0, 1], {
  easing: Easing.bezier(0.8, 0.22, 0.96, 0.65)
});

// Elastic - overshoots like a spring
const elastic = interpolate(frame, [0, 100], [0, 1], {
  easing: Easing.elastic(1)  // bounciness 0-1+
});

// Bounce effect
const bounced = interpolate(frame, [0, 100], [0, 1], {
  easing: Easing.bounce
});

// Back - goes slightly back before moving forward
const back = interpolate(frame, [0, 100], [0, 1], {
  easing: Easing.back(1.7)
});

// All standard easings available:
Easing.linear
Easing.ease
Easing.quad
Easing.cubic
Easing.poly(4)  // quartic
Easing.poly(5)  // quintic
Easing.sin
Easing.circle
Easing.exp
```

### Modifying Easing Direction

```tsx
// Run easing forwards
Easing.in(Easing.ease)

// Run easing backwards (decelerate to start)
Easing.out(Easing.ease)

// Make symmetrical (ease in AND out)
Easing.inOut(Easing.ease)
```

### Visual Reference

Use [cubic-bezier.com](http://cubic-bezier.com/) and [easings.net](http://easings.net/) to visualize curves.

---

## @remotion/transitions Package

**Available from v4.0.53+**

Install:
```bash
npm i @remotion/transitions
```

### TransitionSeries Component

The `<TransitionSeries>` component creates smooth transitions between scenes:

```tsx
import { AbsoluteFill } from 'remotion';
import { 
  TransitionSeries, 
  linearTiming, 
  springTiming 
} from '@remotion/transitions';
import { fade } from '@remotion/transitions/fade';
import { wipe } from '@remotion/transitions/wipe';
import { slide } from '@remotion/transitions/slide';

const Fill = ({ color }: { color: string }) => (
  <AbsoluteFill style={{ backgroundColor: color }} />
);

export const TransitionExample: React.FC = () => {
  return (
    <TransitionSeries>
      <TransitionSeries.Sequence durationInFrames={60}>
        <Fill color="#0b84f3" />
      </TransitionSeries.Sequence>
      
      {/* Fade transition with spring timing */}
      <TransitionSeries.Transition 
        timing={springTiming({ config: { damping: 200 } })}
        presentation={fade()} 
      />
      
      <TransitionSeries.Sequence durationInFrames={60}>
        <Fill color="pink" />
      </TransitionSeries.Sequence>
      
      {/* Wipe transition with linear timing */}
      <TransitionSeries.Transition 
        timing={linearTiming({ durationInFrames: 30 })}
        presentation={wipe({ direction: 'from-left' })} 
      />
      
      <TransitionSeries.Sequence durationInFrames={60}>
        <Fill color="#2ecc71" />
      </TransitionSeries.Sequence>
    </TransitionSeries>
  );
};
```

### Built-in Transition Presentations

#### `fade()`

Simple crossfade between scenes:

```tsx
import { fade } from '@remotion/transitions/fade';

<TransitionSeries.Transition
  presentation={fade()}
/>

// With options
<TransitionSeries.Transition
  presentation={fade({
    shouldFadeOutExitingScene: true  // v4.0.166+
  })}
/>
```

#### `slide()`

Pushes the exiting slide out:

```tsx
import { slide } from '@remotion/transitions/slide';

<TransitionSeries.Transition
  presentation={slide({ direction: 'from-left' })}
/>

// Directions: 'from-left' | 'from-right' | 'from-top' | 'from-bottom'
```

#### `wipe()`

Slides over the exiting slide (like a reveal):

```tsx
import { wipe } from '@remotion/transitions/wipe';

<TransitionSeries.Transition
  presentation={wipe({ direction: 'from-left' })}
/>

// Directions: 'from-left' | 'from-top-left' | 'from-top' | 
//            'from-top-right' | 'from-right' | 'from-bottom-right' | 
//            'from-bottom' | 'from-bottom-left'
```

### Timing Functions

```tsx
import { linearTiming, springTiming, cubicBezierTiming } from '@remotion/transitions';

// Linear timing
linearTiming({ durationInFrames: 30 })

// Spring timing
springTiming({ 
  config: { damping: 200, stiffness: 100 },
  durationInFrames: 40  // optional: force exact duration
})

// Custom bezier
cubicBezierTiming({ 
  x1: 0.8, y1: 0.22, x2: 0.96, y2: 0.65 
})
```

### Overlay Effects (v4.0.415+)

Renders effects on top without affecting timing:

```tsx
import { TransitionSeries } from '@remotion/transitions';
import { LightLeak } from '@remotion/light-leaks';

<TransitionSeries>
  <TransitionSeries.Sequence durationInFrames={60}>
    <Fill color="blue" />
  </TransitionSeries.Sequence>
  
  <TransitionSeries.Overlay durationInFrames={20}>
    <LightLeak />
  </TransitionSeries.Overlay>
  
  <TransitionSeries.Sequence durationInFrames={60}>
    <Fill color="black" />
  </TransitionSeries.Sequence>
</TransitionSeries>
```

### Duration Calculation

Transitions **shorten** total duration (overlap). Calculate:

```
Total = Sum(sequences) - Sum(transitions)

Example: 40 + 60 - 30 = 70 frames
```

---

## @remotion/noise Package

**Available from v3.2.32+**

Install:
```bash
npm i @remotion/noise
```

Provides noise effects for organic textures and motion:

```tsx
import { AbsoluteFill } from 'remotion';
import { useCurrentFrame, interpolate } from 'remotion';
import { white, perlin } from '@remotion/noise';

// White noise overlay (grain effect)
export const GrainEffect = () => {
  const frame = useCurrentFrame();
  
  return (
    <AbsoluteFill style={{ opacity: 0.1 }}>
      <white.Browser
        width={1920}
        height={1080}
        time={frame / 30}
      />
    </AbsoluteFill>
  );
};
```

### Noise Functions

- `white` - Random white noise
- `perlin` - Smooth Perlin noise for organic motion
- Each has `<Browser>` and `<Server>` renderable components

### Perlin Noise for Organic Motion

```tsx
import { perlin } from '@remotion/noise';
import { useCurrentFrame, interpolate } from 'remotion';

const OrganicFloat = () => {
  const frame = useCurrentFrame();
  
  // Use perlin noise for smooth, organic movement
  const noiseValue = perlin.getNoiseAt({
    x: frame * 0.01,
    y: 0,
    z: 0
  });
  
  // Map noise (-1 to 1) to position
  const offsetY = interpolate(noiseValue, [-1, 1], [-50, 50]);
  
  return (
    <div style={{ transform: `translateY(${offsetY}px)` }}>
      Floating Element
    </div>
  );
};
```

---

## @remotion/paths Package

**Standalone package (no Remotion dependency)**

Install:
```bash
npm i @remotion/paths
```

Provides utility functions for SVG path manipulation:

```tsx
import { 
  getPathLength,
  getPointAtLength,
  getTotalLength,
  reverse,
  translate,
  scale,
  interpolatePath
} from '@remotion/paths';

// Get length of SVG path
const length = getPathLength('M10 10 L90 90');

// Get point at specific distance along path
const point = getPointAtLength('M10 10 L90 90', 50);
// Returns { x: 50, y: 50, angle: 45 }

// Animate element along path
export const PathFollower = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  
  const progress = interpolate(frame, [0, durationInFrames], [0, 1]);
  const point = getPointAtLength(customPath, progress * totalLength);
  
  return (
    <div style={{
      transform: `translate(${point.x}px, ${point.y}px) rotate(${point.angle}deg)`
    }}>
      🚀
    </div>
  );
};

// Interpolate between two paths (morphing)
const morphedPath = interpolatePath(
  'M10 10 L90 90',
  'M10 90 L90 10',
  0.5  // 50% between paths
);
```

---

## Frame-Based Particle Systems

Create particle effects by rendering many elements per frame:

```tsx
import { useMemo } from 'react';
import { useCurrentFrame, interpolate, AbsoluteFill } from 'remotion';

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  opacity: number;
};

const ParticleSystem = ({ count = 100 }) => {
  const frame = useCurrentFrame();
  
  // Generate particles once with useMemo
  const particles = useMemo(() => {
    return Array.from({ length: count }, (): Particle => ({
      x: Math.random() * 1920,
      y: Math.random() * 1080,
      vx: (Math.random() - 0.5) * 2,
      vy: (Math.random() - 0.5) * 2,
      size: Math.random() * 4 + 1,
      opacity: Math.random()
    }));
  }, [count]);
  
  // Calculate particle positions for current frame
  const renderedParticles = useMemo(() => {
    return particles.map(p => ({
      ...p,
      x: p.x + p.vx * frame,
      y: p.y + p.vy * frame + 0.5 * frame * frame * 0.1, // gravity
      opacity: interpolate(frame, [0, 100], [p.opacity, 0])
    }));
  }, [frame, particles]);
  
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      {renderedParticles.map((p, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: p.x,
            top: p.y,
            width: p.size,
            height: p.size,
            borderRadius: '50%',
            background: 'white',
            opacity: p.opacity
          }}
        />
      ))}
    </AbsoluteFill>
  );
};
```

### Optimized Particle Rendering

For complex particle systems, use Canvas:

```tsx
import { useRef, useEffect } from 'react';
import { useCurrentFrame, AbsoluteFill } from 'remotion';

const CanvasParticles = ({ count = 500 }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frame = useCurrentFrame();
  
  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    
    // Clear canvas
    ctx.clearRect(0, 0, 1920, 1080);
    
    // Draw particles (batch render)
    for (let i = 0; i < count; i++) {
      const x = (i * 137.5) % 1920 + frame * 0.5;
      const y = (i * 73.3) % 1080 + Math.sin(frame * 0.05 + i) * 20;
      
      ctx.beginPath();
      ctx.arc(x, y, 2, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 255, ${1 - frame / 300})`;
      ctx.fill();
    }
  }, [frame, count]);
  
  return (
    <AbsoluteFill>
      <canvas 
        ref={canvasRef} 
        width={1920} 
        height={1080}
        style={{ width: '100%', height: '100%' }}
      />
    </AbsoluteFill>
  );
};
```

---

## Compositing Multiple Animated Layers

Use `<Sequence>` for layer composition:

```tsx
import { Sequence, AbsoluteFill, useCurrentFrame } from 'remotion';

// Background layer
const Background = () => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 30], [0, 1]);
  
  return (
    <AbsoluteFill style={{ background: 'linear-gradient(...)', opacity }}>
      {/* Background content */}
    </AbsoluteFill>
  );
};

// Middle layer - character
const Character = () => {
  const frame = useCurrentFrame();
  const translateX = interpolate(frame, [30, 60], [-100, 100]);
  
  return (
    <div style={{ transform: `translateX(${translateX}px)` }}>
      {/* Character sprite */}
    </div>
  );
};

// Foreground layer - particles/effects
const Effects = () => {
  // Particle system
};

// Main composition
export const LayeredScene = () => {
  return (
    <>
      {/* Background: starts at frame 0 */}
      <Sequence from={0} durationInFrames={150}>
        <Background />
      </Sequence>
      
      {/* Character: starts at frame 30 */}
      <Sequence from={30} durationInFrames={90}>
        <Character />
      </Sequence>
      
      {/* Effects: full duration */}
      <Sequence from={0} durationInFrames={120}>
        <Effects />
      </Sequence>
    </>
  );
};
```

### Series Component (Sequential Playback)

```tsx
import { Series, AbsoluteFill } from 'remotion';

export const SequentialScenes = () => {
  return (
    <Series>
      <Series.Sequence durationInFrames={60}>
        <Scene1 />
      </Series.Sequence>
      <Series.Sequence durationInFrames={60}>
        <Scene2 />
      </Series.Sequence>
      <Series.Sequence durationInFrames={60}>
        <Scene3 />
      </Series.Sequence>
    </Series>
  );
};
```

---

## Performance Tips

### 1. Memoize Static Calculations

```tsx
// ❌ Bad: recalculates every frame
const positions = Array.from({ length: 100 }, (_, i) => ({
  x: Math.sin(i * 0.1) * 100
}));

// ✅ Good: memoized, only calculates once
const positions = useMemo(() => 
  Array.from({ length: 100 }, (_, i) => ({
    x: Math.sin(i * 0.1) * 100
  })), 
  []
);
```

### 2. Use `layout="none"` for Sequences

```tsx
// Default: adds AbsoluteFill wrapper
<Sequence from={0} durationInFrames={60}>
  <Content />
</Sequence>

// Opt-out for custom layout
<Sequence from={0} durationInFrames={60} layout="none">
  <Content />
</Sequence>
```

### 3. Avoid React Re-renders

```tsx
// ❌ Bad: new object every render
<div style={{ transform: `translate(${x}px, ${y}px)` }} />

// ✅ Good: use CSS variables or separate components
const MovingPart = ({ x, y }) => (
  <div style={{ transform: `translate(${x}px, ${y}px)` }} />
);
```

### 4. Use Appropriate Video Tags

| Component | Use Case |
|-----------|----------|
| `<OffthreadVideo>` | Best for server-side rendering |
| `<Html5Video>` | Legacy, browser-only |
| `@remotion/media Video` | Experimental, best performance |

### 5. Mute Videos with Silent Audio

```tsx
// Forces Remotion to skip audio extraction
<Html5Video muted src="video.webm" />
```

### 6. Limit Color Space

```tsx
// In remotion.config.ts
export default defineConfig({
  colorSpace: 'srgb',  // vs 'display-p3' - faster
});
```

---

## Audio Sync Techniques

### Basic Audio Playback

```tsx
import { AbsoluteFill, Html5Audio, staticFile } from 'remotion';

export const VideoWithAudio = () => {
  return (
    <AbsoluteFill>
      <Html5Audio src={staticFile('background.mp3')} />
      {/* Video content */}
    </AbsoluteFill>
  );
};
```

### Frame-Based Volume Control

```tsx
import { Html5Audio, interpolate, staticFile } from 'remotion';

<Html5Audio 
  src={staticFile('audio.mp3')}
  volume={(f) => interpolate(f, [0, 30], [0, 1], { 
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp'
  })}
/>
```

### Audio-Visual Sync

```tsx
import { useCurrentFrame, interpolate } from 'remotion';

const BeatReactive = () => {
  const frame = useCurrentFrame();
  
  // Assume 120 BPM = 2 beats per second = 1 beat per 15 frames
  const beatPhase = (frame % 15) / 15;
  const scale = interpolate(beatPhase, [0, 0.2, 1], [1, 1.2, 1]);
  
  return (
    <div style={{ transform: `scale(${scale})` }}>
      Beat!
    </div>
  );
};
```

### Playback Rate Control

```tsx
// Slow down audio
<Html5Audio src={staticFile('audio.mp3')} playbackRate={0.5} />

// Speed up
<Html5Audio src={staticFile('audio.mp3')} playbackRate={2} />
```

### Audio Trimming

```tsx
// Skip first 2 seconds, play until 4 seconds (2 second clip)
<Html5Audio 
  src={staticFile('audio.mp3')} 
  trimBefore={60}   // 60 frames @ 30fps = 2s
  trimAfter={120}   // 120 frames @ 30fps = 4s
/>
```

### Loop Audio

```tsx
<Html5Audio 
  src={staticFile('loop.mp3')} 
  loop
  volume={0.3}
/>
```

---

## Summary

Remotion provides a comprehensive toolkit for professional video generation:

- **Core primitives**: `useCurrentFrame()`, `interpolate()`, `spring()` form the foundation
- **Rich easing**: Beyond springs with bezier, elastic, bounce, and custom curves
- **Transitions**: Built-in fade, slide, wipe with `@remotion/transitions`
- **Noise effects**: White and Perlin noise for organic textures
- **Path utilities**: SVG path manipulation and morphing with `@remotion/paths`
- **Particle systems**: Canvas-based rendering for complex effects
- **Layer composition**: Sequence and Series components for timing
- **Audio sync**: Frame-accurate audio with volume/trimming control

These tools combine to create sophisticated, production-ready video content.

---

## References

- [Remotion Docs](https://www.remotion.dev/docs)
- [Easing Visualizer](http://easings.net/)
- [Cubic Bezier Editor](http://cubic-bezier.com/)
- [Remotion GitHub](https://github.com/remotion-dev/remotion)
