-- Add dead letter queue for failed execution recovery
-- Part of P0_006: Dead Letter Queue for FAILED Recovery

-- Add retry_count to executions table
ALTER TABLE executions ADD COLUMN retry_count INTEGER NOT NULL DEFAULT 0;

-- Create dead letter queue table
CREATE TABLE dead_letter_queue (
  id SERIAL PRIMARY KEY,
  execution_id INTEGER NOT NULL REFERENCES executions(id) ON DELETE CASCADE,
  failure_reason TEXT NOT NULL,
  retry_count INTEGER NOT NULL,
  last_attempt_at TIMESTAMP NOT NULL,
  moved_to_dlq_at TIMESTAMP NOT NULL DEFAULT NOW(),
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'RETRYING', 'RESOLVED', 'ABANDONED')),
  resolution_notes TEXT,
  resolved_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Unique constraint: execution can only be in DLQ once at a time
CREATE UNIQUE INDEX idx_dlq_execution_id ON dead_letter_queue(execution_id) WHERE status IN ('PENDING', 'RETRYING');

-- Index for status queries
CREATE INDEX idx_dlq_status ON dead_letter_queue(status);

-- Index for moved_to_dlq_at (for chronological queries)
CREATE INDEX idx_dlq_moved_at ON dead_letter_queue(moved_to_dlq_at DESC);

-- Index for retry_count on executions table
CREATE INDEX idx_executions_retry_count ON executions(retry_count);

-- Audit log
INSERT INTO audit_log (event_type, resource_type, action, details)
VALUES ('MIGRATION', 'schema', 'add_dead_letter_queue', '{"migration": "006_add_dead_letter_queue.sql"}');
