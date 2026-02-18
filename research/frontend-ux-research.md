# NFT Cross-Chain Bridge/Reincarnation Frontend UX Research

**Date:** February 18, 2026  
**Purpose:** Research best practices for Ika Tensei v3 frontend development

---

## 1. Top NFT Marketplace UIs

### Overview
In 2025, NFT marketplaces have evolved significantly. The market is split between pro-trader platforms (Blur, Tensor) and mainstream hubs (OpenSea, Magic Eden).

| Marketplace | Main Chain | 30-Day Volume | Key Audience |
|-------------|------------|---------------|--------------|
| Blur | Ethereum, Blast | $520M | Pro traders |
| OpenSea | Ethereum, Base, Polygon | $340M | Mass market |
| Magic Eden | Solana, Bitcoin, Ethereum | $280M | Mobile-first |
| Tensor | Solana | $120M | Solana degens |

### Key UX Patterns to Steal

#### Wallet Connection (Multi-Chain)
- **Magic Eden**: Mobile-first design, cross-chain "wallet linking" - supports SOL, BTC, ETH in one interface
- **OpenSea**: Unified wallet profiles across chains, supports linking multiple wallets to single account
- **Phantom**: Best-in-class NFT grid display with high-res images, multi-chain (Ethereum, Polygon added)
- **Pattern**: Show chain indicators on each NFT card (small badge/icon)

#### NFT Display (Grid, Cards, 3D Previews)
- **Grid Layouts**: Masonry/tiled grids with consistent card aspect ratios (1:1 most common)
- **Card Design**: Rounded corners (8-12px), subtle shadows, hover zoom effect
- **3D Previews**: Support for GLB/GLTF models, interactive rotation on hover
- **Lazy Loading**: Progressive image loading with blur-up placeholders
- **Collection Stats**: Floor price, volume, owners directly on collection cards

#### Transaction Flows
- **Blur/Tensor**: Single-click "sweep" for bulk buying - minimal friction
- **Magic Eden**: Multi-step wizard for minting with clear step indicators
- **OpenSea**: Traditional "Buy Now" / "Make Offer" / "List" modal flows
- **Pattern**: Always show gas estimates before confirmation

#### Loading States & Animations
- Skeleton loaders for grids (pulsing gray rectangles)
- Micro-interactions on hover (scale 1.02-1.05, subtle glow)
- Transaction pending state with animated spinner + "Confirming..." text
- Success state with confetti or checkmark animation

### Sources
- https://lanzocrypto.com/blog/nft-marketplace-in-2025-opensea-blur-magiceden
- https://opensea.io/
- https://magiceden.io/
- https://www.tensor.trade/

---

## 2. Cross-Chain Bridge UIs

### Wormhole Portal
- **URL**: https://portalbridge.com
- **UI Pattern**: Two-panel design (Source Chain → Destination Chain)
- **Chain Selector**: Dropdown with chain icons, searchable
- **Progress**: Step indicators: "Send" → "Bridge" → "Receive"
- **Features**:
  - Wormhole Connect SDK for in-app bridging
  - Visual VAA (Verified Action Approval) tracking
  - Gas token conversion (e.g., ETH → wETH)

### LayerZero
- **URL**: https://docs.layerzero.network/
- **Philosophy**: "All collapsing into a single transaction from the user's point of view"
- **UI Pattern**: Invisible bridge - no multiple steps, no repeated confirmations
- **Documentation**: OApp (Omnichain Application) concept, developers integrate via SDK
- **Features**:
  - Executors abstract away destination gas
  - DVN (Decentralized Verifier Network) selection
  - No bridge UI - embedded in dApps directly

### Axelar
- **Cross-chain UX**: Similar to Wormhole, emphasis on "Send tokens across chains"
- **Features**: 
  - Satellite UI for direct transfers
  - GMP (General Message Passing) for arbitrary cross-chain calls
  - Gas service to pay destination chain fees

### Key UX Patterns to Steal

#### Source → Destination Visuals
- Left-right flow with animated connection line
- Chain logos on both sides with bridge animation in middle
- "Bridging..." animation with progress percentage
- Estimated time display (e.g., "~2-3 minutes")

#### Multi-Step Transactions
1. **Select Source** → 2. **Select Destination** → 3. **Amount** → 4. **Review** → 5. **Confirm**
- Progress bar at top showing current step
- Each step can be edited without losing other selections

#### Estimated Time & Fees
- Always show before confirmation: "Estimated time: 2-5 minutes"
- Show gas fee breakdown: "Network fee: $X, Service fee: $Y"
- Warning if destination chain requires minimum amount

### Sources
- https://portalbridge.com
- https://wormhole.com/docs/
- https://docs.layerzero.network/v2
- https://layerzero.network/blog/the-default-is-many-chains

---

## 3. Best "NFT Transformation" UIs

### Burn & Mint Patterns
- **URL**: https://tokenminds.co/blog/nft-development/burn-and-mint-nft
- **Concept**: Transforming NFTs through burn-and-redeem mechanics
- **UI Elements**:
  - Clear "burn" confirmation with warning: "This action is irreversible"
  - Before/after preview showing what you'll receive
  - Quantity selectors for batch operations

### Before/After Displays
- Side-by-side comparison layout
- Slider to reveal transformation
- "Mystery box" style with scratch-to-reveal

### Reveal Animations
- **Common patterns**:
  - Gradient overlay with "Revealing..." text
  - Particle burst on reveal
  - Card flip animation (3D CSS transform)
  - Glitch/shatter effect for "digital" feel

### Collection Gallery Views
- Full-bleed hero with collection showcase
- Filterable grid by trait/rarity
- "Rarity score" visualization with heat maps

### Sources
- https://tokenminds.co/blog/nft-development/burn-and-mint-nft
- https://dribbble.com/tags/nft-minting
- https://www.broworks.net/blog/nft-and-ui-design

---

## 4. Three.js NFT Showcases

### Key Examples & Techniques

#### Particle Effects
- **Three Nebula**: https://three-nebula.org/ - Particle system engine for Three.js
- **Interactive Particle Simulation**: https://discourse.threejs.org/t/interactive-particle-simulation/67581
  - Cursor attraction effect
  - Gravity/escape velocity controls
- **Pattern**: Use particles for "magical" NFT reveal effects

#### 3D Card Flips
- **Library**: Three.js with CSS3DRenderer or pure CSS 3D transforms
- **Effect**: Card rotates on Y-axis on hover/click, revealing back with NFT metadata
- **Implementation**: `transform: rotateY(180deg)` with `preserve-3d`

#### Portal/Wormhole Animations
- Torus geometry with custom shaders
- GLSL fragment shaders for "wormhole" distortion effect
- Post-processing: bloom, chromatic aberration
- **Example**: https://threejs.org/examples/webgl_postprocessing_bloom.html

#### Floating/Orbiting Galleries
- **PlanetNFT**: https://discourse.threejs.org/t/planetnft-a-three-js-nft-gallery-editor/32728
  - 3D gallery editor with orbit controls
- **Pattern**: NFTs as textured planes orbiting a center point
- Camera: PerspectiveCamera with OrbitControls for user exploration

#### Shader Effects (Glow, Dissolve, Materialize)
- **Glow**: UnrealBloomPass post-processing
- **Dissolve**: Custom shader with noise texture + alpha threshold
- **Materialize**: Fresnel effect for edge glow on NFT edges
- **Reference**: https://discourse.threejs.org/t/advanced-3d-effects-particle-morphing/88359

### Libraries to Use
- **React Three Fiber** (@react-three/fiber) - React bindings
- **Drei** (@react-three/drei) - Useful helpers (OrbitControls, useGLTF, Html)
- **React Three Postprocessing** - Bloom, chromatic aberration, etc.

### Sources
- https://freefrontend.com/three-js/
- https://threejs.org/examples/
- https://discourse.threejs.org/
- https://www.jotform.com/blog/20-exceptional-three-js-experiments-98740/

---

## 5. Wallet UX Best Practices 2025-2026

### Sui Wallet Adapters

#### @mysten/dapp-kit (Recommended)
- **URL**: https://sdk.mystenlabs.com/dapp-kit
- **Key Components**:
  - `WalletProvider` - Root wrapper for wallet context
  - `ConnectButton` - Pre-built wallet connection UI
  - `useWallet` hook - Access wallet state
- **Features**:
  - All Sui wallets automatically supported via Wallet Standard
  - Both React components AND lower-level hooks available
  - gRPC/GraphQL support (not the deprecated JSON-RPC)

#### @suiet/wallet-kit
- **URL**: https://kit.suiet.app/
- **Pattern**: Wrap with `WalletKitProvider`
- **Quick Start**:
```jsx
import { WalletKitProvider } from '@mysten/wallet-kit';
function App() {
  return (
    <WalletKitProvider>
      <YourApp />
    </WalletKitProvider>
  );
}
```

#### Suiet Wallet Adapter
- **GitHub**: https://github.com/suiet/wallet-adapter
- **Note**: React-only, integrates with Mysten ecosystem

### Solana Wallet Adapter

#### @solana/wallet-adapter
- **URL**: https://solana.com/developers/cookbook/wallets/connect-wallet-react
- **Key Packages**:
  - `@solana/wallet-adapter-react` - Core hooks
  - `@solana/wallet-adapter-react-ui` - Pre-built UI components
  - `@solana/wallet-adapter-wallets` - Bundle of common wallets
- **Pattern**:
```jsx
<ConnectionProvider endpoint={endpoint}>
  <WalletProvider wallets={wallets}>
    <WalletModalProvider>
      <YourApp />
    </WalletModalProvider>
  </WalletProvider>
</ConnectionProvider>
```
- **Mobile Wallet Adapter**: https://docs.solanamobile.com/mobile-wallet-adapter/ux-guidelines
  - SIWS (Sign-In With Solana) UI built-in
  - Early wallet selection in UI flow fixes connection issues

### Ethereum (wagmi + viem + RainbowKit/ConnectKit)

#### RainbowKit (Recommended for 2025)
- **URL**: https://github.com/rainbow-me/rainbowkit
- **Stack**: Built on wagmi + viem + TanStack Query
- **Features**:
  - Customizable theme (dark/light mode)
  - Network switching built-in
  - Account display with ENS support
- **Pattern**:
```jsx
import { WagmiProvider } from 'wagmi';
import { RainbowKitProvider, ConnectButton } from '@rainbow-me/rainbowkit';
import { configureChains } from '@wagmi/core';
import { mainnet, polygon } from 'wagmi/chains';

const { chains, publicClient } = configureChains([mainnet, polygon], [...]);
const wagmiConfig = createConfig({ publicClient });

function App() {
  return (
    <WagmiProvider config={wagmiConfig}>
      <RainbowKitProvider chains={chains}>
        <ConnectButton />
      </RainbowKitProvider>
    </WagmiProvider>
  );
}
```

#### ConnectKit (Alternative)
- More minimal, direct integration with wagmi
- Popular with newer projects

### Gas Abstraction / "User Doesn't Need a Wallet"

#### Sui Sponsored Transactions
- **URL**: https://docs.sui.io/concepts/transactions/sponsored-transactions
- **Concept**: Sponsor pays gas fees for users - no SUI required
- **UX Pattern**: Show "Gas sponsored by [Protocol]" badge
- **Use Case**: Perfect for Ika Tensei's "no wallet needed" experience

#### zkLogin (Sui)
- **URL**: https://blog.sui.io/account-abstraction-explained/
- **Concept**: OAuth login → wallet created automatically
- **UX**: "Continue with Google" / "Continue with Apple" buttons

#### General Gas Abstraction Patterns
- **2026 Best Practice**: 
  - Embedded wallets (Openfort, Paper.xyz)
  - Session keys with limited permissions + expiry
  - Paymasters sponsor gas, optionally charge in-app token
- **Display**: "Free transaction" or "Gasless" badge when available

#### UX Guidelines
- **Always show**: Gas estimate, even if sponsor pays
- **Fallback**: If sponsorship fails, show "Pay with [Token]" option
- **Transparent**: "Your wallet may be created automatically" disclosure

### Sources
- https://sdk.mystenlabs.com/dapp-kit
- https://kit.suiet.app/docs/tutorial/connect-dapp-with-wallets/
- https://solana.com/developers/cookbook/wallets/connect-wallet-react
- https://docs.solanamobile.com/mobile-wallet-adapter/ux-guidelines
- https://github.com/rainbow-me/rainbowkit
- https://docs.sui.io/concepts/transactions/sponsored-transactions
- https://blog.sui.io/account-abstraction-explained/
- https://www.openfort.io/blog/top-10-embedded-wallets
- https://www.cryptowisser.com/guides/crypto-wallet-ux-guide-2025/

---

## Summary: Key UX Patterns to Steal for Ika Tensei

### For NFT Reincarnation/Bridging
1. **Before/After Display**: Side-by-side comparison with smooth transition animation
2. **Seal/Lock Metaphor**: Show "sealed" state → animate breaking seal → reveal transformed NFT
3. **Step-by-Step Wizard**: Source → Confirm → Bridge → Destination → Reveal
4. **Progress Visualization**: Animated line between chains with percentage/step indicator

### For Wallet Connection
1. **Multi-chain unified**: One profile, multiple chain badges
2. **Gasless by default**: Show "Sponsored" badge, fallback to wallet
3. **Embedded wallet option**: "Continue with Google" creates wallet automatically

### For Visual Effects
1. **Three.js gallery**: Floating NFTs with orbit controls
2. **Reveal animation**: Particle burst + card flip combo
3. **Loading states**: Skeleton loaders + "Processing..." with progress bar

### For Transaction Flows
1. **Review screen**: Always show gas, time estimate before confirm
2. **Pending state**: Animated spinner + "Confirm in wallet..."
3. **Success**: Checkmark + link to explorer + "View your NFT"

---

*Research completed February 18, 2026*
