-- Migration 014: Create user_positions table
-- Tracks user positions across Kalshi and Polymarket

CREATE TABLE IF NOT EXISTS user_positions (
  id              SERIAL PRIMARY KEY,
  user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platform        VARCHAR(20) NOT NULL CHECK (platform IN ('kalshi', 'polymarket')),
  market_id       VARCHAR(255) NOT NULL,  -- Kalshi ticker or Polymarket condition_id
  question        TEXT NOT NULL,
  side            VARCHAR(10) NOT NULL CHECK (side IN ('YES', 'NO')),
  shares          NUMERIC(18, 6) NOT NULL DEFAULT 0,
  avg_price       NUMERIC(10, 6) NOT NULL DEFAULT 0,  -- 0-1 scale
  current_price   NUMERIC(10, 6),                     -- latest mark price
  cost_basis      NUMERIC(18, 2) NOT NULL DEFAULT 0,  -- USD
  current_value   NUMERIC(18, 2),                     -- USD
  realized_pnl    NUMERIC(18, 2) NOT NULL DEFAULT 0,
  status          VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'closed')),
  resolution      VARCHAR(10) CHECK (resolution IN ('YES', 'NO', NULL)),
  opened_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast per-user lookups
CREATE INDEX IF NOT EXISTS idx_user_positions_user_id ON user_positions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_positions_platform ON user_positions(platform);
CREATE INDEX IF NOT EXISTS idx_user_positions_status ON user_positions(status);
CREATE INDEX IF NOT EXISTS idx_user_positions_market ON user_positions(platform, market_id);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_user_positions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_user_positions_updated_at
  BEFORE UPDATE ON user_positions
  FOR EACH ROW EXECUTE FUNCTION update_user_positions_updated_at();
