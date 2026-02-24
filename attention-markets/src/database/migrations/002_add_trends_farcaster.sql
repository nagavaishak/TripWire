-- Migration 002: Add Google Trends + Farcaster columns
ALTER TABLE attention_scores
  ADD COLUMN IF NOT EXISTS google_trends_ei        DECIMAL(6,4),
  ADD COLUMN IF NOT EXISTS farcaster_ei            DECIMAL(6,4),
  ADD COLUMN IF NOT EXISTS google_trends_raw_score DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS farcaster_raw_score     DECIMAL(12,2);
