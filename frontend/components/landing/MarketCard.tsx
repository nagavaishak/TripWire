'use client';

import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { oracleClient } from '@/lib/api';

interface MarketCardProps {
  topic: string;
  locked?: boolean;
  index: number;
}

export function MarketCard({ topic, locked = false, index }: MarketCardProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['topic', topic],
    queryFn: () => oracleClient.getTopic(topic),
    refetchInterval: 5 * 60 * 1000,
    staleTime: 60 * 1000,
    enabled: !locked,
  });

  const val = data?.value ?? null;
  const color = val == null ? '#8A8A95' : val >= 60 ? '#00FF88' : val >= 30 ? '#FFB800' : '#FF3B5C';
  const trend = val != null && val >= 50 ? 'up' : 'down';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ delay: index * 0.1, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className={`relative bg-[#111113] border rounded-2xl overflow-hidden transition-all duration-200 ${
        locked
          ? 'border-[#222225] opacity-50 cursor-not-allowed'
          : 'border-[#222225] hover:border-[#2E2E33] cursor-pointer group'
      }`}
    >
      {/* Top accent line */}
      {!locked && (
        <div
          className="absolute top-0 inset-x-0 h-px"
          style={{ background: `linear-gradient(90deg, transparent, ${color}60, transparent)` }}
        />
      )}

      <div className="p-5">
        {/* Header row */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="font-[family-name:var(--font-space)] font-bold text-base text-[#EAEAEC]">{topic}</p>
            <p className="text-[11px] font-[family-name:var(--font-mono)] text-[#55555E] mt-0.5">
              Attention Market
            </p>
          </div>
          {locked ? (
            <div className="flex items-center gap-1.5 bg-[#222225] border border-[#2E2E33] rounded-lg px-3 py-1.5">
              <svg viewBox="0 0 16 16" className="w-3.5 h-3.5 text-[#55555E]" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                <path d="M8 1a3.5 3.5 0 00-3.5 3.5V6h-.75A1.75 1.75 0 002 7.75v5.5C2 14.216 2.784 15 3.75 15h8.5A1.75 1.75 0 0014 13.25v-5.5A1.75 1.75 0 0012.25 6H11.5V4.5A3.5 3.5 0 008 1zm2.5 5V4.5a2.5 2.5 0 00-5 0V6h5z"/>
              </svg>
              <span className="text-[11px] font-[family-name:var(--font-mono)] text-[#55555E]">Locked</span>
            </div>
          ) : (
            <span
              className="text-[11px] font-[family-name:var(--font-mono)] border px-2 py-1 rounded-md"
              style={{ color, borderColor: `${color}30`, background: `${color}10` }}
            >
              ● Live
            </span>
          )}
        </div>

        {/* Score display */}
        {!locked ? (
          <div className="mb-4">
            {isLoading ? (
              <div className="h-10 w-24 bg-[#222225] rounded-lg animate-pulse" />
            ) : (
              <div className="flex items-end gap-2">
                <span
                  className="font-[family-name:var(--font-mono)] font-bold text-4xl leading-none tabular-nums"
                  style={{ color }}
                >
                  {val?.toFixed(1) ?? '—'}
                </span>
                <span className="text-sm text-[#55555E] font-[family-name:var(--font-mono)] mb-1">/ 100</span>
              </div>
            )}
            <div className="mt-2 h-1 bg-[#222225] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${val ?? 0}%`, background: color }}
              />
            </div>
          </div>
        ) : (
          <div className="mb-4">
            <div className="h-10 w-24 bg-[#222225]/50 rounded-lg" />
            <div className="mt-2 h-1 bg-[#222225]/50 rounded-full" />
          </div>
        )}

        {/* Position buttons */}
        <div className="grid grid-cols-2 gap-2">
          <button
            disabled={locked}
            className={`py-2 rounded-lg text-xs font-[family-name:var(--font-space)] font-semibold transition-all ${
              locked
                ? 'bg-[#1A1A1D] text-[#55555E] cursor-not-allowed'
                : 'bg-[#00FF88]/10 border border-[#00FF88]/25 text-[#00FF88] hover:bg-[#00FF88]/15 active:scale-95'
            }`}
          >
            ↑ Long
          </button>
          <button
            disabled={locked}
            className={`py-2 rounded-lg text-xs font-[family-name:var(--font-space)] font-semibold transition-all ${
              locked
                ? 'bg-[#1A1A1D] text-[#55555E] cursor-not-allowed'
                : 'bg-[#FF3B5C]/10 border border-[#FF3B5C]/25 text-[#FF3B5C] hover:bg-[#FF3B5C]/15 active:scale-95'
            }`}
          >
            ↓ Short
          </button>
        </div>

        {/* P&L formula hint */}
        {!locked && (
          <p className="text-[10px] font-[family-name:var(--font-mono)] text-[#55555E] mt-3 text-center">
            Long payout = stake × (current / entry)
          </p>
        )}

        {locked && (
          <p className="text-[10px] font-[family-name:var(--font-mono)] text-[#55555E] mt-3 text-center">
            Request access to trade
          </p>
        )}
      </div>
    </motion.div>
  );
}
