# Anime/Otaku-Style Motion Graphics & Trailer Research

Research compiled: 2026-02-18

## Overview

This document covers motion graphics techniques specific to anime, otaku culture, Japanese typography, and gacha game aesthetics. These techniques are used in anime trailers, game promos, visual novel cinematics, and title sequences.

---

## 1. Kinetic Japanese Typography

### Kanji Flying In / Stroke-by-Stroke Reveal

**Technique**: Animate kanji characters as if they're being written or flying into frame.

**Implementation approaches**:
- **Stroke animation**: Use SVG path animations to simulate brush strokes drawing each character. Tools like After Effects with the "Stroke" effect or mocha tracking can achieve this.
- **Particle scatter**: Break kanji into particle systems, then reconstitute them. Popular in cyberpunk-style trailers.
- **Depth zoom**: Kanji starts small/distant and rapidly expands to fill the screen. This creates the classic "impact" feel.
- **Layer separation**: Animate different stroke components (radical, remaining strokes) with staggered timing.

**Japanese-specific typography tips**:
- Use bold, condensed fonts for impact (like Gothic fonts: ゴシック体)
- Mix kanji with hiragana for rhythm — kanji for impact words, hiragana for flowing phrases
- Vertical text (縦書き) creates traditional, dramatic flow
- Consider furigana (振仮名) small text above kanji as design element

**Tools**: After Effects, Character Animator, CSS/SVG for web

---

## 2. Anime Speed Lines & Impact Frames

### Speed Lines (速度線 / sokudo-sen)

**Characteristics**:
- Radial lines emanating from a focal point
- Typically white or light-colored on dark backgrounds
- Vary in thickness and length for depth

**Use cases**:
- Character entrance with explosive impact
- Fast camera movement/reaction shots
- Power-up transformations

**Implementation**:
- Use radial blur or custom speed line brush assets
- Overlay with screen shake
- Animate opacity pulse for intensity

### Impact Frames (一枚絵 / ichi-mai-e)

**Characteristics**:
- Single static frame with intense artwork
- Brief pause (1-3 frames) for dramatic emphasis
- Often used at climax moments

**Implementation**:
- Hold on key art for 2-4 frames
- Add dramatic zoom (ease-out to key moment)
- Pair with sound effect text (like "バシーン!" / BASHA!)

### Dramatic Zoom

**Types**:
- **Rack focus**: Shift focus between foreground/background
- **Zoom burst**: Quick zoom in with slight overshoot, then settle
- **Pull-back (dolly out)**: Reveal context, often used for establishing shots
- **Dutch angle**: Tilted camera for disorientation/drama

---

## 3. Light Novel / Visual Novel Text Reveal Effects

### Common Visual Novel Text Effects

| Effect | Description | Use Case |
|--------|-------------|----------|
| **Typewriter** | Characters appear one by one | Dialogue, narration |
| **Fade in/out** | Text gradually appears/disappears | Emotional moments |
| **Shake/vibrate** | Text shakes with impact | Excitement, drama |
| **Glitch** | Text distorts, corrupts | Horror, digital themes |
| **Blur reveal** | Text sharpens into focus | Dreams, memories |
| **Word-by-word** | Each word animates in | Poetry, emphasis |

### Text Box Styling (Dialogue Boxes)

**Classic anime/VN text box**:
- Semi-transparent dark background (rgba(0,0,0,0.8))
- Rounded corners (border-radius: 8-12px)
- Border with accent color (white or themed color)
- Speaker name in distinct style above text
- "Next" indicator (▼ or ▼-click to continue)

**Effects to add**:
- Text appears with subtle glow
- Background pulse on speaker name change
- Sound effect integration points

---

## 4. Gacha Game Pull Animations

### Rarity Tiers & Visual Language

| Rarity | Common Colors | Effects |
|--------|---------------|----------|
| N (1★) | Gray, White | Basic, minimal effects |
| R (2★) | Blue, Green | Subtle glow |
| SR (3★) | Purple, Pink | Sparkle, light rays |
| SSR (4★) | Gold, Orange | Bright glow, beams |
| UR/SSR (5★) | Rainbow, Multi | Full particle explosion, screen flash |

### Animation Sequence (Standard Gacha Pull)

1. **Setup**: Character selects pull (single/multi)
2. **Portal/Orb appearance**: Circle/door/gateway appears with energy
3. **Rarity indication**: Color reveals (blue → gold → rainbow)
4. **Tension build**: Slow-motion, particles gather
5. **Reveal**: Door cracks/opens, character silhouette appears
6. **Full reveal**: Character pose, background effects, signature pose

### Key Animation Techniques

**Gold crack effect**:
- Screen fractures with golden light emanating from cracks
- Use displacement maps + lens flare
- Particle burst on "break"

**Rainbow shimmer**:
- Prismatic/iridescent color cycling
- Lens chromatic aberration
- Multiple light rays in rainbow colors
- Often paired with intense camera shake

**Star burst (SSR/UR reveal)**:
- Radial particle explosion
- Background dissolves to stars/glow
- Character rises into frame
- Signature sound effect

### Reference Games (Best Pull Animations)

- **Fate/Grand Order**: Multi-stage reveal with rings that glow gold (4★) or rainbow (5★)
- **Honkai Star Rail**: "Golden Train" animation with Pom Pom conductor
- **Punishing: Gray Raven**: Intense particle effects, bwoosh sounds
- **Arknights**: Operator recruitment with distinct operator silhouettes
- **Limbus Company**: Simple but effective color shift (orange → gold)
- **Dragalia Lost**: Blue → Gold → Rainbow progression

---

## 5. Anime Eye-Catch Transitions

### What Are Eye-Catches?

Eye-catches (アイキャッチ) are short transition segments in anime, typically:
- 2-3 seconds long
- Shown at episode mid-point
- Usually feature character art + logo

### Transition Styles

| Style | Description | Best For |
|-------|-------------|----------|
| **Geometric wipe** | Shapes sweep across screen | Action, energy |
| **Color flash** | Full-screen color pulse | Impact moments |
| **Shutter wipe** | Horizontal/vertical slats | Mechanical themes |
| **Radial burst** | Explosion from center | Transformations |
| **Smash cut** | Hard cut with impact frame | Shock value |
| **Film grain fade** | Noise/grain transition | Vintage aesthetic |
| **Lens distortion** | Screen bends/warps | Fantasy/magic |
| **Particle dissolve** | Screen breaks to particles | Sci-fi, digital |

### Fast Transitions (1-2 seconds)

- Use ease-in-out curves, not linear
- Add motion blur to moving elements
- Include subtle screen shake
- Flash white frame (50-100ms) on cut points

---

## 6. Making Text Feel DRAMATIC

### Japanese + English Combo Techniques

**Mixing scripts**:
- Japanese (hiragana/katakana/kanji) for atmosphere
- English for punch and clarity
- Example: 「召喚」 + "SUMMON" together

**Sizing hierarchy**:
- Large English for impact words
- Smaller Japanese for context/feeling
- Dramatic size contrast creates tension

**Arrangement**:
- Overlapping text layers (with blur on background layer)
- Text on diagonal angles for energy
- Breaking text out of grid for dynamism

### Timing & Rhythm

- **Stagger**: Don't reveal all text at once. Let each word/character land.
- **Hold**: Pause briefly on key words before continuing
- **Burst**: Fast entrance, slow settle (overshoot)
- **Chant**: Repeat words with visual rhythm (like anime title chants)

### Sound Integration

- Text arrival synced to beat drops
- Impact sounds (紙撒き / kamisakki) on text appearance
- Ambient hum/energy that builds with text density

---

## 7. Tools & Software

### Recommended Software

| Tool | Use Case |
|------|----------|
| **After Effects** | Primary for motion graphics, compositing |
| **Premiere Pro** | Video editing, timeline assembly |
| **Blender** | 3D elements, particles, compositing |
| **CSS/Framer Motion** | Web-based animations |
| **Spine/DragonBones** | 2D skeletal animation for characters |
| **Rive** | Interactive state machines |

### Asset Resources

- **Motion Array** (motionarray.com) - Anime transition packs
- **Envato** - Anime opener templates
- ** itch.io** - Visual novel effect packs
- **Custom brush sets** - Speed lines, impact effects

---

## 8. Quick Reference Checklist

### For Anime Trailer / Motion Graphics

- [ ] Speed lines on fast movement
- [ ] Impact frames at key moments (2-4 frames hold)
- [ ] Dramatic zoom on character entrances
- [ ] Text has staggered reveal timing
- [ ] Mix Japanese + English for impact
- [ ] Add screen shake on reveals
- [ ] Use particle effects on high-rarity moments

### For Gacha Pull Animation

- [ ] Blue → Gold → Rainbow progression
- [ ] Gold crack effect on SSR
- [ ] Rainbow shimmer + lens flare on UR
- [ ] Character silhouette before full reveal
- [ ] Sound effect integration
- [ ] Screen shake on reveal

### For Visual Novel UI

- [ ] Typewriter effect for dialogue
- [ ] Proper text box styling (semi-transparent, border)
- [ ] Speaker name highlight
- [ ] Transition effects between scenes
- [ ] Glitch/fade effects for narrative beats

---

## Sources

- Reddit r/gachagaming (pull animation discussions)
- The Artifice (anime opening analysis)
- Motion Array, Envato (anime templates)
- Adobe After Effects documentation
- Various visual novel development resources
