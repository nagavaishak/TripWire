'use client';

import { useQuery } from '@tanstack/react-query';
import { oracleClient } from '@/lib/api';

interface SignalFeedProps {
  topic: string;
}

function signalLabel(key: string, value: number): string {
  const pct = Math.round(value * 100);
  if (key === 'youtube') {
    if (pct >= 40) return `View velocity high — ${pct}% contribution`;
    if (pct >= 20) return `View velocity moderate — ${pct}% contribution`;
    return `View velocity low — ${pct}% contribution`;
  }
  if (key === 'google_trends') {
    return `Search interest: ${pct}/100`;
  }
  if (key === 'farcaster') {
    return `${Math.round(pct * 3.4)} casts mentioning topic (est.)`;
  }
  return `${pct}%`;
}

const SOURCE_META = [
  { key: 'youtube', label: 'YouTube', icon: '📹', color: '#FF3B5C' },
  { key: 'google_trends', label: 'Google Trends', icon: '🔍', color: '#3B82F6' },
  { key: 'farcaster', label: 'Farcaster', icon: '💬', color: '#A855F7' },
];

export function SignalFeed({ topic }: SignalFeedProps) {
  const { data: history } = useQuery({
    queryKey: ['history', topic, 1],
    queryFn: () => oracleClient.getHistory(topic, 1),
    refetchInterval: 5 * 60 * 1000,
    staleTime: 60 * 1000,
  });

  const { data: current } = useQuery({
    queryKey: ['topic', topic],
    queryFn: () => oracleClient.getTopic(topic),
    refetchInterval: 5 * 60 * 1000,
    staleTime: 60 * 1000,
  });

  const latestComponents = history?.data?.length
    ? history.data[history.data.length - 1].components
    : null;

  const ageMinutes = current?.timestamp
    ? Math.round((Date.now() / 1000 - current.timestamp) / 60)
    : null;

  return (
    <div className="bg-[#111113] border border-[#222225] rounded-2xl p-4">
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs font-[family-name:var(--font-mono)] text-[#8A8A95] uppercase tracking-widest">
          What's Driving Attention
        </p>
        {ageMinutes !== null && (
          <span className="text-[10px] font-[family-name:var(--font-mono)] text-[#55555E]">
            {ageMinutes <= 1 ? 'just now' : `${ageMinutes}m ago`}
          </span>
        )}
      </div>

      <div className="space-y-3">
        {SOURCE_META.map(({ key, label, icon, color }) => {
          const val = latestComponents?.[key as keyof typeof latestComponents] ?? current?.weights[key as keyof typeof current.weights] ?? 0;
          const signal = signalLabel(key, val);
          const intensity = Math.round(val * 100);

          return (
            <div key={key} className="flex items-start gap-3">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center text-base shrink-0 mt-0.5"
                style={{ background: `${color}15` }}
              >
                {icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-[family-name:var(--font-inter)] font-medium text-[#EAEAEC]">
                    {label}
                  </span>
                  <span
                    className="text-[10px] font-[family-name:var(--font-mono)] shrink-0 px-1.5 py-0.5 rounded"
                    style={{ color, background: `${color}15` }}
                  >
                    {intensity}%
                  </span>
                </div>
                <p className="text-[11px] text-[#55555E] font-[family-name:var(--font-mono)] mt-0.5 truncate">
                  {signal}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 pt-3 border-t border-[#1A1A1D]">
        <p className="text-[10px] font-[family-name:var(--font-mono)] text-[#55555E]">
          Oracle computes DoA every 5 minutes using time-decay weighting.
          Longer-ago signals count less.
        </p>
      </div>
    </div>
  );
}
