'use client';

import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';

interface WireBreakProps {
  onDone?: () => void;
}

export function WireBreak({ onDone }: WireBreakProps) {
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => {
      onDone?.();
      router.push('/dashboard');
    }, 1800);
    return () => clearTimeout(timer);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[9999] bg-[#0A0A0B] flex flex-col items-center justify-center overflow-hidden"
    >
      {/* Glitch layers */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute inset-0 bg-[#FFB800]/5"
          style={{ animation: 'glitch-h 0.3s infinite linear' }}
        />
        <div
          className="absolute inset-0 bg-[#FF3B5C]/3"
          style={{ animation: 'glitch-h 0.3s infinite linear reverse', animationDelay: '0.05s' }}
        />
      </div>

      {/* Scan line */}
      <div
        className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-[#FFB800] to-transparent pointer-events-none"
        style={{ animation: 'scan-down 0.8s linear', top: 0 }}
      />

      {/* CRT vignette */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 70% 70% at 50% 50%, transparent 60%, rgba(0,0,0,0.7) 100%)' }}
      />

      {/* Content */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.1, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="text-center relative z-10"
      >
        <div className="w-16 h-16 bg-[#FFB800]/10 border border-[#FFB800]/30 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <svg viewBox="0 0 32 32" className="w-8 h-8" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="16" cy="16" r="13" stroke="#FFB800" strokeWidth="1.5" opacity="0.4" />
            <circle cx="16" cy="16" r="7" stroke="#FFB800" strokeWidth="1.5" opacity="0.7" />
            <circle cx="16" cy="16" r="2.5" fill="#FFB800" />
            <line x1="16" y1="16" x2="27" y2="10" stroke="#FFB800" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </div>

        <p className="font-[family-name:var(--font-space)] font-bold text-2xl text-[#EAEAEC] mb-2">
          Access Granted
        </p>
        <p className="font-[family-name:var(--font-mono)] text-sm text-[#FFB800] mb-1">
          TRIPWIRE ENGAGED
        </p>
        <p className="text-xs text-[#55555E] font-[family-name:var(--font-mono)]">
          Redirecting to dashboard...
        </p>

        {/* Loading bar */}
        <div className="mt-8 w-48 h-0.5 bg-[#222225] rounded-full overflow-hidden mx-auto">
          <motion.div
            initial={{ width: '0%' }}
            animate={{ width: '100%' }}
            transition={{ duration: 1.5, ease: 'linear' }}
            className="h-full bg-[#FFB800] rounded-full"
          />
        </div>
      </motion.div>

      {/* Random horizontal glitch strips */}
      {[15, 35, 55, 72, 88].map((y, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, x: 0 }}
          animate={{
            opacity: [0, 0.6, 0, 0.4, 0],
            x: [0, -8, 6, -4, 0],
          }}
          transition={{ delay: i * 0.07, duration: 0.4, repeat: 2 }}
          className="absolute left-0 right-0 bg-[#FFB800]/8 pointer-events-none"
          style={{ top: `${y}%`, height: '2px' }}
        />
      ))}
    </motion.div>
  );
}
