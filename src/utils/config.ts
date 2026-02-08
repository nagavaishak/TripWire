/**
 * System configuration and constants
 * Centralizes all configuration to avoid magic numbers throughout codebase
 */

export const CONFIG = {
  // Execution control
  EXECUTION_ENABLED: process.env.EXECUTION_ENABLED !== 'false', // Kill switch - set to 'false' to stop all executions

  // Database
  DATABASE_MAX_CONNECTIONS: parseInt(process.env.DATABASE_MAX_CONNECTIONS || '10', 10),

  // Kalshi API
  KALSHI_API_KEY_ID: process.env.KALSHI_API_KEY_ID || '',
  KALSHI_PRIVATE_KEY: process.env.KALSHI_PRIVATE_KEY || '',
  KALSHI_PRIVATE_KEY_PATH: process.env.KALSHI_PRIVATE_KEY_PATH || '',
  KALSHI_ENVIRONMENT: (process.env.KALSHI_ENVIRONMENT || 'production') as 'demo' | 'production',
  KALSHI_POLL_INTERVAL_MS: parseInt(process.env.KALSHI_POLL_INTERVAL_MS || '900000', 10), // 15 minutes
  KALSHI_MOCK_MODE: process.env.KALSHI_MOCK_MODE === 'true',

  // Rule evaluation
  RULE_COOLDOWN_HOURS: parseInt(process.env.RULE_COOLDOWN_HOURS || '24', 10),
  ABNORMAL_JUMP_THRESHOLD: parseFloat(process.env.ABNORMAL_JUMP_THRESHOLD || '0.15'), // 15%
  ABNORMAL_JUMP_WINDOW_HOURS: parseInt(process.env.ABNORMAL_JUMP_WINDOW_HOURS || '2', 10),

  // Swap limits (P0: Aggregate exposure limits needed)
  MAX_SWAP_VALUE_USD: parseInt(process.env.MAX_SWAP_VALUE_USD || '10000', 10),
  MAX_USER_AGGREGATE_EXPOSURE_USD: parseInt(process.env.MAX_USER_AGGREGATE_EXPOSURE_USD || '50000', 10),

  // Transaction settings
  SLIPPAGE_TOLERANCE_BPS: parseInt(process.env.SLIPPAGE_TOLERANCE_BPS || '200', 10), // 2%
  TRANSACTION_CONFIRMATION_COMMITMENT: (process.env.TRANSACTION_CONFIRMATION_COMMITMENT || 'finalized') as 'finalized' | 'confirmed',
  TRANSACTION_TIMEOUT_MS: parseInt(process.env.TRANSACTION_TIMEOUT_MS || '60000', 10), // 60 seconds

  // Retry logic
  EXECUTION_MAX_RETRIES: parseInt(process.env.EXECUTION_MAX_RETRIES || '1', 10),
  EXECUTION_RETRY_DELAY_MS: parseInt(process.env.EXECUTION_RETRY_DELAY_MS || '120000', 10), // 2 minutes

  // Security
  MASTER_ENCRYPTION_KEY: process.env.MASTER_ENCRYPTION_KEY || '',
  API_KEY: process.env.API_KEY || '',

  // External services
  JUPITER_MOCK_MODE: process.env.JUPITER_MOCK_MODE === 'true',
  JUPITER_API_URL: process.env.JUPITER_API_URL || 'https://quote-api.jup.ag/v6',
  SOLANA_RPC_URL: process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',

  // Health checks
  HEALTH_CHECK_INTERVAL_MS: parseInt(process.env.HEALTH_CHECK_INTERVAL_MS || '60000', 10), // 1 minute

  // Notifications
  SENDGRID_API_KEY: process.env.SENDGRID_API_KEY || '',
  NOTIFICATION_MOCK_MODE: process.env.NOTIFICATION_MOCK_MODE === 'true' || !process.env.SENDGRID_API_KEY,

  // Rate limiting
  RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10), // 1 minute
  RATE_LIMIT_MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),

  // Supported tokens (P1: Token allowlist)
  SUPPORTED_TOKENS: {
    SOL: 'So11111111111111111111111111111111111111112',
    USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    USDT: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
  } as const,
};

/**
 * Validate critical configuration on startup
 * Throws if configuration is invalid or missing required values
 */
export function validateConfig(): void {
  const errors: string[] = [];

  // P0: Master encryption key validation
  if (!CONFIG.MASTER_ENCRYPTION_KEY) {
    errors.push('MASTER_ENCRYPTION_KEY is required');
  } else if (CONFIG.MASTER_ENCRYPTION_KEY.length !== 64) {
    errors.push('MASTER_ENCRYPTION_KEY must be 32 bytes (64 hex characters)');
  }

  // Database URL
  if (!process.env.DATABASE_URL) {
    errors.push('DATABASE_URL is required');
  }

  // API key for authentication
  if (!CONFIG.API_KEY) {
    errors.push('API_KEY is required for authentication');
  }

  // Kalshi API validation (warn only, not critical for startup)
  if (!CONFIG.KALSHI_MOCK_MODE) {
    if (!CONFIG.KALSHI_API_KEY_ID) {
      console.warn('WARNING: KALSHI_API_KEY_ID not set - Kalshi API calls will fail');
    }
    if (!CONFIG.KALSHI_PRIVATE_KEY && !CONFIG.KALSHI_PRIVATE_KEY_PATH) {
      console.warn('WARNING: KALSHI_PRIVATE_KEY or KALSHI_PRIVATE_KEY_PATH not set - Kalshi API calls will fail');
    }
  }

  // Commitment level validation (P0)
  if (!['finalized', 'confirmed'].includes(CONFIG.TRANSACTION_CONFIRMATION_COMMITMENT)) {
    errors.push('TRANSACTION_CONFIRMATION_COMMITMENT must be "finalized" or "confirmed"');
  }

  if (CONFIG.TRANSACTION_CONFIRMATION_COMMITMENT === 'confirmed') {
    console.warn(
      'WARNING: Using "confirmed" commitment. Recommended to use "finalized" for production to prevent transaction rollbacks.',
    );
  }

  if (errors.length > 0) {
    throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
  }
}

/**
 * Check if execution is globally enabled (kill switch)
 * P0: Every execution must check this before proceeding
 */
export function isExecutionEnabled(): boolean {
  return CONFIG.EXECUTION_ENABLED;
}

/**
 * Check if a token is supported
 */
export function isSupportedToken(tokenMint: string): boolean {
  return Object.values(CONFIG.SUPPORTED_TOKENS).includes(tokenMint as any);
}
