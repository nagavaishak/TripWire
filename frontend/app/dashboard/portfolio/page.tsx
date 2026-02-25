'use client';

import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { useQuery } from '@tanstack/react-query';
import * as anchor from '@coral-xyz/anchor';
import {
  getProgram,
  fetchAllUserPositions,
  calculatePnl,
  lamportsToSol,
  bpsToDisplay,
  type PositionAccount,
} from '@/lib/anchor-client';
import { oracleClient } from '@/lib/api';
import { PositionCard } from '@/components/trading/PositionCard';
import { MARKETS } from '@/lib/constants';
import Link from 'next/link';

function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="bg-[#111113] border border-[#222225] rounded-2xl p-4">
      <p className="text-[10px] font-[family-name:var(--font-mono)] text-[#55555E] uppercase tracking-widest mb-2">{label}</p>
      <p className="font-[family-name:var(--font-mono)] font-bold text-2xl tabular-nums" style={{ color: color ?? '#EAEAEC' }}>
        {value}
      </p>
      {sub && <p className="text-[10px] font-[family-name:var(--font-mono)] text-[#55555E] mt-1">{sub}</p>}
    </div>
  );
}

export default function PortfolioPage() {
  const { publicKey, signTransaction, signAllTransactions, connected } = useWallet();
  const { connection } = useConnection();
  const { setVisible } = useWalletModal();

  // Fetch all current market DoA scores
  const marketQueries = MARKETS.filter((m) => m.enabled).map((m) => m.topic);

  const { data: solanaData } = useQuery({
    queryKey: ['topic', 'Solana'],
    queryFn: () => oracleClient.getTopic('Solana'),
    refetchInterval: 5 * 60 * 1000,
  });
  const { data: aiData } = useQuery({
    queryKey: ['topic', 'AI'],
    queryFn: () => oracleClient.getTopic('AI'),
    refetchInterval: 5 * 60 * 1000,
  });

  const doaByTopic: Record<string, number> = {
    Solana: solanaData ? Math.round(solanaData.value * 100) : 0,
    AI: aiData ? Math.round(aiData.value * 100) : 0,
  };

  // Fetch all user positions
  const { data: positions = [], isLoading } = useQuery({
    queryKey: ['positions', publicKey?.toBase58()],
    queryFn: async () => {
      if (!publicKey || !signTransaction || !signAllTransactions) return [];
      const wallet = { publicKey, signTransaction, signAllTransactions } as anchor.Wallet;
      const program = getProgram(wallet, connection);
      return fetchAllUserPositions(program, publicKey);
    },
    enabled: !!publicKey && connected,
    refetchInterval: 30_000,
  });

  // Compute summary stats
  let totalPnlLamports = 0;
  let totalStakeLamports = 0;
  for (const pos of positions) {
    const currentBps = doaByTopic[pos.topic] ?? 0;
    const stake = pos.amount.toNumber();
    const pnl = calculatePnl(pos.entryDoa, currentBps, pos.direction, stake);
    totalPnlLamports += pnl.pnl;
    totalStakeLamports += stake;
  }

  const pnlColor = totalPnlLamports > 0 ? '#00FF88' : totalPnlLamports < 0 ? '#FF3B5C' : '#8A8A95';

  if (!connected || !publicKey) {
    return (
      <main className="max-w-7xl mx-auto px-4 py-12">
        <div className="max-w-md mx-auto text-center space-y-6">
          <div className="w-16 h-16 bg-[#FFB800]/10 border border-[#FFB800]/25 rounded-2xl flex items-center justify-center mx-auto">
            <svg viewBox="0 0 24 24" className="w-8 h-8 text-[#FFB800]" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M3 7h18M3 12h18M3 17h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>
          <div>
            <h1 className="font-[family-name:var(--font-space)] font-bold text-2xl text-[#EAEAEC] mb-2">Portfolio</h1>
            <p className="text-[#8A8A95] text-sm font-[family-name:var(--font-inter)]">
              Connect your wallet to view your open positions and P&L.
            </p>
          </div>
          <button
            onClick={() => setVisible(true)}
            className="bg-[#FFB800] text-[#0A0A0B] font-[family-name:var(--font-space)] font-bold text-sm px-6 py-3 rounded-xl hover:bg-[#FFB800]/90 transition-all"
          >
            Connect Wallet
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-[family-name:var(--font-space)] font-bold text-2xl text-[#EAEAEC]">Portfolio</h1>
          <p className="text-xs font-[family-name:var(--font-mono)] text-[#55555E] mt-1">
            {publicKey.toBase58().slice(0, 8)}...{publicKey.toBase58().slice(-8)} · Devnet
          </p>
        </div>
        <Link
          href="/dashboard"
          className="text-sm font-[family-name:var(--font-inter)] text-[#8A8A95] hover:text-[#FFB800] transition-colors flex items-center gap-1.5"
        >
          ← Trade
        </Link>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="Unrealized P&L"
          value={`${totalPnlLamports >= 0 ? '+' : ''}${lamportsToSol(totalPnlLamports).toFixed(4)} SOL`}
          color={pnlColor}
        />
        <StatCard
          label="Open Positions"
          value={isLoading ? '...' : String(positions.length)}
          sub={positions.length === 0 ? 'No active trades' : `Across ${new Set(positions.map((p) => p.topic)).size} market(s)`}
        />
        <StatCard
          label="Total Staked"
          value={`${lamportsToSol(totalStakeLamports).toFixed(4)} SOL`}
        />
      </div>

      {/* Positions */}
      <div>
        <p className="text-xs font-[family-name:var(--font-mono)] text-[#8A8A95] uppercase tracking-widest mb-4">
          Open Positions
        </p>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2].map((i) => (
              <div key={i} className="h-48 bg-[#111113] border border-[#222225] rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : positions.length === 0 ? (
          <div className="bg-[#111113] border border-[#222225] rounded-2xl p-10 text-center space-y-4">
            <p className="text-[#55555E] text-sm font-[family-name:var(--font-mono)]">
              No open positions yet.
            </p>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 bg-[#FFB800]/10 border border-[#FFB800]/25 text-[#FFB800] text-sm font-[family-name:var(--font-space)] font-semibold px-4 py-2.5 rounded-xl hover:bg-[#FFB800]/15 transition-all"
            >
              Go to Trade →
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {positions.map((pos, i) => {
              const currentBps = doaByTopic[pos.topic] ?? 0;
              return (
                <PositionCard
                  key={i}
                  position={pos}
                  topic={pos.topic}
                  currentDoaBps={currentBps}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Footer note */}
      <p className="text-[10px] font-[family-name:var(--font-mono)] text-[#55555E] text-center">
        Closed positions are settled on-chain.{' '}
        <a
          href={`https://solscan.io/account/${publicKey.toBase58()}?cluster=devnet`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#3B82F6] hover:underline"
        >
          View history on Solscan ↗
        </a>
      </p>
    </main>
  );
}
