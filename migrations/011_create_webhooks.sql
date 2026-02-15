-- Create webhooks table for user notifications

CREATE TABLE IF NOT EXISTS webhooks (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL CHECK (type IN ('HTTP', 'EMAIL', 'SLACK', 'DISCORD')),
  url TEXT,
  email VARCHAR(255),
  events JSONB NOT NULL DEFAULT '[]',
  enabled BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB DEFAULT '{}',
  last_triggered_at TIMESTAMP,
  failure_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Ensure either URL or email is provided
  CONSTRAINT webhook_destination_check CHECK (
    (type = 'EMAIL' AND email IS NOT NULL) OR
    (type IN ('HTTP', 'SLACK', 'DISCORD') AND url IS NOT NULL)
  )
);

-- Indexes for performance
CREATE INDEX idx_webhooks_user_id ON webhooks(user_id);
CREATE INDEX idx_webhooks_enabled ON webhooks(enabled) WHERE enabled = true;
CREATE INDEX idx_webhooks_events ON webhooks USING GIN (events);

-- Audit log
INSERT INTO audit_log (event_type, resource_type, action, details)
VALUES ('MIGRATION', 'schema', 'create_webhooks', '{"migration": "011_create_webhooks.sql"}');
