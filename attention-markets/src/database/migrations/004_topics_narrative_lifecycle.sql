-- Migration 004: Topics table + narrative lifecycle

CREATE TABLE IF NOT EXISTS topics (
  id         SERIAL PRIMARY KEY,
  name       TEXT UNIQUE NOT NULL,
  slug       TEXT UNIQUE NOT NULL,
  status     TEXT NOT NULL DEFAULT 'active',   -- 'active' | 'inactive'
  created_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO topics (name, slug, status) VALUES
  ('Solana',    'solana',    'active'),
  ('AI',        'ai',        'active'),
  ('Bitcoin',   'bitcoin',   'inactive'),
  ('Ethereum',  'ethereum',  'inactive'),
  ('Memecoins', 'memecoins', 'inactive')
ON CONFLICT (name) DO NOTHING;

-- Add lifecycle status to narratives
ALTER TABLE narratives
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'emerging';

-- Unique index to enable ON CONFLICT (keyword, source) upserts
CREATE UNIQUE INDEX IF NOT EXISTS idx_narratives_keyword_source
  ON narratives (keyword, source);

CREATE INDEX IF NOT EXISTS idx_narratives_status
  ON narratives (status);
