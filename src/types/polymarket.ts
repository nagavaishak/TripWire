/**
 * Polymarket API Types
 * Data from Polymarket CLOB API (https://clob.polymarket.com)
 */

export interface PolymarketProbabilityData {
  marketId: string;       // condition_id from Polymarket
  probability: number;    // 0-1
  timestamp: Date;
  bestBid: number;        // YES token best bid (implied YES probability)
  bestAsk: number;        // YES token best ask
  volume24h: number;
  liquidity: number;
}

export interface PolymarketMarketData {
  conditionId: string;
  question: string;         // Human-readable event name
  outcomeTokens: string[];  // ["Yes", "No"]
  endDate: string;
  active: boolean;
  volume: number;
}

/**
 * Polymarket CLOB API Base URL
 */
export const POLYMARKET_API_BASE_URL = 'https://clob.polymarket.com';
