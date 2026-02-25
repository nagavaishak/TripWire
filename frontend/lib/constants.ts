import { PublicKey } from '@solana/web3.js';

export const PROGRAM_ID = new PublicKey('35mr61jToyKGyynBgFtQJ8RnEEx3aoSVa3ofyK7rAgzb');
export const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.devnet.solana.com';
export const ORACLE_API = process.env.NEXT_PUBLIC_ORACLE_URL || 'https://attention-markets-api.onrender.com';

export const MARKETS = [
  { topic: 'Solana', enabled: true },
  { topic: 'AI', enabled: true },
  { topic: 'Bitcoin', enabled: false },
  { topic: 'DeFi', enabled: false },
] as const;

export type MarketTopic = (typeof MARKETS)[number]['topic'];

export const MIN_STAKE_LAMPORTS = 1_000_000; // 0.001 SOL
export const MAX_PAYOUT_MULTIPLIER = 2;
export const ORACLE_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
export const SOL_PER_LAMPORT = 1e-9;
