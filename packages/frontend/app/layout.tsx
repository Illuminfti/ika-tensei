import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/wallet/Providers";
import { ToastProvider } from "@/components/ui/ToastSystem";
import { NavigationBar } from "@/components/ui/NavigationBar";

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
          <ToastProvider>
            <NavigationBar />
            <main className="pt-16">
              {children}
            </main>
          </ToastProvider>
        </Providers>
      </body>
    </html>
  );
}
