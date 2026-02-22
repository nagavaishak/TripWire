-- Migration 012: Create market_comparisons table for cross-platform comparison data
-- Stores Kalshi <-> Polymarket paired comparisons and arbitrage opportunities

CREATE TABLE IF NOT EXISTS market_comparisons (
  id SERIAL PRIMARY KEY,
  kalshi_market_id VARCHAR(100),
  polymarket_condition_id VARCHAR(100),
  event_name VARCHAR(500),
  kalshi_probability DECIMAL(5,4),
  polymarket_probability DECIMAL(5,4),
  spread_pct DECIMAL(5,2),
  consensus_probability DECIMAL(5,4),
  arbitrage_opportunity BOOLEAN DEFAULT false,
  raw_data JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_market_comparisons_arbitrage
  ON market_comparisons(arbitrage_opportunity)
  WHERE arbitrage_opportunity = true;

CREATE INDEX IF NOT EXISTS idx_market_comparisons_created
  ON market_comparisons(created_at DESC);

