-- Fix rules schema to match service expectations

-- Add name column
ALTER TABLE rules ADD COLUMN IF NOT EXISTS name VARCHAR(255);

-- Rename market_id to kalshi_market_id if needed
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name='rules' AND column_name='market_id') THEN
    ALTER TABLE rules RENAME COLUMN market_id TO kalshi_market_id;
  ELSIF NOT EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_name='rules' AND column_name='kalshi_market_id') THEN
    ALTER TABLE rules ADD COLUMN kalshi_market_id VARCHAR(100) NOT NULL;
  END IF;
END $$;

-- Add condition_type column (replaces old trigger_type logic)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='rules' AND column_name='condition_type') THEN
    ALTER TABLE rules ADD COLUMN condition_type VARCHAR(20) NOT NULL DEFAULT 'THRESHOLD_ABOVE'
      CHECK (condition_type IN ('THRESHOLD_ABOVE', 'THRESHOLD_BELOW'));
  END IF;
END $$;

-- Update trigger_type to use new values
DO $$
BEGIN
  -- Drop old constraint if it exists
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'rules_trigger_type_check') THEN
    ALTER TABLE rules DROP CONSTRAINT rules_trigger_type_check;
  END IF;

  -- Add new constraint
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'rules_trigger_type_check_new') THEN
    ALTER TABLE rules ADD CONSTRAINT rules_trigger_type_check_new
      CHECK (trigger_type IN ('SWAP_TO_STABLECOIN', 'SWAP_TO_SOL'));
  END IF;
END $$;

-- Add swap_percentage column
ALTER TABLE rules ADD COLUMN IF NOT EXISTS swap_percentage INTEGER DEFAULT 100
  CHECK (swap_percentage > 0 AND swap_percentage <= 100);

-- Drop old columns that are no longer used
ALTER TABLE rules DROP COLUMN IF EXISTS input_token;
ALTER TABLE rules DROP COLUMN IF EXISTS output_token;
ALTER TABLE rules DROP COLUMN IF EXISTS swap_amount;
ALTER TABLE rules DROP COLUMN IF EXISTS slippage_bps;

-- Audit log
INSERT INTO audit_log (event_type, resource_type, action, details)
VALUES ('MIGRATION', 'schema', 'fix_rules_schema', '{"migration": "009_fix_rules_schema.sql"}');
