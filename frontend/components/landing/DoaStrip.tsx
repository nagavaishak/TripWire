'use client';

import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { oracleClient } from '@/lib/api';

const TOPICS = ['Solana', 'AI'];

function DoaItem({ topic }: { topic: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['topic', topic],
    queryFn: () => oracleClient.getTopic(topic),
    refetchInterval: 5 * 60 * 1000,
    staleTime: 60 * 1000,
  });

  const val = data?.value ?? null;
  const color = val == null ? '#8A8A95' : val >= 60 ? '#00FF88' : val >= 30 ? '#FFB800' : '#FF3B5C';

  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] font-[family-name:var(--font-mono)] text-[#8A8A95] uppercase tracking-widest">
        {topic}
      </span>
      <span className="text-[11px] font-[family-name:var(--font-mono)] font-bold" style={{ color }}>
        {isLoading ? '—' : val != null ? val.toFixed(1) : '—'}
      </span>
      <span className="text-[10px] font-[family-name:var(--font-mono)] text-[#55555E]">DoA</span>
    </div>
  );
}

export function DoaStrip() {
  return (
    <div className="flex items-center gap-6 border border-[#222225] bg-[#111113] rounded-lg px-4 py-2">
      <span className="text-[10px] font-[family-name:var(--font-mono)] text-[#FFB800] uppercase tracking-widest animate-pulse">
        ● Live
      </span>
      {TOPICS.map((t) => (
        <DoaItem key={t} topic={t} />
      ))}
      <span className="text-[10px] font-[family-name:var(--font-mono)] text-[#55555E]">
        5m refresh
      </span>
    </div>
  );
}
