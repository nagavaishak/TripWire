'use client';

import { useQuery } from '@tanstack/react-query';
import { oracleClient } from '@/lib/api';

interface SourceBreakdownProps {
  topic: string;
}

const SOURCES = [
  { key: 'youtube' as const, label: 'YouTube', color: '#FF3B5C', icon: '📹' },
  { key: 'google_trends' as const, label: 'Google Trends', color: '#3B82F6', icon: '🔍' },
  { key: 'farcaster' as const, label: 'Farcaster', color: '#A855F7', icon: '💬' },
];

export function SourceBreakdown({ topic }: SourceBreakdownProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['topic', topic],
    queryFn: () => oracleClient.getTopic(topic),
    refetchInterval: 5 * 60 * 1000,
    staleTime: 60 * 1000,
  });

  const { data: history } = useQuery({
    queryKey: ['history', topic, 1],
    queryFn: () => oracleClient.getHistory(topic, 1),
    refetchInterval: 5 * 60 * 1000,
    staleTime: 60 * 1000,
  });

  // Use actual component values from most recent history point
  const latestComponents = history?.data?.length
    ? history.data[history.data.length - 1].components
    : null;
  const prevComponents = (history?.data?.length ?? 0) > 1
    ? history!.data![history!.data!.length - 2].components
    : null;

  return (
    <div className="bg-[#111113] border border-[#222225] rounded-2xl p-4">
      <p className="text-xs font-[family-name:var(--font-mono)] text-[#8A8A95] uppercase tracking-widest mb-4">
        Source Breakdown
      </p>

      <div className="space-y-4">
        {SOURCES.map(({ key, label, color, icon }) => {
          const rawVal = latestComponents?.[key] ?? data?.weights[key] ?? 0;
          const pct = Math.round(rawVal * 100);
          const prevVal = prevComponents?.[key] ?? null;
          const delta = prevVal != null ? rawVal - prevVal : null;
          const deltaUp = delta != null && delta >= 0;

          return (
            <div key={key} className="space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-base leading-none">{icon}</span>
                  <span className="text-xs font-[family-name:var(--font-inter)] text-[#8A8A95]">{label}</span>
                </div>
                <div className="flex items-center gap-2">
                  {delta !== null && Math.abs(delta) > 0.001 && (
                    <span
                      className="text-[10px] font-[family-name:var(--font-mono)]"
                      style={{ color: deltaUp ? '#00FF88' : '#FF3B5C' }}
                    >
                      {deltaUp ? '↑' : '↓'} {(Math.abs(delta) * 100).toFixed(0)}%
                    </span>
                  )}
                  <span className="text-xs font-[family-name:var(--font-mono)] font-bold tabular-nums" style={{ color }}>
                    {isLoading ? '—' : `${pct}%`}
                  </span>
                </div>
              </div>
              <div className="h-1.5 bg-[#222225] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: isLoading ? '0%' : `${pct}%`, background: color }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-[10px] font-[family-name:var(--font-mono)] text-[#55555E] mt-4">
        Configured weights: YT 30% · Trends 35% · Farcaster 35%
      </p>
    </div>
  );
}
