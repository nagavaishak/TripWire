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

/**
 * Single order level in the orderbook
 */
export interface PolymarketOrder {
  price: number;   // 0-1 scale
  size: number;    // USDC notional
}

/**
 * Level-2 orderbook snapshot for a token
 */
export interface PolymarketOrderbook {
  tokenId: string;
  bids: PolymarketOrder[];   // sorted desc by price
  asks: PolymarketOrder[];   // sorted asc by price
  spread: number;            // ask[0].price - bid[0].price
  midpoint: number;          // (bid[0].price + ask[0].price) / 2
  timestamp: Date;
}

/**
 * A user's Polymarket position as returned by the API
 */
export interface PolymarketPosition {
  conditionId: string;
  tokenId: string;
  outcome: string;       // "Yes" | "No"
  size: number;          // shares held
  avgPrice: number;      // 0-1
  currentPrice: number;  // latest mark
  pnl: number;           // unrealised P&L in USDC
}

/**
 * Parameters for placing a Polymarket CLOB order
 */
export interface PolymarketOrderParams {
  conditionId: string;
  outcome: 'YES' | 'NO';
  side: 'BUY' | 'SELL';
  size: number;          // shares
  price: number;         // limit price 0-1
  walletAddress: string;
}
