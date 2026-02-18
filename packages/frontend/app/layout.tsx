import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/wallet/Providers";
import { ConnectButton } from "@/components/wallet/ConnectButton";

export const metadata: Metadata = {
  title: "イカ転生 | Ika Tensei - NFT Reincarnation Protocol",
  description: "Seal your NFTs. Reborn them on Solana. Join the Adventurer's Guild.",
  keywords: ["NFT", "cross-chain", "Solana", "Ethereum", "Sui", "reincarnation", "bridge"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="scanlines">
      <head>
        <link rel="stylesheet" href="/nes.min.css" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Press+Start+2P&family=Silkscreen:wght@400;700&family=Noto+Sans+JP:wght@400;700&display=swap" rel="stylesheet" />
      </head>
      <body className="bg-void-purple text-ghost-white min-h-screen">
        <Providers>
          <nav className="fixed top-0 w-full z-50 bg-void-purple/90 backdrop-blur-sm border-b-2 border-sigil-border px-4 py-3 flex items-center justify-between">
            <a href="/" className="flex items-center gap-3">
              <span className="font-pixel text-blood-pink text-sm">🦑 イカ転生</span>
            </a>
            <div className="flex items-center gap-4">
              <a href="/seal" className="font-silk text-xs text-faded-spirit hover:text-ghost-white transition-colors">Seal</a>
              <a href="/gallery" className="font-silk text-xs text-faded-spirit hover:text-ghost-white transition-colors">Gallery</a>
              <a href="/guild" className="font-silk text-xs text-faded-spirit hover:text-ghost-white transition-colors">Guild</a>
              <a href="/profile" className="font-silk text-xs text-faded-spirit hover:text-ghost-white transition-colors">Profile</a>
              <ConnectButton />
            </div>
          </nav>
          <main className="pt-16">
            {children}
          </main>
        </Providers>
      </body>
    </html>
  );
}
