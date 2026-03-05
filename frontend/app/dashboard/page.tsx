'use client';

import { useState } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { useQuery } from '@tanstack/react-query';
import { oracleClient } from '@/lib/api';
import { MarketHeader } from '@/components/trading/MarketHeader';
import { DoaChart } from '@/components/trading/DoaChart';
import { TAIBreakdown } from '@/components/trading/TAIBreakdown';
import { SourceBreakdown } from '@/components/trading/SourceBreakdown';
import { SignalFeed } from '@/components/trading/SignalFeed';
import { TradePanel } from '@/components/trading/TradePanel';
import { PositionsList } from '@/components/trading/PositionsList';
import { useEffect } from 'react';

export default function TradePage() {
  const [selectedTopic, setSelectedTopic] = useState('Solana');
  const { publicKey, connected } = useWallet();
  const { connection } = useConnection();
  const [walletBalance, setWalletBalance] = useState<number | null>(null);

  // Fetch wallet balance
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

  // Current topic score for DoA bps
  const { data: topicData } = useQuery({
    queryKey: ['topic', selectedTopic],
    queryFn: () => oracleClient.getTopic(selectedTopic),
    refetchInterval: 5 * 60 * 1000,
    staleTime: 60 * 1000,
  });

  // Convert float DoA (0-100) to bps (0-10000) for on-chain interactions
  const currentDoaBps = topicData ? Math.round(topicData.value * 100) : 0;

  return (
    <main className="max-w-7xl mx-auto px-4 py-6">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">
        {/* ── Left column ─────────────────────────────────────── */}
        <div className="space-y-5 min-w-0">
          <MarketHeader
            selectedTopic={selectedTopic}
            onSelectTopic={setSelectedTopic}
          />
          <DoaChart topic={selectedTopic} />

          {/* TAI Signal Breakdown — core upgrade */}
          <TAIBreakdown topic={selectedTopic} />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <SourceBreakdown topic={selectedTopic} />
            <SignalFeed topic={selectedTopic} />
          </div>
        </div>

        {/* ── Right column (sticky trade panel) ───────────────── */}
        <div className="space-y-4">
          <div className="lg:sticky lg:top-[72px] space-y-4">
            <TradePanel
              topic={selectedTopic}
              currentDoaBps={currentDoaBps}
              walletBalance={walletBalance}
            />
            <PositionsList
              topic={selectedTopic}
              currentDoaBps={currentDoaBps}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
