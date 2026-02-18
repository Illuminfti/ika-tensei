# Ika Tensei Frontend UX/Interaction Audit

**Date:** 2026-02-18  
**Auditor:** Sora  
**Frontend URL:** https://frontend-phi-nine-12.vercel.app  
**Scope:** All 5 pages (/, /seal, /gallery, /guild, /profile)

---

## Executive Summary

The Ika Tensei frontend demonstrates strong visual design with JRPG-inspired aesthetics and smooth animations. However, several UX gaps exist that could frustrate users, particularly around **error handling**, **wallet state management**, and **onboarding clarity**. The seal flow is functional but has logic issues that could confuse users.

**Overall Assessment:** 6.5/10 — Strong visual execution with functional gaps

---

## 1. Seal Flow UX Analysis

### 1.1 Is the 5-step flow intuitive?

**Steps:** Connect Wallet → Select Chain → Deposit → Summoning → Complete

| Aspect | Finding | Priority |
|--------|---------|----------|
| Step indicator | Clear visual progress bar at top with labels | ✅ Good |
| Dialogue boxes | Ika's explanations help users understand each step | ✅ Good |
| Back navigation | Available on steps 2 & 3 | ⚠️ Partial |

**Confusion Points Identified:**

1. **Redundant onConfirm Logic (P0)**
   - In `SelectChainStep`, the `onConfirm` button calls `selectChain()` again even though the chain was already selected via `onSelect`
   - This creates a confusing code path where clicking "Get Deposit Address" re-triggers the same function

2. **Unclear "I've Sent NFT" Action (P1)**
   - The deposit step shows an address but doesn't verify the user actually sent anything
   - User just clicks "I've Sent the NFT" with no on-chain verification
   - **Risk:** Users may think the process is automated when it requires manual action

3. **No Gas/Fee Disclosure (P1)**
   - No information about sealing costs anywhere in the flow
   - Users may be surprised by transaction fees

4. **Step Labels Too Small (P2)**
   - Step indicator labels use 7px font — unreadable on most displays
   - Only visible on desktop (`hidden md:block`)

### 1.2 Recommendations

**Mockup: Improved Seal Flow**

```
┌─────────────────────────────────────────────────┐
│  ✦ THE SOUL SEAL RITUAL ✦                      │
│  NFT Reincarnation · Powered by IKA dWallet    │
├─────────────────────────────────────────────────┤
│  [1]Connect → [2]Chain → [3]Deposit → [4]Ritual│
│  (complete) (active)                            │
├─────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────┐    │
│  │ 💬 Ika: "Select which chain holds       │    │
│  │    your NFT. You can seal from          │    │
│  │    Ethereum, Polygon, Sui, and more."   │    │
│  └─────────────────────────────────────────┘    │
│                                                 │
│  Select Source Chain:                           │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐          │
│  │ETH │ │POL │ │ARB │ │BASE│ │SUI │          │
│  │ ✅ │ │    │ │    │ │    │ │    │          │
│  └────┘ └────┘ └────┘ └────┘ └────┘          │
│                                                 │
│  💰 Estimated fees: ~0.005 SOL + gas           │
│                                                 │
│  [← Back]           [Get Deposit Address →]    │
└─────────────────────────────────────────────────┘
```

---

## 2. Error States

### 2.1 Current Implementation

```tsx
// From SelectChainStep
{error && (
  <motion.p className="mt-3 font-pixel text-[9px] text-demon-red text-center">
    ⚠ {error}
  </motion.p>
)}
```

### 2.2 Issues

| Issue | Severity | Description |
|-------|----------|-------------|
| Tiny font | P0 | 9px pixel font is virtually unreadable |
| No error icons | P1 | Only ⚠️ emoji, no visual distinction |
| No error boundaries | P0 | Entire app could crash from uncaught errors |
| Silent failures | P1 | Network errors in polling are swallowed silently |
| No retry UI | P1 | Users stuck with no way to retry failed actions |

### 2.3 Recommendations

- Increase error text to minimum 12px
- Add colored error boxes with icons
- Implement React error boundaries
- Add "Try Again" buttons on failures

**Mockup: Improved Error Display**

```
┌─────────────────────────────────────────────────┐
│  ┌─────────────────────────────────────────┐    │
│  │ ❌ CONNECTION FAILED                    │    │
│  │                                          │    │
│  │ Could not connect to the ritual servers.│    │
│  │ Please check your connection and try    │    │
│  │ again.                                  │    │
│  │                                          │    │
│  │ [↻ Retry the Ritual]  [Contact Support]│    │
│  └─────────────────────────────────────────┘    │
└─────────────────────────────────────────────────┘
```

---

## 3. Loading States

### 3.1 Current Implementation

- Only shows "Preparing..." text during chain selection
- No skeleton loaders
- No loading indicators on initial page load

### 3.2 Assessment

| Loading Scenario | Current State | Recommendation |
|-----------------|---------------|----------------|
| Initial page load | ❌ None | Add skeleton/spinner |
| Chain selection API | ⚠️ Text only | Add spinner + progress |
| Wallet connect | ✅ Handled by Dynamic | — |
| Polling for status | ✅ Silent (intentional) | Consider subtle indicator |
| Tab switches (Guild) | ❌ None | Add transitions |

### 3.3 Recommendations

- Add skeleton loaders for all panels
- Show estimated wait times where applicable

---

## 4. Navigation

### 4.1 Current Implementation

- Fixed top navbar with links: Seal, Gallery, Guild, Profile
- Mobile hamburger menu with slide-down panel
- Back buttons within seal flow steps
- No browser history handling

### 4.2 Issues

| Issue | Priority | Description |
|-------|----------|-------------|
| Browser back breaks flow | P0 | Pressing back doesn't navigate correctly in seal flow |
| No deep linking clarity | P2 | Can't share link to specific guild tab |
| Back from deposit resets chain | P1 | User loses their chain selection when going back |
| Mobile nav overlays content | P1 | Nav covers part of page when open |

### 4.3 Recommendations

- Implement `useEffect` to handle browser history events
- Persist chain selection when navigating back
- Add URL params for guild tabs (`?tab=quests`)

---

## 5. Wallet Connection UX

### 5.1 Current Implementation

**Demo Mode (no DYNAMIC_ENV_ID):**
```tsx
// Shows DevModeConnect
<h2 className="font-pixel text-lg text-ritual-gold mb-2">
  Dev Mode
</h2>
<p className="font-silk text-sm text-faded-spirit mb-1">
  No DYNAMIC_ENV_ID set — using mock wallet
</p>
<button>🛠 Mock Connect (Dev)</button>
```

**Real Mode (with DYNAMIC_ENV_ID):**
- Uses Dynamic.xyz SDK
- Shows IkaSprite animation
- Button: "⚡ Connect Wallet"

### 5.2 Issues

| Issue | Priority | Description |
|-------|----------|-------------|
| Demo mode not visually distinct | P1 | Looks similar to production, confusing for users |
| No wallet disconnect UI | P1 | Connected state shows address but no disconnect |
| Silent fallback to dev mode | P0 | If env var missing, silently shows dev mode |
| No connection status persistence | P2 | Refresh loses connection state display |
| Wallet address truncation | P2 | Only shows 8+6 chars, hard to verify |

### 5.3 Recommendations

- Make demo mode visually prominent (yellow warning banner)
- Add disconnect button in navbar
- Add clear "Demo Mode" badge when in dev mode

**Mockup: Wallet Connection States**

```
┌─────────────────────────────────────────────────┐
│ [Ika Icon] イカ転生          [Phantom] [Disconnect]│
│                              7x9Y2...abc123    │
└─────────────────────────────────────────────────┘

// When no wallet connected in demo mode:
┌─────────────────────────────────────────────────┐
│ ⚠️ DEMO MODE - No wallet required               │
│ [Connect Real Wallet]  [Continue in Demo]      │
└─────────────────────────────────────────────────┘
```

---

## 6. Guild UX Analysis

### 6.1 Tab Structure

| Tab | Content | Badge |
|-----|---------|-------|
| Hall | Welcome dialogue, quick actions, activity feed | — |
| Quests | Quest board with difficulty badges | Open: 5 |
| Vault | Treasury assets and revenue breakdown | — |
| Council | DAO proposals with voting | Active: 2 |
| Rankings | Leaderboard with podium | — |

### 6.2 Assessment

**Strengths:**
- Clear tab indicators with counts ✓
- Visual difficulty badges (S/A/B/C/D) ✓
- Voting UI with For/Against/Abstain ✓

**Issues:**

| Issue | Priority | Description |
|-------|----------|-------------|
| Hall tab is mostly marketing | P1 | Real content buried in other tabs |
| No quest search/filter | P2 | Can't find quests by type |
| Voting is purely client-side | P1 | No actual blockchain integration |
| Activity feed is mock data | P1 | Not connected to real events |
| "Your position" hardcoded | P1 | Always shows "Rank #42, Today" |

### 6.3 Recommendations

- Move quest filtering to top of Quests tab
- Add "My Quests" filter button
- Connect voting to real contract (or clearly state it's demo)
- Add real-time treasury updates

---

## 7. Accessibility

### 7.1 Current State

| Aspect | Status | Notes |
|--------|--------|-------|
| Keyboard navigation | ❌ Not tested | Likely broken |
| Screen reader support | ❌ No ARIA | Missing labels |
| Focus indicators | ❌ None | Can't see focus state |
| Color contrast | ⚠️ Partial | Gold on purple fails WCAG AA |
| Font sizes | ❌ Too small | 7-11px range |

### 7.2 Critical Issues (P0)

1. **No ARIA labels** — Interactive elements have no accessible names
2. **Pixel fonts unreadable** — 7-9px text impossible to read
3. **No focus management** — Tab order unclear

### 7.3 Recommendations

- Add `aria-label` to all buttons
- Increase minimum font size to 12px
- Add visible focus rings (framer-motion `whileFocus`)
- Test with screen reader (VoiceOver/NVDA)

**Mockup: Accessible Button**

```tsx
<motion.button
  aria-label="Connect Solana wallet"
  aria-describedby="wallet-help"
  whileFocus={{ boxShadow: "0 0 0 3px #ffd700" }}
  className="..."
>
  ⚡ Connect Wallet
</motion.button>
<div id="wallet-help" className="sr-only">
  Opens Phantom, Backpack, or Solflare to connect
</div>
```

---

## 8. Touch Targets

### 8.1 Current Sizes

| Element | Size | Recommendation |
|---------|------|----------------|
| nes-btn | min 32px height | ✅ OK |
| Chain cards | 44x44px icon + text | ⚠️ Tight on mobile |
| Tab buttons | ~48px height | ✅ OK |
| Guild action buttons | Variable | ⚠️ Check each |

### 8.2 Issues

- Chain selector cards: 44px may be too small for fat fingers
- Gap between chain cards: 8px (2 on grid) — risk of mis-taps

### 8.3 Recommendations

- Increase chain cards to minimum 56px
- Add 12px gap between cards

---

## 9. Empty States

### 9.1 Assessment

**No empty states implemented** — All pages show mock data.

| Page | Current | Should Show |
|------|---------|-------------|
| Gallery | Mock images | "No NFTs sealed yet" |
| Profile | Mock data | "Connect wallet to view profile" |
| Guild Quests | All mocked | "No quests available" |
| Council | All mocked | "No active proposals" |

### 9.2 Recommendations

Add empty state components:

**Mockup: Empty Gallery**

```
┌─────────────────────────────────────────────────┐
│           🖼️ YOUR GALLERY                        │
├─────────────────────────────────────────────────┤
│                                                 │
│           ┌───────────────────┐                 │
│           │                   │                 │
│           │   No Reborn NFTs   │                 │
│           │                   │                 │
│           │   Seal your first │                 │
│           │   NFT to see it   │                 │
│           │   here!           │                 │
│           │                   │                 │
│           └───────────────────┘                 │
│                                                 │
│         [← Seal an NFT Now]                     │
│                                                 │
└─────────────────────────────────────────────────┘
```

---

## 10. Micro-interactions

### 10.1 Current Implementation (✅ Good)

| Interaction | Implementation |
|-------------|----------------|
| Hover states | `whileHover={{ scale: 1.05 }}` |
| Click feedback | `whileTap={{ scale: 0.95 }}` |
| Step transitions | `AnimatePresence` with slide |
| Summoning circle | Multiple animated phases |
| Button glow | CSS keyframe animations |
| Sprite expressions | Varies by context |

### 10.2 Missing

- No success haptic feedback (mobile)
- No sound effects toggle
- No tooltips on hover

---

## 11. Onboarding

### 11.1 Current Onboarding

1. **Landing page hero** — Clear tagline: "Seal your NFTs from any chain. Reborn them on Solana."
2. **"How It Works"** — 3-step visual flow (Seal → Reborn → Join Guild)
3. **No walkthrough** — No tooltips or guided tour

### 11.2 Assessment

| Metric | Finding |
|--------|---------|
| 5-second comprehension | ⚠️ Partial — Japanese title confusing |
| Clear value proposition | ✅ Yes, tagline is clear |
| First action obvious | ⚠️ "Begin the Ritual" button exists but buried |
| No getting stuck guidance | ❌ Missing |

### 11.3 Recommendations

- Add "New? Start Here" callout on landing
- Add first-time user tooltip tour
- Add quick start guide in /seal before wallet connect

**Mockup: Onboarding Tooltip**

```
┌─────────────────────────────────────────────────┐
│                                                 │
│  Welcome to Ika Tensei! 👋                      │
│  ┌─────────────────────────────────────────┐   │
│  │ This protocol seals NFTs from any chain │   │
│  │ and reborn them on Solana.              │   │
│  │                                         │   │
│  │ Ready? [Start Sealing →] [Skip]        │   │
│  └─────────────────────────────────────────┘   │
│                              [×]                │
│                                                 │
└─────────────────────────────────────────────────┘
```

---

## 12. Priority Summary

### P0 — Critical (Fix Immediately)

| # | Issue | Location |
|---|-------|----------|
| 1 | Browser back breaks seal flow | seal/page.tsx |
| 2 | Demo mode silent fallback | Providers.tsx |
| 3 | No error boundaries | App-wide |
| 4 | Unreadable error text (9px) | Multiple |
| 5 | Redundant selectChain call | SelectChainStep |

### P1 — High Priority

| # | Issue | Location |
|---|-------|----------|
| 1 | No wallet disconnect UI | NavigationBar |
| 2 | No empty states | Gallery, Profile |
| 3 | Unclear "I've sent" verification | DepositStep |
| 4 | No fee disclosure | Seal flow |
| 5 | Voting not connected to chain | Guild council |
| 6 | Accessibility: ARIA labels missing | App-wide |
| 7 | Back resets chain selection | seal/goBack |

### P2 — Medium Priority

| # | Issue | Location |
|---|-------|----------|
| 1 | Step labels too small | StepIndicator |
| 2 | No loading skeletons | All pages |
| 3 | Quests not filterable | guild/page.tsx |
| 4 | No sound toggle | Global |
| 5 | Guild tab not in URL | guild/page.tsx |

---

## 13. Quick Wins (Implement First)

1. **Add error boundaries** — Wrap app in error boundary component
2. **Increase error text size** — Change 9px → 14px minimum
3. **Add "Demo Mode" banner** — Yellow warning when no env var
4. **Add disconnect button** — In navbar when wallet connected
5. **Add browser history handling** — Use `popstate` event in seal flow
6. **Add empty states** — Gallery, Profile minimum
7. **Add fee estimate** — Show before chain selection

---

## 14. Visual Audit Notes

### What Works Well
- ✅ JRPG aesthetic is cohesive and memorable
- ✅ Summoning circle animation is impressive
- ✅ Pixel fonts add character (but too small)
- ✅ Color palette is consistent (void purple, ritual gold, blood pink)
- ✅ Framer Motion transitions are smooth

### What Needs Work
- ⚠️ Inconsistent button styling (nes-btn vs custom)
- ⚠️ Some panels have no borders/dividers
- ⚠️ Mobile layout sometimes breaks (scroll issues)
- ❌ Some images use hardcoded URLs (placehold.co)

---

## Appendix: File References

| File | Purpose |
|------|---------|
| `app/seal/page.tsx` | Main seal flow UI |
| `hooks/useSealFlow.ts` | Flow state management |
| `components/ui/ChainSelector.tsx` | Chain selection grid |
| `app/guild/page.tsx` | Guild/DAO page |
| `components/ui/NavigationBar.tsx` | Main navigation |
| `components/wallet/Providers.tsx` | Wallet provider setup |
| `components/wallet/SolanaConnect.tsx` | Wallet connection UI |
| `lib/constants.ts` | Chain definitions |

---

*End of Audit*
