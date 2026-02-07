export interface KalshiMarketResponse {
  market: {
    ticker: string;
    event_ticker: string;
    market_type: string;
    title: string;
    subtitle: string;
    open_time: string;
    close_time: string;
    expected_expiration_time: string;
    latest_expiration_time: string;
    status: string;
    yes_bid: number;
    yes_ask: number;
    no_bid: number;
    no_ask: number;
    last_price: number;
    previous_yes_bid: number;
    previous_yes_ask: number;
    previous_price: number;
    volume: number;
    volume_24h: number;
    liquidity: number;
    open_interest: number;
    result: string;
    can_close_early: boolean;
    expiration_value: string;
    category: string;
    risk_limit_cents: number;
    strike_type: string;
    floor_strike: number;
    cap_strike: number;
    expiration_time: string;
    settlement_timer_seconds: number;
    market_id: string;
  };
}

export interface KalshiProbabilityData {
  marketId: string;
  probability: number;
  timestamp: Date;
  lastPrice: number;
  volume: number;
  openInterest: number;
}

export interface KalshiError {
  error: {
    code: string;
    message: string;
  };
}

export const KALSHI_MARKETS = {
  US_RECESSION_2026: 'USRECESSION-2026',
} as const;

export const KALSHI_API_BASE_URL = 'https://api.kalshi.com/trade-api/v2';
export const KALSHI_STALENESS_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes
export const KALSHI_POLL_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes
