"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { IkaSprite } from "@/components/ui/PixelSprite";
import { ConnectButton } from "@/components/wallet/ConnectButton";

const NAV_LINKS = [
  { href: "/seal", label: "Seal" },
  { href: "/gallery", label: "Gallery" },
  { href: "/guild", label: "Guild" },
  { href: "/profile", label: "Profile" },
];

function HamburgerIcon({ isOpen }: { isOpen: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <motion.path
        d="M4 6h16"
        stroke="#9ca3af"
        strokeWidth="2"
        strokeLinecap="round"
        animate={{
          rotate: isOpen ? 45 : 0,
          y: isOpen ? 6 : 0,
        }}
        transition={{ duration: 0.2 }}
      />
      {isOpen ? (
        <motion.path
          d="M4 12h16"
          stroke="#9ca3af"
          strokeWidth="2"
          strokeLinecap="round"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 0.1 }}
        />
      ) : (
        <motion.path
          d="M4 12h16"
          stroke="#9ca3af"
          strokeWidth="2"
          strokeLinecap="round"
          animate={{ opacity: 1 }}
          transition={{ duration: 0.1 }}
        />
      )}
      <motion.path
        d="M4 18h16"
        stroke="#9ca3af"
        strokeWidth="2"
        strokeLinecap="round"
        animate={{
          rotate: isOpen ? -45 : 0,
          y: isOpen ? -6 : 0,
        }}
        transition={{ duration: 0.2 }}
      />
    </svg>
  );
}

function NavLink({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();
  const isActive = pathname === href || (href !== "/" && pathname?.startsWith(href));

  return (
    <Link
      href={href}
      className={`
        font-silk text-xs transition-all duration-200 relative
        ${isActive 
          ? "text-ghost-white" 
          : "text-faded-spirit hover:text-ghost-white"
        }
      `}
    >
      {label}
      {isActive && (
        <motion.div
          layoutId="navIndicator"
          className="absolute -bottom-1 left-0 right-0 h-0.5 bg-blood-pink"
          style={{
            boxShadow: "0 0 10px #ff6b9d, 0 0 20px #ff6b9d80",
          }}
        />
      )}
    </Link>
  );
}

function MobileNavLink({
  href,
  label,
  onClick,
}: {
  href: string;
  label: string;
  onClick: () => void;
}) {
  const pathname = usePathname();
  const isActive = pathname === href || (href !== "/" && pathname?.startsWith(href));

  return (
    <Link
      href={href}
      onClick={onClick}
      className={`
        block w-full py-3 px-6 font-silk text-sm border-b border-sigil-border/50 transition-all
        ${isActive 
          ? "text-ghost-white bg-blood-pink/10" 
          : "text-faded-spirit hover:text-ghost-white hover:bg-sigil-border/20"
        }
      `}
    >
      {label}
    </Link>
  );
}

export function NavigationBar() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  return (
    <>
      {/* Desktop & Mobile Top Bar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-void-purple/90 backdrop-blur-sm border-b-2 border-sigil-border py-3 px-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          {/* Left: Logo */}
          <Link href="/" className="flex items-center gap-2">
            <motion.div
              whileHover={{ y: -2 }}
              transition={{ type: "spring", stiffness: 400, damping: 17 }}
            >
              <IkaSprite size={24} expression="neutral" />
            </motion.div>
            <span className="font-pixel text-blood-pink text-sm">イカ転生</span>
          </Link>

          {/* Center: Desktop Nav Links */}
          <div className="hidden md:flex items-center gap-6">
            {NAV_LINKS.map((link) => (
              <NavLink key={link.href} href={link.href} label={link.label} />
            ))}
          </div>

          {/* Right: Connect Button (Desktop) + Hamburger (Mobile) */}
          <div className="hidden md:block">
            <ConnectButton />
          </div>
          <button
            className="md:hidden p-2"
            onClick={() => setIsMobileMenuOpen(true)}
            aria-label="Open menu"
          >
            <HamburgerIcon isOpen={false} />
          </button>
        </div>
      </nav>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
              onClick={closeMobileMenu}
            />

            {/* Slide-down Panel */}
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed top-[57px] left-0 right-0 z-50 md:hidden bg-ritual-dark border-b border-sigil-border"
            >
              {/* Mobile Nav Links */}
              <div className="py-2">
                {NAV_LINKS.map((link) => (
                  <MobileNavLink
                    key={link.href}
                    href={link.href}
                    label={link.label}
                    onClick={closeMobileMenu}
                  />
                ))}
              </div>

              {/* Connect Button (Mobile) */}
              <div className="p-6 border-t border-sigil-border">
                <ConnectButton />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
