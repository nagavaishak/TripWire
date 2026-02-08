import winston from 'winston';

// Production: Only log to stdout (JSON format) - Railway captures this
// Development: Log to console (colorized) + files for debugging
const transports: winston.transport[] = [];

if (process.env.NODE_ENV === 'production') {
  // Production: JSON to stdout only (no files - they're ephemeral in containers)
  transports.push(
    new winston.transports.Console({
      format: winston.format.json(),
    }),
  );
} else {
  // Development: Colorized console + file logs
  transports.push(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple(),
      ),
    }),
  );
  transports.push(
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
  );
  transports.push(new winston.transports.File({ filename: 'combined.log' }));
}

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json(),
  ),
  defaultMeta: { service: 'tripwire' },
  transports,
});

// SECURITY: Never log sensitive data (private keys, encryption keys, passwords)
// Part of P0_008: Secrets Management Hardening
//
// Multi-layer redaction strategy:
// 1. Field name matching (exact and pattern-based)
// 2. Value pattern matching (detects keys/tokens by format)
// 3. Nested object traversal (catches secrets in nested structures)

const sensitiveFieldNames = [
  // Private keys
  'privateKey',
  'private_key',
  'secretKey',
  'secret_key',
  'encrypted_private_key',
  // Encryption
  'masterKey',
  'master_key',
  'encryption_key',
  'auth_tag',
  'authTag',
  'encryption_iv',
  'iv',
  // Authentication
  'password',
  'api_key',
  'apiKey',
  'api_key_hash',
  'bearer',
  'token',
  'auth_token',
  'authorization',
  // Secrets
  'secret',
  'SECRET',
  'MASTER_ENCRYPTION_KEY',
  'DATABASE_URL',
  'KALSHI_API_KEY',
  'SOLANA_PRIVATE_KEY',
];

// Value patterns that look like secrets (regex detection)
const sensitivePatterns = [
  /^[0-9a-fA-F]{64}$/, // 32-byte hex strings (encryption keys)
  /^[0-9a-fA-F]{32}$/, // 16-byte hex strings (auth tags, IVs)
  /^tw_[A-Za-z0-9_-]{32,}$/, // TripWire API keys
  /^Bearer\s+.+$/i, // Bearer tokens
  /^[1-9A-HJ-NP-Za-km-z]{32,44}$/, // Solana private keys (base58)
  /postgres:\/\/.*:.*@/, // PostgreSQL connection strings with passwords
  /^sk_[a-zA-Z0-9]{32,}$/, // Generic secret keys
];

/**
 * Recursively redact sensitive data in objects
 * CRITICAL: Traverses nested objects and arrays
 */
function redactSensitiveData(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map((item) => redactSensitiveData(item));
  }

  // Handle non-objects (primitives)
  if (typeof obj !== 'object') {
    // Check if value matches sensitive pattern
    if (typeof obj === 'string') {
      for (const pattern of sensitivePatterns) {
        if (pattern.test(obj)) {
          return '[REDACTED]';
        }
      }
    }
    return obj;
  }

  // Handle objects
  const redacted: any = {};
  for (const [key, value] of Object.entries(obj)) {
    // Check if field name is sensitive
    const keyLower = key.toLowerCase();
    const isSensitiveField = sensitiveFieldNames.some(
      (sensitiveField) =>
        keyLower === sensitiveField.toLowerCase() ||
        keyLower.includes(sensitiveField.toLowerCase()),
    );

    if (isSensitiveField) {
      redacted[key] = '[REDACTED]';
    } else if (typeof value === 'string') {
      // Check if value matches sensitive pattern
      let isRedacted = false;
      for (const pattern of sensitivePatterns) {
        if (pattern.test(value)) {
          redacted[key] = '[REDACTED]';
          isRedacted = true;
          break;
        }
      }
      if (!isRedacted) {
        redacted[key] = value;
      }
    } else if (typeof value === 'object') {
      // Recursively redact nested objects
      redacted[key] = redactSensitiveData(value);
    } else {
      redacted[key] = value;
    }
  }

  return redacted;
}

// Apply redaction to all log entries
logger.on('data', (log) => {
  // Redact the entire log object recursively
  Object.keys(log).forEach((key) => {
    log[key] = redactSensitiveData(log[key]);
  });
});

export default logger;
