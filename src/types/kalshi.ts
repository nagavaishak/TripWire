/**
 * Kalshi API Types
 * Note: Market response types are now provided by kalshi-typescript SDK
 * Import from 'kalshi-typescript' when needed
 */

export interface KalshiProbabilityData {
  marketId: string;
  probability: number;
  timestamp: Date;
  lastPrice: number;
  volume: number;
  openInterest: number;
}

/**
 * Example Kalshi market tickers
 */
export const KALSHI_MARKETS = {
  US_RECESSION_2026: 'USRECESSION-2026',
} as const;

/**
 * Kalshi API Base URLs
 */
export const KALSHI_API_BASE_URL_PRODUCTION =
  'https://api.kalshi.com/trade-api/v2';
export const KALSHI_API_BASE_URL_DEMO =
  'https://demo-api.kalshi.co/trade-api/v2';

/**
 * Kalshi polling and staleness thresholds
 */
export const KALSHI_STALENESS_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes
export const KALSHI_POLL_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes
