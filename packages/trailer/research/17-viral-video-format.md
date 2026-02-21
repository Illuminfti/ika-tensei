# 17 — Viral Video Format Research
*Twitter/X Short-Form Video: Specs, Hooks & CT Patterns*
*Researched: 2026-02-18*

---

## TL;DR for the Ika Tensei Trailer

- **Format**: 1:1 square (1080×1080) or 16:9 (1280×720) for broad reach; 9:16 (1080×1920) if mobile-first
- **Duration**: 15–30 seconds sweet spot. Hard cut to black or seamless loop at end
- **Hook**: First 3 seconds are everything. Start mid-action, not fade-in
- **Captions**: Always. 80%+ of Twitter views are muted on mobile
- **CT pattern**: Mystery → reveal → FOMO → CTA. Never explain, always tease
- **Looping**: Keep first and last frame identical — video plays as infinite loop under 60s

---

## 1. Twitter/X Video Technical Specs (2025/2026)

### Supported Resolutions

| Format | Dimensions | Aspect Ratio |
|--------|-----------|--------------|
| HD Landscape | 1280 × 720 px | 16:9 ✅ Recommended |
| Full HD Landscape | 1920 × 1080 px | 16:9 |
| Vertical / Portrait | 720 × 1280 px | 9:16 ✅ Recommended |
| Full HD Vertical | 1080 × 1920 px | 9:16 |
| Square | 720 × 720 px | 1:1 |
| Square Full HD | 1080 × 1080 px | 1:1 ✅ For standalone |

**Max resolution**: 1920×1200 px (landscape), 1080×1920 px (portrait)  
**Min resolution**: 32×32 px (don't go here)  
**Aspect ratio range accepted**: 1:2.39 to 2.39:1

### File Requirements

| Parameter | Free/Standard | Premium/Pro |
|-----------|--------------|-------------|
| Max duration | **140 seconds** (2m 20s) | Up to 4 hours |
| Max file size | **512 MB** | 16 GB |
| Resolution (max) | 720p | 1080p (<2h), 720p (2-4h) |
| Android limit | 140s | 10 min |

### Encoding

```
Video Codec:  H.264
Audio Codec:  AAC
Container:    MP4 or MOV
Frame rate:   30 fps recommended, up to 40 fps supported
Bitrate:      No official cap, compress to target file size
```

### Optimal Export Settings (for Ika trailer)

```
Resolution:   1280 × 720 (16:9) or 1080 × 1080 (1:1)
Frame rate:   30 fps
Codec:        H.264, High Profile
Audio:        AAC 128kbps stereo
Container:    MP4
File size:    Target < 50 MB for fast CDN delivery
Duration:     15–30 seconds (never over 60s for looping)
```

---

## 2. Aspect Ratio Decision Guide

### 16:9 Landscape — Use When:
- Desktop-first audience
- Cinematic quality reveal / trailer feel
- Showing gameplay, UI, or dashboard
- Will be cross-posted to YouTube
- Shows more horizontal content (panoramas, maps)

### 1:1 Square — Use When:
- **Best for Twitter/X timeline** — takes up maximum real estate in feed
- Works on both mobile and desktop without letterboxing
- Product showcase, logo animation, sigil/rune reveal
- Safe zone: keeps subject centered

### 9:16 Vertical — Use When:
- Mobile-only campaign (85%+ mobile Twitter users)
- Reels/TikTok cross-post strategy
- Character reveal, portrait shots
- Story-style narrative
- **Full-screen takeover on mobile** — most immersive

### Recommendation for Ika Tensei:
**Primary: 1:1 (1080×1080)** — maximum feed real estate, works everywhere  
**Secondary: 16:9 (1280×720)** — cinematic trailer feel for premium reveal  
**TikTok/Reels cut: 9:16 (1080×1920)** — separate crop if cross-posting

---

## 3. The First 3 Seconds: Hook Science

### Why 3 Seconds Is The Only Metric That Matters

- **65%** of people who watch the first 3 seconds will watch at least 10 seconds  
- **45%** will watch 30+ seconds if the hook lands  
- Platform algorithms track early drop-off; if viewers swipe away → content is deprioritized immediately  
- Human brains use **"thin-slicing"** — forming judgments about relevance and quality in milliseconds  

### The 3-Hook Rule: All Three Must Work Together

Every viral video opener has **three simultaneous hooks**:

#### 🎬 Visual Hook (Frame 0)
The very first frame must create immediate interest before a word is heard.
- Fast-paced shot, unusual angle, high contrast
- Motion in first 0.5 seconds (camera push, cut, zoom)
- Subject reacts to something off-screen
- One micro-preview flash of the "end result" then cut back

**For Ika**: Open on the summoning circle already spinning. Cut in mid-ritual. The Ika already mid-emergence. Don't start from still.

#### 📝 Text Hook (0–2 seconds)
Most Twitter/X autoplay is **muted by default**. Your text overlay IS the first impression.
- Tease pain point, question, or result
- SHORT — 5 words max for the first overlay
- Large, bold, readable at 375px wide (iPhone screen)
- Position in upper ⅓ of frame (safe from UI chrome)

Examples that work:
- `"this changes everything"`  
- `"you weren't supposed to see this"`  
- `"what if your wallet had a soul?"`  

#### 🎙️ Verbal/Audio Hook (0–1.5 seconds)
Even for muted viewers — the audio waveform displays. A dramatic sound hit signals energy.
- Dramatic sound effect or music swell on frame 1
- No fade-in silence — cut straight to audio action
- Voice line (if any) should be the most arresting line in the piece

---

## 4. The 7 Proven Hook Archetypes

### 1. 🔮 The Pattern Interrupter
**What**: Break the scrolling autopilot. Something unexpected that violates expectations.  
**Trigger**: Novelty & contrast — hijacks the auto-scroll reflex  
**Example (CT)**: Open on a wall of hexadecimal code that suddenly resolves into an anime character

### 2. ❓ The Bold Statement / Question  
**What**: Strong claim or provocative question  
**Trigger**: Curiosity gap — activates need to resolve incomplete information  
**Example (CT)**: `"I turned my DWallet into a summon. No one else has done this."`

### 3. 🔥 Shock / WTF / Humor
**What**: Surprise is the most powerful emotion for capture  
**Trigger**: Arousal response — high emotional energy makes content sticky and shareable  
**Example (CT)**: Abrupt pixelated explosion → cuts to serene seal with 1000x price tag

### 4. 👁️ Visual Intrigue / Motion
**What**: Hook via what you SHOW, not what you say  
**Trigger**: Visual salience — movement catches peripheral attention  
**Example (Ika)**: Spinning rune sigil in close-up before pulling back to reveal full seal

### 5. 🤝 The Relatable Hit
**What**: Call out the viewer directly — they feel personally seen  
**Trigger**: Self-identification — "this was made for me"  
**Example (CT)**: `"If you've ever lost a trade because you weren't watching..."`

### 6. 💡 Value-First / Promise
**What**: Get straight to the payoff — what they'll know/have/be after watching  
**Trigger**: Immediate reward expectation  
**Example (CT)**: `"Cross-chain wallet with AI co-pilot. 30 seconds."` — then deliver it

### 7. 📈 Social Proof / FOMO
**What**: Imply others are already paying attention  
**Trigger**: Fear of missing out + social influence  
**Example (CT)**: `"3,000 seals remain. Deploying to mainnet in [countdown]."`

---

## 5. Crypto Twitter (CT) Specific Patterns

### What Goes Viral in CT — The Playbook

**Core CT Viral Ingredients:**

1. **Mystery → Reveal structure** — Never explain upfront. Tease. Make them watch to understand
2. **Number specificity** — `"9,999 seals"`, `"$0.0007 to $0.07"`, `"day 3 of 30"`
3. **Countdowns & urgency** — Live mint countdowns, "X seals remaining"
4. **Price action as plot** — Show a chart going up, let it breathe, then cut to product
5. **Community flex** — Discord screenshots, waitlist numbers, follower counts
6. **Anti-explanation** — CT hates being talked to like a normie. No tutorials, only reveals
7. **Jargon as in-group signal** — `"trustless", "on-chain", "sovereign", "cross-chain"` in captions creates belonging for the right audience

### CT Video Formats That Perform:

| Format | CT Use Case |
|--------|-------------|
| **The Reveal** | Logo/character emerges from darkness — project announce |
| **The Milestone Flex** | "X holders in 48h" with rising counter animation |
| **The Lore Drop** | Animated lore sequence — no price talk, pure worldbuilding |
| **The Demo Loop** | 15s looping product demo — wallet interaction, chain txn |
| **The Meme Cut** | Meme format twist at the end — unexpected humor |
| **The Alpha Leak** | Deliberately lo-fi "accidentally leaked" clip — mystery |
| **The Influencer Cosign** | 5s clip of known CT figure using/reacting to product |
| **The Countdown** | Clock ticking toward mint/launch — 24h before event |

### CT Aesthetic Signals (What Reads as "Legit"):
- Pixel art, CRT effects, scanlines → retro/indie → authentic
- Dark backgrounds → crypto native aesthetic
- Fast cuts, no padding
- Minimal UI visible → product confidence
- Particle effects, chain visualizations → tech credibility
- Anime/manga influence → broad crypto-gaming crossover appeal

---

## 6. Text Placement for Mobile

### Safe Zones on Twitter Mobile (375px wide × 667px tall)

```
┌─────────────────────────────┐ ← 0px
│  [STATUS BAR: 44px]         │
│  ─────────────────────────  │
│                             │
│  ⬆ TITLE TEXT ZONE ⬆       │ ← 60–180px (safe for primary text)
│                             │
│                             │
│         [MAIN              │
│          ACTION            │ ← CENTER (most visual attention)
│          ZONE]             │
│                             │
│                             │
│  ⬇ SUBTITLE / CTA ⬇       │ ← 480–600px (safe for secondary)
│                             │
│  [PLAYER CHROME: ~67px]     │
└─────────────────────────────┘ ← 667px
```

**Rules:**
- Never place text in bottom 15% — obscured by video controls
- Never place text in top 8% — status bar overlap
- Keep text inside center 80% horizontally (40px margins each side)
- Font size minimum: **28px** (for 1080p video — scales to ~20px on phone)
- Max 5–6 words per line on screen at once
- High contrast: white text + dark stroke/shadow, or black text + light background

---

## 7. Looping Techniques (GIF-like Videos)

### How Twitter/X Looping Works

- Videos **under 60 seconds auto-loop** on Twitter/X
- This is the most powerful engagement mechanic — seconds watched = loop count × length
- Looping videos inflate engagement metrics for the algorithm

### Making a Perfect Loop

**Technique 1: Match-Cut Loop**
- End frame visually identical to first frame
- Works for: rotating objects, circular animations, sigil spins
- Ika application: summoning circle starts spinning → build up → seal emerges → circle resets

**Technique 2: The Echo Loop**
- End on a motion that implies more (camera zoom stopping mid-push)
- Viewer unconsciously expects continuation → rewatches
- Ika application: Ika's eye opening → cut to black → restart

**Technique 3: The Information Loop**
- Pack more data than 1 watch can absorb
- Viewer rewinds to catch detail they missed
- Ika application: Flash stats/lore at 2fps — viewers pause/replay to read

**Technical Tips:**
- Match audio at loop point (or fade to silence 0.5s before end)
- Avoid hard audio cut at loop — jarring cuts break the loop experience
- Use a **1-2 frame cross-dissolve** at loop point if visually needed
- Export at exactly the duration you want — trim to frame

---

## 8. Caption / Subtitle Best Practices

### Why Captions Are Non-Negotiable

- **80%+ of Twitter video is watched with sound OFF** (mobile default behavior)
- Captions increase completion rate and accessibility
- Twitter/X has built-in auto-captioning — but it's imperfect; burned-in is better

### Two Caption Approaches

**Option A: Burned-in Open Captions (Recommended for CT)**
- Captions baked into the video file
- Full control over style, position, timing
- Works on all platforms with zero friction
- Can be styled to match brand (pixel font = 🔥 for Ika Tensei)

**Option B: SRT File Upload (Twitter Media Studio)**
- Upload a `.srt` file alongside the video
- Twitter renders them in a standard white box style
- Less brand control but works if burned captions aren't feasible

### Caption Style Rules

```
Font:       Bold, high legibility (Bebas Neue, Impact, or pixel font for Ika)
Size:       Large — 6–8% of frame height minimum
Color:      White with black stroke (2–4px) OR yellow with black stroke
Background: Optional subtle dark box if contrast is low
Timing:     Max 2 lines per caption card
            Max 42 chars per line (for mobile readability)
            Each card: 1.5–3 seconds on screen
Position:   Upper 1/3 OR lower 1/3 (not center — blocks action)
```

### Caption as Design Element (CT Strategy)
For Ika Tensei specifically — captions aren't just accessibility, they're **worldbuilding**:
- Use in-universe terminology: `[SUMMONING PROTOCOL INITIATED]`
- Use pixel font to match aesthetic
- Treat captions like game UI dialogue boxes
- React to the visuals: caption appears as the visual moment happens

---

## 9. The Stop-Scroll Framework (Combined Checklist)

### Frame 0 (First Frame — Thumbnail):
- [ ] Is there motion or implied motion?
- [ ] Is there a face or character with expression?
- [ ] High contrast — will it read as thumbnail?
- [ ] Text overlay (max 5 words) — visible at 100×100px thumbnail size?

### Seconds 0–3 (The Hook):
- [ ] Does it start mid-action (not fade-in)?
- [ ] Is there a visual/audio impact on frame 1?
- [ ] Does it ask a question, make a bold claim, or show something unexpected?
- [ ] Is the text legible muted?

### Seconds 3–15 (The Pull):
- [ ] Is there a "promise" of what's coming?
- [ ] Does each 3-second segment advance the story?
- [ ] Is there visual variety (cut rate varies)?
- [ ] No dead air, no "Hi guys", no logo animation as filler?

### Seconds 15–30 (The Payoff + CTA):
- [ ] The biggest visual hit happens in this window
- [ ] CTA is on screen (website, mint link, "follow for updates")
- [ ] Last frame is loop-ready (matches or fades cleanly to black)
- [ ] Audio peak coincides with visual peak?

---

## 10. Posting Strategy for CT Virality

### Timing
- Peak CT activity: **7–9 AM EST** and **5–7 PM EST** (US market hours)
- Avoid posting during major market events (everyone watching charts)
- Tuesday–Thursday > Monday/Friday for crypto content engagement

### Thread Integration
- Post video as **reply 1** to a text tweet that creates context
- The text tweet gets engagement (likes/quotes); video gets views
- Or: Post video as main tweet → reply chain adds lore/detail

### Engagement Baiting (Ethical CT Style)
- End video with an open question on screen → people reply to answer
- Use a **poll tweet** in reply to the video post
- Tag collaborators/chains in the tweet text (not in the video itself)
- Include 1–2 relevant hashtags: `#GameFi #SuiNetwork #CrossChain`

### Amplification Triggers
- Post between Monday–Thursday
- First 30 minutes: the algorithm watches for early engagement velocity
- Have 5–10 allied accounts quote-tweet or reply immediately
- The "inner circle" pre-retweet strategy is standard CT launch practice

---

## 11. Application: Ika Tensei Trailer Spec Sheet

### Recommended Spec

```
Filename:       ika-tensei-trailer-v1.mp4
Resolution:     1080 × 1080 (1:1 square)
Frame rate:     30 fps
Codec:          H.264 High Profile
Audio:          AAC 128kbps, stereo
Duration:       20–25 seconds (loopable)
File size:      < 40 MB
Loop:           YES — last frame matches first (summoning circle)
```

### Hook Sequence (Suggested)

```
00:00–00:01  IMPACT FRAME: Spinning summoning circle, full brightness, sound hit
00:01–00:02  Text overlay: "what if your wallet had a soul?"
00:02–00:05  Quick cuts: runes, sigils, chain addresses resolving
00:05–00:10  The Ika emerges — pixel art sprite, dramatic
00:10–00:18  Cross-chain visualization — Sui ↔ ETH ↔ SOL ↔ SUI arcs
00:18–00:22  PAYOFF FRAME: "9,999 seals. One per wallet." + website URL
00:22–00:25  Fade to black → match-cut back to summoning circle (loop start)
```

### Caption Strategy
- Use pixel font, upper-third placement  
- Style as in-universe game dialogue: `[ SUMMONING PROTOCOL ACTIVE ]`  
- Auto-burn captions matching any voice lines  
- Website/CTA appears as burned caption in final 5 seconds  

---

## Sources

- Twitter/X Video Specs (verified 2026-01-09): postfa.st/sizes/x/video
- ScreenStory Twitter Video Guide 2024: screenstory.io
- Brandefy — Psychology of Viral Video Openers (2025): brandefy.com
- Aiken House — Viral Hook Strategies (2025): aikenhouse.com
- Opus Pro — YouTube Shorts Hook Formulas (Nov 2025): opus.pro
- CoinBand — Meme Coin Marketing Strategies: coinband.io
- Social Media Examiner — Stop-Scroll Video (Nov 2025): socialmediaexaminer.com
