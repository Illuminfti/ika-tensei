# Ika Tensei Frontend Architecture Research

**Version:** 1.0  
**Date:** 2026-02-18  
**Status:** Architecture Recommendation

---

## Executive Summary

This document outlines the recommended frontend architecture for Ika Tensei - a cross-chain NFT reincarnation protocol. The architecture prioritizes:

1. **Performance** - Heavy Three.js usage requires careful bundle management
2. **Multi-chain UX** - Seamless Ethereum, Sui, and Solana wallet integration
3. **Developer Experience** - Type-safe, maintainable codebase
4. **Visual Identity** - Dark mode with neon accents, "sacred/mystical" aesthetic

---

## 1. Technology Stack Recommendations

### 1.1 Core Framework & 3D

```json
{
  "dependencies": {
    "next": "14.2.x",
    "react": "18.3.x",
    "react-dom": "18.3.x",
    "three": "0.162.x",
    "@react-three/fiber": "8.15.x",
    "@react-three/drei": "9.99.x",
    "@react-three/postprocessing": "2.16.x"
  }
}
```

**Rationale:**
- Next.js 14 App Router provides optimal SSR/CSR balance
- R3F v8 has native Next.js App Router support with proper SSR handling
- drei provides ready-to-use abstractions (OrbitControls, Environment, useGLTF)
- Use exact versions for Three.js ecosystem to avoid shader compilation issues

### 1.2 Multi-Chain Wallet

```json
{
  "dependencies": {
    "@wagmi/core": "2.x",
    "viem": "2.x",
    "@mysten/dapp-kit": "0.14.x",
    "@solana/wallet-adapter-react": "0.9.x",
    "@solana/wallet-adapter-react-ui": "0.4.x",
    "@solana/web3.js": "1.91.x"
  }
}
```

**Rationale:**
- wagmi v2 + viem for Ethereum (tree-shakeable, type-safe)
- @mysten/dapp-kit provides Sui wallet integration
- @solana/wallet-adapter-react is the standard for Solana
- Avoid using multiple wallet libraries for same chain

### 1.3 State Management

```json
{
  "dependencies": {
    "zustand": "4.5.x",
    "jotai": "2.8.x",
    "valtio": "1.13.x"
  }
}
```

**Recommendation:** Use **Zustand** as primary store

**Rationale:**
- Simpler API than Redux, smaller bundle than Redux Toolkit
- Excellent TypeScript support
- Easy middleware for persistence (localStorage)
- Transients support for high-frequency updates (wallet state)
- Jotai is good for atomic state but adds complexity for cross-chain flows

### 1.4 UI & Styling

```json
{
  "dependencies": {
    "tailwindcss": "3.4.x",
    "@radix-ui/react-dialog": "1.1.x",
    "@radix-ui/react-dropdown-menu": "1.1.x",
    "@radix-ui/react-tabs": "1.1.x",
    "@radix-ui/react-tooltip": "1.1.x",
    "@radix-ui/react-slot": "1.1.x",
    "class-variance-authority": "0.7.x",
    "clsx": "2.1.x",
    "tailwind-merge": "2.2.x",
    "lucide-react": "0.363.x"
  }
}
```

**Rationale:**
- Tailwind CSS v4 is production-ready with CSS-first configuration
- Radix UI provides accessible primitives (builds shadcn/ui foundation)
- lucide-react for consistent iconography

### 1.5 Data Fetching

```json
{
  "dependencies": {
    "@tanstack/react-query": "5.x",
    "viem": "2.x",
    "@mysten/sui.js": "1.0.x",
    "@solana/dapp-publishing": "0.1.x"
  }
}
```

**Rationale:**
- TanStack Query v5 handles caching, refetching, deduping
- Native SDKs for each chain (viem, @mysten/sui.js, @solana/web3.js)

### 1.6 Utilities

```json
{
  "dependencies": {
    "zod": "3.22.x",
    "typescript": "5.4.x",
    "eslint": "8.57.x",
    "prettier": "3.2.x"
  }
}
```

---

## 2. Directory Structure

```
/
├── app/                          # Next.js 14 App Router
│   ├── (routes)/                 # Route groups
│   │   ├── page.tsx              # Landing page (SSR)
│   │   ├── (app)/                # Authenticated app
│   │   │   ├── layout.tsx        # App shell with wallet providers
│   │   │   ├── dashboard/
│   │   │   │   └── page.tsx
│   │   │   ├── reincarnate/
│   │   │   │   └── page.tsx      # NFT selection + cross-chain flow
│   │   │   └── collection/
│   │   │       └── page.tsx
│   │   └── (marketing)/
│   │       └── page.tsx
│   ├── api/                     # API routes
│   ├── layout.tsx               # Root layout
│   ├── globals.css              # Tailwind + custom properties
│   └── error.tsx                # Error boundary
│
├── components/
│   ├── ui/                      # shadcn/ui base components
│   │   ├── button.tsx
│   │   ├── dialog.tsx
│   │   ├── dropdown-menu.tsx
│   │   ├── card.tsx
│   │   └── ...
│   ├── three/                   # 3D scene components
│   │   ├── scene-canvas.tsx     # Main canvas (client-only)
│   │   ├── nft-viewer.tsx       # 3D NFT display
│   │   ├── particles.tsx        # Sacred/mystical effects
│   │   ├── environment.tsx       # HDR lighting
│   │   └── models/
│   │       ├── soul-orb.tsx
│   │       └── portal.tsx
│   ├── wallet/                  # Multi-chain wallet components
│   │   ├── connect-button.tsx
│   │   ├── chain-selector.tsx
│   │   ├── wallet-modal.tsx
│   │   └── providers/
│   │       ├── eth-provider.tsx
│   │       ├── sui-provider.tsx
│   │       └── sol-provider.tsx
│   └── crosschain/               # Cross-chain flow components
│       ├── flow-container.tsx
│       ├── step-select.tsx
│       ├── step-bridge.tsx
│       ├── step-confirm.tsx
│       └── transaction-status.tsx
│
├── lib/
│   ├── chains/
│   │   ├── config.ts             # Chain configurations
│   │   ├── eth.ts                # Ethereum utilities
│   │   ├── sui.ts                # Sui utilities
│   │   └── sol.ts                # Solana utilities
│   ├── nft/
│   │   ├── fetcher.ts            # Unified NFT fetching
│   │   ├── parser.ts             # Parse NFT metadata
│   │   └── transformer.ts        # Transform for 3D display
│   ├── ipfs/
│   │   └── client.ts             # IPFS gateway handling
│   └── utils/
│       ├── cn.ts                 # className merger
│       └── format.ts             # Formatting utilities
│
├── stores/
│   ├── use-wallet-store.ts       # Unified wallet state
│   ├── use-crosschain-store.ts   # Cross-chain flow state
│   └── use-ui-store.ts           # UI state (modals, sidebar)
│
├── hooks/
│   ├── use-nfts.ts               # NFT fetching hook
│   ├── use-crosschain-tx.ts      # Cross-chain transaction hook
│   ├── use-bridge-status.ts      # Bridge status polling
│   └── use-three-scene.ts        # Three.js scene management
│
├── public/
│   ├── models/                   # GLB/GLTF 3D models
│   │   ├── soul-orb.glb
│   │   └── portal.glb
│   ├── textures/                 # Textures, normal maps
│   └── hdri/                     # Environment maps
│
├── types/
│   ├── nft.ts                    # NFT type definitions
│   ├── wallet.ts                 # Wallet type definitions
│   └── crosschain.ts             # Cross-chain flow types
│
├── config/
│   ├── site.ts                   # Site configuration
│   └── chains.ts                 # Chain IDs, RPCs, explorers
│
├── package.json
├── tailwind.config.ts
├── next.config.js
├── tsconfig.json
└── vercel.json                   # Vercel deployment config
```

---

## 3. Key Architectural Decisions

### 3.1 Next.js 14 App Router + Three.js Integration

#### Client Components for 3D Scenes

```typescript
// components/three/scene-canvas.tsx
'use client';

import { Canvas } from '@react-three/fiber';
import { Suspense } from 'react';

export function SceneCanvas() {
  return (
    <div className="w-full h-full">
      <Canvas
        camera={{ position: [0, 0, 5], fov: 50 }}
        dpr={[1, 2]} // Handle high DPI
        gl={{ 
          antialias: true,
          powerPreference: 'high-performance'
        }}
      >
        <Suspense fallback={null}>
          <SceneContent />
        </Suspense>
      </Canvas>
    </div>
  );
}
```

#### Dynamic Import with SSR Disabled

```typescript
// app/reincarnate/page.tsx
import dynamic from 'next/dynamic';

const SceneCanvas = dynamic(
  () => import('@/components/three/scene-canvas').then(mod => mod.SceneCanvas),
  { 
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-full">
        <div className="animate-pulse text-neon-cyan">Loading sacred realm...</div>
      </div>
    )
  }
);

export default function ReincarnatePage() {
  return (
    <main>
      <SceneCanvas />
      <NFTControls />
    </main>
  );
}
```

#### Code Splitting Strategy

1. **Route-based splitting** - Next.js App Router does this automatically
2. **Component-based splitting** - Dynamic imports for Three.js scenes
3. **Library splitting** - Use `@next/bundle-analyzer` to monitor

```javascript
// next.config.js
const nextConfig = {
  experimental: {
    optimizePackageImports: [
      '@react-three/fiber',
      '@react-three/drei',
      'three',
      'lucide-react'
    ]
  },
  webpack: (config, { isServer }) => {
    // Optimize Three.js tree-shaking
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false
      };
    }
    return config;
  }
};
```

### 3.2 Multi-Chain Wallet Architecture

#### Unified Wallet State

```typescript
// stores/use-wallet-store.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface WalletState {
  // Ethereum
  ethAddress: string | null;
  ethChainId: number | null;
  
  // Sui
  suiAddress: string | null;
  
  // Solana
  solAddress: string | null;
  
  // Unified
  isConnected: boolean;
  activeChain: 'ethereum' | 'sui' | 'solana' | null;
  
  // Actions
  setEthWallet: (address: string, chainId: number) => void;
  setSuiWallet: (address: string) => void;
  setSolWallet: (address: string) => void;
  disconnect: () => void;
  setActiveChain: (chain: 'ethereum' | 'sui' | 'solana') => void;
}

export const useWalletStore = create<WalletState>()(
  persist(
    (set) => ({
      ethAddress: null,
      ethChainId: null,
      suiAddress: null,
      solAddress: null,
      isConnected: false,
      activeChain: null,
      
      setEthWallet: (address, chainId) => set({ 
        ethAddress: address, 
        ethChainId: chainId,
        isConnected: true 
      }),
      setSuiWallet: (address) => set({ 
        suiAddress: address,
        isConnected: true 
      }),
      setSolWallet: (address) => set({ 
        solAddress: address,
        isConnected: true 
      }),
      disconnect: () => set({
        ethAddress: null,
        ethChainId: null,
        suiAddress: null,
        solAddress: null,
        isConnected: false,
        activeChain: null
      }),
      setActiveChain: (chain) => set({ activeChain: chain })
    }),
    { name: 'ika-wallet' }
  )
);
```

#### Provider Pattern

```typescript
// components/wallet/providers/wagmi-provider.tsx
'use client';

import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { config } from '@/lib/chains/eth';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5_000,
      refetchOnWindowFocus: false,
    },
  },
});

export function EthProvider({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}
```

```typescript
// components/wallet/providers/sui-provider.tsx
'use client';

import { SuiClientProvider, WalletProvider } from '@mysten/dapp-kit';
import { mainnet, testnet } from '@mysten/sui/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient();

const networks = {
  mainnet,
  testnet,
  devnet: 'https://fullnode.devnet.sui.io:443'
};

export function SuiProvider({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <SuiClientProvider networks={networks} defaultNetwork="testnet">
        <WalletProvider>
          {children}
        </WalletProvider>
      </SuiClientProvider>
    </QueryClientProvider>
  );
}
```

```typescript
// components/wallet/providers/sol-provider.tsx
'use client';

import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { PhantomWalletAdapter, SlopeWalletAdapter } from '@solana/wallet-adapter-wallets';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { clusterApiUrl } from '@solana/web3.js';

export function SolProvider({ children }: { children: React.ReactNode }) {
  const endpoint = clusterApiUrl('devnet');
  const wallets = [
    new PhantomWalletAdapter(),
    new SlopeWalletAdapter()
  ];

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          {children}
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
```

#### Root Provider Composition

```typescript
// app/providers.tsx
'use client';

import { ReactNode } from 'react';
import { EthProvider } from '@/components/wallet/providers/eth-provider';
import { SuiProvider } from '@/components/wallet/providers/sui-provider';
import { SolProvider } from '@/components/wallet/providers/sol-provider';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <EthProvider>
      <SuiProvider>
        <SolProvider>
          {children}
        </SolProvider>
      </SuiProvider>
    </EthProvider>
  );
}
```

```typescript
// app/layout.tsx
import { Providers } from './providers';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
```

### 3.3 State Management for Cross-Chain Flows

#### Cross-Chain Flow Store

```typescript
// stores/use-crosschain-store.ts
import { create } from 'zustand';

type FlowStep = 'select' | 'bridge' | 'confirm' | 'mint' | 'complete';
type FlowStatus = 'idle' | 'pending' | 'confirming' | 'success' | 'error';

interface CrossChainState {
  // Flow state
  step: FlowStep;
  status: FlowStatus;
  
  // Source NFT
  sourceChain: 'ethereum' | 'sui' | 'solana' | null;
  sourceNft: NFT | null;
  
  // Bridge state
  bridgeTxHash: string | null;
  bridgeConfirmations: number;
  
  // Target
  targetChain: 'ethereum' | 'sui' | 'solana' | null;
  targetAddress: string | null;
  
  // Error handling
  error: string | null;
  retryCount: number;
  
  // Actions
  setStep: (step: FlowStep) => void;
  setSourceNft: (chain: string, nft: NFT) => void;
  setBridgeTx: (txHash: string) => void;
  updateConfirmations: (count: number) => void;
  setTargetChain: (chain: string, address: string) => void;
  setError: (error: string) => void;
  retry: () => void;
  reset: () => void;
}

export const useCrossChainStore = create<CrossChainState>((set) => ({
  step: 'select',
  status: 'idle',
  sourceChain: null,
  sourceNft: null,
  bridgeTxHash: null,
  bridgeConfirmations: 0,
  targetChain: null,
  targetAddress: null,
  error: null,
  retryCount: 0,
  
  setStep: (step) => set({ step, status: 'idle' }),
  
  setSourceNft: (chain, nft) => set({ 
    sourceChain: chain as any,
    sourceNft: nft 
  }),
  
  setBridgeTx: (txHash) => set({ 
    bridgeTxHash: txHash,
    status: 'confirming'
  }),
  
  updateConfirmations: (count) => set({ 
    bridgeConfirmations: count,
    status: count >= 1 ? 'success' : 'confirming'
  }),
  
  setTargetChain: (chain, address) => set({
    targetChain: chain as any,
    targetAddress: address
  }),
  
  setError: (error) => set({ status: 'error', error }),
  
  retry: () => set((state) => ({ 
    retryCount: state.retryCount + 1,
    status: 'pending',
    error: null
  })),
  
  reset: () => set({
    step: 'select',
    status: 'idle',
    sourceChain: null,
    sourceNft: null,
    bridgeTxHash: null,
    bridgeConfirmations: 0,
    targetChain: null,
    targetAddress: null,
    error: null,
    retryCount: 0
  })
}));
```

#### Optimistic UI Updates

```typescript
// hooks/use-crosschain-tx.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCrossChainStore } from '@/stores/use-crosschain-store';

export function useCrossChainTx() {
  const queryClient = useQueryClient();
  const { setBridgeTx, setError, setStep } = useCrossChainStore();

  return useMutation({
    mutationFn: async (tx: CrossChainTxRequest) => {
      // Optimistic update
      setStep('bridge');
      
      // Submit transaction
      const result = await submitCrossChainTx(tx);
      
      // Update with actual tx hash
      setBridgeTx(result.txHash);
      
      return result;
    },
    onSuccess: () => {
      // Invalidate and refetch
      queryClient.invalidateQueries({ queryKey: ['nfts'] });
    },
    onError: (error) => {
      setError(error.message);
    }
  });
}
```

#### Real-Time Status Polling

```typescript
// hooks/use-bridge-status.ts
import { useQuery } from '@tanstack/react-query';
import { useCrossChainStore } from '@/stores/use-crosschain-store';

function pollBridgeStatus(txHash: string, chain: string) {
  return async () => {
    const response = await fetch(`/api/bridge-status?tx=${txHash}&chain=${chain}`);
    return response.json();
  };
}

export function useBridgeStatus() {
  const { bridgeTxHash, sourceChain, updateConfirmations } = useCrossChainStore();

  return useQuery({
    queryKey: ['bridge-status', bridgeTxHash, sourceChain],
    queryFn: pollBridgeStatus(bridgeTxHash!, sourceChain!),
    enabled: !!bridgeTxHash && !!sourceChain,
    refetchInterval: 5000, // Poll every 5 seconds
    retry: 10,
    retryDelay: 2000,
    onSuccess: (data) => {
      updateConfirmations(data.confirmations);
    }
  });
}
```

### 3.4 NFT Data Fetching

#### Unified NFT Fetcher

```typescript
// lib/nft/fetcher.ts
import { createPublicClient, http, getContract } from 'viem';
import { mainnet, sepolia } from 'viem/chains';
import { getOwnedObjects } from '@mysten/sui.js';
import { Connection, PublicKey } from '@solana/web3.js';
import { getTokenAccounts } from '@solana/spl-token';

type NFT = {
  id: string;
  chain: 'ethereum' | 'sui' | 'solana';
  contractAddress: string;
  tokenId: string;
  name: string;
  description: string;
  imageUrl: string;
  metadataUrl: string;
  owner: string;
};

// Ethereum NFT Fetcher
export async function fetchEthNFTs(address: string): Promise<NFT[]> {
  const client = createPublicClient({
    chain: sepolia,
    transport: http()
  });
  
  // Use Alchemy SDK or Moralis for production
  const response = await fetch(
    `https://eth-sepolia.g.alchemy.com/nft/v3/${process.env.ALCHEMY_API_KEY}/getNFTsForOwner`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        owner: address,
        contractAddresses: [], // All contracts
        withMetadata: true
      })
    }
  );
  
  const data = await response.json();
  return data.ownedNfts.map((nft: any) => ({
    id: `${nft.contract.address}:${nft.tokenId}`,
    chain: 'ethereum' as const,
    contractAddress: nft.contract.address,
    tokenId: nft.tokenId,
    name: nft.name || `NFT #${nft.tokenId}`,
    description: nft.description || '',
    imageUrl: nft.media[0]?.gateway || nft.image.cachedUrl || '',
    metadataUrl: nft.tokenUri.gateway,
    owner: address
  }));
}

// Sui NFT Fetcher
export async function fetchSuiNFTs(address: string): Promise<NFT[]> {
  const client = new SuiClient({ 
    url: 'https://fullnode.testnet.sui.io' 
  });
  
  const { data } = await client.getOwnedObjects({
    owner: address,
    filter: { MoveModule: { module: 'nft' } },
    options: { showContent: true, showDisplay: true }
  });
  
  return data.map((obj) => ({
    id: obj.data?.objectId || '',
    chain: 'sui' as const,
    contractAddress: obj.data?.type || '',
    tokenId: obj.data?.objectId || '',
    name: (obj.data?.display as any)?.name || 'Sui NFT',
    description: (obj.data?.display as any)?.description || '',
    imageUrl: (obj.data?.display as any)?.image_url || '',
    metadataUrl: '',
    owner: address
  }));
}

// Solana NFT Fetcher
export async function fetchSolNFTs(address: string): Promise<NFT[]> {
  const connection = new Connection(clusterApiUrl('devnet'));
  
  // Use Helius DAS API for better performance
  const response = await fetch('https://api.mainnet-beta.solana.com', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: '1',
      method: 'getTokenAccountsByOwner',
      params: [
        address,
        { programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' },
        { encoding: 'jsonParsed' }
      ]
    })
  });
  
  const data = await response.json();
  
  // Filter for NFTs (amount = 1) and get metadata
  const nfts = data.result.value
    .filter((acc: any) => acc.account.data.parsed.info.tokenAmount.amount === '1')
    .map((acc: any) => acc.pubkey);
  
  // Fetch metadata for each NFT (batch in production)
  const nftData = await Promise.all(
    nfts.map(async (mint: string) => {
      const metadata = await fetchMetadata(new PublicKey(mint));
      return {
        id: mint,
        chain: 'solana' as const,
        contractAddress: mint,
        tokenId: mint,
        name: metadata?.name || 'Solana NFT',
        description: metadata?.description || '',
        imageUrl: metadata?.image || '',
        metadataUrl: metadata?.uri || '',
        owner: address
      };
    })
  );
  
  return nftData;
}

// Unified fetcher
export async function fetchNFTs(
  address: string, 
  chain: 'ethereum' | 'sui' | 'solana'
): Promise<NFT[]> {
  switch (chain) {
    case 'ethereum': return fetchEthNFTs(address);
    case 'sui': return fetchSuiNFTs(address);
    case 'solana': return fetchSolNFTs(address);
    default: return [];
  }
}
```

#### Image Optimization

```typescript
// Use Next.js Image component with custom loader
import Image from 'next/image';

function NFTImage({ src, alt }: { src: string; alt: string }) {
  // Handle IPFS URLs
  const optimizedSrc = src.replace('ipfs://', 'https://ipfs.io/ipfs/');
  
  return (
    <Image
      src={optimizedSrc}
      alt={alt}
      width={400}
      height={400}
      className="object-cover rounded-lg"
      loading="lazy"
      placeholder="blur"
      blurDataURL="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
    />
  );
}
```

### 3.5 UI Component Architecture

#### Tailwind Configuration (Dark + Neon + Sacred)

```typescript
// tailwind.config.ts
import type { Config } from 'tailwindcss';

export default {
  darkMode: 'class',
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}'
  ],
  theme: {
    extend: {
      colors: {
        // Base dark palette
        background: '#0a0a0f',
        foreground: '#f0f0f5',
        
        // Sacred/mystical palette
        sacred: {
          900: '#0d0d1a',
          800: '#12121f',
          700: '#1a1a2e',
          600: '#252540'
        },
        
        // Neon accents
        neon: {
          cyan: '#00f5ff',
          magenta: '#ff00ff',
          gold: '#ffd700',
          violet: '#8b5cf6',
          emerald: '#10b981'
        },
        
        // Primary action
        primary: {
          DEFAULT: '#00f5ff',
          foreground: '#0a0a0f'
        }
      },
      fontFamily: {
        display: ['var(--font-cinzel)', 'serif'], // Sacred/mystical
        body: ['var(--font-inter)', 'sans-serif']
      },
      animation: {
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
        'float': 'float 6s ease-in-out infinite'
      },
      keyframes: {
        glow: {
          '0%': { boxShadow: '0 0 5px #00f5ff, 0 0 10px #00f5ff' },
          '100%': { boxShadow: '0 0 20px #00f5ff, 0 0 30px #00f5ff' }
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' }
        }
      },
      backgroundImage: {
        'sacred-gradient': 'radial-gradient(ellipse at center, #1a1a2e 0%, #0a0a0f 70%)',
        'neon-gradient': 'linear-gradient(135deg, #00f5ff 0%, #8b5cf6 50%, #ff00ff 100%)'
      }
    }
  },
  plugins: []
} satisfies Config;
```

#### Base Button Component

```typescript
// components/ui/button.tsx
import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils/cn';

const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-md text-sm font-medium transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-neon-cyan text-background hover:bg-neon-cyan/80 shadow-[0_0_15px_rgba(0,245,255,0.5)]',
        secondary: 'bg-sacred-700 text-foreground hover:bg-sacred-600 border border-sacred-600',
        ghost: 'hover:bg-sacred-700 text-foreground',
        outline: 'border border-neon-cyan text-neon-cyan hover:bg-neon-cyan/10',
        destructive: 'bg-red-600 text-white hover:bg-red-700'
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 px-3',
        lg: 'h-12 px-8',
        icon: 'h-10 w-10'
      }
    },
    defaultVariants: {
      variant: 'default',
      size: 'default'
    }
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
```

---

## 4. Performance Budget Recommendations

### 4.1 Bundle Size Targets

| Resource | Target | Maximum |
|----------|--------|---------|
| Initial JS (First Load) | < 250KB | 350KB |
| Three.js Core | Lazy loaded | 600KB |
| Route-based chunks | < 100KB each | 150KB |
| Total page weight | < 1MB | 2MB |

### 4.2 Core Web Vitals Targets

| Metric | Target | Threshold |
|--------|--------|-----------|
| LCP (Largest Contentful Paint) | < 2.5s | 4.0s |
| FID (First Input Delay) | < 100ms | 300ms |
| INP (Interaction to Next Paint) | < 200ms | 500ms |
| CLS (Cumulative Layout Shift) | < 0.1 | 0.25 |

### 4.3 Three.js Performance

- **Target FPS:** 60fps on mid-range devices
- **Max draw calls:** < 100 per frame
- **Texture size:** < 2048x2048 (use compression)
- **Model size:** < 2MB per GLB
- **Enable Draco compression** for all models

### 4.4 Optimization Strategies

```typescript
// next.config.js - Complete configuration
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true'
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'ipfs.io' },
      { protocol: 'https', hostname: '**.ipfs.nftstorage.link' },
      { protocol: 'https', hostname: 'arweave.net' },
      { protocol: 'https', hostname: '**.cloudfront.net' }
    ],
    formats: ['image/avif', 'image/webp']
  },
  
  experimental: {
    optimizePackageImports: [
      '@react-three/fiber',
      '@react-three/drei',
      'three',
      'lucide-react',
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu'
    ]
  },
  
  webpack: (config, { isServer }) => {
    // Three.js optimization
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false
      };
    }
    
    // Handle shader imports
    config.module.rules.push({
      test: /\.(glsl|vs|fs|vert|frag)$/,
      use: ['raw-loader', 'glslify-loader']
    });
    
    return config;
  },
  
  // Vercel specific
  poweredByHeader: false,
  compress: true
};

module.exports = withBundleAnalyzer(nextConfig);
```

---

## 5. Similar Projects to Study

### 5.1 NFT Marketplaces

| Project | Chain | What to Learn |
|---------|-------|----------------|
| **tensor.trade** | Solana | Speed-focused UX, real-time updates, efficient state management |
| **blur.io** | Ethereum | Minimalist UI, keyboard shortcuts, fast browsing |
| **magiceden** | Solana | Multi-chain support, filter UX |
| **opensea** | Ethereum | Established patterns, wallet connection flow |

### 5.2 Bridge UIs

| Project | What to Learn |
|---------|----------------|
| **app.wormhole.com** | Cross-chain status tracking, step-by-step flows |
| **portal.bridge** | Real-time transaction monitoring |
| **allbridge.io** | Multi-chain token selection |

### 5.3 Three.js + Next.js Projects

| Project | What to Learn |
|---------|----------------|
| **pmndrs/market** | R3F best practices |
| **speckle.works** | 3D model viewer |
| **sketchfab.com** | 3D model embedding, performance |

---

## 6. Implementation Roadmap

### Phase 1: Foundation (Week 1-2)
- [ ] Set up Next.js 14 project with TypeScript
- [ ] Configure Tailwind CSS with sacred/neon theme
- [ ] Implement shadcn/ui base components
- [ ] Set up wallet providers (Ethereum, Sui, Solana)

### Phase 2: Core Features (Week 3-4)
- [ ] Implement unified wallet store
- [ ] Build NFT fetcher for all chains
- [ ] Create basic cross-chain flow UI
- [ ] Implement Three.js scene canvas

### Phase 3: 3D Integration (Week 5-6)
- [ ] Build NFT 3D viewer component
- [ ] Add sacred/mystical particle effects
- [ ] Implement model loading with suspense
- [ ] Optimize bundle size

### Phase 4: Polish (Week 7-8)
- [ ] Implement real-time bridge status
- [ ] Add error recovery UX
- [ ] Performance testing and optimization
- [ ] Vercel deployment

---

## 7. Environment Variables

```bash
# Ethereum
NEXT_PUBLIC_ETH_CHAIN_ID=11155111
NEXT_PUBLIC_ETH_RPC=https://eth-sepolia.g.alchemy.com/v2/...
ALCHEMY_API_KEY=...

# Sui
NEXT_PUBLIC_SUI_NETWORK=testnet
SUI_CLIENT_URL=https://fullnode.testnet.sui.io

# Solana
NEXT_PUBLIC_SOL_NETWORK=devnet
SOLANA_RPC_URL=https://api.devnet.solana.com

# General
NEXT_PUBLIC_IPFS_GATEWAY=https://ipfs.io/ipfs/
NEXT_PUBLIC_CDN_URL=https://cdn.iktensei.xyz
```

---

## 8. Security Considerations

1. **Wallet Security**
   - Never store private keys in localStorage
   - Use wallet's built-in connection methods
   - Implement proper disconnect handlers

2. **Transaction Signing**
   - Always show clear transaction preview
   - Use wallet's native signing UI
   - Validate all transaction parameters before signing

3. **Data Validation**
   - Validate all NFT metadata before rendering
   - Sanitize user inputs
   - Use Zod for runtime validation

4. **API Security**
   - Implement rate limiting
   - Use API keys for external services
   - Never expose secrets in client-side code

---

## Summary

This architecture provides:

1. **Scalable foundation** - Next.js 14 App Router with proper SSR/CSR separation
2. **Multi-chain ready** - Unified wallet state across Ethereum, Sui, and Solana
3. **3D-capable** - Optimized Three.js integration with code splitting
4. **Type-safe** - Full TypeScript coverage with Zod validation
5. **Performant** - Bundle optimization, image optimization, and lazy loading
6. **Themed** - Dark mode with neon accents for the sacred/mystical aesthetic

The recommended stack balances developer experience with production performance, and provides clear patterns for the complex cross-chain NFT reincarnation flow that Ika Tensei requires.
