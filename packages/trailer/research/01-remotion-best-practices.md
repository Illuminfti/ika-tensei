# Remotion Best Practices for Hype Trailers

> Research compiled: 2026-02-18
> Purpose: Creating high-impact trailer videos for Ika Tensei

---

## Core Animation Primitives

### 1. `spring()` — Physics-Based Animation

The most powerful primitive for natural-looking motion. Perfect for "pop" effects, reveals, and anything that needs organic feel.

```tsx
import { spring, useCurrentFrame, useVideoConfig } from 'remotion';

const BouncyText = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  
  const scale = spring({
    frame,
    fps,
    config: { damping: 10, stiffness: 100 },
  });
  
  return <div style={{ transform: `scale(${scale})` }}>HELLO</div>;
};
```

**Key Parameters:**
- `damping` — Higher = less bounce (default: 10)
- `stiffness` — Higher = snappier (default: 100)
- `mass` — Lower = faster animation
- `overshootClamping` — Set `true` to prevent overshooting target
- `durationInFrames` — Force exact duration
- `delay` — Start animation later

**Hype Trailer Use Cases:**
- Text popping in with impact
- Logo reveals with bounce
- Element entrances that feel energetic

---

### 2. `interpolate()` — Value Mapping

Map any input range to output range. Essential for fades, slides, and property transitions.

```tsx
import { interpolate, useCurrentFrame } from 'remotion';

const FadeInOut = () => {
  const frame = useCurrentFrame();
  
  const opacity = interpolate(frame, [0, 20, 80, 100], [0, 1, 1, 0]);
  const translateY = interpolate(frame, [0, 30], [50, 0]);
  
  return <div style={{ opacity, transform: `translateY(${translateY}px)` }} />;
};
```

**Key Options:**
- `extrapolateLeft` / `extrapolateRight` — `'clamp'`, `'extend'`, `'wrap'`, `'identity'`
- `easing` — Apply easing functions to the interpolation

**Pro Pattern — Combine with Spring:**
```tsx
const driver = spring({ frame, fps });
const scale = interpolate(driver, [0, 1], [0.5, 1.5]);
```

---

### 3. `Easing` Module

Built-in easing functions for cinematic motion:

```tsx
import { Easing, interpolate } from 'remotion';

// Cubic bezier for custom curves
interpolate(frame, [0, 60], [0, 1], {
  easing: Easing.bezier(0.8, 0.22, 0.96, 0.65),
});

// Predefined easings
Easing.ease      // Smooth acceleration
Easing.back(1)   // Slight overshoot before going forward
Easing.elastic  // Spring-like bounce
Easing.bounce    // Bouncing ball effect
Easing.inOut(Easing.ease) // Smooth in and out
```

---

## Timing & Sequencing

### `<Sequence>` — Time-Shifted Animations

Control exactly when elements appear:

```tsx
import { Sequence } from 'remotion';

const Trailer = () => (
  <>
    <Sequence from={0} durationInFrames={60}>
      <TitleReveal />
    </Sequence>
    <Sequence from={60} durationInFrames={90}>
      <Feature1 />
    </Sequence>
    <Sequence from={150}>
      <CTA />
    </Sequence>
  </>
);
```

**Key Props:**
- `from` — Start frame (optional since v3.2.36)
- `durationInFrames` — How long to display
- `layout="none"` — Disable auto-absolute positioning
- `name` — Label in Remotion Studio timeline

---

### `<Series>` — Sequential Scenes

Cleaner syntax for sequential content:

```tsx
import { Series } from 'remotion';

const Trailer = () => (
  <Series>
    <Series.Sequence durationInFrames={40}>
      <IntroScene />
    </Series.Sequence>
    <Series.Sequence durationInFrames={60}>
      <MainFeature />
    </Series.Sequence>
    <Series.Sequence durationInFrames={30}>
      <OutroCTA />
    </Series.Sequence>
  </Series>
);
```

---

### `<Loop>` — Repeating Animations

Perfect for backgrounds, particles, and ambient motion:

```tsx
import { Loop } from 'remotion';

<Loop durationInFrames={60}>
  <PulsingGlow />
</Loop>

// Nested loops for complex patterns
<Loop durationInFrames={75}>
  <Loop durationInFrames={30}>
    <SubElement />
  </Loop>
</Loop>
```

**Hook: `Loop.useLoop()`** — Get iteration info:
```tsx
const loop = Loop.useLoop();
if (loop) {
  console.log(loop.iteration); // Current iteration (0-indexed)
}
```

---

## Transitions (v4.0+)

### `<TransitionSeries>` — Scene Transitions

```tsx
import { TransitionSeries, linearTiming, springTiming } from '@remotion/transitions';
import { slide, wipe } from '@remotion/transitions/slide';

const Trailer = () => (
  <TransitionSeries>
    <TransitionSeries.Sequence durationInFrames={40}>
      <SceneA />
    </TransitionSeries.Sequence>
    <TransitionSeries.Transition
      presentation={slide()}
      timing={springTiming({ config: { damping: 200 } })}
    />
    <TransitionSeries.Sequence durationInFrames={60}>
      <SceneB />
    </TransitionSeries.Sequence>
  </TransitionSeries>
);
```

**Available Transitions:**
- `slide` — Slide in from direction
- `wipe` — Directional reveal
- Custom presentations available

---

## Advanced Techniques

### 1. Deterministic Randomness

For particle effects, star fields, scattered elements:

```tsx
import { random } from 'remotion';

// Deterministic - same every render
const x = random(`particle-x-${i}`);
const y = random(`particle-y-${i}`);

// True randomness (for non-critical visuals)
const trulyRandom = random(null);
```

---

### 2. Slow Motion / Speed Ramps

```tsx
import { interpolate, useCurrentFrame, Freeze } from 'remotion';

const remapSpeed = ({ frame, speed }) => {
  let framesPassed = 0;
  for (let i = 0; i <= frame; i++) {
    framesPassed += speed(i);
  }
  return framesPassed;
};

const SlowMotionEffect = ({ children }) => {
  const frame = useCurrentFrame();
  const remappedFrame = remapSpeed({
    frame,
    speed: (f) => interpolate(f, [0, 20, 21], [1.5, 1.5, 0.5], { extrapolateRight: 'clamp' }),
  });
  
  return <Freeze frame={remappedFrame}>{children}</Freeze>;
};
```

---

### 3. Audio Synchronization

```tsx
import { Html5Audio, interpolate, staticFile } from 'remotion';

<Html5Audio 
  src={staticFile('trailer-audio.mp3')} 
  volume={(f) => interpolate(f, [0, 30], [0, 1], { extrapolateLeft: 'clamp' })}
  playbackRate={1.0}
/>
```

---

### 4. Freeze Frame

Pause on a specific frame for dramatic effect:

```tsx
import { Freeze } from 'remotion';

<Freeze frame={60}>
  <EpicMoment />
</Freeze>
```

---

## Visual Effects Patterns

### Text Reveal (Character by Character)

```tsx
const CharacterReveal = ({ text }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  
  return (
    <div>
      {text.split('').map((char, i) => {
        const delay = i * 5; // 5 frames per character
        const driver = spring({ frame: frame - delay, fps, config: { damping: 15 } });
        const opacity = interpolate(driver, [0, 1], [0, 1]);
        
        return (
          <span key={i} style={{ opacity, display: 'inline-block' }}>
            {char}
          </span>
        );
      })}
    </div>
  );
};
```

---

### Glitch Effect

```tsx
import { random } from 'remotion';

const GlitchText = ({ text }) => {
  const frame = useCurrentFrame();
  const offset = Math.random() > 0.9 ? random(frame) * 10 : 0;
  
  return (
    <div style={{ 
      textShadow: `${offset}px 0 red, ${-offset}px 0 cyan` 
    }}>
      {text}
    </div>
  );
};
```

---

### Particle Burst

```tsx
const ParticleBurst = ({ count = 20 }) => {
  return (
    <>
      {new Array(count).fill(true).map((_, i) => (
        <Particle key={i} index={i} />
      ))}
    </>
  );
};

const Particle = ({ index }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  
  const seed = `particle-${index}`;
  const angle = random(seed) * 2 * Math.PI;
  const speed = 50 + random(`${seed}-speed`) * 100;
  
  const progress = spring({ frame, fps, config: { damping: 15 } });
  const x = Math.cos(angle) * speed * progress;
  const y = Math.sin(angle) * speed * progress;
  
  return (
    <div style={{ 
      transform: `translate(${x}px, ${y}px)`,
      opacity: 1 - progress 
    }} />
  );
};
```

---

## Code Patterns Worth Stealing

### 1. Composition Pattern — Layered Effects

```tsx
// Build effects from inside-out
const AnimatedElement = () => (
  <Explosion>              // Rotation distribution
    <Trail amount={4}>    // Delayed copies
      <Move delay={i * 3}> // Spring movement
        <Shrinking>       // Scale animation
          <Dot />         // Base element
        </Shrinking>
      </Move>
    </Trail>
  </Explosion>
);
```

### 2. Reusable Animation Hook

```tsx
const useAnimatedValue = (from, to, config = {}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  
  const driver = spring({ frame, fps, ...config });
  return interpolate(driver, [0, 1], [from, to]);
};

// Usage
const scale = useAnimatedValue(0, 1, { config: { damping: 12 } });
```

### 3. Staggered Animation Helper

```tsx
const stagger = (index, delayPerItem = 3) => index * delayPerItem;

// In component
const delay = stagger(i);
const driver = spring({ frame: frame - delay, fps });
```

---

## Key Packages & Libraries

| Package | Purpose |
|---------|---------|
| `@remotion/transitions` | Scene transitions (slide, wipe, etc.) |
| `@remotion/three` | 3D scenes with Three.js |
| `@remotion/lottie` | Lottie animations |
| `@remotion/gltf` | GLTF 3D models |
| `@remotion/assets` | Asset management |
| `@remotion/media` | Media handling |
| `@remotion/player` | Interactive player component |

---

## Top Remotion Creators to Follow

**Twitter/X:**
- @JonnyBurger — Creator of Remotion, tutorials
- @remotion — Official account
- Check #RemotionMadeMe for community examples

**GitHub:**
- remotion-dev/remotion — Main repo with examples
- Search "remotion-example" for community projects

**YouTube:**
- Official Remotion channel — Tutorials and guides

---

## Performance Tips for Trailers

1. **Use `layout="none"`** on Sequences when you don't need absolute positioning
2. **Limit `random()` calls** — Cache deterministic values
3. **Pre-render heavy elements** — Complex SVGs, Three.js scenes
4. **Use `<Freeze>`** to pause expensive animations
5. **Composition caching** — Break into smaller compositions for the Studio

---

## Recommended Learning Path

1. Start with the Apple-style tutorial (`remotion-dev/apple-wow-tutorial` on GitHub)
2. Master `spring()` + `interpolate()` combination
3. Learn `<Sequence>` and `<Series>` timing
4. Add `<TransitionSeries>` for professional cuts
5. Explore `@remotion/three` for 3D elements

---

## Resources

- [Remotion Docs](https://www.remotion.dev/docs)
- [Remotion Blog/Learn](https://www.remotion.dev/learn)
- [Easing Reference](http://easings.net/)
- [Cubic Bezier Editor](http://cubic-bezier.com/)
- [Timing Editor](https://remotion.dev/timing-editor)

---

*End of Research*
