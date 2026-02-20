-- Migration 013: Add platform field to executions and rules
-- Supports routing between Kalshi and Polymarket

ALTER TABLE executions
  ADD COLUMN IF NOT EXISTS platform VARCHAR(20) DEFAULT 'kalshi'
    CHECK (platform IN ('kalshi', 'polymarket'));

ALTER TABLE rules
  ADD COLUMN IF NOT EXISTS platform VARCHAR(20) DEFAULT 'kalshi'
    CHECK (platform IN ('kalshi', 'polymarket'));

INSERT INTO schema_migrations (version, description) VALUES
  ('013', 'add_platform_to_executions')
ON CONFLICT (version) DO NOTHING;
