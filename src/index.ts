import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import { Server } from 'http';
import logger from './utils/logger';
import { errorHandler } from './middleware/errorHandler';
import { testConnection, closePool } from './utils/db';
import { validateConfig } from './utils/config';
import { authenticate } from './middleware/auth.middleware';
import { userService } from './services/user.service';
import { closeSolanaConnection } from './utils/solana';
import { marketPollerService } from './services/market-poller.service';

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

// Enable CORS for frontend
app.use(cors({
  origin: ['http://localhost:3001', 'http://127.0.0.1:3001'],
  credentials: true,
}));

app.use(express.json({ limit: '10kb' })); // Request size limit for DDoS protection

// Public routes (no authentication required)
app.get('/health', async (_req, res) => {
  const dbHealthy = await testConnection();
  const pollerStatus = marketPollerService.getStatus();

  res.json({
    status: dbHealthy ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: dbHealthy ? 'connected' : 'disconnected',
    marketPoller: {
      running: pollerStatus.isRunning,
      paused: pollerStatus.isPaused,
      lastPollTime: pollerStatus.lastPollTime,
      pollCount: pollerStatus.pollCount,
      errorCount: pollerStatus.errorCount,
    },
  });
});

// User registration endpoint (public)
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, main_wallet_address } = req.body;

    if (!email || !main_wallet_address) {
      res.status(400).json({
        error: 'Email and main_wallet_address are required',
        code: 'MISSING_FIELDS',
      });
      return;
    }

    // Validate email format
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({
        error: 'Invalid email format',
        code: 'INVALID_EMAIL',
      });
      return;
    }

    // Validate Solana address format (44 characters, base58)
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(main_wallet_address)) {
      res.status(400).json({
        error: 'Invalid Solana wallet address',
        code: 'INVALID_WALLET',
      });
      return;
    }

    const { user, apiKey } = await userService.createUser(
      email,
      main_wallet_address,
    );

    res.status(201).json({
      message: 'User created successfully',
      user: {
        id: user.id,
        email: user.email,
        main_wallet_address: user.main_wallet_address,
        created_at: user.created_at,
      },
      api_key: apiKey, // ONLY TIME THIS IS VISIBLE - save it!
      warning: 'Save your API key securely. It will not be shown again.',
    });
  } catch (error) {
    logger.error('User registration error', {
      error: error instanceof Error ? error.message : String(error),
    });

    if (error instanceof Error && error.message.includes('already exists')) {
      res.status(409).json({
        error: error.message,
        code: 'USER_EXISTS',
      });
      return;
    }

    res.status(500).json({
      error: 'Failed to create user',
      code: 'REGISTRATION_ERROR',
    });
  }
});

// Protected routes - require authentication
app.use('/api', authenticate); // All /api/* routes now require Bearer token

// Test endpoint to verify authentication
app.get('/api/me', (req, res) => {
  res.json({
    user: {
      id: req.user!.id,
      email: req.user!.email,
      main_wallet_address: req.user!.main_wallet_address,
    },
  });
});

// API Routes
import rulesRoutes from './routes/rules.routes';
import walletsRoutes from './routes/wallets.routes';
import webhooksRoutes from './routes/webhooks.routes';
import adminRoutes from './routes/admin.routes';

app.use('/api/rules', rulesRoutes);
app.use('/api/wallets', walletsRoutes);
app.use('/api/webhooks', webhooksRoutes);
app.use('/api/admin', adminRoutes);

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

      // Start market poller after server is running
      try {
        marketPollerService.start();
        logger.info('Market poller started');
      } catch (error) {
        logger.error('Failed to start market poller', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
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
    // Stop market poller
    try {
      marketPollerService.stop();
      logger.info('Market poller stopped');
    } catch (error) {
      logger.error('Error stopping market poller', {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // TODO: Wait for in-flight executions to complete
    // For now, give brief time for any active operations
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Close Solana connection
    closeSolanaConnection();

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
