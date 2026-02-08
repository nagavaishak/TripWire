/**
 * Swap Types for Jupiter Integration
 */

import { PublicKey } from '@solana/web3.js';

/**
 * Token mint addresses (Solana mainnet)
 */
export const TOKEN_MINTS = {
  SOL: 'So11111111111111111111111111111111111111112', // Wrapped SOL
  USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
  USDT: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', // USDT
} as const;

/**
 * Swap parameters
 */
export interface SwapParams {
  inputMint: string; // Token to sell (mint address)
  outputMint: string; // Token to buy (mint address)
  amount: number; // Amount to swap (in token's smallest unit - lamports/atoms)
  slippageBps: number; // Slippage tolerance in basis points (e.g., 50 = 0.5%)
  userPublicKey: string; // Wallet performing the swap
}

/**
 * Jupiter quote response
 */
export interface JupiterQuote {
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  otherAmountThreshold: string;
  swapMode: string;
  slippageBps: number;
  priceImpactPct: string;
  routePlan: any[];
}

/**
 * Swap quote result
 */
export interface SwapQuote {
  inputMint: string;
  outputMint: string;
  inputAmount: number;
  outputAmount: number;
  minimumOutputAmount: number;
  priceImpactPercent: number;
  route: string; // Description of swap route
  quote: JupiterQuote; // Raw Jupiter quote for building transaction
}

/**
 * Swap execution result
 */
export interface SwapResult {
  success: boolean;
  signature: string | null;
  inputAmount: number;
  outputAmount: number | null;
  error?: string;
}

/**
 * Get token mint address by symbol
 */
export function getTokenMint(symbol: 'SOL' | 'USDC' | 'USDT'): string {
  return TOKEN_MINTS[symbol];
}

/**
 * Get stablecoin mint (USDC by default)
 */
export function getStablecoinMint(): string {
  return TOKEN_MINTS.USDC;
}

/**
 * Validate swap parameters
 */
export function validateSwapParams(params: SwapParams): {
  valid: boolean;
  error?: string;
} {
  // Validate mints
  try {
    new PublicKey(params.inputMint);
    new PublicKey(params.outputMint);
  } catch {
    return {
      valid: false,
      error: 'Invalid token mint address',
    };
  }

  if (params.inputMint === params.outputMint) {
    return {
      valid: false,
      error: 'Input and output mints must be different',
    };
  }

  // Validate amount
  if (!Number.isInteger(params.amount) || params.amount <= 0) {
    return {
      valid: false,
      error: 'Amount must be a positive integer',
    };
  }

  // Validate slippage
  if (params.slippageBps < 0 || params.slippageBps > 10000) {
    return {
      valid: false,
      error: 'Slippage must be between 0 and 10000 bps (0-100%)',
    };
  }

  // Validate user public key
  try {
    new PublicKey(params.userPublicKey);
  } catch {
    return {
      valid: false,
      error: 'Invalid user public key',
    };
  }

  return { valid: true };
}

/**
 * Format token amount for display
 */
export function formatTokenAmount(
  amount: number,
  decimals: number = 9,
): string {
  return (amount / Math.pow(10, decimals)).toFixed(decimals);
}

/**
 * Convert SOL to lamports
 */
export function solToLamports(sol: number): number {
  return Math.floor(sol * 1_000_000_000);
}

/**
 * Convert lamports to SOL
 */
export function lamportsToSol(lamports: number): number {
  return lamports / 1_000_000_000;
}
