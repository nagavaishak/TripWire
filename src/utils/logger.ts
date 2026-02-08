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
// Add a filter to redact sensitive fields if accidentally logged
const sensitiveFields = ['privateKey', 'private_key', 'secret', 'password', 'auth_tag', 'encryption_iv'];
logger.on('data', (log) => {
  sensitiveFields.forEach((field) => {
    if (log[field]) {
      log[field] = '[REDACTED]';
    }
  });
});

export default logger;
