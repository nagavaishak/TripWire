-- Add secrets audit trail for security monitoring
-- Part of P0_008: Secrets Management Hardening

-- Add key_version to automation_wallets for key rotation support
ALTER TABLE automation_wallets ADD COLUMN key_version INTEGER NOT NULL DEFAULT 1;

-- Create secrets audit table
CREATE TABLE secrets_audit (
  id SERIAL PRIMARY KEY,
  key_type VARCHAR(50) NOT NULL, -- 'master_key', 'wallet_key', 'api_key', etc.
  resource_type VARCHAR(50), -- 'automation_wallet', 'user', etc.
  resource_id INTEGER, -- ID of the resource (wallet ID, user ID, etc.)
  action VARCHAR(50) NOT NULL, -- 'decrypt', 'encrypt', 'validate', 'rotate', etc.
  accessed_by VARCHAR(255), -- Process/user that accessed the secret
  accessed_at TIMESTAMP NOT NULL DEFAULT NOW(),
  success BOOLEAN NOT NULL DEFAULT TRUE,
  error_message TEXT,
  ip_address INET, -- Client IP if applicable
  user_agent TEXT, -- User agent if applicable
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Index for key_type queries
CREATE INDEX idx_secrets_audit_key_type ON secrets_audit(key_type);

-- Index for resource lookups
CREATE INDEX idx_secrets_audit_resource ON secrets_audit(resource_type, resource_id);

-- Index for action queries
CREATE INDEX idx_secrets_audit_action ON secrets_audit(action);

-- Index for accessed_at (chronological queries)
CREATE INDEX idx_secrets_audit_accessed_at ON secrets_audit(accessed_at DESC);

-- Index for failed access attempts (security monitoring)
CREATE INDEX idx_secrets_audit_failed ON secrets_audit(success) WHERE success = FALSE;

-- Index for key_version on automation_wallets
CREATE INDEX idx_automation_wallets_key_version ON automation_wallets(key_version);

-- Function to clean up old audit logs
CREATE OR REPLACE FUNCTION cleanup_old_secrets_audit(days_to_keep INTEGER DEFAULT 90) RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM secrets_audit
  WHERE accessed_at < NOW() - (days_to_keep || ' days')::INTERVAL;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Audit log
INSERT INTO audit_log (event_type, resource_type, action, details)
VALUES ('MIGRATION', 'schema', 'add_secrets_audit', '{"migration": "007_add_secrets_audit.sql"}');
