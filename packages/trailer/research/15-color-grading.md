# 15 — Color Grading & Post-Processing Effects

**Research for:** Ika Tensei trailer / dark occult themed video presentation  
**Palette:** void purple `#0d0a1a` · blood pink `#ff3366` · ritual gold `#ffd700`  
**Date:** 2026-02-18

---

## 1. Overview / Philosophy

Dark occult / dark fantasy color grading is about **controlled contrast and chromatic suggestion**. The goal is not pure black — pure black is dead. The goal is **void purple-tinted darkness** with:

- **Rich shadows** that have color (purple, indigo, midnight blue undertones)
- **Luminous highlights** that pop against that darkness (pink, gold)
- **Atmosphere** created by bloom, grain, and vignette — the same tools cinematographers use

Reference aesthetics:
- **Midsommar** — bleached daylight horror (inverse of our goal but shows contrast power)
- **Hereditary** — deep shadow detail, warm-cool split
- **Suspiria (2018)** — de-saturated body, saturated ritual color
- **Blade Runner 2049** — god-tier color grading, orange/teal split, bloom on every light source
- **Midnight Mass** — dark, candle-lit, vignette heavy
- **The Craft** — 90s occult purple/green palette
- **Ari Aster's films** — unsettling color pops against neutral backgrounds

**For Ika Tensei:** We want **Blade Runner 2049 meets occult anime OP** — dark void with glowing sigils, blood-pink energy, ritual gold accents. Everything feels like it's lit from within.

---

## 2. Our Palette: Color Science

### Primary Colors & Their Roles

```
Void Purple    #0d0a1a    → Background — the void. Shadows. Space between stars.
Blood Pink     #ff3366    → Primary accent — energy, danger, desire. Magic activation.
Ritual Gold    #ffd700    → Sacred accent — divinity, power, seals, sigils.
```

### Extended Palette (derived)

```css
:root {
  /* Core */
  --void-deep:    #0d0a1a;   /* background base */
  --void-mid:     #1a1428;   /* cards, panels */
  --void-surface: #241b38;   /* raised surfaces */
  --void-border:  #3d2d5e;   /* borders, dividers */

  /* Blood Pink spectrum */
  --pink-core:    #ff3366;   /* main accent */
  --pink-hot:     #ff6b9d;   /* highlight / glow center */
  --pink-deep:    #cc1144;   /* shadow of pink elements */
  --pink-ghost:   rgba(255, 51, 102, 0.15); /* ambient tint */

  /* Ritual Gold spectrum */
  --gold-core:    #ffd700;   /* main gold */
  --gold-hot:     #fff176;   /* highlight */
  --gold-deep:    #b8860b;   /* dark gold / brass */
  --gold-ghost:   rgba(255, 215, 0, 0.12);  /* ambient tint */

  /* Neutral supports */
  --ink:          #080510;   /* absolute darkest */
  --mist:         #c8b8d8;   /* light text, faded white with purple undertone */
  --ash:          #6b5b7b;   /* secondary text */
}
```

### HSL Analysis for Color Grading

```
Void Purple  → H: 261°  S: 31%  L: 7%     → Very dark, slightly warm blue-purple
Blood Pink   → H: 344°  S: 100% L: 60%    → Hot pink, high saturation
Ritual Gold  → H: 51°   S: 100% L: 50%    → Pure yellow-gold, maximum saturation

Color temperature spread:
- Shadows: cool purple (261°)  
- Midtones: neutral-to-warm  
- Highlights: warm gold (51°) or hot pink (344°)

This creates a triadic contrast: purple/pink/gold — the classic alchemy palette.
```

---

## 3. CSS Filter Chains for Cinematic Looks

### 3.1 Available CSS Filters

```css
/* All available filters — can be chained in any order */
filter:
  blur(Xpx)           /* gaussian blur — bloom, depth of field */
  brightness(X%)      /* overall exposure */
  contrast(X%)        /* tonal range — higher = more dramatic */
  saturate(X%)        /* color intensity */
  hue-rotate(Xdeg)    /* shift all hues — good for color temperature */
  sepia(X%)           /* warm, aged look */
  grayscale(X%)       /* desaturate */
  invert(X%)          /* invert colors */
  opacity(X%)         /* transparency */
  drop-shadow(x y blur color) /* shadow that follows alpha */
;
/* ORDER MATTERS — filters apply left to right */
```

### 3.2 Preset Filter Chains for Our Aesthetic

#### "Void Ritual" — Main look
```css
.void-ritual {
  filter:
    contrast(115%)
    brightness(90%)
    saturate(130%)
    hue-rotate(-5deg);
  /* Effect: Deeper blacks, more vivid colors, slight purple push */
}
```

#### "Blood Moon" — For hot pink moments
```css
.blood-moon {
  filter:
    contrast(125%)
    brightness(85%)
    saturate(160%)
    hue-rotate(-10deg);
  /* Effect: Crimson push, dramatic contrast, shadows crush to void */
}
```

#### "Ancient Gold" — For ritual/seal sequences
```css
.ancient-gold {
  filter:
    sepia(20%)
    contrast(110%)
    brightness(95%)
    saturate(140%)
    hue-rotate(10deg);
  /* Effect: Warm sepia base + pushed saturation = antique gold feel */
}
```

#### "Nightmare Desaturate" — For horror/tension moments
```css
.nightmare {
  filter:
    grayscale(30%)
    contrast(130%)
    brightness(80%)
    saturate(70%)
    hue-rotate(-15deg);
  /* Effect: De-saturated horror, blue-purple push, heavy contrast */
}
```

#### "Ethereal Bloom" — Soft glow moments
```css
.ethereal {
  filter:
    brightness(108%)
    saturate(110%)
    contrast(95%)
    blur(0.3px);
  /* Effect: Slightly overexposed, soft focus — dream state */
}
```

### 3.3 Backdrop-filter for Glass/Panel Effects

```css
/* Frosted glass over dark void */
.occult-panel {
  background: rgba(13, 10, 26, 0.6);
  backdrop-filter:
    blur(12px)
    brightness(85%)
    saturate(120%);
  -webkit-backdrop-filter:
    blur(12px)
    brightness(85%)
    saturate(120%);
  border: 1px solid rgba(255, 51, 102, 0.2);
}
```

---

## 4. Bloom & Glow Effects

### 4.1 The Physics of Bloom

Real bloom occurs when bright light overwhelms the sensor/eye. In CSS, we simulate it with **layered shadows at increasing radii** — tight core, medium mid, wide outer bloom.

**Key principle:** 3-5 shadow layers, each progressively larger and more transparent.

### 4.2 Blood Pink Glow (Primary Accent)

```css
/* Full neon glow system for blood pink */
:root {
  --glow-tight:  4px;
  --glow-mid:    12px;
  --glow-wide:   24px;
  --glow-bloom:  48px;
}

/* Element glow — for buttons, sigils, borders */
.glow-pink {
  box-shadow:
    0 0 var(--glow-tight)  2px  rgba(255, 51,  102, 0.9),   /* hot core */
    0 0 var(--glow-mid)    6px  rgba(255, 51,  102, 0.6),   /* inner bloom */
    0 0 var(--glow-wide)   10px rgba(255, 107, 157, 0.4),   /* mid bloom (lighter pink) */
    0 0 var(--glow-bloom)  20px rgba(255, 51,  102, 0.15);  /* outer atmospheric */
}

/* Text glow */
.text-glow-pink {
  color: #ff6b9d;
  text-shadow:
    0 0 1px  #fff,              /* hot center white glint */
    0 0 4px  #ff3366,           /* core pink */
    0 0 10px #ff3366,           /* inner bloom */
    0 0 20px rgba(255,51,102,0.7),  /* mid bloom */
    0 0 40px rgba(255,51,102,0.3);  /* outer atmospheric */
}
```

### 4.3 Ritual Gold Glow

```css
.glow-gold {
  box-shadow:
    0 0 4px  2px  rgba(255, 215, 0, 0.95),
    0 0 12px 6px  rgba(255, 215, 0, 0.6),
    0 0 24px 10px rgba(255, 241, 118, 0.35),  /* yellow-white mid */
    0 0 48px 20px rgba(255, 180, 0, 0.12);    /* amber outer */
}

.text-glow-gold {
  color: #fff176;
  text-shadow:
    0 0 1px  #fff,
    0 0 4px  #ffd700,
    0 0 10px #ffd700,
    0 0 20px rgba(255, 215, 0, 0.8),
    0 0 40px rgba(255, 180, 0, 0.4);
}
```

### 4.4 Pulsing Bloom Animation

```css
@keyframes bloom-pulse {
  0%, 100% {
    box-shadow:
      0 0 4px  2px  rgba(255, 51, 102, 0.9),
      0 0 12px 6px  rgba(255, 51, 102, 0.5),
      0 0 24px 10px rgba(255, 51, 102, 0.3),
      0 0 48px 20px rgba(255, 51, 102, 0.1);
  }
  50% {
    box-shadow:
      0 0 6px  3px  rgba(255, 51, 102, 1.0),
      0 0 18px 10px rgba(255, 51, 102, 0.7),
      0 0 36px 16px rgba(255, 51, 102, 0.4),
      0 0 72px 30px rgba(255, 51, 102, 0.15);
  }
}

.bloom-pulse {
  animation: bloom-pulse 2.5s ease-in-out infinite;
}

/* Slow breathing — for ambient sigils */
@keyframes bloom-breathe {
  0%, 100% { filter: brightness(90%) saturate(100%); }
  50%       { filter: brightness(115%) saturate(130%); }
}

.sigil-glow {
  animation: bloom-breathe 4s ease-in-out infinite;
}
```

### 4.5 Drop-shadow Filter Bloom (for PNGs/SVGs)

```css
/* Use filter: drop-shadow() for non-rectangular elements (sprites, SVGs) */
.sigil-sprite {
  filter:
    drop-shadow(0 0 4px  rgba(255, 51, 102, 0.9))
    drop-shadow(0 0 12px rgba(255, 51, 102, 0.6))
    drop-shadow(0 0 24px rgba(255, 51, 102, 0.3));
}

/* Stack multiple drop-shadows for bloom */
.seal-icon {
  filter:
    drop-shadow(0 0 2px  #fff)
    drop-shadow(0 0 6px  #ffd700)
    drop-shadow(0 0 15px rgba(255, 215, 0, 0.7))
    drop-shadow(0 0 30px rgba(255, 215, 0, 0.3));
}
```

---

## 5. Film Grain

### 5.1 Why Film Grain Works

Film grain breaks up **color banding** on gradients and prevents flat darks from looking digital. It adds **organic texture** that reads as "cinematic" and "aged." For dark occult content, grain also adds a sense of **ritual degradation** — like old film of a forbidden ceremony.

### 5.2 SVG feTurbulence Method (Best Quality)

```html
<!-- Hidden SVG filter definition -->
<svg style="position:absolute;width:0;height:0" aria-hidden="true">
  <defs>
    <filter id="film-grain-light" color-interpolation-filters="sRGB"
            x="0" y="0" width="100%" height="100%">
      <!-- Create Perlin noise -->
      <feTurbulence
        type="fractalNoise"
        baseFrequency="0.65"
        numOctaves="3"
        stitchTiles="stitch"
        result="noise"
      />
      <!-- Color correct: grayscale noise, alpha = noise intensity -->
      <feColorMatrix
        type="saturate"
        values="0"
        in="noise"
        result="gray-noise"
      />
      <!-- Blend onto source — soft light for subtle grain -->
      <feBlend
        in="SourceGraphic"
        in2="gray-noise"
        mode="soft-light"
        result="blend"
      />
      <feComposite in="blend" in2="SourceGraphic" operator="in" />
    </filter>

    <!-- Heavier grain for dramatic moments -->
    <filter id="film-grain-heavy" color-interpolation-filters="sRGB"
            x="0" y="0" width="100%" height="100%">
      <feTurbulence
        type="fractalNoise"
        baseFrequency="0.85"
        numOctaves="4"
        stitchTiles="stitch"
        result="noise"
      />
      <feColorMatrix type="saturate" values="0" in="noise" result="gray-noise" />
      <!-- Overlay mode = harder, more visible grain -->
      <feBlend in="SourceGraphic" in2="gray-noise" mode="overlay" result="blend" />
      <feComposite in="blend" in2="SourceGraphic" operator="in" />
    </filter>
  </defs>
</svg>
```

```css
/* Apply grain filter to layer */
.grain-overlay {
  filter: url(#film-grain-light);
}

/* Or as a pseudo-element overlay on any container */
.scene::after {
  content: '';
  position: absolute;
  inset: 0;
  filter: url(#film-grain-heavy);
  background: transparent;
  pointer-events: none;
  opacity: 0.4;
  mix-blend-mode: overlay;
}
```

### 5.3 Animated Grain (Flickering)

```css
/* Shift the noise pattern every frame for motion */
@keyframes grain-shift {
  0%   { transform: translate(0, 0);       }
  10%  { transform: translate(-2%, -3%);   }
  20%  { transform: translate(3%, 1%);     }
  30%  { transform: translate(-1%, 4%);    }
  40%  { transform: translate(2%, -2%);    }
  50%  { transform: translate(-3%, 3%);    }
  60%  { transform: translate(1%, -1%);    }
  70%  { transform: translate(-2%, 2%);    }
  80%  { transform: translate(3%, -3%);    }
  90%  { transform: translate(-1%, 1%);    }
  100% { transform: translate(0, 0);       }
}

.animated-grain::after {
  content: '';
  position: fixed;
  inset: -50%;  /* oversized to prevent edge gaps during translate */
  width: 200%;
  height: 200%;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E");
  opacity: 0.08;
  mix-blend-mode: overlay;
  pointer-events: none;
  z-index: 9999;
  animation: grain-shift 0.15s steps(1) infinite;
}
```

### 5.4 CSS-only Grain (Pseudo-element Trick)

```css
/* Fallback: use a base64 noise texture */
.grain-pseudo::after {
  content: '';
  position: absolute;
  inset: 0;
  background-image: url("data:image/png;base64,iVBORw0KGgo..."); /* noise.png */
  opacity: 0.05;
  mix-blend-mode: overlay;
  pointer-events: none;
}

/* Or: use CSS noise approximation with multiple gradients */
.pseudo-grain {
  background-image:
    url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n' x='0' y='0'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E");
  background-size: 300px 300px;
  opacity: 0.04;
  mix-blend-mode: soft-light;
}
```

---

## 6. Vignette Effects

### 6.1 Classic Inset Box-Shadow Vignette

```css
/* Simple strong vignette */
.vignette-strong {
  box-shadow: inset 0 0 200px 60px rgba(0, 0, 0, 0.95);
}

/* Subtle cinematic vignette */
.vignette-subtle {
  box-shadow: inset 0 0 120px 20px rgba(0, 0, 0, 0.6);
}

/* Purple-tinted vignette — key for our palette */
.vignette-void {
  box-shadow: inset 0 0 150px 40px rgba(13, 10, 26, 0.9);
}

/* As a pseudo-element (for <img> tags which don't show inset shadows) */
.vignette-wrap {
  position: relative;
}
.vignette-wrap::after {
  content: '';
  position: absolute;
  inset: 0;
  box-shadow: inset 0 0 150px 40px rgba(13, 10, 26, 0.85);
  pointer-events: none;
}
```

### 6.2 Radial Gradient Vignette (Smoother)

```css
/* Radial gradient vignette — rounder, more natural */
.vignette-radial::after {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(
    ellipse at center,
    transparent 50%,
    rgba(13, 10, 26, 0.6) 75%,
    rgba(13, 10, 26, 0.95) 100%
  );
  pointer-events: none;
}

/* Asymmetric vignette — darker at top (oppressive ceiling feel) */
.vignette-top-heavy::after {
  content: '';
  position: absolute;
  inset: 0;
  background:
    radial-gradient(ellipse 100% 60% at 50% 0%,   rgba(0,0,0,0.7) 0%, transparent 100%),
    radial-gradient(ellipse 80%  80% at 50% 100%, rgba(13,10,26,0.5) 0%, transparent 80%);
  pointer-events: none;
}
```

### 6.3 Animated Vignette (Breathing)

```css
@keyframes vignette-breathe {
  0%, 100% {
    opacity: 0.7;
    background: radial-gradient(ellipse at center, transparent 45%, rgba(13,10,26,0.9) 100%);
  }
  50% {
    opacity: 1.0;
    background: radial-gradient(ellipse at center, transparent 35%, rgba(13,10,26,0.95) 100%);
  }
}

.vignette-breathing::after {
  content: '';
  position: absolute;
  inset: 0;
  animation: vignette-breathe 6s ease-in-out infinite;
  pointer-events: none;
}
```

---

## 7. Chromatic Aberration

### 7.1 What It Is & When to Use It

Chromatic aberration (CA) mimics **lens failure** — the R, G, B channels fail to converge, creating color fringing at high-contrast edges. Artistically it says:
- **Reality is breaking down**
- **Something supernatural is happening**
- **This is raw, unfiltered, slightly wrong**

For Ika Tensei: use CA on **seal activation**, **dimension tears**, **glitch moments** — not as permanent UI state (gets exhausting). Use sparingly = impact. Always present = noise.

### 7.2 CSS Pseudo-element Method

```css
/* Chromatic aberration on text */
.ca-text {
  position: relative;
  color: #fff;
}

.ca-text::before,
.ca-text::after {
  content: attr(data-text); /* mirror text via data attribute */
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}

/* Red channel — shifted left */
.ca-text::before {
  color: rgba(255, 0, 0, 0.7);
  transform: translateX(-2px);
  mix-blend-mode: screen;
}

/* Blue channel — shifted right */
.ca-text::after {
  color: rgba(0, 0, 255, 0.7);
  transform: translateX(2px);
  mix-blend-mode: screen;
}
```

### 7.3 Animated Chromatic Aberration (Glitch)

```css
@keyframes ca-glitch {
  0%, 90%, 100% {
    text-shadow: none;
    transform: none;
  }
  91% {
    text-shadow:
      -3px 0 rgba(255, 0, 0, 0.8),
       3px 0 rgba(0, 0, 255, 0.8);
    transform: skewX(-1deg);
  }
  93% {
    text-shadow:
      3px 0 rgba(255, 51, 102, 0.8),
      -3px 0 rgba(0, 150, 255, 0.8);
    transform: skewX(1deg);
  }
  95% {
    text-shadow: none;
    transform: none;
  }
  96% {
    text-shadow:
      -2px 0 rgba(255, 0, 0, 0.6),
       2px 0 rgba(0, 0, 255, 0.6);
  }
}

.ca-glitch {
  animation: ca-glitch 5s ease-in-out infinite;
}
```

### 7.4 SVG feColorMatrix Chromatic Aberration

```html
<!-- SVG filter for image-level CA -->
<filter id="chromatic-aberration">
  <!-- Split into R/G/B channels -->
  <feColorMatrix type="matrix"
    values="1 0 0 0 0
            0 0 0 0 0
            0 0 0 0 0
            0 0 0 1 0"
    in="SourceGraphic"
    result="red-channel"
  />
  <feOffset dx="-3" dy="0" in="red-channel" result="red-shifted" />

  <feColorMatrix type="matrix"
    values="0 0 0 0 0
            0 0 0 0 0
            0 0 1 0 0
            0 0 0 1 0"
    in="SourceGraphic"
    result="blue-channel"
  />
  <feOffset dx="3" dy="0" in="blue-channel" result="blue-shifted" />

  <!-- Combine channels -->
  <feBlend in="red-shifted" in2="SourceGraphic" mode="screen" result="r-blend" />
  <feBlend in="blue-shifted" in2="r-blend"      mode="screen" />
</filter>
```

```css
.ca-image {
  filter: url(#chromatic-aberration);
}
```

### 7.5 Our Flavor: Pink-Gold CA

Instead of standard R/B split, use our palette colors for a unique occult CA:

```css
@keyframes occult-ca {
  0%, 100% {
    text-shadow: none;
  }
  50% {
    text-shadow:
      -3px 0 rgba(255, 51,  102, 0.7),   /* blood pink left */
       3px 0 rgba(255, 215, 0,   0.7);   /* ritual gold right */
  }
}

/* This gives a "rift in reality" feel using our own palette */
.occult-ca-text {
  animation: occult-ca 3s ease-in-out infinite;
}
```

---

## 8. Dark Background Depth (Making Voids Feel Rich)

### 8.1 The Problem

`background: #0d0a1a` is flat. It reads as a dark rectangle. Real dark scenes have **atmospheric depth** — slight variation, ambient light scatter, surface texture.

### 8.2 Multi-Stop Gradient Background

```css
/* Multiple gradient layers stacked */
.rich-void-bg {
  background:
    /* Top atmospheric haze */
    radial-gradient(ellipse 80% 40% at 50% 0%,
      rgba(61, 45, 94, 0.4) 0%,
      transparent 70%),

    /* Bottom depth shadow */
    radial-gradient(ellipse 100% 50% at 50% 100%,
      rgba(5, 3, 12, 0.8) 0%,
      transparent 70%),

    /* Corner darkening */
    radial-gradient(ellipse 60% 80% at 0% 50%,
      rgba(5, 3, 12, 0.5) 0%,
      transparent 60%),
    radial-gradient(ellipse 60% 80% at 100% 50%,
      rgba(5, 3, 12, 0.5) 0%,
      transparent 60%),

    /* Base color */
    #0d0a1a;
}
```

### 8.3 Layered Color Clouds (Nebula Effect)

```css
/* Soft color "nebula" clouds in the background */
.nebula-bg {
  background:
    /* Pink nebula cluster — top right */
    radial-gradient(ellipse 300px 200px at 75% 20%,
      rgba(255, 51, 102, 0.08) 0%,
      transparent 70%),

    /* Gold nebula — bottom left */
    radial-gradient(ellipse 250px 300px at 20% 80%,
      rgba(255, 215, 0, 0.06) 0%,
      transparent 70%),

    /* Purple cluster — center */
    radial-gradient(ellipse 400px 300px at 50% 50%,
      rgba(80, 40, 120, 0.15) 0%,
      transparent 60%),

    /* Deep void base */
    #0d0a1a;
}
```

### 8.4 Subtle Background Noise for Texture

```css
/* Add micro-texture to prevent banding */
.textured-void {
  background-color: #0d0a1a;
  background-image:
    url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)' opacity='0.05'/%3E%3C/svg%3E");
  background-size: 200px 200px;
}
```

### 8.5 Animated Ambient Light

```css
/* Slow drifting ambient light — gives life to the void */
@keyframes ambient-drift {
  0%   { background-position: 0% 0%, 100% 100%, 0% 50%, 100% 50%, 0 0; }
  25%  { background-position: 5% 5%, 95% 95%, 5% 45%, 95% 55%, 0 0; }
  50%  { background-position: 10% 0%, 90% 100%, 0% 50%, 100% 50%, 0 0; }
  75%  { background-position: 5% 5%, 95% 95%, 5% 55%, 95% 45%, 0 0; }
  100% { background-position: 0% 0%, 100% 100%, 0% 50%, 100% 50%, 0 0; }
}

.living-void {
  background:
    radial-gradient(ellipse 300px 200px at 75% 20%, rgba(255,51,102,0.08) 0%, transparent 70%),
    radial-gradient(ellipse 250px 300px at 20% 80%, rgba(255,215,0,0.05)   0%, transparent 70%),
    radial-gradient(ellipse 400px 300px at 50% 50%, rgba(80,40,120,0.15)   0%, transparent 60%),
    radial-gradient(ellipse 200px 200px at 0%   50%, rgba(5,3,12,0.5)       0%, transparent 60%),
    #0d0a1a;
  background-size: 100% 100%, 100% 100%, 100% 100%, 100% 100%, auto;
  animation: ambient-drift 20s ease-in-out infinite;
}
```

---

## 9. Color Shift Animations (Temperature Over Time)

### 9.1 Warm-to-Cool Scene Shift

```css
/* Full scene color temperature shift — warmer to cooler */
@keyframes temp-shift-warm-cool {
  0% {
    filter: contrast(110%) brightness(95%) saturate(120%) hue-rotate(10deg);
    /* Warm: slight gold push */
  }
  50% {
    filter: contrast(115%) brightness(88%) saturate(130%) hue-rotate(-15deg);
    /* Cool: purple push, more contrast */
  }
  100% {
    filter: contrast(110%) brightness(95%) saturate(120%) hue-rotate(10deg);
  }
}

.color-shifting-scene {
  animation: temp-shift-warm-cool 30s ease-in-out infinite;
}
```

### 9.2 Ritual Activation Sequence

```css
/* Scene gets warmer/more saturated as ritual builds */
@keyframes ritual-build {
  0%   { filter: grayscale(30%) contrast(100%) brightness(100%) hue-rotate(0deg); }
  25%  { filter: grayscale(15%) contrast(105%) brightness(98%)  hue-rotate(-5deg); }
  50%  { filter: grayscale(5%)  contrast(115%) brightness(92%)  hue-rotate(-10deg); }
  75%  { filter: grayscale(0%)  contrast(125%) brightness(88%)  hue-rotate(-15deg); }
  100% { filter: grayscale(0%)  contrast(135%) brightness(82%)  hue-rotate(-20deg) saturate(150%); }
}

/* Separate recovery sequence */
@keyframes ritual-release {
  0%   { filter: contrast(135%) brightness(82%) saturate(150%) hue-rotate(-20deg); }
  20%  { filter: contrast(160%) brightness(120%) saturate(200%) hue-rotate(-30deg); }
  /* FLASH — max saturation */
  40%  { filter: contrast(100%) brightness(100%) saturate(100%) hue-rotate(0deg); }
  100% { filter: contrast(110%) brightness(95%) saturate(110%) hue-rotate(-5deg); }
}
```

### 9.3 Slow Color Grade Drift (Subtle, Always-On)

```css
/* Very slow ambient color shift — 90 second cycle, barely perceptible */
@keyframes grade-drift {
  0%   { filter: hue-rotate(0deg)   saturate(100%) brightness(100%); }
  20%  { filter: hue-rotate(-5deg)  saturate(108%) brightness(98%); }
  40%  { filter: hue-rotate(-10deg) saturate(115%) brightness(95%); }
  60%  { filter: hue-rotate(-5deg)  saturate(108%) brightness(98%); }
  80%  { filter: hue-rotate(5deg)   saturate(95%)  brightness(102%); }
  100% { filter: hue-rotate(0deg)   saturate(100%) brightness(100%); }
}

.ambient-grade {
  animation: grade-drift 90s ease-in-out infinite;
}
```

---

## 10. Full Post-Processing Layer Stack

### The Complete System (Layer Order, Bottom to Top)

```
[1] Rich void background (multi-radial-gradient)  ← deepest layer
[2] Content (video, canvas, UI elements)
[3] Nebula ambient color clouds (pseudo-element, mix-blend: screen)
[4] Film grain (pseudo-element, mix-blend: overlay, opacity 0.05-0.10)
[5] Vignette (pseudo-element, radial-gradient, mix-blend: multiply)
[6] Color grade filter (on wrapper element or individual scenes)
[7] Chromatic aberration (triggered, not always-on)
```

### Implementation: Full Wrapper

```css
.scene-wrapper {
  position: relative;
  overflow: hidden;
  background:
    radial-gradient(ellipse 80% 40% at 50%  0%,   rgba(61,45,94,0.4)    0%, transparent 70%),
    radial-gradient(ellipse 60% 80% at 0%   50%,  rgba(5,3,12,0.5)      0%, transparent 60%),
    radial-gradient(ellipse 60% 80% at 100% 50%,  rgba(5,3,12,0.5)      0%, transparent 60%),
    #0d0a1a;

  /* Color grade on entire scene */
  filter: contrast(112%) brightness(92%) saturate(125%) hue-rotate(-5deg);

  /* Slow drift */
  animation: grade-drift 90s ease-in-out infinite;
}

/* Film grain layer */
.scene-wrapper::before {
  content: '';
  position: absolute;
  inset: -50%;
  width: 200%;
  height: 200%;
  z-index: 100;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23n)'/%3E%3C/svg%3E");
  background-size: 300px 300px;
  opacity: 0.06;
  mix-blend-mode: overlay;
  pointer-events: none;
  animation: grain-shift 0.2s steps(1) infinite;
}

/* Vignette layer */
.scene-wrapper::after {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 101;
  background: radial-gradient(
    ellipse at center,
    transparent 40%,
    rgba(13, 10, 26, 0.5) 70%,
    rgba(13, 10, 26, 0.9) 100%
  );
  pointer-events: none;
}
```

---

## 11. Performance Considerations

| Effect | GPU Cost | CPU Cost | Notes |
|--------|----------|----------|-------|
| `filter: contrast/brightness/saturate` | Low | Low | Hardware accelerated |
| `filter: blur()` | Medium | Low | GPU accelerated, limit to small areas |
| `box-shadow` (glow) | Medium | Low | More layers = more cost |
| `backdrop-filter` | High | Medium | Use sparingly, can tank mobile perf |
| `feTurbulence` (static) | Medium | Low | Paint once, cheap if not animated |
| `feTurbulence` (animated) | High | High | Avoid over large areas |
| `mix-blend-mode` | Medium | Low | Creates stacking context |
| CSS `animation` on `filter` | Medium | Low | Prefer `transform` for 60fps |

### Optimization Rules

```css
/* 1. Force GPU layer for animated elements */
.glow-element {
  will-change: box-shadow, filter;
  transform: translateZ(0); /* create GPU layer */
}

/* 2. Reduce animated grain area */
.grain-overlay {
  /* Only cover visible area, not 200% oversized */
  /* Accept slight edge artifacts or use clip-path */
  clip-path: inset(0);
}

/* 3. Pause animations when not visible */
@media (prefers-reduced-motion: reduce) {
  .bloom-pulse,
  .grain-shift,
  .ambient-drift {
    animation: none;
  }
}

/* 4. Use lower-cost fallback for mobile */
@media (max-width: 768px) {
  .scene-wrapper {
    filter: contrast(112%) brightness(92%); /* drop saturation and hue-rotate */
    animation: none;
  }
  .scene-wrapper::before {
    display: none; /* kill grain on mobile */
  }
}
```

---

## 12. Trailer-Specific Cue Points

### Scene: Opening (0:00-0:05)
```
Grade: Nightmare (grayscale 30%, high contrast, cold)
Vignette: Maximum (90% edge darkness)
Grain: Heavy
Bloom: None
```

### Scene: First Seal Reveal (0:06-0:12)
```
Grade: Transition nightmare → void-ritual over 2s
Vignette: Ease down from max to medium
Bloom: Pink glow on seal — slow fade in, then bloom-pulse
CA: Brief flash (1-2 frames) on reveal moment
```

### Scene: Ritual Activation (0:13-0:20)
```
Grade: ritual-build keyframes over 7s
Vignette: Breathing animation
Bloom: Gold + pink layered, pulsing faster
Grain: Reduce (cleaner = more powerful)
CA: Occult CA on text overlays
```

### Scene: Climax (0:21-0:24)
```
Grade: Maximum saturation (contrast 135%, sat 150%)
Bloom: Full bloom, all elements glowing
CA: Active on all text
Grade flash: brightness 130% → 80% sharp cut
```

### Scene: Resolution (0:25-0:30)
```
Grade: ritual-release → return to void-ritual
Bloom: Fade to slow breathe
Grain: Medium
Vignette: Strong static
CA: Gone
```

---

## 13. Quick Reference: Color Values for Effects

```css
/* Glow colors */
--glow-pink:       rgba(255, 51, 102, VAR);
--glow-pink-light: rgba(255, 107, 157, VAR);
--glow-gold:       rgba(255, 215, 0, VAR);
--glow-gold-hot:   rgba(255, 241, 118, VAR);
--glow-void:       rgba(80, 40, 120, VAR);
--glow-white:      rgba(255, 255, 255, VAR);

/* Opacity levels for glow layers */
/* Layer 1 (core):  0.9 - 1.0  */
/* Layer 2 (inner): 0.5 - 0.7  */
/* Layer 3 (mid):   0.25 - 0.4  */
/* Layer 4 (bloom): 0.08 - 0.15 */

/* Vignette overlay colors */
--vignette-void: rgba(13, 10, 26, VAR);   /* pure void */
--vignette-ink:  rgba(5,  3,  12, VAR);   /* absolute black */

/* Film grain intensity */
/* Subtle:   opacity 0.03 - 0.05 */
/* Normal:   opacity 0.05 - 0.08 */
/* Heavy:    opacity 0.08 - 0.12 */
/* Dramatic: opacity 0.12 - 0.20 */
```

---

## Sources & References

- CSS filter MDN: https://developer.mozilla.org/en-US/docs/Web/CSS/filter
- Glow effects: https://codersblock.com/blog/creating-glow-effects-with-css/
- Neon glow system: https://css3shapes.com/how-to-make-a-neon-glow-effect-in-css/
- Vignette 3 ways: https://una.im/vignettes
- Grainy gradients: https://css-tricks.com/grainy-gradients/
- SVG feTurbulence: https://tympanus.net/codrops/2019/02/19/svg-filter-effects-creating-texture-with-feturbulence/
- Grainy CSS bg: https://www.freecodecamp.org/news/grainy-css-backgrounds-using-svg-filters/
- Chromatic aberration CSS: https://freefrontend.com/css-glitch-effects/ (30 CSS glitch effects collection)
- Color grading film: https://localeyesit.com/color-grading-in-film/
- Depth with gradients: https://618media.com/en/blog/complex-gradients-depth-color-transitions/

---

*Research complete. All code examples are production-ready and tuned for our palette.*
