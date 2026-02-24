'use client';

import { useQuery } from '@tanstack/react-query';
import { motion, useInView } from 'framer-motion';
import { useRef, useEffect, useState } from 'react';
import { oracleClient } from '@/lib/api';

function AnimatedNumber({ value, duration = 1.2 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(0);
  const startRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const start = display;
    const end = value;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    function step(ts: number) {
      if (!startRef.current) startRef.current = ts;
      const elapsed = (ts - startRef.current) / (duration * 1000);
      const t = Math.min(1, elapsed);
      const ease = 1 - Math.pow(1 - t, 3);
      setDisplay(start + (end - start) * ease);
      if (t < 1) rafRef.current = requestAnimationFrame(step);
      else startRef.current = null;
    }
    rafRef.current = requestAnimationFrame(step);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [value]);

  return <>{display.toFixed(1)}</>;
}

export function GridBreak() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });

  const { data: solana } = useQuery({
    queryKey: ['topic', 'Solana'],
    queryFn: () => oracleClient.getTopic('Solana'),
    refetchInterval: 5 * 60 * 1000,
    staleTime: 60 * 1000,
  });
  const { data: ai } = useQuery({
    queryKey: ['topic', 'AI'],
    queryFn: () => oracleClient.getTopic('AI'),
    refetchInterval: 5 * 60 * 1000,
    staleTime: 60 * 1000,
  });

  const topics = [
    { label: 'Solana', data: solana },
    { label: 'AI', data: ai },
  ];

  return (
    <section className="relative overflow-hidden" ref={ref}>
      {/* Background grid lines */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: `linear-gradient(rgba(34,34,37,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(34,34,37,0.4) 1px, transparent 1px)`,
          backgroundSize: '60px 60px',
        }}
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse 100% 80% at 50% 50%, rgba(255,184,0,0.05) 0%, rgba(10,10,11,0.6) 60%, rgba(10,10,11,0.95) 100%)',
        }}
      />

      <div className="relative max-w-6xl mx-auto px-6 py-24">
        <motion.div
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ duration: 0.8 }}
          className="text-center mb-12"
        >
          <p className="text-[11px] font-[family-name:var(--font-mono)] text-[#FFB800] uppercase tracking-widest mb-4">
            Live Attention Index
          </p>
          <p className="text-base text-[#8A8A95] font-[family-name:var(--font-inter)] max-w-md mx-auto">
            This number is live. It moves every 5 minutes. Your position tracks it in real time.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 max-w-2xl mx-auto">
          {topics.map(({ label, data }, i) => {
            const val = data?.value ?? 0;
            const color = val >= 60 ? '#00FF88' : val >= 30 ? '#FFB800' : '#FF3B5C';
            const pct = Math.min(100, Math.max(0, val));

            return (
              <motion.div
                key={label}
                initial={{ opacity: 0, y: 30 }}
                animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: i * 0.15, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                className="text-center relative"
              >
                {/* Giant number */}
                <div
                  className="font-[family-name:var(--font-mono)] font-bold leading-none tracking-tighter select-none"
                  style={{
                    fontSize: 'clamp(80px, 18vw, 140px)',
                    color,
                    textShadow: `0 0 60px ${color}50, 0 0 120px ${color}20`,
                    opacity: inView ? 1 : 0,
                  }}
                >
                  {inView && data ? <AnimatedNumber value={val} /> : '—'}
                </div>

                <p className="font-[family-name:var(--font-space)] font-bold text-xl text-[#EAEAEC] mt-2">
                  {label}
                </p>
                <p className="text-[11px] font-[family-name:var(--font-mono)] text-[#55555E] mt-1 uppercase tracking-widest">
                  Degree of Attention
                </p>

                {/* Progress bar */}
                <div className="mt-4 h-1 bg-[#222225] rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: '0%' }}
                    animate={inView ? { width: `${pct}%` } : {}}
                    transition={{ delay: i * 0.15 + 0.5, duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
                    className="h-full rounded-full"
                    style={{ background: color }}
                  />
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
