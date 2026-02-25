'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ComposedChart,
} from 'recharts';
import { oracleClient } from '@/lib/api';

const HOUR_OPTIONS = [1, 6, 24, 48] as const;

interface DoaChartProps {
  topic: string;
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  return (
    <div className="bg-[#111113] border border-[#222225] rounded-xl p-3 text-xs font-[family-name:var(--font-mono)] shadow-xl">
      <p className="text-[#55555E] mb-2">{d.timeLabel}</p>
      <p className="text-[#FFB800] font-bold mb-1">DoA: {d.doa?.toFixed(1)}</p>
      <p className="text-[#FF3B5C]">YouTube: {(d.youtube * 100).toFixed(0)}%</p>
      <p className="text-[#3B82F6]">Trends: {(d.trends * 100).toFixed(0)}%</p>
      <p className="text-[#A855F7]">Farcaster: {(d.farcaster * 100).toFixed(0)}%</p>
    </div>
  );
}

export function DoaChart({ topic }: DoaChartProps) {
  const [hours, setHours] = useState<number>(24);

  const { data, isLoading } = useQuery({
    queryKey: ['history', topic, hours],
    queryFn: () => oracleClient.getHistory(topic, hours),
    refetchInterval: 5 * 60 * 1000,
    staleTime: 60 * 1000,
  });

  const chartData = (data?.data ?? []).map((p) => {
    const date = new Date(p.time * 1000);
    const timeLabel =
      hours <= 6
        ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : date.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    return {
      time: p.time,
      timeLabel,
      doa: p.value,
      youtube: p.components.youtube,
      trends: p.components.google_trends,
      farcaster: p.components.farcaster,
    };
  });

  return (
    <div className="bg-[#111113] border border-[#222225] rounded-2xl p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs font-[family-name:var(--font-mono)] text-[#8A8A95] uppercase tracking-widest">
          DoA History
        </p>
        <div className="flex gap-1">
          {HOUR_OPTIONS.map((h) => (
            <button
              key={h}
              onClick={() => setHours(h)}
              className={`px-2.5 py-1 text-[11px] font-[family-name:var(--font-mono)] rounded-lg transition-all ${
                hours === h
                  ? 'bg-[#FFB800]/10 border border-[#FFB800]/30 text-[#FFB800]'
                  : 'text-[#55555E] hover:text-[#8A8A95]'
              }`}
            >
              {h}h
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      {isLoading ? (
        <div className="h-48 bg-[#18181B] rounded-xl animate-pulse" />
      ) : chartData.length < 2 ? (
        <div className="h-48 flex items-center justify-center text-[#55555E] text-sm font-[family-name:var(--font-mono)]">
          Not enough data yet — check back after a few oracle updates
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={192}>
          <ComposedChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
            <CartesianGrid stroke="#222225" strokeDasharray="0" vertical={false} />
            <XAxis
              dataKey="time"
              tickFormatter={(t) => {
                const d = new Date(t * 1000);
                return hours <= 6
                  ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  : d.toLocaleDateString([], { month: 'short', day: 'numeric' });
              }}
              tick={{ fill: '#55555E', fontSize: 10, fontFamily: 'var(--font-mono)' }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fill: '#55555E', fontSize: 10, fontFamily: 'var(--font-mono)' }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<CustomTooltip />} />

            {/* Source contribution areas */}
            <Area
              type="monotone"
              dataKey="youtube"
              stackId="sources"
              stroke="none"
              fill="#FF3B5C"
              fillOpacity={0.12}
            />
            <Area
              type="monotone"
              dataKey="trends"
              stackId="sources"
              stroke="none"
              fill="#3B82F6"
              fillOpacity={0.12}
            />
            <Area
              type="monotone"
              dataKey="farcaster"
              stackId="sources"
              stroke="none"
              fill="#A855F7"
              fillOpacity={0.12}
            />

            {/* DoA composite line on top */}
            <Line
              type="monotone"
              dataKey="doa"
              stroke="#FFB800"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: '#FFB800', stroke: '#0A0A0B', strokeWidth: 2 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      )}

      {/* Legend */}
      <div className="flex items-center gap-4 mt-3 flex-wrap">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-0.5 bg-[#FFB800]" />
          <span className="text-[10px] font-[family-name:var(--font-mono)] text-[#55555E]">DoA Score</span>
        </div>
        {[
          { color: '#FF3B5C', label: 'YouTube' },
          { color: '#3B82F6', label: 'Trends' },
          { color: '#A855F7', label: 'Farcaster' },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <div className="w-3 h-2 rounded-sm opacity-60" style={{ background: color }} />
            <span className="text-[10px] font-[family-name:var(--font-mono)] text-[#55555E]">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
