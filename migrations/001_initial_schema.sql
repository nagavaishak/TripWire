-- TripWire Initial Database Schema

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    main_wallet_address VARCHAR(44) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Automation wallets table
CREATE TABLE IF NOT EXISTS automation_wallets (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    address VARCHAR(44) UNIQUE NOT NULL,
    encrypted_private_key TEXT NOT NULL,
    encryption_iv VARCHAR(32) NOT NULL,
    auth_tag VARCHAR(32) NOT NULL, -- CRITICAL: Required for AES-256-GCM integrity verification
    balance_sol DECIMAL(20, 9) DEFAULT 0,
    balance_usdc DECIMAL(20, 6) DEFAULT 0,
    last_balance_check TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id)
);

-- Rules table
CREATE TABLE IF NOT EXISTS rules (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    automation_wallet_id INTEGER NOT NULL REFERENCES automation_wallets(id) ON DELETE CASCADE,

    -- Rule configuration
    market_id VARCHAR(100) NOT NULL,
    trigger_type VARCHAR(20) NOT NULL CHECK (trigger_type IN ('above', 'below')),
    threshold_probability DECIMAL(5, 4) NOT NULL CHECK (threshold_probability >= 0 AND threshold_probability <= 1),

    -- Swap configuration
    input_token VARCHAR(44) NOT NULL,
    output_token VARCHAR(44) NOT NULL,
    swap_amount DECIMAL(20, 6) NOT NULL,
    slippage_bps INTEGER DEFAULT 200 CHECK (slippage_bps >= 0 AND slippage_bps <= 10000),

    -- Cooldown configuration
    cooldown_hours INTEGER DEFAULT 24 CHECK (cooldown_hours > 0),

    -- State
    status VARCHAR(20) NOT NULL DEFAULT 'CREATED' CHECK (status IN ('CREATED', 'ACTIVE', 'TRIGGERED', 'EXECUTING', 'EXECUTED', 'FAILED', 'PAUSED', 'CANCELLED')),

    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    activated_at TIMESTAMP,
    triggered_at TIMESTAMP,
    last_triggered_at TIMESTAMP, -- For cooldown enforcement
    executed_at TIMESTAMP,
    cancelled_at TIMESTAMP,

    -- Metadata
    last_checked_at TIMESTAMP,
    error_message TEXT,

    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Executions table
CREATE TABLE IF NOT EXISTS executions (
    id SERIAL PRIMARY KEY,
    rule_id INTEGER NOT NULL REFERENCES rules(id) ON DELETE CASCADE,

    -- Execution details
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PRE_FLIGHT_CHECK', 'GETTING_QUOTE', 'BUILDING_TX', 'SIGNING', 'SENDING', 'CONFIRMING', 'SUCCESS', 'FAILED')),

    -- Market data at execution
    market_probability DECIMAL(5, 4),

    -- Swap details
    input_token VARCHAR(44),
    output_token VARCHAR(44),
    input_amount DECIMAL(20, 6),
    expected_output_amount DECIMAL(20, 6),
    actual_output_amount DECIMAL(20, 6),

    -- Solana transaction
    transaction_signature VARCHAR(88),
    slot BIGINT,
    block_time TIMESTAMP,
    compute_units_consumed INTEGER,
    priority_fee BIGINT,

    -- Error handling
    error_type VARCHAR(50),
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,

    -- Timestamps
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Market snapshots table (for monitoring Kalshi)
CREATE TABLE IF NOT EXISTS market_snapshots (
    id SERIAL PRIMARY KEY,
    market_id VARCHAR(100) NOT NULL,
    probability DECIMAL(5, 4) NOT NULL,
    volume DECIMAL(20, 2),
    open_interest DECIMAL(20, 2),
    timestamp TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Audit log table (append-only, immutable audit trail)
CREATE TABLE IF NOT EXISTS audit_log (
    id SERIAL PRIMARY KEY,
    event_type VARCHAR(50) NOT NULL, -- 'AUTH', 'RULE_CREATE', 'RULE_UPDATE', 'RULE_DELETE', 'WITHDRAWAL', 'EXECUTION', 'CONFIG_CHANGE'
    user_id INTEGER REFERENCES users(id),
    resource_type VARCHAR(50), -- 'rule', 'wallet', 'user', 'system'
    resource_id VARCHAR(100),
    action VARCHAR(50) NOT NULL,
    details JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Schema migrations tracking table
CREATE TABLE IF NOT EXISTS schema_migrations (
    id SERIAL PRIMARY KEY,
    version VARCHAR(255) UNIQUE NOT NULL,
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Indexes for performance
CREATE INDEX idx_rules_user_id ON rules(user_id);
CREATE INDEX idx_rules_status ON rules(status);
CREATE INDEX idx_rules_market_id ON rules(market_id);
CREATE INDEX idx_rules_status_last_triggered ON rules(status, last_triggered_at);
CREATE INDEX idx_executions_rule_id ON executions(rule_id);
CREATE INDEX idx_executions_status ON executions(status);
CREATE INDEX idx_executions_created_at ON executions(created_at DESC);
CREATE INDEX idx_market_snapshots_market_timestamp ON market_snapshots(market_id, timestamp DESC);
CREATE INDEX idx_automation_wallets_user_id ON automation_wallets(user_id);
CREATE INDEX idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX idx_audit_log_event_type ON audit_log(event_type);
CREATE INDEX idx_audit_log_created_at ON audit_log(created_at DESC);
CREATE INDEX idx_audit_log_resource ON audit_log(resource_type, resource_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_automation_wallets_updated_at BEFORE UPDATE ON automation_wallets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_rules_updated_at BEFORE UPDATE ON rules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_executions_updated_at BEFORE UPDATE ON executions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
