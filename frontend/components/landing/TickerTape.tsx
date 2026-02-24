'use client';

import { useEffect, useRef } from 'react';

const ITEMS = [
  { label: 'Solana DoA', value: '—', id: 'solana-doa' },
  { label: 'AI DoA', value: '—', id: 'ai-doa' },
  { label: 'Oracle', value: 'LIVE', id: 'oracle' },
  { label: 'Sources', value: 'YT · GTrends · Farcaster', id: 'sources' },
  { label: 'Update', value: '5m', id: 'update' },
  { label: 'Chain', value: 'Solana Devnet', id: 'chain' },
  { label: 'Program', value: '35mr61j...', id: 'program' },
  { label: 'Positions', value: 'Long / Short', id: 'positions' },
  { label: 'P&L model', value: 'Trendle', id: 'pnl' },
];

export function TickerTape() {
  // Duplicate items for seamless loop
  const all = [...ITEMS, ...ITEMS, ...ITEMS];

  return (
    <div className="relative overflow-hidden border-y border-[#222225] bg-[#0A0A0B]/60 py-2.5">
      <div
        className="flex gap-12 whitespace-nowrap"
        style={{
          animation: 'ticker-scroll 28s linear infinite',
          width: 'max-content',
        }}
      >
        {all.map((item, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-2 text-[11px] font-[family-name:var(--font-mono)] shrink-0"
          >
            <span className="text-[#55555E] uppercase tracking-widest">{item.label}</span>
            <span className="text-[#FFB800]">/</span>
            <span className="text-[#EAEAEC]">{item.value}</span>
          </span>
        ))}
      </div>

      {/* Fade edges */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-[#0A0A0B] to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-[#0A0A0B] to-transparent" />

      <style>{`
        @keyframes ticker-scroll {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-33.333%); }
        }
      `}</style>
    </div>
  );
}
