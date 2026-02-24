'use client';

import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';
import { MarketCard } from './MarketCard';

const MARKETS = [
  { topic: 'Solana', locked: false },
  { topic: 'AI', locked: false },
  { topic: 'Bitcoin', locked: true },
  { topic: 'DeFi', locked: true },
];

export function MarketPreview() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });

  return (
    <section id="markets" className="py-32 relative" ref={ref}>
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse 60% 40% at 50% 0%, rgba(255,184,0,0.04) 0%, transparent 60%)',
        }}
      />

      <div className="max-w-6xl mx-auto px-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="mb-12"
        >
          <p className="text-[11px] font-[family-name:var(--font-mono)] text-[#FFB800] uppercase tracking-widest mb-3">
            Live Markets
          </p>
          <div className="flex items-end justify-between flex-wrap gap-4">
            <h2 className="font-[family-name:var(--font-space)] font-bold text-4xl sm:text-5xl text-[#EAEAEC] tracking-tight">
              See What's{' '}
              <span className="text-[#FFB800]">Moving</span>
            </h2>
            <a
              href="#access"
              className="text-sm font-[family-name:var(--font-inter)] text-[#8A8A95] hover:text-[#FFB800] transition-colors flex items-center gap-1.5 group"
            >
              Unlock all markets
              <svg viewBox="0 0 16 16" className="w-3.5 h-3.5 fill-current group-hover:translate-x-0.5 transition-transform" xmlns="http://www.w3.org/2000/svg">
                <path fillRule="evenodd" d="M4 8a.5.5 0 01.5-.5h5.793L8.146 5.354a.5.5 0 11.708-.708l3 3a.5.5 0 010 .708l-3 3a.5.5 0 01-.708-.708L10.293 8.5H4.5A.5.5 0 014 8z"/>
              </svg>
            </a>
          </div>
          <p className="text-[#8A8A95] mt-3 max-w-xl text-base leading-relaxed font-[family-name:var(--font-inter)]">
            Attention markets update every 5 minutes. Open long or short — no deadline, no expiry. Close when you're ready.
          </p>
        </motion.div>

        {/* Market grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {MARKETS.map((market, i) => (
            <MarketCard
              key={market.topic}
              topic={market.topic}
              locked={market.locked}
              index={i}
            />
          ))}
        </div>

        {/* P&L formula callout */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.5, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="mt-10 border border-[#222225] bg-[#111113] rounded-2xl p-6 grid grid-cols-1 sm:grid-cols-3 gap-6"
        >
          <div className="text-center">
            <p className="text-[11px] font-[family-name:var(--font-mono)] text-[#55555E] uppercase tracking-widest mb-2">Long payout</p>
            <p className="font-[family-name:var(--font-mono)] text-sm text-[#00FF88]">
              stake × (current / entry)
            </p>
            <p className="text-[11px] text-[#55555E] mt-1 font-[family-name:var(--font-inter)]">Wins when DoA rises</p>
          </div>
          <div className="text-center border-x border-[#222225]">
            <p className="text-[11px] font-[family-name:var(--font-mono)] text-[#55555E] uppercase tracking-widest mb-2">Short payout</p>
            <p className="font-[family-name:var(--font-mono)] text-sm text-[#FF3B5C]">
              stake × (entry / current)
            </p>
            <p className="text-[11px] text-[#55555E] mt-1 font-[family-name:var(--font-inter)]">Wins when DoA falls</p>
          </div>
          <div className="text-center">
            <p className="text-[11px] font-[family-name:var(--font-mono)] text-[#55555E] uppercase tracking-widest mb-2">Max gain</p>
            <p className="font-[family-name:var(--font-mono)] text-sm text-[#FFB800]">2× stake</p>
            <p className="text-[11px] text-[#55555E] mt-1 font-[family-name:var(--font-inter)]">Capped at 100% profit</p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
