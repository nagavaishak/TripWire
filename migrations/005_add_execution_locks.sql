-- Add execution locks to prevent concurrent execution
-- Part of P0_004: Concurrent Execution Locks

CREATE TABLE execution_locks (
  id SERIAL PRIMARY KEY,
  rule_id INTEGER NOT NULL REFERENCES rules(id) ON DELETE CASCADE,
  locked_by VARCHAR(255) NOT NULL, -- Process identifier (e.g., hostname:pid)
  locked_at TIMESTAMP NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL, -- Lock expires after 5 minutes to prevent deadlocks
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Unique constraint to prevent concurrent execution of same rule
CREATE UNIQUE INDEX idx_execution_locks_rule_id ON execution_locks(rule_id) WHERE expires_at > NOW();

-- Index for cleanup queries (removing expired locks)
CREATE INDEX idx_execution_locks_expires_at ON execution_locks(expires_at);

-- Index for locked_by queries (monitoring which process holds locks)
CREATE INDEX idx_execution_locks_locked_by ON execution_locks(locked_by);

-- Function to clean up expired locks
CREATE OR REPLACE FUNCTION cleanup_expired_locks() RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM execution_locks WHERE expires_at <= NOW();
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Audit log
INSERT INTO audit_log (event_type, resource_type, action, details)
VALUES ('MIGRATION', 'schema', 'add_execution_locks', '{"migration": "005_add_execution_locks.sql"}');
