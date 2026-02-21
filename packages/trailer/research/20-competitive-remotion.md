# Competitive Analysis: Best Remotion Videos Ever Made

**Research Date:** 2026-02-18  
**Purpose:** Find the most visually impressive Remotion productions, steal their best techniques, and identify every weakness in the current Ika Tensei trailer.

---

## Sources Researched

- [remotion.dev/showcase](https://www.remotion.dev/showcase) — Official showcase page
- [remotion.dev/docs/resources](https://www.remotion.dev/docs/resources) — Full ecosystem listing
- [github.com/remotion-dev](https://github.com/remotion-dev) — Official repos
- GitHub search: remotion trailer, remotion animation
- Source code deep-dives: 4-0-trailer, github-unwrapped-2022, three-particles, spring-loaded, a-roll

---

## TOP 5 MOST IMPRESSIVE REMOTION PRODUCTIONS

---

### #1 — Remotion 4.0 Keynote Trailer
**Source:** `github.com/remotion-dev/4-0-trailer`  
**Live:** `remotion.dev/4`

#### What It Looks Like
A monumental rotating "4" rendered in **real 3D** — not CSS 3D transforms, not WebGL — pure SVG path manipulation. The "4" has visible depth/extrusion (front face, back face, side tiles). It flies in from off-screen with spring physics, spinning continuously on all three axes simultaneously. The camera appears to zoom INTO the digit until it fills the frame, then text content appears masked inside the front face of the 3D letter. White background, single Remotion blue accent color. Minimal. Devastating.

#### Visual Techniques
1. **Custom 3D SVG Engine** built from scratch using `@remotion/paths`. Converts 2D SVG paths into 3D coordinates: `M 0 0 → M 0 0 0`. Then applies full matrix transformations: `rotateX`, `rotateY`, `rotateZ`, `scaled`, `translateX`, `translateY` — stacked as composition.
2. **Flat extrusion**: Front face + back face generated; side "tiles" computed as orthogonal quads filling the depth. Stroke width is halved via masking to prevent overlap.
3. **ClipPath masking trick**: The 3D front face's SVG path is used as a `clipPath` on a full `<AbsoluteFill>` containing normal React/HTML content. Result: text appears to live INSIDE the 3D letter.
4. **Zoom that exponentially approaches**: `distance = interpolate(zoomIn, [0, 1], [1, 0.000000005])` then `scale = 1/distance` — creates a dramatic infinite zoom effect with `Easing.out(Easing.ease)`.
5. **Simultaneous multi-axis rotation**: `rotateY(-0.4 + frame/200)`, `rotateX(0.3 - frame/400)`, `rotateZ(0.4 - frame/300)` — different speeds per axis, continuous, organic.
6. **Spring entrance from right**: `fromRight = interpolate(progress, [0, 1], [width * 0.75, 0])` with `damping: 20`, smooth hard deceleration.

#### Timing and Pacing
- `durationInFrames: 40` for the spring entrance — less than 1.5 seconds
- Rotation and zoom are continuous from frame 0 through end
- Content reveal happens during zoom: `textY = interpolate(progress, [0, 1], [2000000, 0])` — flies in from impossibly far while 3D letter zoom plays

#### Remotion Features
- `@remotion/paths` (parsePath, getSubpaths, resetPath, extrudeElement)
- Custom `threeDIntoSvgPath()` function
- `spring()` with custom damping
- `interpolate()` with `Easing.out(Easing.ease)`
- SVG `clipPath` + `path()` CSS masking
- Custom font loading via `loadFont()`

#### What To Steal
- **The zoom-into-infinity technique**: Apply to our summoning circle — zoom into the sigil as if falling through a portal
- **ClipPath-inside-3D-shape**: Put the Ika mascot or chain logos inside a 3D-extruded Japanese kanji
- **Multi-axis continuous rotation** for the summoning circle (currently only rotating on Z axis)
- **The restraint**: Single color, maximum impact. Our trailer is too visually busy.

---

### #2 — GitHub Unwrapped 2022
**Source:** `github.com/remotion-dev/github-unwrapped-2022`  
**Live:** `githubunwrapped.com` (yearly)

#### What It Looks Like
A personalized developer year-in-review video with a Christmas/winter theme. Clean white backgrounds. Delightful illustrated components — an animated gift box, falling snow, language-specific SVG icons per programming language, animated contribution bar charts, day-of-week commit heatmaps, user avatar frames. Each section is a distinct visual "card" with its own personality. Transitions use spring slides. Multiple themed color palettes (red/green/blue/gold) per user. Feels warm, handcrafted, alive.

#### Visual Techniques
1. **Rough.js integration**: All circles, ellipses, and paths use `rough.js` to render with a hand-drawn sketchy quality. Every geometric shape looks like it was drawn by a skilled illustrator, not a computer. Uses a `get-rough.ts` helper to generate roughness SVG paths deterministically.
2. **Gift bow spring cascade**: Three independent spring animations (`bow1`, `bow2`, `bow3`) with staggered delays (0, -5, -9 frames) and `damping: 15`. Each bow is anchored to a different corner (`transformOrigin: 'center 100%'`, `'100% 100%'`, `'0 100%'`) and springs independently. Result: the bow "pops" open naturally.
3. **Realistic snow physics (400 particles)**: Uses Remotion's `random()` (deterministic) for position/size/speed. Each snowflake has: `Math.sin(frame / 20 + delay) * 100` horizontal oscillation, random fall speed, "wind push" moments via spring arrays. Creates genuine atmospheric depth.
4. **Per-language SVG illustrations**: Every supported programming language (JS, TS, Rust, Python, etc.) has a hand-drawn SVG icon with animated internal paths (e.g., Rust's gear teeth rotate, Python's snake twists). 30+ individual component files.
5. **Watercolor texture overlay**: A `watercolour.png` is composited over everything at low opacity, giving organic warmth and preventing the "too digital" look.
6. **Multiple music tracks**: Three distinct tracks, each mapping to a different user personality/stat profile. Audio drives emotional pacing.
7. **Squeeze component**: A `Squeeze.tsx` that applies a brief scale-down-and-spring-back on cuts — creates a physical "weight" feeling on transitions.

#### Timing and Pacing
- Each data segment runs ~2-3 seconds, tight cuts, punchy
- Snow starts immediately, runs throughout — continuous ambient motion
- Bar chart counters tick up using `spring()` reaching final value — satisfying data reveal
- End card springs in with mascot, URL, social share CTA

#### Remotion Features
- `random()` — deterministic random (NOT Math.random)
- `spring()` with diverse configs (stiff=stiff, loose=loose)
- `interpolate()` with multiple keypoints for chart bars
- `Sequence` for scene transitions
- `Audio` + multiple tracks
- Custom font (Mona Sans)
- `Img` + `staticFile` for watercolor texture
- AWS Lambda for scale rendering

#### What To Steal
- **The `random()` function** — our Particles component uses Math.random() style logic (seeded from index), but Remotion's `random()` is deterministic and frame-independent. Switch to it.
- **Staggered spring cascades** for the chain badges instead of a single uniform spring function
- **Texture overlays**: A noise/grain texture composited over everything — our trailer looks too "clean/digital"
- **Multiple spring configs**: We use `damping: 12, stiffness: 80` everywhere. Vary it dramatically per element type.
- **The Squeeze transition**: Brief scale pulse on every scene cut

---

### #3 — Three.js Particles via @remotion/three
**Source:** `github.com/remotion-dev/three-particles`  
**Preview:** `three-particles-remotion.vercel.app`

#### What It Looks Like
A storm of 3D particles moving through space, morphing between different formations (sphere, torus, grid, etc.). Particles leave light trails. The "camera" moves through the field. Deep, dark background (near-black). Individual particles are tiny bright dots or small spheres. The overall effect resembles a living nebula or magic spell being cast. Completely unlike anything you can do with CSS alone.

#### Visual Techniques
1. **React Three Fiber inside Remotion**: `@remotion/three` provides `<ThreeCanvas>` which renders a full WebGL scene. Every Three.js feature is available: lights, shadows, materials, geometry.
2. **Deterministic frame-based rendering**: `useCurrentFrame()` replaces `requestAnimationFrame`. Camera position, particle positions, all computed from `frame` — never random at render time.
3. **Particle morphing**: Point clouds lerp between target positions based on `interpolate(frame, ...)`. Particles "fly" from one formation to another.
4. **Trail/motion blur via `<CameraMotionBlur>`**: `@remotion/motion-blur` wraps elements and renders them multiple times at slightly different time offsets. Blurred streaks appear on fast-moving particles.
5. **Size/opacity variation**: Particles range from 0.5px to 4px, opacity 0.3 to 1.0, creating depth layers even in 2D projection.

#### Timing and Pacing  
- Morphing transitions: ~60 frames each (2 seconds at 30fps)
- Camera sweep: slow, continuous rotation around the scene center
- Color shifts: `interpolateColors()` over time — cyan → purple → gold

#### Remotion Features
- `@remotion/three` — `<ThreeCanvas>`, `useVideoConfig()` for dimensions
- `@remotion/motion-blur` — `<CameraMotionBlur>`, `<Trail>`
- `interpolateColors()` — smooth color animation
- `useCurrentFrame()` as animation clock for Three.js scene

#### What To Steal
- **Add `@remotion/three` to the Ika Tensei trailer** for Scene 3 (The Ritual) — replace the flat SVG summoning circle with a 3D animated one. Particles could swirl in a vortex during the seal ritual.
- **`interpolateColors()`** for the blood pink → soul cyan → ritual gold color transitions in Scene 4
- **`<CameraMotionBlur>`** on the chain badges flying in (Scene 2) — they should leave trails

---

### #4 — Apple "Spring Loaded" Recreation
**Source:** `github.com/JonnyBurger/spring-loaded`

#### What It Looks Like
An exact recreation of Apple's 2021 "Spring Loaded" event logo animation: a complex illustrated apple logo made of layered, colorful shapes, where each individual path segment **draws itself** from left to right, then **color-fills** from the edges inward. The final result is a fully filled illustration that looks hand-inked. Runs in a perfect loop. Colors shift through the rainbow via `interpolateColors()`. The organic feel is striking — it looks like a high-end product commercial.

#### Visual Techniques
1. **SVG Path drawing via `getTotalLength()` / `getPointAtLength()`**: The SVG path is manually traced in Sketch, exported. Then in Remotion, each point along the path is placed as an individual `<circle>` element, animated with progressive reveal using `interpolate(frame, [delay, delay+duration], [0, 1])`. ~Hundreds of individual DOM elements.
2. **`interpolateColors(frame, [0, 180, 360], ['#FF0000', '#00FF00', '#0000FF'])`**: Each path segment has its own color cycling at a slightly different offset — the whole logo shimmers through color space continuously.
3. **Spring bounce on reveal**: The letter "animates in" with a spring that overshoots, then settles — same feel as Apple's actual motion design.
4. **Layered composition**: Multiple SVG groups rendered as separate `<Sequence>` layers with `from` offsets staggered by 5-10 frames — creates the "drawing itself" feel.

#### Timing and Pacing
- Each path draws itself over ~30 frames (1 second)
- Colors cycle once per 180 frames (6 seconds loop)
- Overall composition loops seamlessly: first path finishes as the last path is starting

#### Remotion Features
- Plain SVG + `getTotalLength()` / `getPointAtLength()` (DOM API)
- `interpolateColors()` — multi-stop color animation
- `spring()` with overshoot (low damping)
- `Sequence` with staggered `from` values
- `interpolate()` with `Easing.out`

#### What To Steal
- **SVG path self-drawing**: Apply this to the summoning circle runes. Instead of the circle appearing fully formed, have each rune stroke "draw itself" sequentially as the ritual begins.
- **`interpolateColors()` on the mascot's glow**: Pulse through `#ff3366 → #ffd700 → #00ccff → #ff3366` continuously
- **Low-damping overshoot spring** for the CTA button entrance — it should overshoot and snap back

---

### #5 — Remotion Shader / A-Roll Collection
**Source:** `github.com/onion2k/a-roll`

#### What It Looks Like
A curated library of high-end video motion graphics components for Remotion: CRT scan-line effects, film grain, light leaks, glitch effects, vignettes, color grading overlays. The shader example uses WebGL fragment shaders rendered through Remotion to achieve GPU-quality visual effects that would be impossible with CSS alone. Used for film-quality post-processing.

#### Visual Techniques
1. **WebGL Fragment Shaders in Remotion**: An `<OffthreadVideo>` or `<AbsoluteFill>` with a canvas element; fragment shaders sample the frame pixels and apply transforms (chromatic aberration, barrel distortion, scanlines, noise).
2. **CRT Effect**: Horizontal scanline bars using `Math.sin(y * frequency + frame * speed)` — appears to flicker at the CRT refresh rate. Combined with slight screen curvature via barrel distortion shader.
3. **Film grain**: `@remotion/noise` generates a Perlin noise field per frame — composited over the scene at 5-10% opacity with `mix-blend-mode: overlay`. Changes every frame, never repeating.
4. **Light leaks**: Pre-rendered light leak image (lens flare, colored halation) animated across the screen with opacity pulses on scene cuts.
5. **Vignette**: Radial gradient from transparent to `rgba(0,0,0,0.7)` at edges — makes the center pop, darkens edges, increases perceived contrast without changing actual pixel values.
6. **Chromatic aberration on fast motion**: Red channel shifted +2px, blue channel shifted -2px in horizontal — gives a cheap but effective "camera shake" feel.

#### Timing and Pacing
- CRT flicker: ~12Hz (5 frames per cycle at 60fps)
- Film grain: changes every frame (intentional noise)
- Light leaks: triggered on cuts (interpolate from 0 to peak opacity in 5 frames, decay over 30)

#### Remotion Features
- `@remotion/noise` — `noise2D(x, y)` for Perlin noise
- `<OffthreadVideo>` for video compositing
- CSS `mix-blend-mode` for layer compositing
- Tailwind CSS for overlay sizing

#### What To Steal
- **The vignette** — immediately add this to every scene. `radial-gradient(transparent 40%, rgba(0,0,0,0.8) 100%)`. It's one line and makes everything look 10x more cinematic.
- **Film grain via `@remotion/noise`**: Generate a noise texture per frame and overlay at 8% opacity with `mix-blend-mode: overlay`. Our trailer currently has zero texture.
- **CRT scanlines** as a transition effect between scenes — fits the pixel/JRPG aesthetic perfectly
- **Chromatic aberration** on the chain badges flying in — they look like they're moving fast through a lens
- **Light leak** on the cold open — a flash of pink/gold as the first text appears

---

## WHAT THE IKA TENSEI TRAILER IS MISSING

After reading `Trailer.tsx` in full and comparing against the best-in-class Remotion work, here is every weakness, ranked by impact:

---

### CRITICAL — Visual Quality Killers

**1. NO AUDIO**  
The single biggest differentiator between amateur and professional Remotion work is music/sound. Every top production has licensed music, sound effects on transitions, and uses `useAudioData()` to synchronize visual elements to the beat. Our trailer is completely silent. A 30-second mute video feels like watching a loading spinner. Priority: **HIGHEST**.

**2. NO TEXTURE — The "Too Digital" Problem**  
Everything in our trailer is flat, perfect, digital. Real atmospheric videos (GitHub Unwrapped, any film-quality production) layer:
- Film grain (`@remotion/noise` overlaid at 8% opacity)
- Vignette (radial gradient, 1 line of CSS)
- Scanlines (1 animated CSS component, trivial to build)
Our `VOID_PURPLE` background is pure hex — it looks like a PowerPoint slide, not a ritual.

**3. PARTICLES USE WRONG RANDOM**  
The `Particles` component uses `Math.sin(frame * 0.05 + i) * 0.15` for opacity — this is frame-dependent and unpredictable during Lambda renders. Should use Remotion's `random(seed)` which is deterministic per seed, regardless of render timing. Current particles also look physically wrong (they drift at constant speed with no easing or variation in the drift direction).

**4. CHAIN BADGES HAVE NO DEPTH**  
In Scene 2, the chains fly in uniformly from their computed angle — same spring config, same timing pattern, same visual weight. The best Remotion productions stagger entries with VARIED spring configs: some come in fast and stiff, others slow and bouncy. Our 18 chains are indistinguishable from each other in their motion.

**5. SUMMONING CIRCLE IS FLAT**  
The `SummoningCircleSVG` is a static SVG structure that merely rotates. In comparison, the Apple Spring Loaded recreation has individual path strokes that **draw themselves**. Our summoning circle should:
- Have runes/sigils that draw themselves stroke-by-stroke
- Glow intensity should pulse with a physically-based sine wave, not just `Math.sin(frame * 0.1)`
- Add a second counter-rotating ring (there are two layers in occult symbology)
- Particles should spiral INWARD toward the circle, not just float randomly

**6. SCENE TRANSITIONS ARE ABRUPT**  
We cut between all 6 scenes using hard opacity fades at the `Sequence` boundaries. The best Remotion work uses:
- `@remotion/transitions` — slide, wipe, fade, flip transitions with easing
- Overlap between sequences (Sequences can overlap!)
- "Squeeze" pulses on cuts (brief scale dip and spring-back)
- Light leak flashes on major scene changes

---

### HIGH IMPACT — Technical Weaknesses

**7. SPRING CONFIG IS MONOCULTURE**  
Every spring in the trailer uses `{ damping: 12, stiffness: 80 }` or `{ damping: 10, stiffness: 60 }`. This creates animation that feels robotic — everything has the same "weight." Real animations require:
- Heavy objects: high damping (40+), low stiffness (20-40) — slow, deliberate
- Light objects: low damping (8-12), high stiffness (100-200) — snappy, zippy  
- Elastic reveal: damping ~6, stiffness 100 — obvious overshoot

**8. NO EASING ON `interpolate()` CALLS**  
Almost no `interpolate()` calls in our code use the `easing` option. Every linear interpolation produces mechanical, unnatural motion. Should use `Easing.out(Easing.cubic)` for entrances, `Easing.in(Easing.quad)` for exits, `Easing.bezier()` for complex curves.

**9. SCENE 4 (FEATURES) IS MECHANICALLY PACED**  
Four features, each exactly 45 frames, exact same animation pattern (opacity + translateY). This is the most visible "I made this in Remotion" tell. Professional motion design has micro-variations: different entrance directions per feature, different type hierarchies, different particle colors, different spring configs.

**10. TEXT RENDERING LACKS HIERARCHY**  
Every GlowText uses the same 'Press Start 2P' pixel font at similar sizes. Top Remotion productions mix font weights dramatically: a huge number in a display font with tiny caption text in a completely different font below it. The GitHub Unwrapped uses Mona Sans Bold at 120px next to regular Mona Sans at 16px. Our text has no such contrast.

**11. THE MASCOT DOES NOTHING**  
`ika-mascot-v2.png` appears in Scene 3 and Scene 6 with only a `filter: drop-shadow + glow pulse`. The mascot never moves. In the best Remotion productions, even static assets get micro-animations: idle "breathing" scale, slight tilt, blinking. At minimum, the mascot should do a spring-bounce entrance (scale 0→1.2→1.0 with overshoot), not just fade in.

**12. NO COLOR ANIMATION — `interpolateColors()` UNUSED**  
The entire trailer uses fixed hex colors. Every color is hardcoded. The Remotion `interpolateColors()` function allows smooth color transitions that feel alive. The summoning circle's glow should shift from `BLOOD_PINK` to `RITUAL_GOLD` as the ritual intensifies. The chain badges should briefly flash their chain color when they land.

**13. SCENE 5 (GUILD) IS VISUALLY INCOHERENT**  
The Guild scene tries to load two PNG assets (`guild-banner.png`, `guild-banner.png`) but no assets were confirmed to exist. It also mixes Japanese kanji with Latin text and RPG class emojis in a way that creates visual noise rather than intrigue. If the assets exist, the scene could work; if they don't render, the scene shows broken boxes.

---

### MEDIUM IMPACT — Missed Opportunities

**14. ZERO USE OF `@remotion/noise`**  
Perlin noise is the easiest way to add organic, non-repeating motion. Use it for: particle drift direction variation, background subtle color shifts, mascot idle sway, "ethereal energy" effect on the summoning circle. It's in the Remotion ecosystem and takes 10 minutes to integrate.

**15. NO MOTION BLUR**  
The chain badges fly across the screen in Scene 2 at high speed with zero motion blur. `@remotion/motion-blur`'s `<Trail>` component renders each element at multiple time offsets — the chain badges would look like they're moving through dimensions, not just sliding across a screen.

**16. FEATURE TEXT IS EXPOSITION, NOT DRAMA**  
Scene 4 copy: "No Bridges — Direct deposit addresses via dWallet MPC". This is a product doc, not a trailer. Compare to how Apple trailers work: **EMOTION** then **FEATURE NAME** then **TECHNICAL DETAIL** (optional, in small text). The emotional hook is missing. Better: "Your NFTs. Any chain. One ritual." with the technical sub-line as caption.

**17. 30 SECONDS IS TOO LONG**  
The best Remotion trailers for products are 15-20 seconds maximum. Crypto product trailers (where attention is even shorter) should be 10-15 seconds. Our current pacing is slow enough to bore the target audience before the CTA appears. Each scene has too much dwell time. Scenes 1, 5, and 6 should each be cut in half.

**18. THE FINAL CTA IS PASSIVE**  
"Begin the Ritual →" inside a flat border div is the weakest possible CTA. Look at how the Remotion 4.0 trailer ends: the entire screen is the product. Our final 4 seconds should have the URL in massive text with a particle explosion and a spring that makes it feel like the UI is reaching toward the viewer.

**19. NO SCENE INTRO FLASH**  
Every scene transition should have a 2-frame white flash (or color flash) — a brief white `AbsoluteFill` at opacity 1 that decays to 0 over 8 frames. This mimics camera shutter overexposure and is used in every high-budget motion graphic to create snap and energy. Zero cost, massive feel improvement.

**20. STATIC BACKGROUND**  
The `VOID_PURPLE` background (`#0d0a1a`) is a dead flat color through the entire 30 seconds. At minimum, a radial gradient should breathe (expand/contract the inner radius using `Math.sin(frame * 0.02)`). Better: subtle `@remotion/noise`-based color field that shifts from deep purple to near-black.

---

## PRIORITY IMPLEMENTATION ROADMAP

```
TIER 1 — Do these first (max visual impact, min effort):
  □ Add vignette: radial-gradient overlay on AbsoluteFill
  □ Add film grain: @remotion/noise at 8% overlay opacity
  □ Add scene flash: 2-frame white flash between every Sequence
  □ Switch particles to Remotion's random() function
  □ Add audio: even a placeholder SFX track
  □ Add interpolateColors() to summoning circle glow

TIER 2 — Do these second (fixes the core boring-ness):
  □ Vary spring configs: at least 3 different damping/stiffness combos
  □ Add easing to all interpolate() calls (Easing.out, Easing.cubic)
  □ Mascot: add spring overshoot entrance + idle "breathe" scale
  □ Chain badges: staggered spring configs (varied damping per chain)
  □ Scene transitions: implement slide or wipe, not just opacity

TIER 3 — Do these for the premium version:
  □ @remotion/three: replace summoning circle with WebGL vortex
  □ @remotion/motion-blur: Trail on chain badge entrances
  □ Path self-drawing: runes draw themselves stroke by stroke
  □ Cut trailer from 30s to 20s
  □ Rewrite Scene 4 copy to be emotional, not technical
```

---

## KEY REMOTION FEATURES TO ADD

| Feature | Package | Current Use | Should Use |
|---|---|---|---|
| `random(seed)` | `remotion` | ❌ using Math-style | ✅ for all particles |
| `interpolateColors()` | `remotion` | ❌ never | ✅ glow, badges |
| `Easing.*` | `remotion` | ❌ never | ✅ all interpolate() |
| `@remotion/noise` | separate | ❌ never | ✅ grain, background |
| `@remotion/motion-blur` | separate | ❌ never | ✅ chain entrances |
| `@remotion/three` | separate | ❌ never | ✅ ritual scene |
| `@remotion/transitions` | separate | ❌ never | ✅ scene cuts |
| `Audio` | `remotion` | ❌ never | ✅ music/sfx |
| `useAudioData()` | `@remotion/media-utils` | ❌ never | ✅ beat sync |
| `<Trail>` | `@remotion/motion-blur` | ❌ never | ✅ particles |

---

## CONCLUSION

The current Ika Tensei trailer has strong art direction instincts (the color palette, the pixel font, the ritual theme, the scene structure) but executes them at roughly 30% of what Remotion makes possible. The most critical gap is **audio** (the trailer is silent), **texture** (no grain/vignette/noise), and **spring variety** (all motion feels identical).

The Remotion 4.0 trailer proves you can make something world-class with **one thing** done perfectly. The GitHub Unwrapped proves depth of craft matters — 50+ bespoke components, physics simulations, hand-drawn aesthetics. 

Ika Tensei needs to pick one: either be **perfectly minimal** (one ritual, one mascot, maximum polish) or be **deeply rich** (every element custom-crafted). Currently it's neither — 6 scenes with surface-level execution each. 

**Recommendation: Cut to 18 seconds. Do 3 scenes. Make each one unforgettable.**
