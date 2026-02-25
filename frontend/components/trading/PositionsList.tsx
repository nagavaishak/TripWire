'use client';

import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { useQuery } from '@tanstack/react-query';
import * as anchor from '@coral-xyz/anchor';
import { getProgram, fetchPosition } from '@/lib/anchor-client';
import { PositionCard } from './PositionCard';

interface PositionsListProps {
  topic: string;
  currentDoaBps: number;
}

export function PositionsList({ topic, currentDoaBps }: PositionsListProps) {
  const { publicKey, signTransaction, signAllTransactions, connected } = useWallet();
  const { connection } = useConnection();

  const { data: position, isLoading } = useQuery({
    queryKey: ['position', topic, publicKey?.toBase58()],
    queryFn: async () => {
      if (!publicKey || !signTransaction || !signAllTransactions) return null;
      const wallet = { publicKey, signTransaction, signAllTransactions } as anchor.Wallet;
      const program = getProgram(wallet, connection);
      return fetchPosition(program, topic, publicKey);
    },
    enabled: !!publicKey && connected,
    refetchInterval: 30_000,
  });

  if (!connected || !publicKey) return null;

  return (
    <div className="space-y-3">
      <p className="text-xs font-[family-name:var(--font-mono)] text-[#8A8A95] uppercase tracking-widest">
        Your Position
      </p>

      {isLoading ? (
        <div className="h-24 bg-[#111113] border border-[#222225] rounded-2xl animate-pulse" />
      ) : position ? (
        <PositionCard
          position={position}
          topic={topic}
          currentDoaBps={currentDoaBps}
        />
      ) : (
        <div className="bg-[#111113] border border-[#222225] rounded-2xl p-4 text-center">
          <p className="text-xs text-[#55555E] font-[family-name:var(--font-mono)]">
            No open position on {topic}
          </p>
        </div>
      )}
    </div>
  );
}
