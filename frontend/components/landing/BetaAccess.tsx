'use client';

import { useState, useRef } from 'react';
import { motion, useInView, AnimatePresence } from 'framer-motion';
import { CodeInput } from './CodeInput';
import { WireBreak } from './WireBreak';

export function BetaAccess() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'error' | 'success'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [showWireBreak, setShowWireBreak] = useState(false);
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });

  const handleCode = async (code: string) => {
    if (status === 'loading' || status === 'success') return;
    setStatus('loading');
    setErrorMsg('');

    try {
      const res = await fetch('/api/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });

      if (res.ok) {
        setStatus('success');
        setTimeout(() => setShowWireBreak(true), 400);
      } else {
        const data = await res.json().catch(() => ({}));
        setErrorMsg(data.error ?? 'Invalid code. Try again.');
        setStatus('error');
        // Reset after a moment
        setTimeout(() => setStatus('idle'), 2000);
      }
    } catch {
      setErrorMsg('Connection error. Please try again.');
      setStatus('error');
      setTimeout(() => setStatus('idle'), 2000);
    }
  };

  return (
    <>
      <AnimatePresence>
        {showWireBreak && <WireBreak />}
      </AnimatePresence>

      <section id="access" className="py-32 relative" ref={ref}>
        {/* Background */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 60% 60% at 50% 50%, rgba(255,184,0,0.06) 0%, transparent 70%)',
          }}
        />

        <div className="max-w-2xl mx-auto px-6 text-center">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          >
            <p className="text-[11px] font-[family-name:var(--font-mono)] text-[#FFB800] uppercase tracking-widest mb-4">
              Early Access
            </p>
            <h2 className="font-[family-name:var(--font-space)] font-bold text-4xl sm:text-5xl text-[#EAEAEC] tracking-tight mb-4">
              Join the{' '}
              <span className="text-[#FFB800]">First Wave</span>
            </h2>
            <p className="text-[#8A8A95] text-base leading-relaxed font-[family-name:var(--font-inter)] max-w-lg mx-auto">
              TripWire is invite-only. DM us to get a code, then enter it below to unlock the full trading interface.
            </p>
          </motion.div>

          {/* DM buttons */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.15, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-wrap items-center justify-center gap-3 mt-10"
          >
            <a
              href="https://warpcast.com/~/inbox/create/tripwire"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2.5 bg-[#111113] border border-[#222225] hover:border-[#A855F7]/50 text-[#EAEAEC] text-sm font-[family-name:var(--font-inter)] font-medium px-5 py-3 rounded-xl transition-all hover:bg-[#A855F7]/5 group"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4 text-[#A855F7]" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                <path d="M11.77.5h.46C18.73.5 23.5 5.27 23.5 11.77v.46C23.5 18.73 18.73 23.5 12.23 23.5h-.46C5.27 23.5.5 18.73.5 12.23v-.46C.5 5.27 5.27.5 11.77.5zm-2.4 6.5H5.5v2h1.25l2.5 8H5.5v2h13v-2h-3.75l2.5-8H18.5v-2h-3.87l-1.63 6-1.63-6H9.37z"/>
              </svg>
              DM on Warpcast
            </a>
            <a
              href="https://twitter.com/messages/compose?recipient_id=tripwire"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2.5 bg-[#111113] border border-[#222225] hover:border-[#EAEAEC]/20 text-[#EAEAEC] text-sm font-[family-name:var(--font-inter)] font-medium px-5 py-3 rounded-xl transition-all hover:bg-[#EAEAEC]/5 group"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
              DM on X
            </a>
          </motion.div>

          {/* Divider */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={inView ? { opacity: 1 } : {}}
            transition={{ delay: 0.25, duration: 0.6 }}
            className="flex items-center gap-4 my-10"
          >
            <div className="flex-1 h-px bg-[#222225]" />
            <span className="text-[11px] font-[family-name:var(--font-mono)] text-[#55555E] uppercase tracking-widest">
              Have a code?
            </span>
            <div className="flex-1 h-px bg-[#222225]" />
          </motion.div>

          {/* Code input */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.3, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="space-y-4"
          >
            <CodeInput
              onComplete={handleCode}
              disabled={status === 'loading' || status === 'success'}
            />

            <AnimatePresence mode="wait">
              {status === 'loading' && (
                <motion.p
                  key="loading"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="text-xs font-[family-name:var(--font-mono)] text-[#FFB800]"
                >
                  Verifying...
                </motion.p>
              )}
              {status === 'error' && (
                <motion.p
                  key="error"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="text-xs font-[family-name:var(--font-mono)] text-[#FF3B5C]"
                >
                  {errorMsg}
                </motion.p>
              )}
              {status === 'success' && (
                <motion.p
                  key="success"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="text-xs font-[family-name:var(--font-mono)] text-[#00FF88]"
                >
                  ✓ Code accepted — loading dashboard...
                </motion.p>
              )}
            </AnimatePresence>

            <p className="text-[11px] text-[#55555E] font-[family-name:var(--font-mono)]">
              6-character invite code · case insensitive
            </p>
          </motion.div>
        </div>
      </section>
    </>
  );
}
