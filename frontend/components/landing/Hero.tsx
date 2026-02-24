'use client';

import { motion, type Variants } from 'framer-motion';
import { RadarCanvas } from './RadarCanvas';
import { DoaStrip } from './DoaStrip';

const EASE = [0.16, 1, 0.3, 1] as [number, number, number, number];

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.7, ease: EASE },
  }),
};

export function Hero() {
  return (
    <section className="relative min-h-screen flex flex-col justify-center overflow-hidden pt-16">
      {/* Background radial gradient */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 60% 50% at 60% 40%, rgba(255,184,0,0.06) 0%, transparent 70%), radial-gradient(ellipse 40% 30% at 20% 70%, rgba(59,130,246,0.04) 0%, transparent 60%)',
        }}
      />

      <div className="max-w-6xl mx-auto px-6 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center min-h-[calc(100vh-4rem)] py-20">
          {/* Left: copy */}
          <div className="space-y-8">
            {/* Eyebrow pill */}
            <motion.div
              variants={fadeUp}
              custom={0}
              initial="hidden"
              animate="show"
              className="inline-flex items-center gap-2 border border-[#FFB800]/25 bg-[#FFB800]/8 rounded-full px-3 py-1.5"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#FFB800] animate-pulse" />
              <span className="text-[11px] font-[family-name:var(--font-mono)] text-[#FFB800] uppercase tracking-widest">
                Attention Oracle · Solana Devnet
              </span>
            </motion.div>

            {/* Headline */}
            <motion.h1
              variants={fadeUp}
              custom={1}
              initial="hidden"
              animate="show"
              className="font-[family-name:var(--font-space)] font-bold text-5xl sm:text-6xl lg:text-7xl leading-[1.05] tracking-tight text-[#EAEAEC]"
            >
              Attention Has
              <br />a{' '}
              <span
                className="text-[#FFB800] amber-text-glow"
              >
                Price
              </span>{' '}
              Now.
            </motion.h1>

            {/* Subheadline */}
            <motion.p
              variants={fadeUp}
              custom={2}
              initial="hidden"
              animate="show"
              className="text-lg text-[#8A8A95] leading-relaxed max-w-lg font-[family-name:var(--font-inter)]"
            >
              TripWire reads YouTube, Google Trends, and Farcaster in real time.
              Our oracle scores what the internet cares about.{' '}
              <span className="text-[#EAEAEC]">You trade the signal.</span>
            </motion.p>

            {/* CTAs */}
            <motion.div
              variants={fadeUp}
              custom={3}
              initial="hidden"
              animate="show"
              className="flex flex-wrap items-center gap-4"
            >
              <a
                href="#access"
                className="inline-flex items-center gap-2.5 bg-[#FFB800] text-[#0A0A0B] font-[family-name:var(--font-space)] font-bold text-sm px-6 py-3.5 rounded-xl hover:bg-[#FFB800]/90 transition-all active:scale-95 amber-glow"
              >
                <svg viewBox="0 0 16 16" className="w-4 h-4 fill-current" xmlns="http://www.w3.org/2000/svg">
                  <path d="M8 1a5.5 5.5 0 100 11A5.5 5.5 0 008 1zm0 1.5a4 4 0 110 8 4 4 0 010-8zm0 1.5a.75.75 0 00-.75.75v2.19l-1.22 1.22a.75.75 0 001.06 1.06l1.5-1.5a.75.75 0 00.22-.53V4.75A.75.75 0 008 4z"/>
                </svg>
                Request Early Access
              </a>
              <a
                href="#how-it-works"
                className="inline-flex items-center gap-2 text-sm text-[#8A8A95] hover:text-[#EAEAEC] transition-colors font-[family-name:var(--font-inter)]"
              >
                See how it works
                <svg viewBox="0 0 16 16" className="w-3.5 h-3.5 fill-current" xmlns="http://www.w3.org/2000/svg">
                  <path fillRule="evenodd" d="M4 8a.5.5 0 01.5-.5h5.793L8.146 5.354a.5.5 0 11.708-.708l3 3a.5.5 0 010 .708l-3 3a.5.5 0 01-.708-.708L10.293 8.5H4.5A.5.5 0 014 8z"/>
                </svg>
              </a>
            </motion.div>

            {/* Live DoA strip */}
            <motion.div
              variants={fadeUp}
              custom={4}
              initial="hidden"
              animate="show"
            >
              <DoaStrip />
            </motion.div>
          </div>

          {/* Right: radar */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3, duration: 1, ease: [0.16, 1, 0.3, 1] }}
            className="flex items-center justify-center lg:justify-end"
          >
            <div className="relative w-[300px] h-[300px] sm:w-[380px] sm:h-[380px] lg:w-[420px] lg:h-[420px]">
              {/* Outer amber ring glow */}
              <div
                className="absolute inset-0 rounded-full"
                style={{
                  boxShadow: '0 0 80px rgba(255,184,0,0.12), 0 0 40px rgba(255,184,0,0.06)',
                }}
              />
              <RadarCanvas className="w-full h-full rounded-full" />
              {/* Corner labels */}
              <div className="absolute top-3 left-3 text-[9px] font-[family-name:var(--font-mono)] text-[#FFB800]/60 uppercase tracking-widest">
                DoA scan
              </div>
              <div className="absolute bottom-3 right-3 text-[9px] font-[family-name:var(--font-mono)] text-[#55555E] uppercase tracking-widest">
                5m interval
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5, duration: 0.8 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
      >
        <span className="text-[10px] font-[family-name:var(--font-mono)] text-[#55555E] uppercase tracking-widest">
          scroll
        </span>
        <div className="w-px h-8 bg-gradient-to-b from-[#55555E] to-transparent" />
      </motion.div>
    </section>
  );
}
