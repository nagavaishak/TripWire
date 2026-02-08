-- Add API key authentication to users table
-- Part of P0_001: User Authentication & Authorization

ALTER TABLE users ADD COLUMN api_key_hash VARCHAR(64) UNIQUE;

-- Index for fast API key lookups
CREATE UNIQUE INDEX idx_users_api_key_hash ON users(api_key_hash);

-- Add audit logging for user creation
INSERT INTO audit_log (event_type, resource_type, action, details)
VALUES ('MIGRATION', 'schema', 'add_api_key_hash', '{"migration": "002_add_user_api_keys.sql", "table": "users", "column": "api_key_hash"}');
