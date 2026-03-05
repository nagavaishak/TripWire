'use client';

import { useQuery } from '@tanstack/react-query';
import { oracleClient } from '@/lib/api';
import type { Narrative } from '@/lib/api';

function statusColor(status: Narrative['status']): string {
  switch (status) {
    case 'trending':  return '#FFB800';
    case 'emerging':  return '#00FF88';
    case 'fading':    return '#55555E';
    default:          return '#55555E';
  }
}

function statusDot(status: Narrative['status']) {
  const color = statusColor(status);
  const pulse = status === 'trending';
  return (
    <span className="relative flex h-1.5 w-1.5 shrink-0">
      {pulse && (
        <span
          className="absolute inline-flex h-full w-full rounded-full animate-ping opacity-60"
          style={{ background: color }}
        />
      )}
      <span className="relative inline-flex h-1.5 w-1.5 rounded-full" style={{ background: color }} />
    </span>
  );
}

function formatGrowth(growth: number): string {
  if (growth >= 1_000_000) return `${(growth / 1_000_000).toFixed(1)}M+ searches`;
  if (growth >= 1_000)     return `${(growth / 1_000).toFixed(0)}K+ searches`;
  if (growth >= 50_000)    return 'Breakout';
  return `+${growth.toLocaleString()}%`;
}

export function GlobalPulse() {
  const { data, isLoading } = useQuery({
    queryKey: ['narratives', 'global'],
    queryFn: () => oracleClient.getGlobalNarratives(),
    refetchInterval: 5 * 60 * 1000,
    staleTime: 2 * 60 * 1000,
  });

  const items = data?.narratives ?? [];

  return (
    <div className="bg-[#111113] border border-[#222225] rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-[family-name:var(--font-mono)] text-[#8A8A95] uppercase tracking-widest">
          Global Pulse
        </p>
        <span className="text-[10px] font-[family-name:var(--font-mono)] text-[#55555E]">
          US · Last 24h
        </span>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-4 bg-[#1A1A1D] rounded animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="text-xs text-[#55555E] font-[family-name:var(--font-mono)]">
          Scanning global trends…
        </p>
      ) : (
        <div className="space-y-2">
          {items.slice(0, 12).map((n, i) => (
            <div key={i} className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                {statusDot(n.status)}
                <span className="text-xs font-[family-name:var(--font-inter)] text-[#EAEAEC] truncate capitalize">
                  {n.keyword}
                </span>
              </div>
              <span
                className="text-[10px] font-[family-name:var(--font-mono)] shrink-0"
                style={{ color: statusColor(n.status) }}
              >
                {formatGrowth(n.growth)}
              </span>
            </div>
          ))}
        </div>
      )}

      <p className="text-[10px] font-[family-name:var(--font-mono)] text-[#55555E] pt-1 border-t border-[#222225]">
        Breakout topics auto-promote to tracked markets
      </p>
    </div>
  );
}
