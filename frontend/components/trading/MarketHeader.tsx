'use client';

import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { oracleClient } from '@/lib/api';
import { CountdownTimer } from './CountdownTimer';

interface MarketHeaderProps {
  selectedTopic: string;
  onSelectTopic: (topic: string) => void;
}

export function MarketHeader({ selectedTopic, onSelectTopic }: MarketHeaderProps) {
  const { data: topicsData } = useQuery({
    queryKey: ['topics'],
    queryFn: () => oracleClient.getTopics(),
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });

  // Fall back to Solana+AI while loading
  const markets = topicsData?.topics ?? [
    { name: 'Solana', status: 'active' as const },
    { name: 'AI',     status: 'active' as const },
  ];

  const { data } = useQuery({
    queryKey: ['topic', selectedTopic],
    queryFn: () => oracleClient.getTopic(selectedTopic),
    refetchInterval: 5 * 60 * 1000,
    staleTime: 60 * 1000,
  });

  const { data: history1h } = useQuery({
    queryKey: ['history', selectedTopic, 1],
    queryFn: () => oracleClient.getHistory(selectedTopic, 1),
    refetchInterval: 5 * 60 * 1000,
    staleTime: 60 * 1000,
  });

  const doa = data?.value ?? null;
  const color = doa == null ? '#8A8A95' : doa >= 60 ? '#00FF88' : doa >= 30 ? '#FFB800' : '#FF3B5C';

  // 1h trend from history
  const points = history1h?.data ?? [];
  const trend =
    points.length >= 2
      ? points[points.length - 1].value - points[0].value
      : null;
  const trendUp = trend != null && trend >= 0;

  return (
    <div className="space-y-4">
      {/* Topic tabs + countdown */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          {markets.map(({ name, status }) => {
            const enabled = status === 'active';
            return (
              <button
                key={name}
                disabled={!enabled}
                onClick={() => enabled && onSelectTopic(name)}
                className={`inline-flex items-center gap-1.5 text-sm font-[family-name:var(--font-space)] font-semibold px-3.5 py-1.5 rounded-lg border transition-all ${
                  selectedTopic === name && enabled
                    ? 'bg-[#FFB800]/10 border-[#FFB800]/30 text-[#FFB800]'
                    : enabled
                    ? 'bg-transparent border-[#222225] text-[#8A8A95] hover:border-[#2E2E33] hover:text-[#EAEAEC]'
                    : 'bg-transparent border-[#1A1A1D] text-[#55555E] cursor-not-allowed opacity-50'
                }`}
              >
                {name}
                {!enabled && (
                  <svg viewBox="0 0 12 12" className="w-3 h-3 fill-current" xmlns="http://www.w3.org/2000/svg">
                    <path d="M6 1a2.5 2.5 0 00-2.5 2.5V5H2.5A1.5 1.5 0 001 6.5v4A1.5 1.5 0 002.5 12h7A1.5 1.5 0 0011 10.5v-4A1.5 1.5 0 009.5 5H8.5V3.5A2.5 2.5 0 006 1zm1.5 4H4.5V3.5a1.5 1.5 0 013 0V5z"/>
                  </svg>
                )}
                {selectedTopic === name && enabled && (
                  <span className="w-1.5 h-1.5 rounded-full bg-[#FFB800] animate-pulse" />
                )}
              </button>
            );
          })}
        </div>
        <CountdownTimer lastUpdateTimestamp={data?.timestamp} />
      </div>

      {/* Big DoA display */}
      <div className="flex items-end gap-6 flex-wrap">
        <div>
          <AnimatePresence mode="wait">
            <motion.div
              key={doa?.toFixed(1)}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3 }}
              className="font-[family-name:var(--font-mono)] font-bold leading-none tabular-nums"
              style={{
                fontSize: 'clamp(56px, 8vw, 88px)',
                color,
                textShadow: `0 0 40px ${color}40`,
              }}
            >
              {doa != null ? doa.toFixed(1) : '—'}
            </motion.div>
          </AnimatePresence>
          <p className="text-[11px] font-[family-name:var(--font-mono)] text-[#55555E] uppercase tracking-widest mt-1">
            Degree of Attention
          </p>
        </div>

        {/* Trend badge */}
        {trend !== null && (
          <div className={`flex flex-col mb-2 ${trendUp ? 'text-[#00FF88]' : 'text-[#FF3B5C]'}`}>
            <span className="font-[family-name:var(--font-mono)] font-bold text-2xl leading-none">
              {trendUp ? '↑' : '↓'} {Math.abs(trend).toFixed(1)}
            </span>
            <span className="text-[11px] font-[family-name:var(--font-mono)] opacity-70 mt-0.5">
              (1h change)
            </span>
          </div>
        )}

        {/* DoA label */}
        <div className="mb-2 ml-auto text-right">
          <div
            className="inline-flex items-center gap-1.5 border rounded-lg px-2.5 py-1"
            style={{ borderColor: `${color}30`, background: `${color}10`, color }}
          >
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: color }} />
            <span className="text-[11px] font-[family-name:var(--font-mono)] uppercase tracking-widest">
              Live Oracle
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
