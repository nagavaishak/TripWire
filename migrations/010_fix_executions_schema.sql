-- Fix executions table to match service expectations

-- Add tx_signature column if it doesn't exist
ALTER TABLE executions ADD COLUMN IF NOT EXISTS tx_signature VARCHAR(88);

-- Ensure error_message column exists
ALTER TABLE executions ADD COLUMN IF NOT EXISTS error_message TEXT;

-- Audit log
INSERT INTO audit_log (event_type, resource_type, action, details)
VALUES ('MIGRATION', 'schema', 'fix_executions_schema', '{"migration": "010_fix_executions_schema.sql"}');
