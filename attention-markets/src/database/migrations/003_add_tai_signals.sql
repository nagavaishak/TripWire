-- Migration 003: TAI (TripWire Attention Index) signal components + narrative detection

ALTER TABLE attention_scores
  ADD COLUMN IF NOT EXISTS tai_level     FLOAT,
  ADD COLUMN IF NOT EXISTS tai_momentum  FLOAT,
  ADD COLUMN IF NOT EXISTS tai_velocity  FLOAT,
  ADD COLUMN IF NOT EXISTS tai_consensus FLOAT,
  ADD COLUMN IF NOT EXISTS tai_score     FLOAT;

CREATE TABLE IF NOT EXISTS narratives (
  id          SERIAL PRIMARY KEY,
  keyword     TEXT,
  source      TEXT,
  growth      FLOAT,
  detected_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_narratives_detected ON narratives (detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_narratives_growth   ON narratives (growth DESC);
