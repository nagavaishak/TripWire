'use client';

import { useQuery } from '@tanstack/react-query';
import { oracleClient } from '@/lib/api';
import type { TAIBreakdown as TAIBreakdownData, Narrative } from '@/lib/api';

interface TAIBreakdownProps {
  topic: string;
}

interface SignalBarProps {
  label: string;
  value: number;       // 0-1
  color: string;
  isBidirectional?: boolean; // if true, 0.5=neutral, color shifts by direction
  weight: string;
}

function SignalBar({ label, value, color, isBidirectional, weight }: SignalBarProps) {
  const pct = Math.round(value * 100);

  // For momentum/velocity: determine direction color
  let barColor = color;
  let dirLabel = '';
  if (isBidirectional) {
    if (value > 0.6) { barColor = '#00FF88'; dirLabel = '↑'; }
    else if (value < 0.4) { barColor = '#FF3B5C'; dirLabel = '↓'; }
    else { barColor = '#55555E'; dirLabel = '—'; }
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-[family-name:var(--font-inter)] text-[#8A8A95] w-20">{label}</span>
          <span className="text-[10px] font-[family-name:var(--font-mono)] text-[#55555E]">{weight}</span>
        </div>
        <div className="flex items-center gap-1.5">
          {isBidirectional && (
            <span
              className="text-[10px] font-[family-name:var(--font-mono)]"
              style={{ color: barColor }}
            >
              {dirLabel}
            </span>
          )}
          <span
            className="text-xs font-[family-name:var(--font-mono)] font-bold tabular-nums w-8 text-right"
            style={{ color: barColor }}
          >
            {pct}%
          </span>
        </div>
      </div>
      <div className="h-1.5 bg-[#222225] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: barColor }}
        />
      </div>
    </div>
  );
}

export function TAIBreakdown({ topic }: TAIBreakdownProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['topic', topic],
    queryFn:  () => oracleClient.getTopic(topic),
    refetchInterval: 5 * 60 * 1000,
    staleTime: 60 * 1000,
  });

  const { data: narrativeData } = useQuery({
    queryKey: ['narratives', topic],
    queryFn:  () => oracleClient.getNarratives(topic) as Promise<{ topic: string; narratives: Narrative[] }>,
    refetchInterval: 10 * 60 * 1000,
    staleTime: 5 * 60 * 1000,
  });

  const tai: TAIBreakdownData | null = data?.tai ?? null;
  const narratives = narrativeData?.narratives?.slice(0, 5) ?? [];

  const taiScore = tai ? Math.round(tai.score * 100) : null;

  return (
    <div className="bg-[#111113] border border-[#222225] rounded-2xl p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-[family-name:var(--font-mono)] text-[#8A8A95] uppercase tracking-widest">
          Signal Breakdown
        </p>
        {taiScore !== null ? (
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-[family-name:var(--font-mono)] text-[#55555E] uppercase tracking-wider">TAI</span>
            <span
              className="text-sm font-[family-name:var(--font-mono)] font-bold tabular-nums"
              style={{ color: taiScore >= 60 ? '#00FF88' : taiScore <= 40 ? '#FF3B5C' : '#FFB800' }}
            >
              {taiScore}
            </span>
          </div>
        ) : (
          <span className="text-[10px] font-[family-name:var(--font-mono)] text-[#55555E]">TAI v2</span>
        )}
      </div>

      {/* Signal bars */}
      {isLoading || !tai ? (
        <div className="space-y-4">
          {['Level', 'Momentum', 'Velocity', 'Consensus'].map(label => (
            <div key={label} className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-[#8A8A95]">{label}</span>
                <span className="text-xs text-[#55555E]">—</span>
              </div>
              <div className="h-1.5 bg-[#222225] rounded-full" />
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          <SignalBar label="Level"     value={tai.level}     color="#FFB800" weight="45%" />
          <SignalBar label="Momentum"  value={tai.momentum}  color="#00FF88" weight="30%" isBidirectional />
          <SignalBar label="Velocity"  value={tai.velocity}  color="#3B82F6" weight="15%" isBidirectional />
          <SignalBar label="Consensus" value={tai.consensus} color="#A855F7" weight="10%" />
        </div>
      )}

      {/* Formula legend */}
      <p className="text-[10px] font-[family-name:var(--font-mono)] text-[#55555E]">
        TAI = 0.45×Level + 0.30×Momentum + 0.15×Velocity + 0.10×Consensus
      </p>

      {/* Narratives */}
      {narratives.length > 0 && (
        <>
          <div className="border-t border-[#222225] pt-4">
            <p className="text-[10px] font-[family-name:var(--font-mono)] text-[#8A8A95] uppercase tracking-widest mb-3">
              Emerging Narratives
            </p>
            <div className="space-y-2">
              {narratives.map((n, i) => (
                <div key={i} className="flex items-center justify-between">
                  <span className="text-xs font-[family-name:var(--font-inter)] text-[#EAEAEC] truncate max-w-[160px]">
                    {n.keyword}
                  </span>
                  <span className="text-[10px] font-[family-name:var(--font-mono)] text-[#00FF88] shrink-0">
                    {n.growth >= 50000 ? 'Breakout' : `+${n.growth.toLocaleString()}%`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
