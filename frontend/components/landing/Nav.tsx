'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';

export function Nav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <motion.nav
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-[#0A0A0B]/90 backdrop-blur-xl border-b border-[#222225]'
          : 'bg-transparent'
      }`}
    >
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 relative">
            <svg viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="14" cy="14" r="12" stroke="#FFB800" strokeWidth="1.5" opacity="0.3" />
              <circle cx="14" cy="14" r="7" stroke="#FFB800" strokeWidth="1.5" opacity="0.6" />
              <circle cx="14" cy="14" r="2.5" fill="#FFB800" />
              {/* radar sweep line */}
              <line x1="14" y1="14" x2="24" y2="9" stroke="#FFB800" strokeWidth="1.5" strokeLinecap="round" opacity="0.8" />
            </svg>
          </div>
          <span className="font-[family-name:var(--font-space)] font-bold text-lg tracking-tight text-[#EAEAEC]">
            TripWire
          </span>
          <span className="text-[10px] font-[family-name:var(--font-mono)] text-[#FFB800] border border-[#FFB800]/30 bg-[#FFB800]/8 px-1.5 py-0.5 rounded uppercase tracking-wider">
            Beta
          </span>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-4">
          <a
            href="#how-it-works"
            className="text-sm text-[#8A8A95] hover:text-[#EAEAEC] transition-colors hidden sm:block"
          >
            How it works
          </a>
          <a
            href="#markets"
            className="text-sm text-[#8A8A95] hover:text-[#EAEAEC] transition-colors hidden sm:block"
          >
            Markets
          </a>
          <a
            href="#access"
            className="inline-flex items-center gap-2 bg-[#FFB800] text-[#0A0A0B] font-semibold text-sm px-4 py-2 rounded-lg hover:bg-[#FFB800]/90 transition-all active:scale-95"
          >
            Request Access
          </a>
        </div>
      </div>
    </motion.nav>
  );
}
