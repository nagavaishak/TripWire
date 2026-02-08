-- Add withdrawal tracking to prevent replay attacks
-- Part of P0_003: Withdrawal Replay Protection

CREATE TABLE withdrawals (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  wallet_id INTEGER NOT NULL REFERENCES automation_wallets(id) ON DELETE CASCADE,
  amount BIGINT NOT NULL CHECK (amount > 0), -- Amount in lamports
  destination_address VARCHAR(44) NOT NULL, -- Solana address
  tx_signature VARCHAR(88), -- Transaction signature (when sent)
  tx_blockhash VARCHAR(44), -- Blockhash used (for retry logic)
  status VARCHAR(20) NOT NULL DEFAULT 'INITIATED' CHECK (status IN ('INITIATED', 'SENT', 'CONFIRMED', 'FAILED', 'CANCELLED')),
  error_message TEXT,
  idempotency_key VARCHAR(64) UNIQUE NOT NULL, -- Prevents duplicate withdrawals
  initiated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMP,
  completed_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Index for user lookups
CREATE INDEX idx_withdrawals_user_id ON withdrawals(user_id);

-- Index for wallet lookups
CREATE INDEX idx_withdrawals_wallet_id ON withdrawals(wallet_id);

-- Index for status queries
CREATE INDEX idx_withdrawals_status ON withdrawals(status);

-- Index for idempotency key lookups (CRITICAL for replay prevention)
CREATE UNIQUE INDEX idx_withdrawals_idempotency_key ON withdrawals(idempotency_key);

-- Composite index to detect exact duplicate withdrawal attempts
CREATE UNIQUE INDEX idx_withdrawals_replay_detection ON withdrawals(user_id, wallet_id, destination_address, amount, DATE_TRUNC('second', initiated_at))
  WHERE status != 'CANCELLED';

-- Audit log
INSERT INTO audit_log (event_type, resource_type, action, details)
VALUES ('MIGRATION', 'schema', 'add_withdrawal_tracking', '{"migration": "004_add_withdrawal_tracking.sql"}');
