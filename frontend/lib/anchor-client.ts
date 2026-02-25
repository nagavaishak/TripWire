import * as anchor from '@coral-xyz/anchor';
import { Connection, PublicKey, SystemProgram } from '@solana/web3.js';
import { PROGRAM_ID } from './constants';
import idl from './idl/attention_markets_program.json';

export type Direction = 'long' | 'short';

export interface MarketAccount {
  topic: string;
  oracle: PublicKey;
  doaScore: number;        // bps (0–10000), display as doaScore / 100
  isOpen: boolean;
  totalLongExposure: anchor.BN;
  totalShortExposure: anchor.BN;
  marketBump: number;
  vaultBump: number;
}

export interface PositionAccount {
  market: PublicKey;
  owner: PublicKey;
  direction: Direction;
  amount: anchor.BN;       // stake in lamports
  entryDoa: number;        // bps
  openedAt: anchor.BN;     // unix timestamp
  isOpen: boolean;
  bump: number;
}

export interface PnlResult {
  payout: number;     // lamports
  pnl: number;        // lamports (positive = profit)
  pnlPercent: number; // e.g. +36.9 or -12.4
  ratio: number;      // capped multiplier 0–2
}

// ── PDA helpers ─────────────────────────────────────────────────

export function getMarketPda(topic: string): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from('market'), Buffer.from(topic)],
    PROGRAM_ID
  );
  return pda;
}

export function getVaultPda(marketPda: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from('vault'), marketPda.toBuffer()],
    PROGRAM_ID
  );
  return pda;
}

export function getPositionPda(marketPda: PublicKey, trader: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from('position'), marketPda.toBuffer(), trader.toBuffer()],
    PROGRAM_ID
  );
  return pda;
}

// ── Program factory ──────────────────────────────────────────────

export function getProgram(
  wallet: anchor.Wallet,
  connection: Connection
): anchor.Program {
  const provider = new anchor.AnchorProvider(connection, wallet, {
    commitment: 'confirmed',
    preflightCommitment: 'confirmed',
  });
  anchor.setProvider(provider);
  return new anchor.Program(idl as anchor.Idl, provider);
}

// ── Read helpers ─────────────────────────────────────────────────

export async function fetchMarket(
  program: anchor.Program,
  topic: string
): Promise<MarketAccount | null> {
  try {
    const pda = getMarketPda(topic);
    const raw = await (program.account as any).market.fetch(pda);
    return {
      topic: raw.topic,
      oracle: raw.oracle,
      doaScore: raw.doaScore,
      isOpen: raw.isOpen,
      totalLongExposure: raw.totalLongExposure,
      totalShortExposure: raw.totalShortExposure,
      marketBump: raw.marketBump,
      vaultBump: raw.vaultBump,
    };
  } catch {
    return null;
  }
}

export async function fetchPosition(
  program: anchor.Program,
  topic: string,
  trader: PublicKey
): Promise<PositionAccount | null> {
  try {
    const marketPda = getMarketPda(topic);
    const positionPda = getPositionPda(marketPda, trader);
    const raw = await (program.account as any).position.fetch(positionPda);
    if (!raw.isOpen) return null; // treat closed as non-existent
    return {
      market: raw.market,
      owner: raw.owner,
      direction: 'long' in raw.direction ? 'long' : 'short',
      amount: raw.amount,
      entryDoa: raw.entryDoa,
      openedAt: raw.openedAt,
      isOpen: raw.isOpen,
      bump: raw.bump,
    };
  } catch {
    return null;
  }
}

export async function fetchAllUserPositions(
  program: anchor.Program,
  trader: PublicKey
): Promise<Array<PositionAccount & { topic: string }>> {
  try {
    // Filter by owner field: discriminator(8) + market pubkey(32) = offset 40
    const accounts = await (program.account as any).position.all([
      {
        memcmp: {
          offset: 40,
          bytes: trader.toBase58(),
        },
      },
    ]);

    const results: Array<PositionAccount & { topic: string }> = [];
    for (const acc of accounts) {
      const raw = acc.account;
      if (!raw.isOpen) continue;

      // Derive topic from market PDA by checking known markets
      const { MARKETS } = await import('./constants');
      let topic = 'Unknown';
      for (const m of MARKETS) {
        const pda = getMarketPda(m.topic);
        if (pda.equals(raw.market)) {
          topic = m.topic;
          break;
        }
      }

      results.push({
        topic,
        market: raw.market,
        owner: raw.owner,
        direction: 'long' in raw.direction ? 'long' : 'short',
        amount: raw.amount,
        entryDoa: raw.entryDoa,
        openedAt: raw.openedAt,
        isOpen: raw.isOpen,
        bump: raw.bump,
      });
    }
    return results;
  } catch {
    return [];
  }
}

// ── Write helpers ────────────────────────────────────────────────

export async function openPosition(
  program: anchor.Program,
  topic: string,
  direction: Direction,
  amountLamports: number,
  trader: PublicKey
): Promise<string> {
  const marketPda = getMarketPda(topic);
  const vaultPda = getVaultPda(marketPda);
  const positionPda = getPositionPda(marketPda, trader);

  const tx = await program.methods
    .openPosition(
      direction === 'long' ? { long: {} } : { short: {} },
      new anchor.BN(amountLamports)
    )
    .accounts({
      market: marketPda,
      vault: vaultPda,
      position: positionPda,
      trader,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  return tx;
}

export async function closePosition(
  program: anchor.Program,
  topic: string,
  trader: PublicKey
): Promise<string> {
  const marketPda = getMarketPda(topic);
  const vaultPda = getVaultPda(marketPda);
  const positionPda = getPositionPda(marketPda, trader);

  const tx = await program.methods
    .closePosition()
    .accounts({
      market: marketPda,
      vault: vaultPda,
      position: positionPda,
      trader,
    })
    .rpc();

  return tx;
}

// ── Pure calculations ────────────────────────────────────────────

export function calculatePnl(
  entryDoaBps: number,
  currentDoaBps: number,
  direction: Direction,
  stakeLamports: number
): PnlResult {
  if (entryDoaBps === 0 || currentDoaBps === 0) {
    return { payout: stakeLamports, pnl: 0, pnlPercent: 0, ratio: 1 };
  }

  const ratio =
    direction === 'long'
      ? currentDoaBps / entryDoaBps
      : entryDoaBps / currentDoaBps;

  const capped = Math.min(2, Math.max(0, ratio));
  const payout = Math.round(stakeLamports * capped);
  const pnl = payout - stakeLamports;
  const pnlPercent = (capped - 1) * 100;

  return { payout, pnl, pnlPercent, ratio: capped };
}

export function lamportsToSol(lamports: number | anchor.BN): number {
  const n = typeof lamports === 'number' ? lamports : lamports.toNumber();
  return n / 1e9;
}

export function solToLamports(sol: number): number {
  return Math.round(sol * 1e9);
}

export function bpsToDisplay(bps: number): number {
  return bps / 100;
}

export function formatSol(lamports: number | anchor.BN, decimals = 4): string {
  return lamportsToSol(lamports).toFixed(decimals);
}

export function formatDoaBps(bps: number): string {
  return (bps / 100).toFixed(1);
}
