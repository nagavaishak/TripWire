-- Fix automation_wallets schema to match service expectations
-- Add missing columns and rename existing ones

-- Add name column
ALTER TABLE automation_wallets ADD COLUMN IF NOT EXISTS name VARCHAR(255);

-- Add public_key column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='automation_wallets' AND column_name='public_key') THEN
    -- If address column exists, rename it to public_key
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name='automation_wallets' AND column_name='address') THEN
      ALTER TABLE automation_wallets RENAME COLUMN address TO public_key;
    ELSE
      ALTER TABLE automation_wallets ADD COLUMN public_key VARCHAR(44) UNIQUE NOT NULL;
    END IF;
  END IF;
END $$;

-- Rename encryption_iv to iv if needed
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name='automation_wallets' AND column_name='encryption_iv') THEN
    ALTER TABLE automation_wallets RENAME COLUMN encryption_iv TO iv;
  ELSIF NOT EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_name='automation_wallets' AND column_name='iv') THEN
    ALTER TABLE automation_wallets ADD COLUMN iv VARCHAR(32) NOT NULL;
  END IF;
END $$;

-- Add key_version if it doesn't exist
ALTER TABLE automation_wallets ADD COLUMN IF NOT EXISTS key_version INTEGER DEFAULT 1;

-- Remove old balance columns if they exist (we calculate balance on demand)
ALTER TABLE automation_wallets DROP COLUMN IF EXISTS balance_sol;
ALTER TABLE automation_wallets DROP COLUMN IF EXISTS balance_usdc;
ALTER TABLE automation_wallets DROP COLUMN IF EXISTS last_balance_check;

-- Remove unique constraint on user_id (users can have multiple wallets)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'automation_wallets_user_id_key') THEN
    ALTER TABLE automation_wallets DROP CONSTRAINT automation_wallets_user_id_key;
  END IF;
END $$;

-- Audit log
INSERT INTO audit_log (event_type, resource_type, action, details)
VALUES ('MIGRATION', 'schema', 'fix_automation_wallets_schema', '{"migration": "008_fix_automation_wallets_schema.sql"}');
