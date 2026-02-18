# Frontend Research Synthesis - 20 Agent Swarm Results

## The Verdict

### Build Approach: Claude Code (us) + v0 for component scaffolding
- **v0.dev** for rapid component generation (shadcn/Tailwind/Next.js native) then customize heavily
- **Lovable.dev** as backup for rapid prototyping full pages
- **Bolt.new** not recommended (quality inconsistent, better for simple apps)
- **Replit Agent** not recommended (deployment lock-in, mediocre output)
- **Cursor** viable but we already have Claude Code via OpenClaw which is equivalent
- **Our workflow**: Claude generates page-by-page, component-by-component. NOT full app at once. Include explicit design tokens, color palettes, font choices in every prompt to avoid "AI slop"

### Stack (Confirmed)
| Layer | Choice | Why |
|-------|--------|-----|
| Framework | Next.js 14 (App Router) | SSR, routing, image optimization |
| 3D | React Three Fiber + drei + postprocessing | Pixel shaders, portal effects, particles |
| Styling | Tailwind CSS + NES.css (hybrid) | Pixel UI components + utility classes |
| State | Zustand | Simple, performant, good TS support |
| Animation | Framer Motion (UI) + GSAP (complex sequences) | FM for page transitions, GSAP for ritual sequences |
| Sound | use-sound (SFX) + Tone.js (ambient/chiptune synthesis) | Lightweight + procedural |
| ETH Wallet | wagmi v2 + viem + RainbowKit (or Dynamic.xyz for multi-chain) | Best ETH DX |
| SOL Wallet | @solana/wallet-adapter-react | Standard |
| SUI Wallet | @mysten/dapp-kit | Official |
| Multi-chain unified | Dynamic.xyz | Best multi-chain single-modal UX, supports ETH+SOL+SUI |
| Data fetching | TanStack Query | Polling, caching, optimistic updates |
| Fonts | Press Start 2P (headings) + Silkscreen (small text) + Noto Sans JP (kanji) |
| Icons | Pixel art custom + lucide-react fallback |

### Pixel Art CSS: NES.css as base
- 25k+ GitHub stars, actively maintained
- Full component library: buttons, dialogs, progress bars, containers
- Dark theme built-in
- Combine with custom occult-themed pixel borders via `pixel-borders` Sass mixin
- Override NES.css colors with our occult palette

### 3D Effects: Selective, not overwhelming
- **Hero**: Pixel-art-styled summoning circle (R3F with PixelatePass postprocessing)
- **Seal flow**: GPGPU particle vortex + dissolve shader (Codrops technique)
- **Reveal**: Tarot card flip with bloom + chromatic aberration
- **Mobile**: Static fallback images, lazy-load 3D on interaction
- **Key**: Apply PixelatePass to ALL 3D scenes for consistent pixel aesthetic

### Pixel Shaders (critical for vibe unity)
```
PixelatePass → reduces 3D to pixel art look
DitherPass → adds retro dithering  
CRT scanlines → optional overlay
Color palette reduction → limit to occult palette
```
All available via @react-three/postprocessing custom effects

### Sound Design
- **Ambient**: Tone.js synthesized dark drone (reverb + low-pass filter)
- **SFX**: 8-bit chiptune via use-sound (Howler.js wrapper)
- **Key sounds**: seal_start (ritual bell), step_complete (level up chime), reveal (magical sparkle), error (8-bit fail)
- **Autoplay**: Require user gesture first, then ambient loops
- **Toggle**: Always provide mute button (accessibility + preference)

### AI-Generated Assets
- **PixelLab** ($24/mo): Character sprites (Ika mascot, NPCs), item icons, UI frames
- **Midjourney v4** (`--v 4` flag): Tarot cards, summoning circles, occult backgrounds
- **Stable Diffusion + Pixel LoRA**: Free backup for bulk generation
- Generate a consistent asset library BEFORE building (don't inline-generate during dev)

### Wallet UX: Dynamic.xyz recommended
- Single modal for ETH + SOL + SUI connections
- Embedded wallets for non-crypto users
- Social login (email, Google) → auto-create wallet
- Themeable (can pixel-art the modal)
- Alternative: build custom with RainbowKit (ETH) + wallet-adapter (SOL) + dapp-kit (SUI) separately

### Real-time Transaction Tracking
- TanStack Query with 3s polling interval during seal flow
- Optimistic UI updates (show step as "in progress" immediately)
- WebSocket upgrade path for production
- Toast notifications via custom pixel-art toasts (not generic)
- Background tab: Service Worker for push notifications

### Platform: Pure Web (PWA optional)
- No Tauri/Electron needed
- PWA manifest for "install" capability
- Service Worker for offline seal status checking
- Mobile-first responsive

---

## Color Palette (Pixel Otaku Occult)

| Role | Hex | Name |
|------|-----|------|
| BG Primary | `#0d0a1a` | Void Purple |
| BG Secondary | `#1a1025` | Ritual Dark |
| Surface | `#231832` | Card Purple |
| Border | `#3a2850` | Sigil Border |
| Text Primary | `#e8e0f0` | Ghost White |
| Text Secondary | `#8a7a9a` | Faded Spirit |
| Accent Primary | `#ff3366` | Blood Pink |
| Accent Secondary | `#ffd700` | Ritual Gold |
| Accent Tertiary | `#9b59b6` | Mystic Purple |
| Success | `#00ff88` | Spectral Green |
| Error | `#ff4444` | Demon Red |
| Pixel Highlight | `#00ccff` | Soul Cyan |

## Typography

| Element | Font | Size |
|---------|------|------|
| Hero/Display | Press Start 2P | 32-48px |
| Headings | Press Start 2P | 16-24px |
| Body | Silkscreen | 14-16px |
| JP Accents | Noto Sans JP | 16-24px |
| Addresses/Code | JetBrains Mono | 12-14px |
| Dialogue boxes | Press Start 2P | 12px |

## Reference Sites (from research)
1. **Azuki** - Best anime NFT site, clean with character art integration
2. **Berachain** - Playful mascot + dark theme done right
3. **ChainZoku** - Interactive 3D storytelling
4. **Zero.tech** - Particle systems + immersive entry
5. **Pudgy Penguins** - Accessible, fun, mass-market appeal

## JRPG UI Elements to Build
- Pixel dialogue box with character portrait (Ika mascot)
- RPG-style progress bar (HP bar aesthetic for seal progress)
- Menu system with pixel cursor
- "Quest complete" animation for successful reincarnation
- Item card frames (for NFT display)

## Anti-Patterns to Avoid
- Generic glassmorphism (every web3 site looks the same)
- Smooth gradients where pixel dithering should be
- Inter/Roboto fonts (instant AI slop detection)
- Generic loading spinners (use pixel art animations)
- Unstyled wallet modals (theme EVERYTHING)
