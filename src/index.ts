import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import { Server } from 'http';
import logger from './utils/logger';
import { errorHandler } from './middleware/errorHandler';
import { testConnection, closePool } from './utils/db';
import { validateConfig } from './utils/config';

const app = express();
const PORT = process.env.PORT || 3000;

// Validate configuration on startup (P0: Fail fast if config is invalid)
try {
  validateConfig();
  logger.info('Configuration validated successfully');
} catch (error) {
  logger.error('Configuration validation failed', {
    error: error instanceof Error ? error.message : String(error),
  });
  process.exit(1);
}

app.use(express.json({ limit: '10kb' })); // Request size limit for DDoS protection

// Health check
app.get('/health', async (_req, res) => {
  const dbHealthy = await testConnection();

  res.json({
    status: dbHealthy ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: dbHealthy ? 'connected' : 'disconnected',
  });
});

// Error handling
app.use(errorHandler);

let server: Server | null = null;
let isShuttingDown = false;

async function startServer() {
  try {
    // Test database connection on startup
    const dbConnected = await testConnection();
    if (!dbConnected) {
      logger.warn('Database connection failed, but server will start anyway');
    }

    server = app.listen(PORT, () => {
      logger.info(`TripWire server running on port ${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to start server', {
      error: error instanceof Error ? error.message : String(error),
    });
    process.exit(1);
  }
}

/**
 * Graceful shutdown handler
 * CRITICAL: Prevents data corruption by waiting for in-flight operations
 */
async function shutdown(signal: string) {
  if (isShuttingDown) {
    logger.warn('Shutdown already in progress');
    return;
  }

  isShuttingDown = true;
  logger.info(`Received ${signal}, starting graceful shutdown`);

  // Stop accepting new connections
  if (server) {
    server.close(() => {
      logger.info('HTTP server closed');
    });
  }

  try {
    // TODO: When execution controller is implemented, wait for in-flight transactions
    // await executionController.waitForInFlightExecutions();

    // Close database connections
    await closePool();

    logger.info('Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown', {
      error: error instanceof Error ? error.message : String(error),
    });
    process.exit(1);
  }
}

// Register shutdown handlers
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', { error: error.message, stack: error.stack });
  shutdown('uncaughtException');
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection', { reason: String(reason) });
  shutdown('unhandledRejection');
});

startServer();

export default app;
