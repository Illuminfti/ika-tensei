# 11 — Screen Transition Effects for Trailers & Motion Graphics

> Research date: 2026-02-18  
> Focus: Remotion `@remotion/transitions`, pixel dissolve, geometric wipes, glitch, anime eye-catch, portal/void, fire/energy, cross-dissolve

---

## Table of Contents

1. [Remotion `@remotion/transitions` — Full API](#1-remotion-remotion-transitions--full-api)
2. [Built-in Presentations Reference](#2-built-in-presentations-reference)
3. [Custom Presentations — How to Build Your Own](#3-custom-presentations--how-to-build-your-own)
4. [Pixel Dissolve Transition](#4-pixel-dissolve-transition)
5. [Geometric Wipes (Triangles, Hexagons, Circles)](#5-geometric-wipes-triangles-hexagons-circles)
6. [Glitch Transitions (RGB Split + Noise + Displacement)](#6-glitch-transitions-rgb-split--noise--displacement)
7. [Anime-Style Eye Catch](#7-anime-style-eye-catch)
8. [Portal / Void Transition (Black Hole / Expanding)](#8-portal--void-transition-black-hole--expanding)
9. [Fire / Energy Wipe Transition](#9-fire--energy-wipe-transition)
10. [Cross-Dissolve with Color Shift](#10-cross-dissolve-with-color-shift)
11. [GL Transitions Catalog](#11-gl-transitions-catalog)
12. [Recommended Transition Map for Ika Tensei Trailer](#12-recommended-transition-map-for-ika-tensei-trailer)

---

## 1. Remotion `@remotion/transitions` — Full API

### Installation

```bash
npm install @remotion/transitions
```

### Core Concept

A transition is: **timing** (duration/easing) + **presentation** (visual effect).

```
Transition = TransitionTiming + TransitionPresentation
```

Both scenes render simultaneously during the overlap. The total duration **shortens** by the transition length:

```
total = sum(scene_durations) - sum(transition_durations)
```

### `<TransitionSeries>` — Basic Usage

```tsx
import { TransitionSeries, linearTiming, springTiming } from '@remotion/transitions';
import { fade }       from '@remotion/transitions/fade';
import { wipe }       from '@remotion/transitions/wipe';
import { slide }      from '@remotion/transitions/slide';
import { flip }       from '@remotion/transitions/flip';
import { clockWipe }  from '@remotion/transitions/clock-wipe';

export const TrailerTransitions: React.FC = () => {
  return (
    <TransitionSeries>
      {/* Scene 1: 60 frames */}
      <TransitionSeries.Sequence durationInFrames={60}>
        <SceneA />
      </TransitionSeries.Sequence>

      {/* Transition A→B: spring eased, 30 frames */}
      <TransitionSeries.Transition
        timing={springTiming({ config: { damping: 200 } })}
        presentation={fade()}
      />

      {/* Scene 2: 90 frames */}
      <TransitionSeries.Sequence durationInFrames={90}>
        <SceneB />
      </TransitionSeries.Sequence>

      {/* Transition B→C: linear, 20 frames */}
      <TransitionSeries.Transition
        timing={linearTiming({ durationInFrames: 20 })}
        presentation={wipe({ direction: 'from-top-right' })}
      />

      {/* Scene 3: 60 frames */}
      <TransitionSeries.Sequence durationInFrames={60}>
        <SceneC />
      </TransitionSeries.Sequence>
    </TransitionSeries>
  );
};
// Total = 60 + 90 + 60 - 30 - 20 = 160 frames
```

### Timings

| Timing | Import | Notes |
|--------|--------|-------|
| `linearTiming` | `@remotion/transitions` | Constant speed, `durationInFrames` required |
| `springTiming` | `@remotion/transitions` | Physics spring, `config.damping/mass/stiffness` |

```tsx
import { linearTiming, springTiming } from '@remotion/transitions';

// Linear — explicit duration
linearTiming({ durationInFrames: 30 })

// Spring — self-terminating (uses physics)
springTiming({
  config: { damping: 200, mass: 1, stiffness: 100 },
  durationRestThreshold: 0.0001,
})

// Get duration at runtime
springTiming({ config: { damping: 200 } }).getDurationInFrames({ fps: 30 }); // ~23
```

### `presentationDirection` & `presentationProgress`

Every custom presentation receives:

- **`presentationDirection`**: `"entering"` | `"exiting"` — which scene is this component wrapping?
- **`presentationProgress`**: `0 → 1` — how far through the transition (0 = start, 1 = end)
- **`presentationDurationInFrames`**: total frames of this transition
- **`passedProps`**: developer-defined extra props

**Key insight**: Both the entering AND exiting scenes receive a `TransitionPresentationComponentProps`. You write one component, but it renders twice per frame with different `presentationDirection`.

### `<TransitionSeries.Overlay>` (v4.0.415+)

Overlays render ON TOP of the cut without shortening duration. Perfect for flash frames, light leaks, energy bursts:

```tsx
import { LightLeak } from '@remotion/light-leaks';

<TransitionSeries>
  <TransitionSeries.Sequence durationInFrames={60}>
    <SceneA />
  </TransitionSeries.Sequence>

  {/* Flash frame overlay — 8 frames centered on cut */}
  <TransitionSeries.Overlay durationInFrames={8}>
    <WhiteFlash />
  </TransitionSeries.Overlay>

  <TransitionSeries.Sequence durationInFrames={60}>
    <SceneB />
  </TransitionSeries.Sequence>
</TransitionSeries>
```

### Enter/Exit Only (no scene swap)

```tsx
// Just animate entrance of a single scene
<TransitionSeries>
  <TransitionSeries.Transition
    presentation={slide({ direction: 'from-bottom' })}
    timing={linearTiming({ durationInFrames: 30 })}
  />
  <TransitionSeries.Sequence durationInFrames={90}>
    <TitleCard />
  </TransitionSeries.Sequence>
</TransitionSeries>
```

---

## 2. Built-in Presentations Reference

### `fade()`

```tsx
import { fade } from '@remotion/transitions/fade';

// Entering scene fades in (opacity 0→1)
// Exiting scene stays opaque by default
fade()
fade({ shouldFadeOutExitingScene: true }) // cross-fade
fade({ enterStyle: { filter: 'blur(10px)' } }) // blur fade
```

### `slide()`

```tsx
import { slide } from '@remotion/transitions/slide';

// Entering pushes out exiting
slide()                              // default: from-left
slide({ direction: 'from-right' })
slide({ direction: 'from-top' })
slide({ direction: 'from-bottom' })
```

### `wipe()`

```tsx
import { wipe } from '@remotion/transitions/wipe';

// Entering slides OVER exiting (reveal wipe)
wipe()                                    // from-left
wipe({ direction: 'from-top-right' })
wipe({ direction: 'from-bottom-left' })
// All 8 directions: from-left, from-top-left, from-top, from-top-right,
//                   from-right, from-bottom-right, from-bottom, from-bottom-left
```

**Under the hood** — uses SVG `clipPath` with path coordinates in objectBoundingBox:

```tsx
// from-top-left path at progress=0.5:
// M 0 0 → L 1.0 0 → L 0 1.0 → Z  (triangle, top-left to bottom-left to top-right)
```

### `flip()`

```tsx
import { flip } from '@remotion/transitions/flip';

flip()                                // from-left (horizontal flip)
flip({ direction: 'from-top' })       // vertical flip
flip({ perspective: 800 })            // closer perspective = more dramatic
```

### `clockWipe()`

```tsx
import { clockWipe } from '@remotion/transitions/clock-wipe';
import { useVideoConfig } from 'remotion';

const { width, height } = useVideoConfig();
clockWipe({ width, height })  // circular sweep reveal, requires dimensions
```

---

## 3. Custom Presentations — How to Build Your Own

### Boilerplate

```tsx
import type {
  TransitionPresentation,
  TransitionPresentationComponentProps,
} from '@remotion/transitions';
import { AbsoluteFill } from 'remotion';

// 1. Define your props
type MyTransitionProps = {
  color?: string;
};

// 2. Write the component
const MyTransitionPresentation: React.FC<
  TransitionPresentationComponentProps<MyTransitionProps>
> = ({
  children,
  presentationDirection,   // 'entering' | 'exiting'
  presentationProgress,    // 0 → 1
  passedProps,
}) => {
  const isEntering = presentationDirection === 'entering';
  
  // Your effect here — children is the scene content
  return (
    <AbsoluteFill style={{ /* your styles */ }}>
      {children}
    </AbsoluteFill>
  );
};

// 3. Export the factory function
export const myTransition = (
  props?: MyTransitionProps
): TransitionPresentation<MyTransitionProps> => ({
  component: MyTransitionPresentation,
  props: props ?? {},
});
```

### Usage

```tsx
<TransitionSeries.Transition
  presentation={myTransition({ color: '#ff00ff' })}
  timing={springTiming({ config: { damping: 200 } })}
/>
```

### Star Mask Example (from Remotion docs)

```tsx
import { getBoundingBox, translatePath } from '@remotion/paths';
import { makeStar } from '@remotion/shapes';
import type { TransitionPresentationComponentProps } from '@remotion/transitions';
import React, { useMemo, useState } from 'react';
import { AbsoluteFill, random } from 'remotion';

type StarProps = { width: number; height: number };

const StarPresentation: React.FC<TransitionPresentationComponentProps<StarProps>> = ({
  children, presentationDirection, presentationProgress, passedProps,
}) => {
  const finishedRadius = Math.sqrt(passedProps.width ** 2 + passedProps.height ** 2) / 2;
  const innerRadius = finishedRadius * presentationProgress;
  const outerRadius = finishedRadius * 2 * presentationProgress;
  
  const { path } = makeStar({ innerRadius, outerRadius, points: 5 });
  const boundingBox = getBoundingBox(path);
  const translatedPath = translatePath(
    path,
    passedProps.width / 2 - boundingBox.width / 2,
    passedProps.height / 2 - boundingBox.height / 2
  );
  
  const [clipId] = useState(() => String(random(null)));
  
  const style: React.CSSProperties = {
    width: '100%',
    height: '100%',
    clipPath: presentationDirection === 'exiting' ? undefined : `url(#${clipId})`,
  };
  
  return (
    <AbsoluteFill>
      <AbsoluteFill style={style}>{children}</AbsoluteFill>
      {presentationDirection === 'entering' && (
        <AbsoluteFill>
          <svg>
            <defs>
              <clipPath id={clipId}>
                <path d={translatedPath} fill="black" />
              </clipPath>
            </defs>
          </svg>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};

export const starTransition = (props: StarProps): TransitionPresentation<StarProps> => ({
  component: StarPresentation,
  props,
});
```

---

## 4. Pixel Dissolve Transition

**Concept**: Scene breaks into blocks/pixels that scatter or dissolve, revealing the next scene. Uses noise-based thresholding — pixels with noise value < progress reveal the new scene.

### CSS/Canvas approach (pure React/Remotion)

```tsx
import React, { useRef, useEffect } from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import type { TransitionPresentationComponentProps } from '@remotion/transitions';

type PixelDissolveProps = {
  pixelSize?: number;    // block size in px (e.g. 4, 8, 16)
  seed?: number;
};

// Seeded pseudo-random — must be deterministic (same seed = same output)
function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const PixelDissolvePresentation: React.FC<
  TransitionPresentationComponentProps<PixelDissolveProps>
> = ({ children, presentationDirection, presentationProgress, passedProps }) => {
  const { width, height } = useVideoConfig();
  const pixelSize = passedProps.pixelSize ?? 8;
  const seed = passedProps.seed ?? 42;

  const isEntering = presentationDirection === 'entering';
  const clipRef = useRef<SVGClipPathElement>(null);
  const clipId = `pixel-dissolve-${seed}-${isEntering ? 'in' : 'out'}`;

  // Build a grid of rectangles. Each cell's visibility is controlled by
  // whether its noise value is < progress (for entering) or > progress (for exiting).
  const cols = Math.ceil(width / pixelSize);
  const rows = Math.ceil(height / pixelSize);
  
  const rand = seededRandom(seed);
  const rects: React.ReactNode[] = [];
  
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const threshold = rand();
      const visible = isEntering
        ? threshold < presentationProgress           // reveal as progress grows
        : threshold > presentationProgress;          // hide as progress grows
      
      if (visible) {
        rects.push(
          <rect
            key={`${row}-${col}`}
            x={col * pixelSize}
            y={row * pixelSize}
            width={pixelSize}
            height={pixelSize}
          />
        );
      }
    }
  }

  return (
    <AbsoluteFill>
      <AbsoluteFill
        style={{
          clipPath: `url(#${clipId})`,
        }}
      >
        {children}
      </AbsoluteFill>
      <AbsoluteFill>
        <svg
          width={width}
          height={height}
          style={{ position: 'absolute', pointerEvents: 'none' }}
        >
          <defs>
            <clipPath id={clipId}>{rects}</clipPath>
          </defs>
        </svg>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const pixelDissolve = (
  props?: PixelDissolveProps
): import('@remotion/transitions').TransitionPresentation<PixelDissolveProps> => ({
  component: PixelDissolvePresentation,
  props: props ?? {},
});
```

### Usage

```tsx
<TransitionSeries.Transition
  presentation={pixelDissolve({ pixelSize: 8, seed: 42 })}
  timing={linearTiming({ durationInFrames: 30 })}
/>
```

### Performance Note

For large canvases (1920×1080) with pixelSize=4 you'd have ~129,600 SVG rects per frame. Use `pixelSize >= 8` for real-time preview. For rendering, fine.

### Scatter Variant (pixels fly off-screen)

```tsx
// Instead of just showing/hiding, also apply a transform to scattered pixels
const ScatterPixelPresentation: React.FC<...> = ({
  children, presentationDirection, presentationProgress, passedProps
}) => {
  // Entering: pixels fly IN from random directions
  // Exiting: pixels fly OUT to random directions
  
  const rand = seededRandom(passedProps.seed ?? 1);
  // For each pixel, interpolate position from (random_offset) → (0,0) for entering
  // Canvas 2D approach is more performant for this variant
  // See: draw pixel-by-pixel using offscreenCanvas
  ...
};
```

---

## 5. Geometric Wipes (Triangles, Hexagons, Circles)

### Strategy

Use SVG `clipPath` with animated geometric shapes. `presentationProgress` drives shape growth.

### Circle Expand Wipe

```tsx
import React, { useState } from 'react';
import { AbsoluteFill, random } from 'remotion';
import type { TransitionPresentationComponentProps } from '@remotion/transitions';

type CircleWipeProps = {
  originX?: number;   // 0-1, default 0.5 (center)
  originY?: number;   // 0-1, default 0.5 (center)
};

const CircleWipePresentation: React.FC<
  TransitionPresentationComponentProps<CircleWipeProps>
> = ({ children, presentationDirection, presentationProgress, passedProps }) => {
  const { originX = 0.5, originY = 0.5 } = passedProps;
  const [clipId] = useState(() => `circle-wipe-${String(random(null))}`);
  
  const isEntering = presentationDirection === 'entering';
  
  // Radius grows from 0 to just past diagonal (1.5 covers corners)
  const maxRadius = Math.sqrt(
    Math.max(originX, 1 - originX) ** 2 + Math.max(originY, 1 - originY) ** 2
  ) * Math.sqrt(2) * 1.1;
  
  const radius = isEntering
    ? presentationProgress * maxRadius
    : (1 - presentationProgress) * maxRadius;

  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ clipPath: `url(#${clipId})` }}>
        {children}
      </AbsoluteFill>
      <AbsoluteFill>
        <svg viewBox="0 0 1 1" style={{ width: '100%', height: '100%', pointerEvents: 'none' }}>
          <defs>
            <clipPath id={clipId} clipPathUnits="objectBoundingBox">
              <circle cx={originX} cy={originY} r={radius} />
            </clipPath>
          </defs>
        </svg>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const circleWipe = (
  props?: CircleWipeProps
) => ({ component: CircleWipePresentation, props: props ?? {} });
```

### Hexagon Tile Wipe

```tsx
// Each hex tile reveals at a different time based on distance from center
// hex grid + staggered reveal = very anime-like effect

function hexPath(cx: number, cy: number, r: number): string {
  const pts = Array.from({ length: 6 }, (_, i) => {
    const angle = (Math.PI / 3) * i - Math.PI / 6;
    return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`;
  });
  return `M ${pts.join(' L ')} Z`;
}

const HexWipePresentation: React.FC<
  TransitionPresentationComponentProps<{ cols?: number }>
> = ({ children, presentationDirection, presentationProgress, passedProps }) => {
  const cols = passedProps.cols ?? 8;
  const rows = Math.ceil(cols * 0.577); // hexagonal aspect ratio
  const [clipId] = useState(() => `hex-${String(random(null))}`);
  
  const hexes: React.ReactNode[] = [];
  
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const cx = (col + (row % 2) * 0.5) / cols;
      const cy = row / rows;
      
      // Distance from center → stagger timing
      const dx = cx - 0.5;
      const dy = cy - 0.5;
      const dist = Math.sqrt(dx * dx + dy * dy) / 0.707; // normalize to 0-1
      
      // Entering: hexes reveal outward from center
      const threshold = presentationDirection === 'entering' ? dist : 1 - dist;
      const active = presentationDirection === 'entering'
        ? presentationProgress > threshold * 0.6   // fan out from center
        : presentationProgress < (1 - threshold * 0.6); // collapse to center
      
      if (active) {
        const hexRadius = 0.7 / cols;
        hexes.push(<path key={`${row}-${col}`} d={hexPath(cx, cy, hexRadius)} />);
      }
    }
  }

  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ clipPath: `url(#${clipId})` }}>{children}</AbsoluteFill>
      <AbsoluteFill>
        <svg viewBox="0 0 1 1" style={{ width: '100%', height: '100%', pointerEvents: 'none' }}>
          <defs>
            <clipPath id={clipId} clipPathUnits="objectBoundingBox">
              {hexes}
            </clipPath>
          </defs>
        </svg>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
```

### Triangle Burst (anime card flip style)

```tsx
// Multiple triangles from screen edges pointing inward, then revealing outward
// Uses CSS clip-path polygon

const TriangleBurstPresentation: React.FC<
  TransitionPresentationComponentProps<{ slices?: number }>
> = ({ children, presentationDirection, presentationProgress, passedProps }) => {
  const slices = passedProps.slices ?? 8;
  const isEntering = presentationDirection === 'entering';
  
  // Each slice is a vertical strip with a sawtooth edge
  // As progress grows, the jagged line sweeps across screen
  const p = isEntering ? presentationProgress : 1 - presentationProgress;
  
  const clipPolygon = Array.from({ length: slices + 1 }, (_, i) => {
    const x = (i / slices) * 100;
    // Alternate triangles up/down for sawtooth edge
    const offset = i % 2 === 0 ? 20 : -20;
    return `${x}% ${50 + offset * (1 - p)}%`;
  });
  
  // Rectangle from left edge up to the sawtooth line
  const leftPart = `0% 0%, 100% 0%, ${clipPolygon.join(', ')}, 100% 100%, 0% 100%`;

  return (
    <AbsoluteFill
      style={{
        clipPath: `polygon(${leftPart})`,
      }}
    >
      {children}
    </AbsoluteFill>
  );
};
```

---

## 6. Glitch Transitions (RGB Split + Noise + Displacement)

### Pure CSS/React Glitch (no WebGL needed)

```tsx
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import type { TransitionPresentationComponentProps } from '@remotion/transitions';

type GlitchProps = {
  intensity?: number;     // 0-1, default 0.5
  slices?: number;        // horizontal scan-line slices, default 8
};

// Hash function for deterministic "random" per frame
const hash = (n: number) => ((Math.sin(n) * 43758.5453) % 1 + 1) % 1;

const GlitchTransitionPresentation: React.FC<
  TransitionPresentationComponentProps<GlitchProps>
> = ({ children, presentationDirection, presentationProgress, passedProps }) => {
  const frame = useCurrentFrame();
  const intensity = (passedProps.intensity ?? 0.5) * presentationProgress;
  const slices = passedProps.slices ?? 8;
  const isEntering = presentationDirection === 'entering';
  
  // RGB channel split
  const rShift = intensity * 40 * hash(frame * 1.1);   // pixels
  const gShift = intensity * 20 * hash(frame * 2.3);
  const bShift = intensity * 30 * hash(frame * 3.7);
  
  // Vertical scan-line distortion
  const yOffset = interpolate(presentationProgress, [0, 0.5, 1], [0, 1, 0]);
  
  // Horizontal slice offsets
  const sliceOffsets = Array.from({ length: slices }, (_, i) => 
    (hash(frame * 0.7 + i * 100) - 0.5) * intensity * 60
  );
  
  const opacity = isEntering ? presentationProgress : 1 - presentationProgress;
  
  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      {/* Red channel — offset left */}
      <AbsoluteFill
        style={{
          mixBlendMode: 'screen',
          filter: 'url(#red-channel)',
          transform: `translateX(${-rShift}px)`,
          opacity: opacity * 0.8,
        }}
      >
        {children}
      </AbsoluteFill>
      
      {/* Green channel — centered */}
      <AbsoluteFill
        style={{
          mixBlendMode: 'screen',
          filter: 'url(#green-channel)',
          transform: `translateX(${gShift * 0.3}px)`,
          opacity,
        }}
      >
        {children}
      </AbsoluteFill>
      
      {/* Blue channel — offset right */}
      <AbsoluteFill
        style={{
          mixBlendMode: 'screen',
          filter: 'url(#blue-channel)',
          transform: `translateX(${bShift}px)`,
          opacity: opacity * 0.8,
        }}
      >
        {children}
      </AbsoluteFill>
      
      {/* SVG filters for color channel separation */}
      <svg style={{ position: 'absolute', width: 0, height: 0 }}>
        <defs>
          <filter id="red-channel">
            <feColorMatrix type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0"/>
          </filter>
          <filter id="green-channel">
            <feColorMatrix type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0"/>
          </filter>
          <filter id="blue-channel">
            <feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0"/>
          </filter>
        </defs>
      </svg>
    </AbsoluteFill>
  );
};
```

### GL Transitions — GlitchMemories GLSL (reference)

From `gl-transitions/gl-transitions`:

```glsl
// GlitchMemories.glsl — Author: Gunnar Roth, based on natewave
// License: MIT

vec4 transition(vec2 p) {
  // Block-based noise (16x16 grid)
  vec2 block = floor(p.xy / vec2(16));
  vec2 uv_noise = block / vec2(64);
  uv_noise += floor(vec2(progress) * vec2(1200.0, 3500.0)) / vec2(64);
  
  // Displacement decreases as progress approaches 1
  vec2 dist = progress > 0.0
    ? (fract(uv_noise) - 0.5) * 0.3 * (1.0 - progress)
    : vec2(0.0);
    
  // RGB channel split with different displacement amounts
  vec2 red   = p + dist * 0.2;
  vec2 green = p + dist * 0.3;
  vec2 blue  = p + dist * 0.5;
  
  return vec4(
    mix(getFromColor(red),   getToColor(red),   progress).r,
    mix(getFromColor(green), getToColor(green), progress).g,
    mix(getFromColor(blue),  getToColor(blue),  progress).b,
    1.0
  );
}
```

### GL Transitions — GlitchDisplace GLSL (reference)

```glsl
// GlitchDisplace.glsl — Author: Matt DesLauriers
// License: MIT

float random(vec2 co) {
  float a = 12.9898, b = 78.233, c = 43758.5453;
  return fract(sin(dot(co.xy, vec2(a, b))) * c);
}

float voronoi(in vec2 x) {
  // Voronoi-based noise for organic displacement
  vec2 p = floor(x), f = fract(x);
  float res = 8.0;
  for (float j = -1.; j <= 1.; j++)
  for (float i = -1.; i <= 1.; i++) {
    vec2 b = vec2(i, j);
    vec2 r = b - f + random(p + b);
    float d = dot(r, r);
    res = min(res, d);
  }
  return sqrt(res);
}

vec4 transition(vec2 uv) {
  vec4 color1 = getFromColor(uv);
  vec4 color2 = getToColor(uv);
  
  // Displace based on voronoi noise, strength reduces as transition completes
  vec2 disp  = displace(color1, uv, 0.33, 0.7, 1.0 - ease1(progress));
  vec2 disp2 = displace(color2, uv, 0.33, 0.5, ease2(progress));
  
  vec4 dColor1 = getToColor(disp);
  vec4 dColor2 = getFromColor(disp2);
  
  // Grayscale flash during transition mid-point
  vec3 gray = vec3(dot(min(dColor2, dColor1).rgb, vec3(0.299, 0.587, 0.114)));
  dColor2 = vec4(gray * 2.0, 1.0);
  
  color1 = mix(color1, dColor2, smoothstep(0.0, 0.5, progress));
  color2 = mix(color2, dColor1, smoothstep(1.0, 0.5, progress));
  return mix(color1, color2, ease1(progress));
}
```

### Remotion Implementation via Canvas + OffscreenCanvas

For true GLSL glitch effects in Remotion, use `<OffthreadVideo>` or canvas drawing:

```tsx
// Approach: render children to canvas, apply WebGL shader, output result
// This requires using Remotion's <Canvas> with a WebGL context
// See: remotion.dev/docs/canvas

import { useRef, useEffect } from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';

export const GlitchCanvas: React.FC<{ progress: number }> = ({ progress }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { width, height } = useVideoConfig();
  const frame = useCurrentFrame();
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext('webgl2');
    if (!gl) return;
    
    // Initialize shader program, textures, etc.
    // Apply GlitchMemories algorithm in JS approximation:
    // ... (full WebGL setup omitted for brevity)
  }, [frame, progress]);
  
  return <canvas ref={canvasRef} width={width} height={height} />;
};
```

---

## 7. Anime-Style Eye Catch

**Concept**: Fast (4-8 frame) geometric pattern flash that acts as a hard cut punctuation — used in anime for commercial breaks, power-up moments, dramatic reveals. Typically: bold shapes expand from center → white flash → new scene.

### Classic Anime Eye Catch Structure

```
Frame 0-2:  Geometric pattern SLAMS in (triangles/diamonds/stripes from edges)
Frame 2-4:  Pattern fills screen + COLOR INVERT flash 
Frame 4-6:  White/black flash frame
Frame 6-8:  New scene slams in through the flash
```

### Implementation

```tsx
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import type { TransitionPresentationComponentProps } from '@remotion/transitions';

type EyeCatchProps = {
  color?: string;          // dominant flash color, default '#ffffff'
  stripes?: number;        // number of stripes, default 6
  style?: 'stripes' | 'diamonds' | 'radial'; // default 'stripes'
};

const EyeCatchPresentation: React.FC<
  TransitionPresentationComponentProps<EyeCatchProps>
> = ({ children, presentationDirection, presentationProgress, passedProps }) => {
  const { color = '#ffffff', stripes = 6, style = 'stripes' } = passedProps;
  const isEntering = presentationDirection === 'entering';
  
  // Eye catch has 3 phases:
  // Phase 1 (0.0-0.4): Stripes slam in from edges
  // Phase 2 (0.4-0.6): Full color flash
  // Phase 3 (0.6-1.0): Stripes retract, new scene revealed
  
  const phase = presentationProgress;
  
  // Stripe expansion
  const stripeProgress = isEntering
    ? interpolate(phase, [0, 0.4], [0, 1], { extrapolateRight: 'clamp' })
    : interpolate(phase, [0.6, 1], [1, 0], { extrapolateLeft: 'clamp' });
  
  // Flash opacity
  const flashOpacity = interpolate(
    phase,
    [0.35, 0.5, 0.65],
    [0, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );
  
  // Scene opacity
  const sceneOpacity = isEntering
    ? interpolate(phase, [0.5, 0.8], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
    : interpolate(phase, [0, 0.5], [1, 0], { extrapolateRight: 'clamp' });
  
  // Generate stripe paths
  const stripePaths: React.ReactNode[] = [];
  for (let i = 0; i < stripes; i++) {
    const t = i / stripes;
    const width = 1 / stripes;
    
    if (style === 'stripes') {
      // Vertical stripes slam in from top and bottom alternating
      const fromTop = i % 2 === 0;
      const y = fromTop
        ? -1 + stripeProgress * 2    // top → center
        : 1 - stripeProgress * 2;    // bottom → center
      
      stripePaths.push(
        <rect
          key={i}
          x={t}
          y={fromTop ? y : y}
          width={width}
          height={1}
          fill={color}
          fillOpacity={0.9}
        />
      );
    } else if (style === 'diamonds') {
      // Diamonds expand from center outward
      const cx = (i / (stripes - 1)) * 0.8 + 0.1;
      const cy = 0.5;
      const r = stripeProgress * 0.15;
      stripePaths.push(
        <polygon
          key={i}
          points={`${cx},${cy - r} ${cx + r},${cy} ${cx},${cy + r} ${cx - r},${cy}`}
          fill={color}
          fillOpacity={0.9}
        />
      );
    }
  }
  
  return (
    <AbsoluteFill>
      {/* Scene content */}
      <AbsoluteFill style={{ opacity: sceneOpacity }}>
        {children}
      </AbsoluteFill>
      
      {/* Stripe overlay */}
      <AbsoluteFill>
        <svg
          viewBox="0 0 1 1"
          style={{ width: '100%', height: '100%', pointerEvents: 'none' }}
          preserveAspectRatio="none"
        >
          {stripePaths}
        </svg>
      </AbsoluteFill>
      
      {/* White flash */}
      <AbsoluteFill
        style={{
          backgroundColor: color,
          opacity: flashOpacity,
          pointerEvents: 'none',
        }}
      />
    </AbsoluteFill>
  );
};

export const eyeCatch = (
  props?: EyeCatchProps
) => ({ component: EyeCatchPresentation, props: props ?? {} });
```

### Usage (very short, 8 frames total at 30fps)

```tsx
<TransitionSeries.Transition
  presentation={eyeCatch({ color: '#ff6600', stripes: 8, style: 'stripes' })}
  timing={linearTiming({ durationInFrames: 8 })}
/>
```

### Ika Tensei Variant — Kanji Flash Eye Catch

```tsx
// Flash a kanji character (e.g. 「転生」) as the eye catch element
const IkaEyeCatch: React.FC<{ char: string }> = ({ char }) => (
  <AbsoluteFill style={{
    background: 'linear-gradient(135deg, #ff6600 0%, #ff0099 50%, #0066ff 100%)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  }}>
    <span style={{
      fontSize: 300, fontWeight: 900, color: 'white',
      textShadow: '0 0 60px #ff6600, 0 0 120px #ff0099',
      letterSpacing: '-0.05em',
    }}>
      {char}
    </span>
  </AbsoluteFill>
);
```

---

## 8. Portal / Void Transition (Black Hole / Expanding)

**Concept**: A circle of darkness (or light) grows from a point, swallowing the screen — or an event horizon forms. Used for dimensional/isekai "falling into another world" moments.

### Void Swallow (circle grows to black, then new scene emerges from center)

```tsx
type VoidProps = {
  voidColor?: string;      // default '#000000'
  cx?: number;             // origin x (0-1), default 0.5
  cy?: number;             // origin y (0-1), default 0.5
  distortion?: number;     // wavy edge distortion amount 0-1, default 0.3
};

const VoidTransitionPresentation: React.FC<
  TransitionPresentationComponentProps<VoidProps>
> = ({ children, presentationDirection, presentationProgress, passedProps }) => {
  const {
    voidColor = '#000000',
    cx = 0.5,
    cy = 0.5,
    distortion = 0.3,
  } = passedProps;
  
  const frame = useCurrentFrame();
  const isEntering = presentationDirection === 'entering';
  const [clipId] = useState(() => `void-${String(random(null))}`);
  
  // For entering: void OPENS (black circle shrinks to reveal scene)
  // For exiting: void CLOSES (scene gets swallowed by growing black circle)
  
  const maxR = Math.sqrt(Math.max(cx, 1-cx)**2 + Math.max(cy, 1-cy)**2) * 1.5;
  
  const circleR = isEntering
    ? (1 - presentationProgress) * maxR   // shrink from full to 0
    : presentationProgress * maxR;         // grow from 0 to full
  
  // Wobbling edge — makes it feel alive (black hole event horizon)
  const points = 64;
  const wobblyCircle = Array.from({ length: points }, (_, i) => {
    const angle = (i / points) * Math.PI * 2;
    const wobble = 1 + distortion * Math.sin(angle * 5 + frame * 0.3) * presentationProgress;
    const r = circleR * wobble;
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    return `${x},${y}`;
  }).join(' ');
  
  // Clip: for exiting, we want to SHOW the void (clip = the circle, showing void)
  // For entering, clip = everything EXCEPT the void circle
  
  if (isEntering) {
    // Exiting scene clips to the shrinking void circle (what remains of old scene)
    return (
      <AbsoluteFill>
        <AbsoluteFill style={{ clipPath: `url(#${clipId})` }}>
          {children}
        </AbsoluteFill>
        {/* Void fill */}
        <AbsoluteFill style={{ backgroundColor: voidColor, zIndex: -1 }} />
        <AbsoluteFill>
          <svg viewBox="0 0 1 1" style={{ width: '100%', height: '100%', pointerEvents: 'none' }}>
            <defs>
              <clipPath id={clipId} clipPathUnits="objectBoundingBox">
                {/* Keep scene visible where void hasn't eaten yet */}
                {/* Complex: invert the circle — use even-odd fill rule */}
                <rect x="0" y="0" width="1" height="1" />
                <polygon points={wobblyCircle} />
              </clipPath>
            </defs>
          </svg>
        </AbsoluteFill>
      </AbsoluteFill>
    );
  }
  
  // Exiting: scene gets swallowed
  return (
    <AbsoluteFill>
      <AbsoluteFill>{children}</AbsoluteFill>
      {/* Void overlay — black circle grows */}
      <AbsoluteFill>
        <svg viewBox="0 0 1 1" style={{ width: '100%', height: '100%', pointerEvents: 'none' }}>
          <polygon points={wobblyCircle} fill={voidColor} />
          {/* Energy glow ring at event horizon */}
          <polygon
            points={wobblyCircle}
            fill="none"
            stroke="#7b00ff"
            strokeWidth={0.01 * presentationProgress}
            strokeOpacity={0.8 * presentationProgress}
            filter="url(#glow)"
          />
          <defs>
            <filter id="glow">
              <feGaussianBlur stdDeviation="0.005" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>
        </svg>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const voidTransition = (props?: VoidProps) => ({
  component: VoidTransitionPresentation,
  props: props ?? {},
});
```

### Usage for Isekai "Falling In" Moment

```tsx
<TransitionSeries.Transition
  presentation={voidTransition({
    voidColor: '#0a0010',
    distortion: 0.4,
    cx: 0.5, cy: 0.5,
  })}
  timing={springTiming({
    config: { damping: 80, stiffness: 100 },
    durationRestThreshold: 0.001,
  })}
/>
```

---

## 9. Fire / Energy Wipe Transition

**Concept**: A wave of fire/plasma energy sweeps across the screen, consuming the old scene and birthing the new one. Used in action trailers.

### CSS Filter Approach

```tsx
type FireWipeProps = {
  direction?: 'left-to-right' | 'right-to-left' | 'top-to-bottom' | 'bottom-to-top';
  color1?: string;   // inner fire color, default '#ff4400'
  color2?: string;   // outer glow, default '#ffaa00'
  thickness?: number; // flame edge thickness as fraction (0-0.2), default 0.08
};

const FireWipePresentation: React.FC<
  TransitionPresentationComponentProps<FireWipeProps>
> = ({ children, presentationDirection, presentationProgress, passedProps }) => {
  const frame = useCurrentFrame();
  const {
    direction = 'left-to-right',
    color1 = '#ff4400',
    color2 = '#ffaa00',
    thickness = 0.08,
  } = passedProps;
  
  const isEntering = presentationDirection === 'entering';
  const p = isEntering ? presentationProgress : 1 - presentationProgress;
  
  // Turbulent fire edge using SVG feTurbulence
  const turbFreq = 0.04 + presentationProgress * 0.02;
  const turbOctaves = 4;
  const seed = Math.floor(frame * 0.5); // slow-changing seed
  
  // The wipe line position
  const [clipId] = useState(() => `fire-${String(random(null))}`);
  const [filterId] = useState(() => `fire-filter-${String(random(null))}`);
  
  // For left-to-right: clip rect from left edge to p * width
  const clipRect = {
    'left-to-right':  { x: 0,   y: 0, w: p,   h: 1 },
    'right-to-left':  { x: 1-p, y: 0, w: p,   h: 1 },
    'top-to-bottom':  { x: 0,   y: 0, w: 1,   h: p },
    'bottom-to-top':  { x: 0,   y: 1-p, w: 1, h: p },
  }[direction];
  
  return (
    <AbsoluteFill>
      {/* Scene content with turbulent clip */}
      <AbsoluteFill style={{ clipPath: `url(#${clipId})` }}>
        {children}
      </AbsoluteFill>
      
      {/* Fire edge glow */}
      <AbsoluteFill>
        <svg
          viewBox="0 0 1 1"
          style={{ width: '100%', height: '100%', pointerEvents: 'none' }}
          preserveAspectRatio="none"
        >
          <defs>
            {/* Turbulence-distorted clip path */}
            <filter id={filterId} x="-20%" y="-20%" width="140%" height="140%">
              <feTurbulence
                type="fractalNoise"
                baseFrequency={turbFreq}
                numOctaves={turbOctaves}
                seed={seed}
                result="turbulence"
              />
              <feDisplacementMap
                in="SourceGraphic"
                in2="turbulence"
                scale={0.04}
                xChannelSelector="R"
                yChannelSelector="G"
                result="displaced"
              />
              <feGaussianBlur in="displaced" stdDeviation="0.002" />
            </filter>
            
            <clipPath id={clipId} clipPathUnits="objectBoundingBox">
              <rect
                {...clipRect}
                filter={`url(#${filterId})`}
              />
            </clipPath>
          </defs>
          
          {/* Fire glow at the edge */}
          <rect
            x={direction === 'left-to-right' ? p - thickness : clipRect.x}
            y={direction === 'top-to-bottom' ? p - thickness : clipRect.y}
            width={['left-to-right', 'right-to-left'].includes(direction) ? thickness : 1}
            height={['top-to-bottom', 'bottom-to-top'].includes(direction) ? thickness : 1}
            fill={`url(#fireGrad-${clipId})`}
            opacity={Math.sin(presentationProgress * Math.PI)}
          />
          
          <defs>
            <linearGradient id={`fireGrad-${clipId}`} x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%" stopColor={color1} stopOpacity="0"/>
              <stop offset="30%" stopColor={color1} stopOpacity="1"/>
              <stop offset="60%" stopColor={color2} stopOpacity="1"/>
              <stop offset="100%" stopColor={color2} stopOpacity="0"/>
            </linearGradient>
          </defs>
        </svg>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const fireWipe = (props?: FireWipeProps) => ({
  component: FireWipePresentation,
  props: props ?? {},
});
```

### Usage

```tsx
<TransitionSeries.Transition
  presentation={fireWipe({ direction: 'left-to-right', color1: '#ff2200', color2: '#ff8800' })}
  timing={linearTiming({ durationInFrames: 25 })}
/>
```

---

## 10. Cross-Dissolve with Color Shift

**Concept**: Fade between scenes, but with a color temperature or hue rotation shift mid-transition. Creates a dreamy, JRPG-cutscene feel.

### Hue Rotate Dissolve

```tsx
type ColorShiftDissolveProps = {
  hueShift?: number;      // degrees of hue rotation at peak, default 30
  saturationBoost?: number; // saturation multiplier at peak, default 1.5
  brightnessBoost?: number; // brightness at peak, default 1.2
};

const ColorShiftDissolvePresentation: React.FC<
  TransitionPresentationComponentProps<ColorShiftDissolveProps>
> = ({ children, presentationDirection, presentationProgress, passedProps }) => {
  const {
    hueShift = 30,
    saturationBoost = 1.5,
    brightnessBoost = 1.2,
  } = passedProps;
  
  const isEntering = presentationDirection === 'entering';
  
  // Mid-transition peaks at progress = 0.5
  const peakIntensity = Math.sin(presentationProgress * Math.PI);
  
  const opacity = isEntering
    ? presentationProgress
    : 1 - presentationProgress;
  
  // CSS filter: hue-rotate + saturate + brightness
  const filter = [
    `hue-rotate(${peakIntensity * hueShift}deg)`,
    `saturate(${1 + peakIntensity * (saturationBoost - 1)})`,
    `brightness(${1 + peakIntensity * (brightnessBoost - 1)})`,
  ].join(' ');
  
  return (
    <AbsoluteFill style={{ opacity, filter }}>
      {children}
    </AbsoluteFill>
  );
};

export const colorShiftDissolve = (props?: ColorShiftDissolveProps) => ({
  component: ColorShiftDissolvePresentation,
  props: props ?? {},
});
```

### Usage

```tsx
<TransitionSeries.Transition
  presentation={colorShiftDissolve({ hueShift: 45, saturationBoost: 2 })}
  timing={springTiming({ config: { damping: 200 } })}
/>
```

### Bleach Bypass (de-saturate + overexpose at peak)

```tsx
// Creates the "bleach bypass" film look common in action trailers
const bleachBypassStyle = (progress: number): React.CSSProperties => {
  const peak = Math.sin(progress * Math.PI);
  return {
    filter: `
      saturate(${1 - peak * 0.8})
      brightness(${1 + peak * 0.5})
      contrast(${1 + peak * 0.3})
    `,
  };
};
```

### Complementary Color Flash (for impact cuts)

```tsx
// At mid-transition, briefly invert colors for a single-frame pop
const invertAtPeak = (progress: number): React.CSSProperties => ({
  filter: `invert(${progress > 0.45 && progress < 0.55 ? 1 : 0})`,
});
```

---

## 11. GL Transitions Catalog

The `gl-transitions` open-source library (MIT) provides 50+ GLSL shaders. These run in WebGL and are the "gold standard" for GPU-accelerated transitions. To use in Remotion, they must be ported to React/canvas.

**Most Relevant for Ika Tensei:**

| Shader | Effect | Use Case |
|--------|--------|----------|
| `GlitchMemories.glsl` | Block noise + RGB split | Dimensional glitch |
| `GlitchDisplace.glsl` | Voronoi displacement + grayscale | Reality distortion |
| `FilmBurn.glsl` | Organic fire-like noise burn | Ancient scroll reveal |
| `Mosaic.glsl` | Rotating tile mosaic | Comic panel transition |
| `CircleCrop.glsl` | Circle crop reveal | Spotlight moment |
| `ZoomInCircles.glsl` | Spinning circles zoom | Magical activation |
| `Swirl.glsl` | Swirl warp | Portal/vortex |
| `DoomScreenTransition.glsl` | Vertical column melt | Hell/death scene |
| `CrossZoom.glsl` | Zoom + cross blur | Epic reveal |
| `PolkaDotsCurtain.glsl` | Dots expanding from center | Cute/kawaii moment |
| `StaticFade.glsl` | TV static noise | System/digital transition |
| `WaterDrop.glsl` | Ripple water distortion | Aquatic / memory |

**Key GLSL API**: Every gl-transition shader uses:
- `getFromColor(vec2 uv)` → from-scene pixel
- `getToColor(vec2 uv)` → to-scene pixel  
- `progress` (0→1) → global uniform
- `transition(vec2 uv) → vec4` → output pixel

---

## 12. Recommended Transition Map for Ika Tensei Trailer

Based on the tone (JRPG / isekai / crypto / dark-cool), here's a recommended mapping:

| Scene Change | Transition | Timing | Frames |
|---|---|---|---|
| Title Card → World Map | `voidTransition` (expand from center) | springTiming damping=80 | ~35 |
| World Map → Character | `hexWipe` (hexagons fan out) | linearTiming | 20 |
| Character intro → Action | `eyeCatch` (orange stripes) | linearTiming | 8 |
| Action → DWallet demo | `glitchTransition` (RGB split) | linearTiming | 15 |
| DWallet → Guild DAO | `colorShiftDissolve` (hue +45°) | springTiming | ~25 |
| Guild → Token stats | `wipe({ direction: 'from-top-right' })` | linearTiming | 20 |
| Stats → Final CTA | `circleWipe` (from center out) | springTiming | ~30 |
| Any hard cut | `eyeCatch` flash (1-frame white) | linearTiming | 6 |

### Complete Trailer Sequence Example

```tsx
import { TransitionSeries, linearTiming, springTiming } from '@remotion/transitions';
import { wipe } from '@remotion/transitions/wipe';
import { fade } from '@remotion/transitions/fade';

// Custom presentations (implement above)
import { eyeCatch } from './transitions/EyeCatch';
import { glitchTransition } from './transitions/Glitch';
import { voidTransition } from './transitions/Void';
import { colorShiftDissolve } from './transitions/ColorShiftDissolve';
import { circleWipe } from './transitions/CircleWipe';
import { hexWipe } from './transitions/HexWipe';

export const IkaTenseiTrailer: React.FC = () => {
  return (
    <TransitionSeries>
      <TransitionSeries.Sequence durationInFrames={90}>
        <TitleScene />
      </TransitionSeries.Sequence>

      {/* Hard impact: void opening */}
      <TransitionSeries.Transition
        presentation={voidTransition({ distortion: 0.4 })}
        timing={springTiming({ config: { damping: 80 } })}
      />

      <TransitionSeries.Sequence durationInFrames={120}>
        <WorldMapScene />
      </TransitionSeries.Sequence>

      {/* Anime eye catch — blink-and-miss */}
      <TransitionSeries.Transition
        presentation={eyeCatch({ color: '#ff6600', stripes: 8 })}
        timing={linearTiming({ durationInFrames: 8 })}
      />

      <TransitionSeries.Sequence durationInFrames={90}>
        <CharacterScene />
      </TransitionSeries.Sequence>

      {/* Glitch into blockchain section */}
      <TransitionSeries.Transition
        presentation={glitchTransition({ intensity: 0.8 })}
        timing={linearTiming({ durationInFrames: 15 })}
      />

      <TransitionSeries.Sequence durationInFrames={120}>
        <DWalletScene />
      </TransitionSeries.Sequence>

      {/* Dreamy dissolve */}
      <TransitionSeries.Transition
        presentation={colorShiftDissolve({ hueShift: 60, saturationBoost: 2 })}
        timing={springTiming({ config: { damping: 200 } })}
      />

      <TransitionSeries.Sequence durationInFrames={90}>
        <GuildScene />
      </TransitionSeries.Sequence>

      {/* Hex wipe to token reveal */}
      <TransitionSeries.Transition
        presentation={hexWipe({ cols: 10 })}
        timing={linearTiming({ durationInFrames: 20 })}
      />

      <TransitionSeries.Sequence durationInFrames={90}>
        <TokenStatsScene />
      </TransitionSeries.Sequence>

      {/* Circle iris to CTA */}
      <TransitionSeries.Transition
        presentation={circleWipe({ originX: 0.5, originY: 0.5 })}
        timing={springTiming({ config: { damping: 120 } })}
      />

      <TransitionSeries.Sequence durationInFrames={120}>
        <CTAScene />
      </TransitionSeries.Sequence>
    </TransitionSeries>
  );
};
```

---

## Summary — Key Implementation Notes

1. **Pixel dissolve**: use seeded random + SVG `clipPath` grid; deterministic = render-safe
2. **Geometric wipes**: SVG `clipPath` with `clipPathUnits="objectBoundingBox"` — works at any resolution
3. **Glitch**: CSS `mix-blend-mode: screen` + `feColorMatrix` channel separation; no WebGL needed
4. **Eye catch**: `linearTiming` with very short durations (6-10 frames); aggressive easing
5. **Void/portal**: SVG polygon with wobble (sin distortion on radius per vertex); add glow with `feGaussianBlur`
6. **Fire wipe**: `feTurbulence` + `feDisplacementMap` on clip path + gradient edge glow
7. **Color shift dissolve**: pure CSS `filter` on `AbsoluteFill` — trivial to implement
8. **TransitionSeries.Overlay**: use for flash frames (white/black hit) without affecting timing

### Dependencies

```json
{
  "@remotion/transitions": "^4.0.59",
  "@remotion/shapes": "^4.0.0",
  "@remotion/paths": "^4.0.0"
}
```

### References

- Remotion Transitions docs: https://www.remotion.dev/docs/transitions
- GL Transitions: https://github.com/gl-transitions/gl-transitions
- Built-in wipe source: https://github.com/remotion-dev/remotion/blob/main/packages/transitions/src/presentations/wipe.tsx
- Built-in fade source: https://github.com/remotion-dev/remotion/blob/main/packages/transitions/src/presentations/fade.tsx
