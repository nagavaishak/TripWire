'use client';

import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';

const SOURCES = [
  {
    id: 'yt',
    label: 'YouTube',
    sublabel: 'Data API v3',
    weight: '30%',
    color: '#FF3B5C',
    icon: (
      <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current" xmlns="http://www.w3.org/2000/svg">
        <path d="M23.5 6.2a3 3 0 00-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.5a3 3 0 00-2.1 2.2C0 8.1 0 12 0 12s0 3.9.5 5.8a3 3 0 002.1 2.1C4.5 20.5 12 20.5 12 20.5s7.5 0 9.4-.5a3 3 0 002.1-2.1C24 15.9 24 12 24 12s0-3.9-.5-5.8zM9.7 15.5V8.5l6.3 3.5-6.3 3.5z"/>
      </svg>
    ),
  },
  {
    id: 'gt',
    label: 'Google Trends',
    sublabel: 'Search interest',
    weight: '35%',
    color: '#3B82F6',
    icon: (
      <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current" xmlns="http://www.w3.org/2000/svg">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
      </svg>
    ),
  },
  {
    id: 'fc',
    label: 'Farcaster',
    sublabel: 'Warpcast API v2',
    weight: '35%',
    color: '#A855F7',
    icon: (
      <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current" xmlns="http://www.w3.org/2000/svg">
        <path d="M11.77.5h.46C18.73.5 23.5 5.27 23.5 11.77v.46C23.5 18.73 18.73 23.5 12.23 23.5h-.46C5.27 23.5.5 18.73.5 12.23v-.46C.5 5.27 5.27.5 11.77.5zm-2.4 6.5H5.5v2h1.25l2.5 8H5.5v2h13v-2h-3.75l2.5-8H18.5v-2h-3.87l-1.63 6-1.63-6H9.37z"/>
      </svg>
    ),
  },
];

export function OracleFlow() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-100px' });

  return (
    <section id="how-it-works" className="py-32 relative" ref={ref}>
      {/* Background */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse 50% 40% at 50% 50%, rgba(59,130,246,0.04) 0%, transparent 70%)',
        }}
      />

      <div className="max-w-6xl mx-auto px-6">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="text-center mb-20"
        >
          <p className="text-[11px] font-[family-name:var(--font-mono)] text-[#FFB800] uppercase tracking-widest mb-4">
            How It Works
          </p>
          <h2 className="font-[family-name:var(--font-space)] font-bold text-4xl sm:text-5xl text-[#EAEAEC] tracking-tight">
            Three Sources.{' '}
            <span className="text-[#FFB800]">One Score.</span>
          </h2>
          <p className="text-[#8A8A95] mt-4 max-w-xl mx-auto text-base leading-relaxed font-[family-name:var(--font-inter)]">
            Every 5 minutes, TripWire collects signals from across the internet and distills them into a single, on-chain Degree of Attention score.
          </p>
        </motion.div>

        {/* Flow diagram */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_80px_1fr_80px_1fr] items-center gap-4 lg:gap-0">
          {/* Sources */}
          <div className="space-y-4">
            {SOURCES.map((src, i) => (
              <motion.div
                key={src.id}
                initial={{ opacity: 0, x: -24 }}
                animate={inView ? { opacity: 1, x: 0 } : {}}
                transition={{ delay: i * 0.12, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                className="flex items-center gap-4 bg-[#111113] border border-[#222225] rounded-xl p-4 hover:border-[#2E2E33] transition-colors"
              >
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: `${src.color}18`, color: src.color }}
                >
                  {src.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-[family-name:var(--font-space)] font-semibold text-sm text-[#EAEAEC]">
                    {src.label}
                  </p>
                  <p className="text-[11px] text-[#55555E] font-[family-name:var(--font-mono)]">
                    {src.sublabel}
                  </p>
                </div>
                <span
                  className="text-xs font-[family-name:var(--font-mono)] font-bold shrink-0"
                  style={{ color: src.color }}
                >
                  {src.weight}
                </span>
              </motion.div>
            ))}
          </div>

          {/* Arrow 1 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={inView ? { opacity: 1 } : {}}
            transition={{ delay: 0.4, duration: 0.5 }}
            className="flex items-center justify-center"
          >
            <div className="flex flex-col items-center gap-1 text-[#222225]">
              <div className="hidden lg:block w-full h-px bg-gradient-to-r from-[#222225] via-[#FFB800]/40 to-[#222225] my-2" style={{ width: '60px' }} />
              <svg viewBox="0 0 24 24" className="w-5 h-5 text-[#FFB800]/50 hidden lg:block" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              {/* Mobile: down arrow */}
              <svg viewBox="0 0 24 24" className="w-5 h-5 text-[#FFB800]/50 lg:hidden" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 5v14M6 13l6 6 6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </motion.div>

          {/* Oracle engine */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={inView ? { opacity: 1, scale: 1 } : {}}
            transition={{ delay: 0.5, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="bg-[#111113] border border-[#FFB800]/25 rounded-2xl p-6 text-center relative overflow-hidden"
          >
            <div
              className="absolute inset-0 pointer-events-none"
              style={{ background: 'radial-gradient(ellipse 80% 60% at 50% 50%, rgba(255,184,0,0.05) 0%, transparent 70%)' }}
            />
            <div className="w-12 h-12 bg-[#FFB800]/10 border border-[#FFB800]/25 rounded-xl flex items-center justify-center mx-auto mb-4">
              <svg viewBox="0 0 24 24" className="w-6 h-6 text-[#FFB800]" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <p className="font-[family-name:var(--font-space)] font-bold text-base text-[#EAEAEC] mb-1">TripWire Engine</p>
            <p className="text-[11px] font-[family-name:var(--font-mono)] text-[#8A8A95] mb-4">Time-decay weighting</p>
            <div className="space-y-1.5 text-left">
              {['Collect signals', 'Apply half-life decay', 'Weighted aggregation', 'Compute DoA score'].map((step, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full bg-[#FFB800]/10 border border-[#FFB800]/25 flex items-center justify-center text-[9px] font-[family-name:var(--font-mono)] text-[#FFB800] shrink-0">
                    {i + 1}
                  </span>
                  <span className="text-[11px] font-[family-name:var(--font-mono)] text-[#8A8A95]">{step}</span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Arrow 2 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={inView ? { opacity: 1 } : {}}
            transition={{ delay: 0.6, duration: 0.5 }}
            className="flex items-center justify-center"
          >
            <div className="flex flex-col items-center gap-1">
              <div className="hidden lg:block w-full h-px bg-gradient-to-r from-[#222225] via-[#FFB800]/40 to-[#222225] my-2" style={{ width: '60px' }} />
              <svg viewBox="0 0 24 24" className="w-5 h-5 text-[#FFB800]/50 hidden lg:block" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <svg viewBox="0 0 24 24" className="w-5 h-5 text-[#FFB800]/50 lg:hidden" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 5v14M6 13l6 6 6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </motion.div>

          {/* On-chain output */}
          <motion.div
            initial={{ opacity: 0, x: 24 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ delay: 0.7, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="space-y-4"
          >
            {[
              { label: 'DoA Score', sublabel: '0–10,000 bps on-chain', color: '#FFB800', icon: '◈' },
              { label: 'Long Position', sublabel: 'Win when attention rises', color: '#00FF88', icon: '↑' },
              { label: 'Short Position', sublabel: 'Win when attention falls', color: '#FF3B5C', icon: '↓' },
            ].map((item, i) => (
              <motion.div
                key={item.label}
                initial={{ opacity: 0, x: 24 }}
                animate={inView ? { opacity: 1, x: 0 } : {}}
                transition={{ delay: 0.7 + i * 0.1, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                className="flex items-center gap-4 bg-[#111113] border border-[#222225] rounded-xl p-4 hover:border-[#2E2E33] transition-colors"
              >
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center text-lg font-bold shrink-0"
                  style={{ background: `${item.color}18`, color: item.color }}
                >
                  {item.icon}
                </div>
                <div>
                  <p className="font-[family-name:var(--font-space)] font-semibold text-sm text-[#EAEAEC]">{item.label}</p>
                  <p className="text-[11px] text-[#55555E] font-[family-name:var(--font-mono)]">{item.sublabel}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
