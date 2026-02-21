# Research: Summoning/Ritual Sequence Animation
> Research for Ika Tensei trailer — how to make a 5-second summoning feel EPIC

---

## 1. The Visual Grammar of Summoning — Core Structure

Every great summoning sequence across FF, Bayonetta, Dark Souls, anime follows the **same 4-act arc**:

```
ACT 1 — PREPARATION    (circle draws, space transforms)
ACT 2 — ACCUMULATION   (energy gathers, pressure builds)
ACT 3 — CLIMAX         (flash, white-out, detonation)
ACT 4 — REVEAL         (entity/boss emerges, silence)
```

The secret: **Acts 1–3 exist only to make Act 4 feel earned**. The more you build, the bigger the payoff. Delay is power.

---

## 2. How FF/RPG Summons Work (Build → Flash → Reveal)

### Final Fantasy / JRPG Pattern
Summon sequences are essentially **compressed dramatic arcs** — 5–15 seconds of pure escalation:

1. **Screen dims** — vignette or full darkness signals "something sacred is happening"
2. **Circle materializes** — appears NOT all at once but drawn, pen-on-paper style
3. **Layers build** — outer ring first, then inner geometry, then rune text last
4. **Spinning begins** — outer ring counter-rotates vs inner, creates hypnotic depth
5. **Color intensification** — white → gold → blood-purple glow, opacity increases
6. **Particle infall** — ambient particles start flowing toward center point
7. **Energy column** — vertical beam of light shoots upward (or downward)
8. **Sub-flash** — brief bright pulse, pupils dilate
9. **FULL FLASH** — total white/gold screen, 1–3 frames held, then cuts
10. **Reveal into silence** — entity appears fully formed, brief stillness before action

### Key JRPG timing observations:
- Act 1 (draw): ~30% of total time (build rapport with the ritual)
- Act 2 (gather): ~35% of total time (longest — maximum tension dwell)
- Act 3 (flash): ~5% of total time (brutally short — that's why it hits hard)
- Act 4 (reveal): ~30% of total time (let them breathe and absorb)

---

## 3. Step-by-Step Ritual Sequence (Technical Breakdown)

### Phase 0: Entry (0–0.3s)
- Screen darkens (black overlay, opacity 0→0.7)
- Background blurs or desaturates
- Sound: low ominous drone begins

### Phase 1: Circle Draws (0.3s–1.2s)
- **Outer ring**: `pathLength` 0→1 over 600ms, drawn clockwise
- **Pentacle/inner geometry**: appears 200ms after outer ring starts
- **Rune glyphs**: fade in sequentially around circumference, 100ms stagger each
- **Visual**: like invisible ink becoming visible — ink draw, not pop-in
- Technique: `stroke-dasharray` + `stroke-dashoffset` animation OR Framer Motion `pathLength`

```
motion.circle: initial={{ pathLength: 0 }} → animate={{ pathLength: 1 }}
duration: 0.6s, ease: "easeIn"  // accelerates as circle completes
```

### Phase 2: Runes Glow (1.2s–2.0s)
- Rune text shifts from dim white → electric purple/gold
- Slight scale pulse on each rune (1.0 → 1.05 → 1.0), staggered
- Circle begins slow rotation (5–10°/sec)
- Counter-rotation: outer ring clockwise, inner ring counter-clockwise
- Faint glow/blur spreads outward from runes (box-shadow or filter: blur)
- Sound: low hum shifts to higher pitch

### Phase 3: Energy Gathers (2.0s–3.5s) ← LONGEST PHASE, MAXIMUM TENSION
- **Particle infall**: 40–80 particles spiral from outer screen edges toward center
  - Each particle: bright point light, leaves fading trail
  - Motion: NOT straight-line — spiral inward on curved paths
  - Speed: slow start, accelerating as they approach center (easeIn)
  - Colors: shift from ambient purple → white-hot as they near center
- **Circle accelerates rotation** — starts slow, ramps up (ease-in-quart)
- **Camera/viewport subtle zoom-in** — 1.0→1.05 scale, barely perceptible
- **Concentric pulse rings** emit from center outward (like sonar pings)
- **Screen edge vignette deepens** — focuses eye on center
- Sound: hum becomes chorus, sub-bass rumble, crackling electricity

### Phase 4: Climax Flash (3.5s–3.8s) ← SHORTEST PHASE, MOST VIOLENT
- **Pre-flash**: one frame of extreme brightness (all elements white)
- **Main flash**: white-gold overlay goes opacity 0→1 in 100ms, holds 150ms
- **BANG**: everything goes pure white for 2–3 frames (~80ms)
- **Screen shake**: translateX/Y ±4px random, 200ms duration
- **Sound**: CRACK/BOOM, all previous sound cuts to silence
- The flash ERASES everything — makes the next reveal feel like a brand new scene

### Phase 5: Entity Reveal (3.8s–5.0s)
- Flash fades: white opacity 1→0 over 400ms (slow fade, dramatic)
- **Entity appears**: NOT a pop-in — emerges through a dissolve or gate effect
  - Pattern: materializes from top-down (Bayonetta approach)
  - OR: rises from the circle like smoke condensing into form
  - OR: cracks through like shattering glass from the center outward
- **Silence lingers** — 200ms of near-silence after reveal (respect the moment)
- **Particles settle** — remaining particles flow AWAY from entity (dispersal)
- Sound: sustained musical note, then theme begins

---

## 4. The Visual Language of "Sealing" (Containment → Lock)

Seals work in the **opposite direction** to summons. Where summons release, seals **compress**.

### Seal Visual Logic:
1. **Expansive → Contracting**: elements start large, constrict inward
2. **Many → One**: multiple rings/layers collapse to single point
3. **Energy flows INWARD** (vs summon: flows outward on reveal)
4. **Lock click**: final frame shows geometry snapping into alignment — geometric "snap"
5. **Post-lock freeze**: brief stillness, then a PULSE (the seal testing itself)

### Seal Sequence Pattern:
```
rings contract → runes compress → lock/click → pulse → silence
```

### Sealing = the inverse of summoning:
| Summoning | Sealing |
|-----------|---------|
| Darkness first, then light | Light first, then darkness |
| Circle draws outward | Circle draws inward |
| Particles flow in | Particles flow out |
| Ends with reveal/explosion | Ends with silence/containment |
| Colors warm (gold, fire) | Colors cold (blue, violet, black) |
| Scale increases | Scale decreases to a point |

### For Ika Tensei (seal = binding a soul to blockchain):
- The summoning IS the minting — energy of the soul being compressed into the seal
- The flash = the transaction confirming
- The lock click = the NFT minted, the soul bound
- Colors: start void-black → purple energy → gold flash → cold blue seal lock

---

## 5. Dramatic Timing Principles from Game VFX

### Bayonetta 3 (PlatinumGames) — Key Lessons:
- **Hair-effect swirling** around magic circle before demon appears — creates ANTICIPATION
- Demon appears through a "gate" (the circle acts as a dimensional portal, not just decoration)
- **Particle generation from the entity's 2D mask** — particles appear from the silhouette itself
- Dissolve reveals top→down (or toward center) — never all-at-once
- "We paid attention to the momentum and vigor during the summoning, making sure to accentuate the energy when they appear out of the magic circle"

### UE5 Holy Swords VFX (80.lv) — Timing Structure:
Explicitly articulated: **Buildup → Climax Signal → Release**
- Buildup: energy accumulates, visual cues intensify
- Climax signal: distinct beat that says "it's about to happen" (pre-flash, sound spike)
- Release: the actual effect deploys

Then optionally: **2nd Buildup → 2nd Release** (the "double peak" technique — incredible for epics)

### Energy Flow Direction:
- Buildup: energy wave flows **from outward edges to center** (infall)
- Release: energy wave flows **from center outward** (explosion)
- This creates a visual breathing: inhale (gather) → exhale (release)

---

## 6. Anticipation Principle — Animation Theory

From animation theory (the 12 principles):

> **Anticipation** is the setup before the main action. It prepares the audience and makes the payoff feel inevitable.

For summoning sequences specifically:
- **Staggered revelation**: each layer appearing sequentially builds anticipation better than everything appearing at once
- **Temporal manipulation**: slight delays before flash build player imagination
- **Sound as anticipation**: volume/pitch increases signal the incoming detonation
- **Speed acceleration**: spinning circle that slows would feel anticlimactic. It MUST speed up going into the flash

### The "One More Second" Rule:
Hold the buildup phase one beat longer than feels comfortable. The discomfort IS the tension. When the flash finally happens, the relief IS the epiphany.

---

## 7. How to Make 5 Seconds Feel EPIC

### The Compression Illusion — 5 techniques:

**1. Front-load the setup visuals**
- The first second should feel "wrong" — dark, ominous, slow. Not impressive yet.
- This makes seconds 2–3 feel like acceleration by contrast.

**2. Micro-events within each phase**
- Each phase should have 3–5 small beats within it (rune 1 glows, then 2, then 3...)
- Layered micro-moments prevent any second from feeling empty

**3. The Rule of Three Intensifications**
- Dim glow → medium glow → BLAZING glow (3 steps)
- Slow rotate → medium rotate → SPINNING (3 steps)
- Quiet hum → louder hum → ROAR (3 steps)
Each escalation makes the next one possible.

**4. The Flash as Punctuation**
- The flash is not the climax — it's the punctuation mark after the climax
- Keep it BRUTALLY short (under 200ms) for maximum impact
- A long flash is a long silence — powerful. A long flash during action is anticlimactic.

**5. The Silence After the Reveal**
- Hold the reveal in near-silence for 500ms minimum
- The contrast between the chaos of the summon and the eerie quiet of the reveal IS the epic feeling
- This is what Dark Souls does with every boss reveal: the music cuts, you just... see them.

---

## 8. Technical Implementation — Framer Motion / React

### SVG Circle Drawing Effect
```tsx
// Outer ring draws first
<motion.circle
  r={120}
  cx={200} cy={200}
  stroke="rgba(180,100,255,0.8)"
  strokeWidth={2}
  fill="none"
  initial={{ pathLength: 0, rotate: 0 }}
  animate={{ 
    pathLength: 1,
    rotate: 360  // continuous spin after draw
  }}
  transition={{ 
    pathLength: { duration: 0.6, ease: "easeIn", delay: 0.3 },
    rotate: { duration: 8, repeat: Infinity, ease: "linear", delay: 0.9 }
  }}
/>

// Inner ring: counter-rotate
<motion.circle
  r={80}
  ...
  animate={{ pathLength: 1, rotate: -360 }}
  transition={{ 
    pathLength: { duration: 0.5, ease: "easeIn", delay: 0.6 },
    rotate: { duration: 6, repeat: Infinity, ease: "linear", delay: 1.1 }
  }}
/>
```

### Rune Sequential Glow
```tsx
// Runes stagger in with a glow
const runeVariants = {
  hidden: { opacity: 0, scale: 0.8 },
  visible: (i: number) => ({
    opacity: [0, 1, 0.7],  // flash then settle
    scale: [0.8, 1.1, 1.0],
    filter: ["blur(4px)", "blur(0px)", "blur(1px)"],
    transition: { delay: 0.8 + i * 0.12, duration: 0.4 }
  })
}
```

### Particle Infall System
```tsx
// Particles spiral toward center
// Each particle: start at random angle on outer ring, spiral in
interface Particle {
  angle: number;      // starting angle
  startRadius: number; // 300–500px from center
  speed: number;      // varied for organic feel
  color: string;      // purple/white gradient
}

// In requestAnimationFrame:
// x = center + radius * cos(angle + spiralOffset)
// y = center + radius * sin(angle + spiralOffset)
// radius decreases over lifetime
// spiralOffset increases over lifetime (creates spiral path)
```

### Flash Effect
```tsx
<motion.div
  className="absolute inset-0 bg-white pointer-events-none"
  initial={{ opacity: 0 }}
  animate={{
    opacity: [0, 0, 0, 1, 0.8, 0],  // spike and fade
  }}
  transition={{
    duration: 0.4,
    delay: 3.5,  // hits at climax
    times: [0, 0.6, 0.7, 0.75, 0.85, 1.0]
  }}
/>
```

### Screen Shake
```tsx
const shakeVariants = {
  shake: {
    x: [0, -4, 4, -3, 3, -1, 1, 0],
    y: [0, 3, -3, 2, -2, 1, -1, 0],
    transition: { duration: 0.3, delay: 3.52 }
  }
}
```

---

## 9. Color Language for Ika Tensei Summoning

### Phase Color Arc:
```
VOID (0s)     → #000000 / #0a0010  (empty, pre-ritual)
CIRCLE (0.3s) → #4a0080 / #6600cc  (purple occult — the seal's power)
RUNES (1.2s)  → #8833ff / #aa55ff  (brightening — ritual activating)
GATHER (2.0s) → #cc88ff → #ffffff  (approaching white-hot)
FLASH (3.5s)  → #ffffff / #ffffaa  (pure light — the moment of creation)
REVEAL (3.8s) → #ffffff→fade → reveal background (the entity/seal exists now)
LOCKED (5.0s) → #001133 / #0033aa  (cold blue — sealed, done, permanent)
```

### The Transition Logic:
- Warm colors (purple → gold) = summoning / becoming
- Cold colors (blue → black) = sealing / complete
- The entity should be lit in the warm colors; the seal lock shifts everything cold

---

## 10. Inspiration References

### Games with the Best Summoning Animations:
1. **Final Fantasy XVI** — Eikon summoning sequences, extreme scale, world-shaking
2. **Bayonetta 3** — Hair-witch magic circles, fluid VAT effects, demon gates
3. **Dark Souls** — Boss fog gates + reveal (not a circle, but the SILENCE is the technique)
4. **Lost Ark (Paladin VFX)** — Area-of-effect holy summon with energy waves inward→outward
5. **Genshin Impact** — Elemental burst animations, especially Venti/Kazuha swirl
6. **Fate/Stay Night** — Noble Phantasm reveals: pre-flash chant → overwhelming burst

### The Dark Souls Bonfire Technique (applied to boss reveals):
The bonfire doesn't do VFX tricks. It does **silence + slow ignition**. The animation starts small (spark), then gradually builds (flame grows), then holds in its final looping state. The power is in the PATIENCE. Apply this: let the circle exist for a beat before anything else happens. Let the player (viewer) see it is a real thing, not a flash.

### TV Tropes — Instant Runes:
The "Instant Runes" trope in anime establishes that:
- Runes/circles appearing signal POWER (the more intricate = more powerful)
- They function as "loading bars" for magic — visual progress toward something
- The disappearance/completion of runes is the trigger point for the spell/summon
- Sealing techniques: "paper servants drawing a symbol in the air" — drawn seals = active seals

---

## 11. Applied to Ika Tensei: The Soul Seal Summoning

### Our specific context:
The user is minting/summoning a digital soul onto the blockchain. The ritual should feel like:
- They are BINDING something real
- The blockchain is the summoning circle (the permanent record)
- The IKA entity is what gets revealed (the goddess/guide/mascot)
- The seal = the NFT = the bond between soul and chain

### Recommended 5-second breakdown for trailer:

| Time | Event | Visual |
|------|-------|--------|
| 0.0s | Darkness, silence | Pure black, faint star particles |
| 0.3s | Circle begins drawing | Outer ring traces clockwise, purple |
| 0.6s | Inner geometry appears | Pentacle, sigils draw in |
| 1.0s | Runes appear sequentially | Each rune pulses in with a soft flash |
| 1.5s | Rotation begins | Outer CW, inner CCW, slow |
| 2.0s | Particles start inflowing | 60 particles spiral from edges |
| 2.5s | Runes intensify | Colors white-hot, blur grows |
| 3.0s | Circle spins faster | Acceleration toward flash |
| 3.2s | PRE-FLASH pulse | Brief bright ring expands from center |
| 3.5s | FLASH | Pure white, holds 150ms |
| 3.65s| Screen shake | ±4px, 200ms |
| 3.8s | IKA emerges | Dissolves in from center, top→down |
| 4.2s | Particles disperse | Flow outward from IKA |
| 4.5s | Seal locks | Geometry snaps to final position, CLICK |
| 4.8s | Silence | IKA exists. The chain holds. |
| 5.0s | Text appears | "Bind your soul." |

---

## Key Takeaways

1. **Build = 60%, Flash = 5%, Reveal = 35%** — timing that always works
2. **Draw circles with pathLength 0→1** — it's the most magical-feeling technique available
3. **Counter-rotating rings** create hypnotic depth without extra complexity
4. **Infall particles** are the visual language of "gathering energy"
5. **The flash must be SHORT** — violence of brevity
6. **Post-reveal silence** is where the epic feeling lives
7. **Cold/warm color arc** — warm during ritual, cold after seal locks = done
8. **Stagger EVERYTHING** — runes don't appear at once, rings don't draw at once
9. **The circle is a portal** — the entity doesn't appear ON the circle, it comes THROUGH it
10. **Sound design is 50% of the epic** — the hum, the crack, the silence after
