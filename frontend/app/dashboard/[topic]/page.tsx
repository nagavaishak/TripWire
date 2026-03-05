'use client';

import { use, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { useQuery } from '@tanstack/react-query';
import { oracleClient } from '@/lib/api';
import { DoaChart } from '@/components/trading/DoaChart';
import { TAIBreakdown } from '@/components/trading/TAIBreakdown';
import { SourceBreakdown } from '@/components/trading/SourceBreakdown';
import { SignalFeed } from '@/components/trading/SignalFeed';
import { TradePanel } from '@/components/trading/TradePanel';
import { PositionsList } from '@/components/trading/PositionsList';

type Tab = 'signal' | 'sources' | 'overview';

export default function TopicDetailPage({ params }: { params: Promise<{ topic: string }> }) {
  const { topic: encodedTopic } = use(params);
  const topic = decodeURIComponent(encodedTopic);
  const router = useRouter();

  const { publicKey, connected } = useWallet();
  const { connection } = useConnection();
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [tab, setTab] = useState<Tab>('signal');

  useEffect(() => {
    if (!publicKey || !connected) { setWalletBalance(null); return; }
    const fetch = async () => {
      try {
        const bal = await connection.getBalance(publicKey);
        setWalletBalance(bal / 1e9);
      } catch { setWalletBalance(null); }
    };
    fetch();
    const id = setInterval(fetch, 30_000);
    return () => clearInterval(id);
  }, [publicKey, connected, connection]);

  const { data: topicData } = useQuery({
    queryKey: ['topic', topic],
    queryFn: () => oracleClient.getTopic(topic),
    refetchInterval: 5 * 60 * 1000,
    staleTime: 60 * 1000,
  });

  const { data: narrativeData } = useQuery({
    queryKey: ['narratives', topic],
    queryFn: () => oracleClient.getNarratives(topic) as Promise<{ topic: string; narratives: any[] }>,
    refetchInterval: 10 * 60 * 1000,
    staleTime: 5 * 60 * 1000,
  });

  const doa = topicData?.value ?? null;
  const currentDoaBps = topicData ? Math.round(topicData.value * 100) : 0;
  const doaColor = doa == null ? '#8A8A95' : doa >= 60 ? '#00FF88' : doa >= 30 ? '#FFB800' : '#FF3B5C';

  const narratives = narrativeData?.narratives ?? [];

  return (
    <main className="max-w-7xl mx-auto px-4 py-6">
      {/* Back button */}
      <button
        onClick={() => router.push('/dashboard')}
        className="flex items-center gap-1.5 text-xs font-[family-name:var(--font-mono)] text-[#55555E] hover:text-[#8A8A95] transition-colors mb-5"
      >
        <svg viewBox="0 0 16 16" className="w-3 h-3" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M10 3L5 8L10 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        All Markets
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">
        {/* ── Left ─────────────────────────────────────────────── */}
        <div className="space-y-4 min-w-0">
          {/* Topic header */}
          <div className="bg-[#111113] border border-[#222225] rounded-2xl px-5 py-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-xl font-[family-name:var(--font-space)] font-bold text-[#EAEAEC]">
                  {topic}
                </h1>
                <p className="text-xs font-[family-name:var(--font-mono)] text-[#55555E] mt-0.5 uppercase tracking-widest">
                  Trend Attention Index
                </p>
              </div>
              <div className="text-right shrink-0">
                <p
                  className="text-3xl font-[family-name:var(--font-mono)] font-bold tabular-nums leading-none"
                  style={{ color: doaColor }}
                >
                  {doa != null ? doa.toFixed(2) : '—'}
                </p>
                <div className="flex items-center justify-end gap-1.5 mt-1">
                  <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: doaColor }} />
                  <span className="text-[10px] font-[family-name:var(--font-mono)] text-[#55555E] uppercase tracking-widest">
                    Live Oracle
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Chart */}
          <DoaChart topic={topic} />

          {/* Tabs */}
          <div className="flex border-b border-[#222225]">
            {(['signal', 'sources', 'overview'] as Tab[]).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-2.5 text-sm font-[family-name:var(--font-inter)] capitalize transition-all border-b-2 -mb-px ${
                  tab === t
                    ? 'border-[#FFB800] text-[#EAEAEC] font-semibold'
                    : 'border-transparent text-[#55555E] hover:text-[#8A8A95]'
                }`}
              >
                {t === 'signal' ? 'Signal' : t === 'sources' ? 'Sources' : 'Overview'}
              </button>
            ))}
          </div>

          {/* Tab content */}
          {tab === 'signal' && <TAIBreakdown topic={topic} />}

          {tab === 'sources' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <SourceBreakdown topic={topic} />
              <SignalFeed topic={topic} />
            </div>
          )}

          {tab === 'overview' && (
            <div className="bg-[#111113] border border-[#222225] rounded-2xl p-5 space-y-5">
              <div>
                <h3 className="text-sm font-[family-name:var(--font-space)] font-bold text-[#EAEAEC] mb-2">
                  Index Info
                </h3>
                <p className="text-sm font-[family-name:var(--font-inter)] text-[#8A8A95] leading-relaxed">
                  This market tracks real-time attention around <strong className="text-[#EAEAEC]">{topic}</strong> across
                  YouTube, Google Trends, and Farcaster. TripWire Oracle aggregates engagement signals into a
                  single Degree of Attention (DoA) score that updates every 5 minutes on-chain.
                </p>
                <p className="text-sm font-[family-name:var(--font-inter)] text-[#8A8A95] leading-relaxed mt-3">
                  Traders can go Long if they expect attention to rise, or Short if they believe current levels
                  are unsustainable. Positions are settled against the oracle DoA score.
                </p>
              </div>

              <div className="border-t border-[#222225] pt-4 space-y-3">
                <h3 className="text-sm font-[family-name:var(--font-space)] font-bold text-[#EAEAEC]">
                  Stats
                </h3>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-[family-name:var(--font-mono)] text-[#55555E]">Current DoA</span>
                    <span className="text-xs font-[family-name:var(--font-mono)] font-bold tabular-nums" style={{ color: doaColor }}>
                      {doa != null ? doa.toFixed(2) : '—'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-[family-name:var(--font-mono)] text-[#55555E]">Oracle interval</span>
                    <span className="text-xs font-[family-name:var(--font-mono)] text-[#8A8A95]">5 minutes</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-[family-name:var(--font-mono)] text-[#55555E]">Sources</span>
                    <span className="text-xs font-[family-name:var(--font-mono)] text-[#8A8A95]">YouTube · Trends · Farcaster</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-[family-name:var(--font-mono)] text-[#55555E]">Network</span>
                    <span className="text-xs font-[family-name:var(--font-mono)] text-[#8A8A95]">Solana Devnet</span>
                  </div>
                </div>
              </div>

              {narratives.length > 0 && (
                <div className="border-t border-[#222225] pt-4">
                  <h3 className="text-sm font-[family-name:var(--font-space)] font-bold text-[#EAEAEC] mb-3">
                    Rising Narratives
                  </h3>
                  <div className="space-y-2">
                    {narratives.slice(0, 8).map((n: any, i: number) => (
                      <div key={i} className="flex items-center justify-between">
                        <span className="text-xs font-[family-name:var(--font-inter)] text-[#8A8A95] capitalize truncate max-w-[200px]">
                          {n.keyword}
                        </span>
                        <span className="text-[10px] font-[family-name:var(--font-mono)] text-[#00FF88] shrink-0">
                          {n.growth >= 50_000 ? 'Breakout' : `+${n.growth.toLocaleString()}%`}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Right (sticky trade panel) ───────────────────────── */}
        <div className="space-y-4">
          <div className="lg:sticky lg:top-[72px] space-y-4">
            <TradePanel
              topic={topic}
              currentDoaBps={currentDoaBps}
              walletBalance={walletBalance}
            />
            <PositionsList
              topic={topic}
              currentDoaBps={currentDoaBps}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
