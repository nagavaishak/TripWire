'use client';

import { useState, useCallback } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { useQueryClient } from '@tanstack/react-query';
import * as anchor from '@coral-xyz/anchor';
import {
  getProgram,
  closePosition,
  calculatePnl,
  lamportsToSol,
  bpsToDisplay,
  type PositionAccount,
} from '@/lib/anchor-client';

interface PositionCardProps {
  position: PositionAccount;
  topic: string;
  currentDoaBps: number;
}

function formatDuration(openedAt: anchor.BN): string {
  const seconds = Math.floor(Date.now() / 1000) - openedAt.toNumber();
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export function PositionCard({ position, topic, currentDoaBps }: PositionCardProps) {
  const { publicKey, signTransaction, signAllTransactions } = useWallet();
  const { connection } = useConnection();
  const queryClient = useQueryClient();
  const [closing, setClosing] = useState(false);
  const [closed, setClosed] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const stakeLamports = position.amount.toNumber();
  const pnl = calculatePnl(position.entryDoa, currentDoaBps, position.direction, stakeLamports);

  const isLong = position.direction === 'long';
  const dirColor = isLong ? '#00FF88' : '#FF3B5C';
  const pnlColor = pnl.pnl > 0 ? '#00FF88' : pnl.pnl < 0 ? '#FF3B5C' : '#8A8A95';

  // Progress bar: 0 = full loss (0×), 50% = breakeven (1×), 100% = max gain (2×)
  const progressPct = Math.round((pnl.ratio / 2) * 100);

  const handleClose = useCallback(async () => {
    if (!publicKey || !signTransaction || !signAllTransactions) return;
    setClosing(true);
    setErrorMsg('');
    try {
      const wallet = { publicKey, signTransaction, signAllTransactions } as anchor.Wallet;
      const program = getProgram(wallet, connection);
      await closePosition(program, topic, publicKey);
      setClosed(true);
      queryClient.invalidateQueries({ queryKey: ['position', topic] });
      queryClient.invalidateQueries({ queryKey: ['positions', publicKey.toBase58()] });
    } catch (err: any) {
      const msg = err?.message ?? String(err);
      setErrorMsg(msg.includes('User rejected') ? 'Transaction cancelled' : msg.slice(0, 60));
      setClosing(false);
    }
  }, [publicKey, signTransaction, signAllTransactions, connection, topic, queryClient]);

  if (closed) {
    return (
      <div className="bg-[#111113] border border-[#00FF88]/15 rounded-2xl p-4 text-center">
        <p className="text-xs font-[family-name:var(--font-mono)] text-[#00FF88]">✓ Position closed</p>
        <p className="text-[10px] text-[#55555E] font-[family-name:var(--font-mono)] mt-1">
          Settlement sent to your wallet
        </p>
      </div>
    );
  }

  return (
    <div className="bg-[#111113] border border-[#222225] rounded-2xl p-4 space-y-3 relative overflow-hidden">
      {/* Top accent */}
      <div className="absolute top-0 inset-x-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${dirColor}50, transparent)` }} />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className="text-[11px] font-[family-name:var(--font-mono)] font-bold px-2 py-0.5 rounded-md border uppercase tracking-widest"
            style={{ color: dirColor, borderColor: `${dirColor}30`, background: `${dirColor}10` }}
          >
            {isLong ? '↑ Long' : '↓ Short'}
          </span>
          <span className="text-xs font-[family-name:var(--font-space)] font-semibold text-[#EAEAEC]">
            {topic}
          </span>
        </div>
        <span className="text-[10px] font-[family-name:var(--font-mono)] text-[#55555E]">
          {formatDuration(position.openedAt)}
        </span>
      </div>

      {/* DoA comparison */}
      <div className="grid grid-cols-2 gap-3 text-center">
        <div>
          <p className="text-[10px] font-[family-name:var(--font-mono)] text-[#55555E] uppercase tracking-widest mb-1">Entry DoA</p>
          <p className="font-[family-name:var(--font-mono)] font-bold text-xl text-[#8A8A95] tabular-nums">
            {bpsToDisplay(position.entryDoa).toFixed(1)}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-[family-name:var(--font-mono)] text-[#55555E] uppercase tracking-widest mb-1">Current DoA</p>
          <p className="font-[family-name:var(--font-mono)] font-bold text-xl tabular-nums" style={{ color: dirColor }}>
            {bpsToDisplay(currentDoaBps).toFixed(1)}
          </p>
        </div>
      </div>

      {/* P&L */}
      <div className="bg-[#18181B] rounded-xl p-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-[family-name:var(--font-mono)] text-[#55555E]">Stake</span>
          <span className="text-[11px] font-[family-name:var(--font-mono)] text-[#EAEAEC] tabular-nums">
            {lamportsToSol(stakeLamports).toFixed(4)} SOL
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-[family-name:var(--font-mono)] text-[#55555E]">P&L</span>
          <span className="text-[11px] font-[family-name:var(--font-mono)] font-bold tabular-nums" style={{ color: pnlColor }}>
            {pnl.pnl >= 0 ? '+' : ''}{lamportsToSol(pnl.pnl).toFixed(4)} SOL
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-[family-name:var(--font-mono)] text-[#55555E]">Return</span>
          <span className="text-[11px] font-[family-name:var(--font-mono)] font-bold tabular-nums" style={{ color: pnlColor }}>
            {pnl.pnlPercent >= 0 ? '+' : ''}{pnl.pnlPercent.toFixed(1)}%
          </span>
        </div>
      </div>

      {/* Progress bar: 0% = 0× = full loss, 50% = break-even, 100% = 2× */}
      <div className="space-y-1">
        <div className="h-1.5 bg-[#222225] rounded-full overflow-hidden relative">
          {/* Break-even marker */}
          <div className="absolute top-0 left-1/2 w-px h-full bg-[#2E2E33] z-10" />
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${progressPct}%`, background: pnlColor }}
          />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[9px] font-[family-name:var(--font-mono)] text-[#55555E]">0×</span>
          <span className="text-[9px] font-[family-name:var(--font-mono)] text-[#55555E]">break-even</span>
          <span className="text-[9px] font-[family-name:var(--font-mono)] text-[#55555E]">2×</span>
        </div>
      </div>

      {/* Error */}
      {errorMsg && (
        <p className="text-[10px] font-[family-name:var(--font-mono)] text-[#FF3B5C] bg-[#FF3B5C]/8 rounded-lg px-2 py-1.5">
          {errorMsg}
        </p>
      )}

      {/* Close button / confirm flow */}
      {!showConfirm ? (
        <button
          onClick={() => setShowConfirm(true)}
          className="w-full py-2.5 text-sm font-[family-name:var(--font-inter)] text-[#8A8A95] border border-[#222225] rounded-xl hover:border-[#FF3B5C]/30 hover:text-[#FF3B5C] transition-all"
        >
          Close Position
        </button>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-[#8A8A95] font-[family-name:var(--font-inter)] text-center">
            Receive ~{lamportsToSol(pnl.payout).toFixed(4)} SOL
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setShowConfirm(false)}
              className="py-2 text-xs font-[family-name:var(--font-inter)] text-[#55555E] border border-[#222225] rounded-xl hover:text-[#8A8A95] transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleClose}
              disabled={closing}
              className="py-2 text-xs font-[family-name:var(--font-space)] font-bold text-[#FF3B5C] bg-[#FF3B5C]/8 border border-[#FF3B5C]/25 rounded-xl hover:bg-[#FF3B5C]/15 transition-all disabled:opacity-50"
            >
              {closing ? 'Closing...' : 'Confirm Close'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
