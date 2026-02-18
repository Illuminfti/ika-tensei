# Frontend Visual Design & Aesthetics Audit

**Date:** 2026-02-18  
**Auditor:** Erina (Visual Design & Aesthetics)  
**Frontend URL:** https://frontend-phi-nine-12.vercel.app  
**Source:** `/home/ubuntu/clawd/ika-tensei/packages/frontend/`

---

## Executive Summary

The Ika Tensei frontend demonstrates **strong visual identity** with a cohesive occult/JRPG aesthetic. The landing page is polished and immersive, while inner pages (seal, gallery, guild, profile) show inconsistent styling—mixing NES.css components with custom pixel art elements. Overall rating: **7.2/10**.

### Quick Ratings by Page

| Page | Score | Key Issue |
|------|-------|-----------|
| Landing (/) | 8.5/10 | Near excellent; minor spacing inconsistencies |
| Seal (/seal) | 7.0/10 | NES.css clash with custom components |
| Gallery (/gallery) | 7.0/10 | Modal styling inconsistent |
| Guild (/guild) | 7.5/10 | Good tab transitions, busy at mobile |
| Profile (/profile) | 6.0/10 | Heavy NES.css usage breaks immersion |

---

## 1. Color Palette Analysis

### ✅ Consistent Elements

The CSS variables in `globals.css:1-24` define a rich occult palette:

```css
--blood-pink: #ff3366      /* Primary accent */
--ritual-gold: #ffd700     /* Secondary accent */
--spectral-green: #00ff88  /* Success states */
--soul-cyan: #00ccff       /* Info/links */
--void-purple: #0d0a1a     /* Primary background */
--faded-spirit: #8a7a9a    /* Muted text */
```

**Verified usage across pages:**
- Landing page hero: pink/gold gradient text (`app/page.tsx:91-115`)
- Seal flow: gold step indicators (`app/seal/page.tsx:44-58`)
- Guild tabs: gold active state (`app/guild/page.tsx:213-225`)
- Dialogue boxes: purple/gold border frames

### ⚠️ Issues Found

| Issue | Location | Severity | Details |
|-------|----------|----------|---------|
| Inconsistent button colors | `app/profile/page.tsx:117` | MEDIUM | Uses `nes-btn is-error` (red) instead of theme-consistent pink |
| Hardcoded colors bypassing theme | `app/page.tsx:318` | LOW | Chain badges use inline hex like `#627eea` instead of CSS vars |
| Jarring contrast on dark elements | `app/profile/page.tsx:89` | MEDIUM | `bg-card-purple/30` with `border-ritual-gold/30` creates low contrast |

**Recommendation:** Create a `colors.ts` constants file mapping chain names to theme-consistent colors, or extend the Tailwind config with chain-specific colors.

---

## 2. Typography Hierarchy

### ✅ Good Practices

- **Press Start 2P** (pixel font) used for headings, buttons, labels — appropriate for pixel art aesthetic
- **Silkscreen** used for body text — readable at small sizes
- Clear size hierarchy defined in `tailwind.config.ts:52-60`:
  - `pixel-xs`: 8px (labels, timestamps)
  - `pixel-sm`: 10px (secondary text)
  - `pixel-base`: 12px (body)
  - `pixel-xl` to `pixel-4xl`: Headings

### ⚠️ Issues Found

| Issue | Location | Severity | Details |
|-------|----------|----------|---------|
| Press Start 2P too small on mobile | Multiple pages | HIGH | 8-10px font is illegible on 320px screens |
| Missing responsive font sizing | `app/page.tsx:91` | MEDIUM | `text-4xl md:text-6xl` works, but body text doesn't scale |
| No font-size for "pixel-xs" equivalent | `tailwind.config.ts` | LOW | Custom `text-[8px]` used instead of tokenized value |

**Example of problematic code:**
```tsx
// app/profile/page.tsx:89
className="font-pixel text-xs text-ghost-white"  // 12px is too small for primary content
```

**Recommendation:** 
- Increase minimum pixel font size to 10px on mobile
- Add `text-pixel-8px` to Tailwind config for 8px tokens
- Use `text-base md:text-lg` for body text instead of fixed pixel sizes

---

## 3. Spacing & Rhythm

### ✅ Good Practices

- Consistent vertical rhythm with 4px base unit (`pixel-1`: 4px in `tailwind.config.ts:147`)
- Generous padding on cards: `p-4` to `p-6` 
- Section spacing: `py-24` (96px) creates good breathing room
- Grid gaps: `gap-4` (16px) consistent in feature grids

### ⚠️ Issues Found

| Issue | Location | Severity | Details |
|-------|----------|----------|---------|
| Inconsistent button padding | `components/ui/PixelButton.tsx:14-16` | LOW | `sm` size has `!py-1 !px-3` but other components use `!py-2` |
| Unequal section dividers | `app/page.tsx:165, 228, 300, 370` | LOW | Each divider uses different gradient colors |
| Guild page tab bar overflow | `app/guild/page.tsx:207` | MEDIUM | `overflow-x-auto` exists but tabs too wide on mobile |

**Example:**
```tsx
// app/guild/page.tsx:203-210
className="flex gap-2 overflow-x-auto scrollbar-hide justify-center"
// Tabs: "Hall", "Quests", "Vault", "Council", "Rankings" - too wide for mobile
```

---

## 4. Animation Quality (Framer Motion)

### ✅ Excellent Implementation

- **Smooth 60fps animations** in SummoningCircle (`components/ui/SummoningCircle.tsx`)
- Good use of `whileInView` for scroll-triggered reveals
- Staggered entrances create satisfying progression
- Phase-based circle animation (idle → charging → active → overload) is polished

### ⚠️ Issues Found

| Issue | Location | Severity | Details |
|-------|----------|----------|---------|
| Too many concurrent animations on landing | `app/page.tsx:70-130` | MEDIUM | Hero section has 10+ motion components animating simultaneously |
| Janky scroll performance | `app/guild/page.tsx` | MEDIUM | Many `whileInView` triggers cause scroll jank |
| No reduced-motion support | Multiple pages | HIGH | Users with `prefers-reduced-motion` get no accommodation despite CSS existing |

**Example of excessive animation:**
```tsx
// app/page.tsx:70-130
// 1. Ika chibi bobbing (3s loop)
// 2. Title entrance
3. Subtitle entrance
4. Description entrance
5. CTA sparkle particles (6x)
6. CTA glow pulse
7. Stats counter entrance
8. Scroll indicator
// All trigger within 1.5s of each other
```

**Recommendation:** Add motion preferences check:
```tsx
const prefersReducedMotion = useReducedMotion();
```

---

## 5. Art Asset Quality

### ✅ Quality Assets

| Asset | Location | Quality |
|-------|----------|---------|
| `ika-chibi.png` | `/public/art/` | 588KB, clean pixel art |
| `ika-mascot-v2.png` | `/public/art/` | 470KB, good detail |
| `hero-wide.png` | `/public/art/` | 1.1MB, high-res |
| `summoning-circle.png` | `/public/art/` | 1.2MB, detailed |

### ⚠️ Issues Found

| Issue | Location | Severity | Details |
|-------|----------|----------|---------|
| Unused assets | `/public/art/hero-banner.png` | LOW | 1.7MB file exists but not used |
| Duplicate versions | `/public/art/hero-wide*.png` (3 versions) | LOW | v1, v2, and current - cleanup needed |
| No alt text on decorative images | `app/page.tsx:71-84` | MEDIUM | Hero images have `alt=""` but should describe for a11y |

**Recommendation:** Delete unused assets, add descriptive alt text:
```tsx
<Image src="/art/hero-wide.png" alt="Ika goddess statue surrounded by mystical fog" />
```

---

## 6. Mobile Responsiveness

### ✅ Working Breakpoints

- Tailwind responsive classes used throughout: `md:`, `lg:`
- Mobile-first section stacking works (`grid-cols-1 md:grid-cols-3`)
- Touch-friendly tap targets on buttons (min 44px)

### ⚠️ Issues Found

| Issue | Location | Severity | Details |
|-------|----------|----------|---------|
| Guild tab bar horizontal scroll | `app/guild/page.tsx:203` | HIGH | Tabs overflow on small screens, requires horizontal scroll |
| Profile page card overflow | `app/profile/page.tsx:50` | HIGH | `nes-container is-dark` not responsive, overflows on 320px |
| Seal step indicator breaks | `app/seal/page.tsx:29` | MEDIUM | Step names hidden on mobile (`hidden md:block`) - no indication of current step |
| Gallery grid too wide | `app/gallery/page.tsx:75` | MEDIUM | `grid-cols-1 md:grid-cols-2 lg:grid-cols-3` creates 3-column on 1024px which is tight |

**Example of broken mobile:**
```tsx
// app/profile/page.tsx:50
className="nes-container is-dark text-center mb-8"
// Fixed width container with no max-width causes horizontal scroll on mobile
```

**Recommendation:**
```tsx
className="nes-container is-dark text-center mb-8 max-w-full overflow-x-hidden"
```

---

## 7. Dark Theme Consistency

### ✅ Strong Implementation

- All pages use `bg-void-purple` or `bg-void-black`
- Text contrast generally good: `text-ghost-white` (#e8e0f0) on dark backgrounds
- Consistent use of semi-transparent overlays: `bg-void-purple/80`

### ⚠️ Issues Found

| Issue | Location | Severity | Details |
|-------|----------|----------|---------|
| White flash on page transitions | `app/layout.tsx` | MEDIUM | No dark background set during navigation |
| Inconsistent dark overlays | `app/profile/page.tsx` | LOW | Mix of `bg-black/30`, `bg-card-purple/30`, `bg-card-purple/20` |
| Light mode leaks possible | `app/seal/page.tsx:268` | MEDIUM | Modal uses hardcoded `bg-[#0a0a14]` instead of theme variable |

**Example:**
```tsx
// app/seal/page.tsx:268
className="bg-[#0a0a14] border-2 border-ritual-gold/30 p-6 max-w-lg w-full"
// Should use: className="bg-void-purple border-2 border-ritual-gold/30"
```

---

## 8. Visual Hierarchy

### ✅ Good Examples

**Landing Page:**
1. Hero: Ika chibi → Title → CTA → Stats (clear top-to-bottom flow)
2. Steps section: Numbered circles create clear sequence
3. Feature grid: Icon → Title → Description (consistent)

**Guild Page:**
- Tab navigation at top provides clear navigation
- Activity feed shows temporal hierarchy (recent at top)

### ⚠️ Issues Found

| Issue | Location | Severity | Details |
|-------|----------|----------|---------|
| Footer overwhelmed by links | `app/page.tsx:431-455` | LOW | 6 links + social = cluttered |
| Profile page confusing hierarchy | `app/profile/page.tsx` | MEDIUM | Wallet section, Active Rituals, Journal, Quest Log - no visual separation |
| Gallery modal competes with page | `app/gallery/page.tsx:91-150` | HIGH | Modal covers entire screen with no clear focus |

**Recommendation:** Add visual separators in profile:
```tsx
<div className="border-t border-sigil-border/30 my-6" />
```

---

## 9. Pixel Art Consistency

### ✅ SVG Sprites Match PNG Style

The custom SVG components in `components/ui/PixelSprite.tsx` match the PNG aesthetic:
- 16x16 grid-based designs
- Consistent color palette (IKA_COLORS, SEAL_COLORS)
- Proper `image-rendering: pixelated` applied

### ⚠️ Issues Found

| Issue | Location | Severity | Details |
|-------|----------|----------|---------|
| `image-rendering` not applied to all images | `app/page.tsx:71-84` | MEDIUM | Hero image has class but some Next.js Image components missing |
| SVG sprites not matching PNG colors | `components/ui/PixelSprite.tsx:38` | LOW | `IKA_COLORS.body` is purple but PNG appears more pink |
| Inconsistent sprite sizing | Multiple pages | LOW | Some places pass `size={48}`, others `size={36}` |

**Example of inconsistent sprite:**
```tsx
// app/page.tsx:12-14 - 48px icons
// app/page.tsx:308-312 - 36px icons
// Feature grid uses mixed sizes
```

---

## Specific File:Line Findings

### Critical (Blocks UX)

1. **`app/profile/page.tsx:50`** — Profile card overflows on mobile
   ```tsx
   className="nes-container is-dark text-center mb-8"
   ```
   **Fix:** Add `max-w-full overflow-x-hidden`

2. **`app/guild/page.tsx:203`** — Tab bar overflows on mobile
   ```tsx
   className="flex gap-2 overflow-x-auto scrollbar-hide justify-center"
   ```
   **Fix:** Change to `flex-wrap justify-center` or reduce tab text

3. **`app/seal/page.tsx:29`** — No mobile step indicator
   ```tsx
   <span className="font-pixel hidden md:block">
   ```
   **Fix:** Add mobile-friendly step dots or numbers

### High Priority

4. **`app/gallery/page.tsx:91`** — Modal too large on mobile
   ```tsx
   className="fixed inset-0 bg-void-purple/80 backdrop-blur-sm z-50"
   ```
   **Fix:** Add `p-4` and constrain max-width

5. **Multiple pages** — Missing reduced-motion support
   **Fix:** Add `prefers-reduced-motion` check with Framer Motion

6. **`components/ui/PixelSprite.tsx:38`** — SVG colors don't match PNG
   **Fix:** Update IKA_COLORS to match ika-mascot-v2.png actual colors

### Medium Priority

7. **`app/page.tsx:318`** — Hardcoded chain colors
   ```tsx
   { name: "Ethereum", abbr: "ETH", color: "#627eea" }
   ```

8. **`app/profile/page.tsx:117`** — Wrong button variant
   ```tsx
   className="nes-btn is-error"
   ```

9. **Multiple** — Inconsistent spacing and padding

### Low Priority

10. **Unused assets** — hero-banner.png, duplicate hero-wide files
11. **Missing alt text** — Decorative images need descriptions
12. **Footer clutter** — Too many links in small space

---

## Recommendations Summary

### Immediate Fixes (This Sprint)

1. Add mobile-responsive wrapper to profile page cards
2. Fix guild tab bar for mobile
3. Add mobile step indicator to seal flow
4. Implement reduced-motion preferences
5. Standardize button variants to use theme colors

### Next Sprint

6. Refactor NES.css usage — replace with custom components
7. Create chain color constants file
8. Clean up unused art assets
9. Add consistent visual separators to profile page
10. Update SVG sprite colors to match PNG

### Design System Improvements

11. Document color tokens in Storybook
12. Create responsive typography scale
13. Build standardized card component
14. Add animation orchestration guidelines

---

## Conclusion

The Ika Tensei frontend has a **strong visual identity** with excellent use of pixel art, custom animations, and thematic consistency. The landing page demonstrates what's possible with this stack. The inner pages need polish to match that quality level—primarily fixing mobile responsiveness and reducing NES.css dependency.

**Overall Score: 7.2/10**  
**Priority: MEDIUM** — Not blocking launch but should be addressed before public marketing push.
