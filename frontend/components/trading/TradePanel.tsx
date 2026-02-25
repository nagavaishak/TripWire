'use client';

import { useState, useCallback } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as anchor from '@coral-xyz/anchor';
import {
  getProgram,
  openPosition,
  calculatePnl,
  fetchPosition,
} from '@/lib/anchor-client';
import { MIN_STAKE_LAMPORTS } from '@/lib/constants';
import type { Direction } from '@/lib/anchor-client';

interface TradePanelProps {
  topic: string;
  currentDoaBps: number; // 0–10000
  walletBalance: number | null; // SOL
}

type PanelStatus = 'idle' | 'submitting' | 'success' | 'error';

export function TradePanel({ topic, currentDoaBps, walletBalance }: TradePanelProps) {
  const { publicKey, signTransaction, signAllTransactions, connected } = useWallet();
  const { connection } = useConnection();
  const { setVisible } = useWalletModal();
  const queryClient = useQueryClient();

  const [direction, setDirection] = useState<Direction>('long');
  const [amountSol, setAmountSol] = useState('0.1');
  const [status, setStatus] = useState<PanelStatus>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [txSig, setTxSig] = useState('');

  // Check if user already has a position on this market
  const { data: existingPosition } = useQuery({
    queryKey: ['position', topic, publicKey?.toBase58()],
    queryFn: async () => {
      if (!publicKey || !connected) return null;
      const wallet = {
        publicKey,
        signTransaction: signTransaction!,
        signAllTransactions: signAllTransactions!,
      } as anchor.Wallet;
      const program = getProgram(wallet, connection);
      return fetchPosition(program, topic, publicKey);
    },
    enabled: !!publicKey && connected,
    refetchInterval: 30_000,
  });

  const hasPosition = existingPosition != null;

  const amountLamports = Math.round(parseFloat(amountSol || '0') * 1e9);
  const validAmount = !isNaN(amountLamports) && amountLamports >= MIN_STAKE_LAMPORTS;

  // P&L previews using 2 hypothetical scenarios
  const pnlIfUp = currentDoaBps > 0
    ? calculatePnl(currentDoaBps, Math.min(10000, currentDoaBps * 1.5), direction, amountLamports)
    : null;
  const pnlIfDown = currentDoaBps > 0
    ? calculatePnl(currentDoaBps, Math.max(1, currentDoaBps * 0.6), direction, amountLamports)
    : null;

  const fillFromBalance = (pct: number) => {
    if (walletBalance == null) return;
    const sol = (walletBalance * pct) / 100;
    setAmountSol(Math.max(0.001, sol - 0.01).toFixed(4)); // leave ~0.01 SOL for fees
  };

  const handleOpen = useCallback(async () => {
    if (!publicKey || !signTransaction || !signAllTransactions) return;
    if (!validAmount) { setErrorMsg('Invalid amount'); return; }
    if (hasPosition) { setErrorMsg('Close existing position first'); return; }

    setStatus('submitting');
    setErrorMsg('');

    try {
      const wallet = {
        publicKey,
        signTransaction,
        signAllTransactions,
      } as anchor.Wallet;
      const program = getProgram(wallet, connection);
      const sig = await openPosition(program, topic, direction, amountLamports, publicKey);
      setTxSig(sig);
      setStatus('success');
      // Invalidate position query so the list refreshes
      queryClient.invalidateQueries({ queryKey: ['position', topic] });
      queryClient.invalidateQueries({ queryKey: ['positions', publicKey.toBase58()] });
    } catch (err: any) {
      const msg = parseAnchorError(err);
      setErrorMsg(msg);
      setStatus('error');
      setTimeout(() => setStatus('idle'), 4000);
    }
  }, [publicKey, signTransaction, signAllTransactions, connection, topic, direction, amountLamports, hasPosition, validAmount, queryClient]);

  // ── No wallet ─────────────────────────────────────────────────
  if (!connected || !publicKey) {
    return (
      <div className="bg-[#111113] border border-[#222225] rounded-2xl p-5 space-y-5">
        <p className="text-sm font-[family-name:var(--font-space)] font-bold text-[#EAEAEC]">Open Position</p>
        <div className="text-center py-6 space-y-4">
          <div className="w-12 h-12 bg-[#FFB800]/10 border border-[#FFB800]/25 rounded-xl flex items-center justify-center mx-auto">
            <svg viewBox="0 0 24 24" className="w-6 h-6 text-[#FFB800]" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="currentColor"/>
            </svg>
          </div>
          <div>
            <p className="text-sm text-[#EAEAEC] font-[family-name:var(--font-inter)] mb-1">
              Connect your Solana wallet
            </p>
            <p className="text-xs text-[#55555E] font-[family-name:var(--font-inter)]">
              to start trading attention markets
            </p>
          </div>
          <button
            onClick={() => setVisible(true)}
            className="w-full bg-[#FFB800] text-[#0A0A0B] font-[family-name:var(--font-space)] font-bold text-sm py-3 rounded-xl hover:bg-[#FFB800]/90 transition-all active:scale-95"
          >
            Connect Wallet
          </button>
          <p className="text-[10px] text-[#55555E] font-[family-name:var(--font-mono)]">
            Supports Phantom · Solflare
          </p>
        </div>
      </div>
    );
  }

  // ── Success ───────────────────────────────────────────────────
  if (status === 'success') {
    return (
      <div className="bg-[#111113] border border-[#00FF88]/20 rounded-2xl p-5 space-y-4">
        <div className="text-center py-4 space-y-3">
          <div className="w-12 h-12 bg-[#00FF88]/10 border border-[#00FF88]/25 rounded-xl flex items-center justify-center mx-auto">
            <svg viewBox="0 0 24 24" className="w-6 h-6 text-[#00FF88]" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div>
            <p className="font-[family-name:var(--font-space)] font-bold text-[#00FF88] text-base">Position Opened!</p>
            <p className="text-xs text-[#8A8A95] font-[family-name:var(--font-mono)] mt-1">
              {direction === 'long' ? '↑ Long' : '↓ Short'} {topic} @ {(currentDoaBps / 100).toFixed(1)} DoA
            </p>
            <p className="text-xs text-[#8A8A95] font-[family-name:var(--font-mono)]">
              Stake: {parseFloat(amountSol).toFixed(4)} SOL
            </p>
          </div>
          {txSig && (
            <a
              href={`https://solscan.io/tx/${txSig}?cluster=devnet`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] font-[family-name:var(--font-mono)] text-[#3B82F6] hover:underline"
            >
              View on Solscan ↗
            </a>
          )}
          <button
            onClick={() => { setStatus('idle'); setAmountSol('0.1'); }}
            className="w-full border border-[#222225] text-[#8A8A95] text-sm font-[family-name:var(--font-inter)] py-2.5 rounded-xl hover:border-[#2E2E33] hover:text-[#EAEAEC] transition-all"
          >
            Open Another
          </button>
        </div>
      </div>
    );
  }

  // ── Has existing position ─────────────────────────────────────
  if (hasPosition) {
    return (
      <div className="bg-[#111113] border border-[#222225] rounded-2xl p-5 space-y-3">
        <p className="text-sm font-[family-name:var(--font-space)] font-bold text-[#EAEAEC]">Open Position</p>
        <div className="bg-[#FFB800]/8 border border-[#FFB800]/20 rounded-xl p-4 text-center space-y-2">
          <p className="text-xs text-[#FFB800] font-[family-name:var(--font-mono)] font-bold uppercase tracking-widest">
            Position Active
          </p>
          <p className="text-xs text-[#8A8A95] font-[family-name:var(--font-inter)]">
            You have an open {existingPosition.direction === 'long' ? '↑ Long' : '↓ Short'} on {topic}.
            Close it below before opening a new one.
          </p>
        </div>
      </div>
    );
  }

  // ── Main trade form ───────────────────────────────────────────
  const btnColor = direction === 'long' ? '#00FF88' : '#FF3B5C';
  const btnLabel = direction === 'long' ? '↑ Open Long' : '↓ Open Short';

  return (
    <div className="bg-[#111113] border border-[#222225] rounded-2xl p-5 space-y-5">
      <p className="text-sm font-[family-name:var(--font-space)] font-bold text-[#EAEAEC]">Open Position</p>

      {/* Direction toggle */}
      <div className="grid grid-cols-2 gap-2">
        {(['long', 'short'] as Direction[]).map((d) => (
          <button
            key={d}
            onClick={() => setDirection(d)}
            className={`py-2.5 rounded-xl text-sm font-[family-name:var(--font-space)] font-bold border transition-all ${
              direction === d
                ? d === 'long'
                  ? 'bg-[#00FF88]/10 border-[#00FF88]/30 text-[#00FF88]'
                  : 'bg-[#FF3B5C]/10 border-[#FF3B5C]/30 text-[#FF3B5C]'
                : 'bg-transparent border-[#222225] text-[#55555E] hover:border-[#2E2E33] hover:text-[#8A8A95]'
            }`}
          >
            {d === 'long' ? '↑ Long' : '↓ Short'}
          </button>
        ))}
      </div>

      {/* Amount input */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-[family-name:var(--font-mono)] text-[#8A8A95] uppercase tracking-widest">
            Amount (SOL)
          </label>
          {walletBalance !== null && (
            <span className="text-[10px] font-[family-name:var(--font-mono)] text-[#55555E]">
              Balance: {walletBalance.toFixed(3)} SOL
            </span>
          )}
        </div>
        <input
          type="number"
          value={amountSol}
          onChange={(e) => { setAmountSol(e.target.value); setStatus('idle'); setErrorMsg(''); }}
          min="0.001"
          step="0.01"
          placeholder="0.1"
          className="w-full bg-[#18181B] border border-[#222225] focus:border-[#FFB800]/50 text-[#EAEAEC] font-[family-name:var(--font-mono)] text-lg px-3 py-2.5 rounded-xl outline-none transition-all placeholder-[#55555E] tabular-nums"
        />
        {/* Quick fill */}
        <div className="grid grid-cols-4 gap-1.5">
          {[25, 50, 75, 100].map((pct) => (
            <button
              key={pct}
              onClick={() => fillFromBalance(pct)}
              disabled={walletBalance == null}
              className="py-1 text-[10px] font-[family-name:var(--font-mono)] text-[#55555E] border border-[#222225] rounded-lg hover:text-[#8A8A95] hover:border-[#2E2E33] transition-all disabled:opacity-40"
            >
              {pct}%
            </button>
          ))}
        </div>
      </div>

      {/* P&L Preview */}
      {currentDoaBps > 0 && validAmount && amountLamports > 0 && (
        <div className="bg-[#18181B] border border-[#222225] rounded-xl p-3 space-y-2">
          <p className="text-[10px] font-[family-name:var(--font-mono)] text-[#55555E] uppercase tracking-widest mb-2">
            Scenario Preview
          </p>
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-[#55555E] font-[family-name:var(--font-mono)]">Entry DoA</span>
            <span className="text-[11px] text-[#EAEAEC] font-[family-name:var(--font-mono)] tabular-nums">
              {(currentDoaBps / 100).toFixed(1)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-[#55555E] font-[family-name:var(--font-mono)]">Stake</span>
            <span className="text-[11px] text-[#EAEAEC] font-[family-name:var(--font-mono)] tabular-nums">
              {parseFloat(amountSol).toFixed(4)} SOL
            </span>
          </div>
          {pnlIfUp && (
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-[#55555E] font-[family-name:var(--font-mono)]">If DoA +50%</span>
              <span className={`text-[11px] font-[family-name:var(--font-mono)] tabular-nums font-bold ${pnlIfUp.pnl >= 0 ? 'text-[#00FF88]' : 'text-[#FF3B5C]'}`}>
                {pnlIfUp.pnl >= 0 ? '+' : ''}{(pnlIfUp.pnl / 1e9).toFixed(4)} SOL
              </span>
            </div>
          )}
          {pnlIfDown && (
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-[#55555E] font-[family-name:var(--font-mono)]">If DoA -40%</span>
              <span className={`text-[11px] font-[family-name:var(--font-mono)] tabular-nums font-bold ${pnlIfDown.pnl >= 0 ? 'text-[#00FF88]' : 'text-[#FF3B5C]'}`}>
                {pnlIfDown.pnl >= 0 ? '+' : ''}{(pnlIfDown.pnl / 1e9).toFixed(4)} SOL
              </span>
            </div>
          )}
          <div className="flex items-center justify-between border-t border-[#222225] pt-2 mt-2">
            <span className="text-[11px] text-[#55555E] font-[family-name:var(--font-mono)]">Max gain</span>
            <span className="text-[11px] text-[#00FF88] font-[family-name:var(--font-mono)] tabular-nums font-bold">
              +{parseFloat(amountSol).toFixed(4)} SOL (2×)
            </span>
          </div>
        </div>
      )}

      {/* Error */}
      {errorMsg && (
        <p className="text-xs font-[family-name:var(--font-mono)] text-[#FF3B5C] bg-[#FF3B5C]/8 border border-[#FF3B5C]/20 rounded-lg px-3 py-2">
          {errorMsg}
        </p>
      )}

      {/* Open button */}
      <button
        onClick={handleOpen}
        disabled={status === 'submitting' || !validAmount}
        className="w-full py-3.5 rounded-xl font-[family-name:var(--font-space)] font-bold text-sm transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
        style={{
          background: status === 'submitting' ? '#18181B' : `${btnColor}18`,
          border: `1px solid ${btnColor}40`,
          color: status === 'submitting' ? '#55555E' : btnColor,
        }}
      >
        {status === 'submitting' ? (
          <span className="flex items-center justify-center gap-2">
            <span className="w-3.5 h-3.5 border-2 border-[#55555E] border-t-[#FFB800] rounded-full animate-spin" />
            Confirm in wallet...
          </span>
        ) : btnLabel}
      </button>

      <p className="text-[10px] text-[#55555E] font-[family-name:var(--font-mono)] text-center">
        Min stake 0.001 SOL · Devnet only · Max 2× gain
      </p>
    </div>
  );
}

function parseAnchorError(err: any): string {
  const msg = err?.message ?? String(err);
  if (msg.includes('StakeTooSmall')) return 'Minimum stake is 0.001 SOL';
  if (msg.includes('DoaNotSet')) return 'Waiting for first oracle update';
  if (msg.includes('MarketClosed')) return 'This market is closed';
  if (msg.includes('InsufficientVaultFunds')) return 'Vault underfunded — contact admin';
  if (msg.includes('User rejected')) return 'Transaction cancelled';
  if (msg.includes('insufficient funds')) return 'Insufficient SOL balance';
  if (msg.includes('0x1')) return 'Insufficient SOL balance';
  return msg.slice(0, 80);
}
