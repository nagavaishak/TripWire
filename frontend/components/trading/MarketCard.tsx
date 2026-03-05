'use client';

import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { oracleClient } from '@/lib/api';
import type { TopicMeta } from '@/lib/api';

// ── Mini sparkline ─────────────────────────────────────────────
function Sparkline({ points, slug, isUp }: { points: number[]; slug: string; isUp: boolean }) {
  if (points.length < 2) {
    return <div className="h-[72px] w-full" />;
  }

  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;

  const W = 400;
  const H = 72;
  const pad = 2;

  const xs = points.map((_, i) => pad + (i / (points.length - 1)) * (W - pad * 2));
  const ys = points.map(v => H - pad - ((v - min) / range) * (H - pad * 2));

  const linePath = xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L${xs[xs.length - 1].toFixed(1)},${H} L${xs[0].toFixed(1)},${H} Z`;

  const color = isUp ? '#00FF88' : '#FF3B5C';
  const gradId = `spark-${slug}`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-[72px]" preserveAspectRatio="none">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradId})`} />
      <path d={linePath} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── Topic icon colors ──────────────────────────────────────────
const ICON_COLORS: Record<string, string> = {
  Solana:    '#9945FF',
  AI:        '#00D4FF',
  Bitcoin:   '#F7931A',
  Ethereum:  '#627EEA',
  Memecoins: '#FF6B9D',
};

function TopicIcon({ name }: { name: string }) {
  const bg = ICON_COLORS[name] ?? '#FFB800';
  const initials = name.length <= 2 ? name.toUpperCase() : name.slice(0, 2).toUpperCase();
  return (
    <div
      className="w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0"
      style={{ background: bg }}
    >
      {initials}
    </div>
  );
}

// ── MarketCard ─────────────────────────────────────────────────
export function MarketCard({ topic }: { topic: TopicMeta }) {
  const router = useRouter();

  const { data: history } = useQuery({
    queryKey: ['history', topic.name, 24],
    queryFn: () => oracleClient.getHistory(topic.name, 24),
    refetchInterval: 5 * 60 * 1000,
    staleTime: 60 * 1000,
    enabled: topic.status === 'active',
  });

  const points = history?.data.map(p => p.value) ?? [];
  const change = points.length >= 2 ? points[points.length - 1] - points[0] : null;
  const isUp   = change == null ? true : change >= 0;
  const pct    = change != null && points[0] > 0 ? (change / points[0]) * 100 : null;

  const doa   = topic.doa;
  const score = doa != null ? doa.toFixed(2) : '—';
  const scoreColor = doa == null ? '#8A8A95' : doa >= 60 ? '#00FF88' : doa >= 30 ? '#FFB800' : '#FF3B5C';

  return (
    <button
      onClick={() => router.push(`/dashboard/${encodeURIComponent(topic.name)}`)}
      className="bg-[#111113] border border-[#222225] rounded-2xl overflow-hidden text-left hover:border-[#2E2E33] hover:bg-[#131315] active:scale-[0.99] transition-all group w-full"
    >
      {/* Header row */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <TopicIcon name={topic.name} />
          <div className="min-w-0">
            <p className="text-sm font-[family-name:var(--font-space)] font-bold text-[#EAEAEC] truncate">
              {topic.name}
            </p>
          </div>
        </div>

        <div className="text-right shrink-0 ml-2">
          <p
            className="text-xl font-[family-name:var(--font-mono)] font-bold tabular-nums leading-none"
            style={{ color: scoreColor }}
          >
            {score}
          </p>
          {pct != null && (
            <p
              className="text-xs font-[family-name:var(--font-mono)] mt-0.5"
              style={{ color: isUp ? '#00FF88' : '#FF3B5C' }}
            >
              {isUp ? '+' : ''}{pct.toFixed(1)}%
            </p>
          )}
        </div>
      </div>

      {/* Sparkline — flush to card edges */}
      <Sparkline points={points} slug={topic.slug} isUp={isUp} />
    </button>
  );
}
