# Ika Tensei - Frontend UX Flow Document

> **Version:** 1.0  
> **Date:** 2026-02-18  
> **Purpose:** Complete user flow and interaction design for NFT reincarnation protocol  
> **Core Principle:** 3 clicks max for main flow; complex 10-step backend hidden from user

---

## Executive Summary

This document defines the complete user experience for Ika Tensei (イカ転生), an NFT reincarnation protocol that enables users to seal their NFTs on source chains (ETH/SUI/SOL) and reborn exact copies on Solana, automatically joining the Adventurer's Guild DAO.

**Key Design Principles:**
- **3 clicks max** for the complete reincarnation flow
- **No Sui wallet required** for ETH users (gas abstracted)
- **Real-time visual feedback** at every step
- **Delightful animations** that make waiting feel magical
- **Mobile-first** responsive design
- **Dark mode default** with neon/sacred aesthetic

---

## Research Findings

### Multi-Step Transaction UI Patterns (Best Practices)

1. **Progress Indicators** - Always show clear step progress (e.g., "Step 2 of 5: Sealing your NFT")
2. **Transaction Explorer Links** - Provide direct links to block explorers for transparency (Uniswap pattern)
3. **Estimated Time** - Show realistic time estimates to manage expectations
4. **Visual Confirmation** - Success/error states with clear next actions
5. **Error Recovery** - Detailed error messages explaining what went wrong and how to fix

### "Waiting for Blockchain" UX Patterns

1. **Animated Loading States** - Replace static spinners with themed animations (portal, sealing, glowing)
2. **Real-time Status Updates** - Polling/websocket updates every 2-3 seconds
3. **Progress Storytelling** - Each step has a visual narrative, not just "processing"
4. **Cancellation Options** - Allow cancellation during pending states where possible
5. **Notification Prefs** - Offer in-app + email notifications for completion

### NFT Reveal/Transformation Animations

1. **Three.js Portal Effects** - Animated portal/gateway between chains
2. **Particle Systems** - Sparkles, glow effects during transformation
3. **Before/After Reveals** - Side-by-side or morphing transitions
4. **Sound Design** - Optional ambient sounds for immersion (mute toggle required)
5. **Micro-interactions** - Hover effects, click feedback, loading states

### Dark Mode NFT Site Typography & Design

1. **High Contrast Text** - White/light text on dark backgrounds (#0a0a0f or similar)
2. **Neon Accents** - Cyan, magenta, purple for CTAs and highlights
3. **Geometric/Sacred Fonts** - Modern sans-serif (Inter, Space Grotesk) for body; display fonts for headings
4. **Glassmorphism** - Semi-transparent cards with blur effects
5. **Gradient Overlays** - Subtle gradients on hero sections

---

## User Personas & Flows

### Persona 1: NFT Collector (Non-technical)
- **Goal:** Get valuable ETH/SUI NFTs to Solana without understanding blockchain
- **Pain Points:** Technical jargon, multiple wallet connections, gas fees
- **Flow:** Landing → Connect → Select NFT → One-click Seal → Wait (no action needed) → View Reborn

### Persona 2: Degen (Power User)
- **Goal:** Fast, skip tutorials, get in and out
- **Pain Points:** Hand-holding, slow animations, too many confirmations
- **Flow:** Direct "Seal" CTA → Quick wallet connect → Select from recent → Fast-track seal → Done

### Persona 3: DAO Enthusiast
- **Goal:** Acquire governance power through NFT rebirth
- **Pain Points:** Unclear voting power, hidden governance features
- **Flow:** Landing → Guild tab → Connect → View proposals → Reborn NFTs auto-grant voting

---

## Page 1: Landing Page (Hero)

### Layout Structure

```
┌─────────────────────────────────────────────────────────────┐
│  [Logo: Ika Tensei]              [Connect] [Guild] [?]     │  ← Header (fixed)
├─────────────────────────────────────────────────────────────┤
│                                                             │
│                    ┌─────────────────┐                      │
│                    │   PORTAL 3D     │                      │  ← Three.js Hero
│                    │   ANIMATION     │                      │     (portal between
│                    └─────────────────┘                      │      chains)
│                                                             │
│              "Bring Your NFTs to Solana"                    │  ← Headline
│                                                             │
│         The sacred ritual of rebirth. Your NFTs             │  ← Subheadline
│         transcend chains and join the Adventurer's          │
│                    Guild (DAO).                             │
│                                                             │
│            ╔═══════════════════════════╗                   │
│            ║   [Start Reincarnation]   ║                   │  ← Primary CTA
│            ╚═══════════════════════════╝                   │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  🌊 12,847 Sealed    ✨ 10,234 Reborn    ⛓ ETH | SUI | SOL│  ← Stats Bar
├─────────────────────────────────────────────────────────────┤
│                                                             │
│       [1. Seal]        [2. Reborn]        [3. Join Guild]  │
│         ↓                  ↓                   ↓            │
│    Deposit your      NFT transcends    Your reborn NFT      │
│    NFT to the        to Solana as      grants you entry    │
│    sacred vault      an exact copy     to the Guild         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Interaction Flows

**Primary CTA Click (Default User):**
1. Redirect to `/select` (NFT Selection page)
2. If no wallet connected → trigger wallet connection modal first

**Primary CTA Click (Returning User with Pending):**
1. Show "You have X NFTs being reincarnated" toast
2. Redirect to `/gallery` (Reborn Gallery)

**Connect Button:**
1. Opens wallet connection modal (WalletConnect, MetaMask, Phantom, Backpack)
2. Remembers last connected chain

**Guild Button:**
1. Redirect to `/guild` (Adventurer's Guild)

### Animation Triggers

- **Portal Animation:** Continuous loop, Three.js particles flowing between chain icons
- **CTA Hover:** Subtle glow pulse (box-shadow animation)
- **Stats Counter:** Animated number count-up on page load
- **Steps Icons:** Sequential fade-in (stagger 200ms each)

### Edge Cases

| Scenario | Handling |
|----------|----------|
| No Web3 wallet installed | Show "Install Wallet" modal with recommended options |
| Mobile users | CTA scrolls to wallet selection, show QR for WalletConnect |
| Network down | Show cached stats, disable CTA with "Service temporarily unavailable" |
| Slow connection | Skeleton loaders for stats, portal animation loads first |

### Responsive Breakpoints

- **Desktop (>1024px):** Full 3D portal, horizontal stats bar
- **Tablet (768-1024px):** Reduced particle count, stacked stats
- **Mobile (<768px):** Static portal image (lazy load 3D on tap), vertical stacked layout

---

## Page 2: NFT Selection

### Layout Structure

```
┌─────────────────────────────────────────────────────────────┐
│  [← Back]  Select Your NFT to Reincarnate       [?]       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Connect your wallet to view your NFTs                     │
│                                                             │
│         ┌─────────────────────────────────┐                 │
│         │     [MetaMask] [WalletConnect]  │               │  ← Wallet Options
│         │         [Phantom] [Backpack]     │               │
│         │                                   │               │
│         │    Or continue without connecting │               │  ← Skip option
│         └─────────────────────────────────┘                 │
│                                                             │
└─────────────────────────────────────────────────────────────┘

[AFTER WALLET CONNECTED]

┌─────────────────────────────────────────────────────────────┐
│  [← Back]  Select Your NFT to Reincarnate       [Profile] │
├─────────────────────────────────────────────────────────────┤
│  Wallet: 0x1234...abc (ETH)  ●  [Disconnect]               │
├─────────────────────────────────────────────────────────────┤
│  🔍 Search NFTs...                    [All] [PFP] [Art]   │  ← Filters
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐           │
│  │ NFT 1  │  │ NFT 2  │  │ NFT 3  │  │ NFT 4  │           │
│  │        │  │        │  │        │  │        │           │  ← NFT Grid
│  │ [ETH]  │  │ [ETH]  │  │ [SUI]  │  │ [ETH]  │           │     (lazy load)
│  └────────┘  └────────┘  └────────┘  └────────┘           │
│                                                             │
│  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐           │
│  │ NFT 5  │  │ NFT 6  │  │ NFT 7  │  │ NFT 8  │           │
│  │        │  │        │  │        │  │        │           │
│  │ [SUI]  │  │ [ETH]  │  │ [SOL]  │  │ [ETH]  │           │
│  └────────┘  └────────┘  └────────┘  └────────┘           │
│                                                             │
└─────────────────────────────────────────────────────────────┘

[AFTER NFT CLICKED - Modal]

┌─────────────────────────────────────────────────────────────┐
│  ✕                                                          │
│                                                             │
│         ┌─────────────────────────────┐                    │
│         │                             │                    │
│         │         [NFT IMAGE]         │                    │  ← Large preview
│         │                             │                    │
│         └─────────────────────────────┘                    │
│                                                             │
│         #42 - Cosmic Squid Collection                      │
│         Owned by you • 1 of 1                              │
│                                                             │
│    ┌─────────────────────────────────────────────┐         │
│    │  ⚠️ This NFT will be SEALED forever         │         │
│    │  and REBORN on Solana                       │         │  ← Warning
│    │  This action cannot be undone               │         │
│    └─────────────────────────────────────────────┘         │
│                                                             │
│    [Cancel]                           [Seal & Reborn]      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Interaction Flows

**Wallet Connection Flow:**
1. User clicks wallet option
2. Wallet popup/request appears
3. On success → fetch NFTs from connected chain
4. On failure → show error toast, allow retry

**NFT Selection Flow:**
1. User clicks NFT card
2. Modal opens with full preview + metadata
3. User reviews warning message
4. User clicks "Seal & Reborn"
5. Redirect to `/seal` with NFT data in state

**Skip Wallet Option (for quick demo):**
1. User clicks "Continue without connecting"
2. Allow manual NFT address input
3. Proceed with same flow but without pre-loaded NFTs

### Animation Triggers

- **NFT Cards:** Staggered fade-in (50ms delay between cards)
- **Card Hover:** Scale 1.02, subtle glow border
- **Card Click:** Ripple effect, then modal slides up
- **Modal Open:** Backdrop fade + modal scale from 0.95 to 1
- **Warning Box:** Subtle pulse animation (draws attention without alarm)

### Error States

| Scenario | Handling |
|----------|----------|
| Wallet connection rejected | Toast: "Connection rejected. Please try again." |
| No NFTs found in wallet | Empty state: "No NFTs found. Connect a wallet with NFTs or enter address manually." |
| NFT already sealed/reborn | Disable card, show "Already Reborn" badge, tooltip with details |
| Network mismatch | Auto-switch prompt: "Switch to [Network] to view your NFTs?" |
| API timeout | Retry button with "Unable to load NFTs. Tap to retry." |

### Edge Cases

- **Large NFT collections (100+):** Infinite scroll with virtualization
- **Unsupported NFT standard:** Show "Not compatible" tooltip, disable selection
- **Gas estimation fails:** Show "Unable to estimate fees" but allow proceeding
- **Cross-chain:** User has NFTs on multiple chains → show tabs or unified grid with chain badges

---

## Page 3: Sealing Flow (The Magic)

### Layout Structure

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│                    ┌─────────────────┐                    │
│                    │   FULL SCREEN   │                    │
│                    │   THREE.JS      │                    │  ← Immersive
│                    │   PORTAL        │                    │     Animation
│                    │   ANIMATION     │                    │
│                    │                 │                    │
│                    │   [NFT floats   │                    │
│                    │    through      │                    │
│                    │    portal]      │                    │
│                    └─────────────────┘                    │
│                                                             │
│         ┌─────────────────────────────────────┐           │
│         │  Your NFT is being reincarnated...  │           │  ← Status Text
│         └─────────────────────────────────────┘           │
│                                                             │
│         Step 2 of 5: ✨ Sealing your NFT                   │
│         ───────────────────────────────────────            │
│         ████████████░░░░░░░░░░░░░░░░░░  25%               │  ← Progress Bar
│                                                             │
│         This takes ~2-3 minutes. You can close             │
│         this page and we'll notify you when done.          │
│                                                             │
│                    [View on Explorer]                       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Step-by-Step Animation Sequence

| Step | Visual Animation | Status Text | Duration |
|------|-------------------|-------------|----------|
| **1. Depositing** | NFT glides toward portal, ethereal particles gather | "Depositing your NFT to the sacred vault..." | ~30s |
| **2. Sealing** | Portal closes with glowing seal, chain links appear | "Sealing your NFT in the blockchain..." | ~45s |
| **3. Signing** | DWallet ceremony visualized (2PC-MPC), key shards combine | "Generating your reborn identity..." | ~60s |
| **4. Minting** | New NFT emerges from portal on Solana side, sparkle burst | "Minting your reborn NFT on Solana..." | ~45s |
| **5. Complete** | Portal opens, reborn NFT revealed, confetti/particle explosion | "Welcome to your new life!" | Instant |

### Interaction Flows

**Initial Load:**
1. Initialize Three.js scene
2. Begin Step 1 animation automatically
3. Start polling for transaction confirmations
4. Update progress as each step completes

**User Leaves Page (Background):**
1. Prompt: "Reincarnation in progress. Leave and we'll notify you."
2. Option: "Stay on page" or "Leave and notify"
3. If leave → store in progress, send push notification on complete

**User Returns (After Time):**
1. Check status via API
2. If complete → redirect to `/gallery` with success state
3. If failed → show error modal with retry option

### Animation Triggers

- **Page Load:** Fade in scene, portal begins swirling
- **Step Transition:** Screen flash (subtle white), portal changes color
- **Step Complete:** Particle burst, progress bar fills with glow
- **Final Step:** Full explosion of particles, NFT appears in glory shot
- **Hover on "View Explorer":** Tooltip shows truncated tx hash

### Real-time Status Updates

- **Polling Interval:** 3 seconds (adjustable based on chain)
- **WebSocket (preferred):** For faster updates when available
- **Status Events:**
  ```
  - deposit_initiated: "Transaction submitted, awaiting confirmations..."
  - deposit_confirmed: "NFT deposited successfully!"
  - seal_initiated: "Sealing in progress..."
  - seal_confirmed: "NFT sealed forever!"
  - dwallet_generated: "Reborn identity created!"
  - mint_initiated: "Minting on Solana..."
  - mint_confirmed: "🎉 Your NFT has been reborn!"
  ```

### Error States

| Scenario | Handling |
|----------|----------|
| Deposit transaction fails | Show error, offer "Retry" or "Use Different NFT" |
| Seal fails (rare) | Automatic retry (3x), then show error with support link |
| DWallet generation fails | Show technical error, "Contact Support" with tx reference |
| Mint fails | Automatic retry, worst case → refund deposit (show process) |
| User closes browser mid-process | Persist state, allow resume on return |
| Gas runs out | Pause, notify user, offer "Add Funds" or "Cancel" |

### Edge Cases

- **Slow network:** Show "Taking longer than expected" after 2x estimated time
- **Multiple NFTs:** Queue system, process one at a time, show position in queue
- **Mobile backgrounded:** Use Service Worker for push notifications
- **Tab hidden:** Reduce animation frame rate, continue processing

---

## Page 4: Reborn Gallery

### Layout Structure

```
┌─────────────────────────────────────────────────────────────┐
│  [← Back]  Your Reborn NFTs              [Profile] [Share]│
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  🎉 Reincarnation Complete!                         │   │
│  │  Your NFT has been reborn on Solana                 │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  Filter: [All] [Recent] [Collections]          [Search...] │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐   │
│  │  BEFORE      │   │              │   │              │   │
│  │  ┌────────┐  │   │              │   │              │   │
│  │  │  NFT   │  │   │              │   │              │   │
│  │  └────────┘  │   │              │   │              │   │
│  │  ETH: 0x123  │   │              │   │              │   │
│  └──────────────┘   │   REBORN     │   │   REBORN     │   │
│                      │   ┌────────┐│   │   ┌────────┐│   │
│         ↔           │   │  NFT   ││   │   │  NFT   ││   │
│                      │   └────────┘│   │   └────────┘│   │
│                      │  SOL: FK... │   │  SOL: FK... │   │
│                      └──────────────┘   └──────────────┘   │
│                                                             │
│                    [View on Solscan] [Share on Twitter]    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Interaction Flows

**View NFT Details:**
1. Click on reborn NFT card
2. Modal opens with full metadata
3. Shows: original chain, original contract, reborn mint address, traits, transaction history

**Share Flow:**
1. Click "Share on Twitter"
2. Opens Twitter intent with pre-filled text:
   ```
   🎉 My NFT has been reborn on Solana via @ika_tensei!
   
   Original: [ETH] 0x1234...abc
   Reborn:   [SOL] FKabc...xyz
   
   Join the Adventurer's Guild → https://ika-tensei.io/guild
   ```
3. User can edit or post directly

**Before/After Comparison:**
1. Hover on card reveals "Before" overlay
2. Click opens split-view comparison modal
3. Slider to compare original vs reborn

### Animation Triggers

- **New NFT Appears:** Fade in + scale from 0.8, particle burst
- **Card Hover:** Lift effect (translateY -4px), glow border
- **Share Button:** Click triggers paper plane animation
- **Empty State:** Subtle floating animation on placeholder

### Responsive Layout

- **Desktop:** 4-column grid, full before/after cards
- **Tablet:** 3-column grid
- **Mobile:** 2-column grid, tap for modal details

---

## Page 5: Adventurer's Guild (DAO)

### Layout Structure

```
┌─────────────────────────────────────────────────────────────┐
│  ⚔️  Adventurer's Guild                                    │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Your Voting Power                                  │   │
│  │  ┌─────────┐                                        │   │
│  │  │   12    │  votes                                │   │  ← 1 NFT = 1 vote
│  │  └─────────┘                                        │   │
│  │  (from 12 reborn NFTs)                              │   │
│  └─────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────┤
│  [Proposals] [Treasury] [Members]              [Propose]  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ACTIVE PROPOSALS                                          │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  #42: Allocate 50 ETH to Marketing Campaign         │   │
│  │  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━░░░░░  68%    │   │
│  │  Ends in 2 days • 12/50 votes cast                  │   │
│  │                                                     │   │
│  │  [Vote For]  [Vote Against]  [Abstain]            │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  #41: Add New Collection to Guild                   │   │
│  │  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  92%    │   │
│  │  Passed • 46/50 votes cast                          │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### DAO Features (Realms Integration)

**Voting Power Calculation:**
- 1 reborn NFT = 1 vote
- Votes are non-transferable
- Voting power = number of reborn NFTs in user's wallet

**Proposal Types:**
- Treasury allocations
- New collection whitelist
- Protocol parameter changes
- Partnership proposals

**Voting Flow:**
1. User clicks "Vote For/Against/Abstain"
2. Wallet signature request (no transaction, just sign message)
3. Vote recorded on-chain
4. UI updates immediately (optimistic update)

### Layout Sections

**Treasury Tab:**
- Total holdings (SOL, USDC, other tokens)
- Recent transactions
- Allocation breakdown (pie chart)

**Members Tab:**
- Leaderboard by voting power
- Total members count
- Recent activity

---

## Page 6: Profile

### Layout Structure

```
┌─────────────────────────────────────────────────────────────┐
│  👤  Your Profile                           [Settings]     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  [Avatar]  Display Name                             │   │
│  │           member since Feb 2026                     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  Connected Wallets                                         │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  🟢 ETH: 0x1234...abc  [Disconnect]                 │   │
│  │  🟢 SOL: FKabc...xyz   [Disconnect]                 │   │
│  │  [+ Add Wallet]                                     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  Your Reincarnations                                       │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Pending (2)                                        │   │
│  │  • Cosmic Squid #42 → Reborning... [View]          │   │
│  │  • Bored Ape #888 → Waiting for deposit [View]     │   │
│  │                                                    │   │
│  │  Completed (10)                                     │   │
│  │  • Punk #1234 → FKabc... [View on Solscan]         │   │
│  │  • CloneX #567 → FKdef... [View on Solscan]        │   │
│  │  ...                                               │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  Transaction History                                        │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  [Filter: All | Seals | Votes]                      │   │
│  │                                                    │   │
│  │  Feb 15, 2026 - Sealed Cosmic Squid #42             │   │
│  │  Feb 14, 2026 - Voted on Proposal #41             │   │
│  │  Feb 13, 2026 - Reborn Bored Ape #888              │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Features

**Wallet Management:**
- Connect multiple wallets (ETH + SOL)
- View all NFTs across wallets
- Unified transaction history

**Pending Seals:**
- Real-time status for in-progress reincarnations
- "View Details" opens full progress modal
- Cancel option for stuck transactions

**Transaction History:**
- Filterable by type (seal, vote, transfer)
- Export to CSV option
- View on explorer for each transaction

---

## Global Components

### Wallet Connection Modal

```
┌─────────────────────────────────────────────────────────────┐
│  ✕                                                          │
│                                                             │
│  Connect Your Wallet                                        │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  [🦊] MetaMask                                       │   │
│  │        Connect via browser extension                │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  [🔗] WalletConnect                                 │   │
│  │        Scan with your mobile wallet                 │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  [👻] Phantom     (Solana)                         │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  [🎒] Backpack   (Solana)                          │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Toast Notifications

| Type | Icon | Usage |
|------|------|-------|
| Success | ✅ | Transaction confirmed, action complete |
| Error | ❌ | Transaction failed, validation error |
| Warning | ⚠️ | Gas low, potential issue |
| Info | ℹ️ | Status updates, reminders |
| Loading | ⏳ | Processing, please wait |

### Error Modal

```
┌─────────────────────────────────────────────────────────────┐
│  ✕                                                          │
│                                                             │
│  ⚠️  Something went wrong                                   │
│                                                             │
│  We couldn't complete your reincarnation.                 │
│                                                             │
│  Error: Transaction reverted                               │
│  Ref: #IK-2026-0218-001                                   │
│                                                             │
│  [Try Again]  [Contact Support]  [Use Different NFT]       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Design System

### Color Palette

| Role | Color | Hex |
|------|-------|-----|
| Background Primary | Near Black | `#0a0a0f` |
| Background Secondary | Dark Purple | `#12121a` |
| Surface | Dark Card | `#1a1a24` |
| Border | Subtle Gray | `#2a2a3a` |
| Text Primary | White | `#ffffff` |
| Text Secondary | Gray | `#a0a0b0` |
| Accent Primary | Cyan | `#00f0ff` |
| Accent Secondary | Magenta | `#ff00aa` |
| Accent Tertiary | Purple | `#9d00ff` |
| Success | Green88` |
| | `#00ff Error | Red | `#ff4444` |
| Warning | Orange | `#ffaa00` |

### Typography

| Element | Font | Size | Weight |
|---------|------|------|--------|
| Hero Headline | Space Grotesk | 48px | 700 |
| Page Title | Space Grotesk | 32px | 600 |
| Section Title | Inter | 20px | 600 |
| Body | Inter | 16px | 400 |
| Caption | Inter | 14px | 400 |
| Button | Inter | 16px | 600 |
| Mono (addresses) | JetBrains Mono | 14px | 400 |

### Spacing System

- Base unit: 4px
- XS: 4px | SM: 8px | MD: 16px | LG: 24px | XL: 32px | XXL: 48px

### Animation Timing

- Fast: 150ms (hover, micro-interactions)
- Normal: 300ms (page transitions, modals)
- Slow: 500ms (major animations, reveals)
- Portal: Continuous loop (60fps target)

---

## Mobile-First Considerations

### Touch Targets
- Minimum 44x44px for all interactive elements
- 16px minimum font size
- 8px minimum spacing between touch targets

### Responsive Breakpoints
- Mobile: < 768px (primary)
- Tablet: 768px - 1024px
- Desktop: > 1024px

### Mobile-Specific Optimizations
- Bottom sheet modals instead of center modals
- Collapsible sections for long content
- Swipe gestures for navigation (optional)
- Reduced Three.js particle count on mobile
- Lazy load 3D scenes only when page is idle

---

## Accessibility (WCAG 2.1 AA)

- Color contrast ratio minimum 4.5:1 for text
- All images have alt text
- Keyboard navigation for all interactive elements
- Focus indicators visible
- Screen reader announcements for status updates
- Reduced motion option available
- No content flashes more than 3 times per second

---

## Analytics & Events

### Key Events to Track

| Event | Parameters | Purpose |
|-------|------------|---------|
| `page_view` | page_name | Funnel analysis |
| `wallet_connect` | wallet_type, chain | Adoption metrics |
| `nft_select` | nft_address, chain | Popular NFTs |
| `seal_start` | nft_address, estimated_time | Conversion |
| `seal_complete` | nft_address, duration | Success rate |
| `seal_error` | error_type, step | Error tracking |
| `gallery_view` | filter_type | Engagement |
| `share_twitter` | nft_address | Viral tracking |
| `guild_view` | - | DAO engagement |
| `vote_cast` | proposal_id, vote_type | Governance activity |

---

## Success Metrics

### Primary KPIs
- **Main Flow Conversion:** Wallet connect → Seal complete (target: 60%)
- **Time to Reborn:** Average time from seal start to complete (target: <3 min)
- **Return Rate:** Users who do 2+ reincarnations (target: 40%)
- **DAO Participation:** Guild visitors who vote (target: 25%)

### Secondary KPIs
- **Bounce Rate:** Users who leave during seal flow
- **Error Rate:** Failed reincarnations by type
- **Mobile vs Desktop:** Conversion by device
- **Wallet Distribution:** Which wallets are most popular

---

## Implementation Notes

### Frontend Stack Recommendation
- **Framework:** Next.js 14+ (App Router)
- **3D:** React Three Fiber + Drei
- **Styling:** Tailwind CSS
- **State:** Zustand or Jotai
- **Wagmi + RainbowKit** for Ethereum
- **Solana wallet adapter** for Solana

### Three.js Portal Scene
- Preload assets on landing page
- Use level-of-detail for mobile
- Implement reduced motion detection
- Fallback to static image on low-end devices

### Real-time Updates
- Use React Query for polling (configurable interval)
- Implement WebSocket connection for seal flow
- Optimistic updates for voting

---

*Document Version: 1.0*  
*Last Updated: 2026-02-18*  
*Next Review: After Phase 4 frontend implementation*
