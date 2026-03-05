'use client';

import { useQuery } from '@tanstack/react-query';
import { oracleClient } from '@/lib/api';
import { MarketCard } from '@/components/trading/MarketCard';
import { GlobalPulse } from '@/components/trading/GlobalPulse';

export default function MarketsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['topics'],
    queryFn: () => oracleClient.getTopics(),
    refetchInterval: 5 * 60 * 1000,
    staleTime: 2 * 60 * 1000,
  });

  const active   = data?.topics.filter(t => t.status === 'active')   ?? [];
  const inactive = data?.topics.filter(t => t.status === 'inactive') ?? [];

  return (
    <main className="max-w-7xl mx-auto px-4 py-8 space-y-10">
      {/* Page title */}
      <div>
        <h1 className="text-xl font-[family-name:var(--font-space)] font-bold text-[#EAEAEC]">
          Attention Markets
        </h1>
        <p className="text-sm font-[family-name:var(--font-inter)] text-[#55555E] mt-0.5">
          Ride narratives before anyone else · Powered by TripWire Oracle
        </p>
      </div>

      {/* Active market cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-40 bg-[#111113] border border-[#222225] rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {active.map(topic => (
            <MarketCard key={topic.name} topic={topic} />
          ))}
        </div>
      )}

      {/* Coming soon */}
      {inactive.length > 0 && (
        <div>
          <p className="text-xs font-[family-name:var(--font-mono)] text-[#2E2E33] uppercase tracking-widest mb-3">
            Coming Soon
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {inactive.map(topic => (
              <div
                key={topic.name}
                className="bg-[#0D0D0E] border border-[#1A1A1D] rounded-2xl px-4 py-3 flex items-center gap-3 opacity-40 cursor-not-allowed"
              >
                <div className="w-9 h-9 rounded-full bg-[#1A1A1D] flex items-center justify-center text-[11px] font-bold text-[#2E2E33]">
                  {topic.name.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-[family-name:var(--font-space)] font-bold text-[#2E2E33]">
                    {topic.name}
                  </p>
                  <p className="text-[10px] font-[family-name:var(--font-mono)] text-[#222225]">
                    Not tracking yet
                  </p>
                </div>
                <svg viewBox="0 0 12 12" className="w-3 h-3 fill-[#2E2E33] ml-auto">
                  <path d="M6 1a2.5 2.5 0 00-2.5 2.5V5H2.5A1.5 1.5 0 001 6.5v4A1.5 1.5 0 002.5 12h7A1.5 1.5 0 0011 10.5v-4A1.5 1.5 0 009.5 5H8.5V3.5A2.5 2.5 0 006 1zm1.5 4H4.5V3.5a1.5 1.5 0 013 0V5z"/>
                </svg>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Global trends feed */}
      <div className="max-w-sm">
        <GlobalPulse />
      </div>
    </main>
  );
}
