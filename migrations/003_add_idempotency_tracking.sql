-- Add idempotency tracking to executions table
-- Part of P0_002: Idempotent Execution

ALTER TABLE executions ADD COLUMN idempotency_key VARCHAR(64) UNIQUE;
ALTER TABLE executions ADD COLUMN tx_sent_at TIMESTAMP;
ALTER TABLE executions ADD COLUMN tx_blockhash VARCHAR(44);

-- Index for idempotency key lookups
CREATE UNIQUE INDEX idx_executions_idempotency_key ON executions(idempotency_key);

-- Audit log
INSERT INTO audit_log (event_type, resource_type, action, details)
VALUES ('MIGRATION', 'schema', 'add_idempotency_tracking', '{"migration": "003_add_idempotency_tracking.sql"}');
