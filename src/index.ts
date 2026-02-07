import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import logger from './utils/logger';
import { errorHandler } from './middleware/errorHandler';
import { testConnection } from './utils/db';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

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

async function startServer() {
  try {
    // Test database connection on startup
    const dbConnected = await testConnection();
    if (!dbConnected) {
      logger.warn('Database connection failed, but server will start anyway');
    }

    app.listen(PORT, () => {
      logger.info(`TripWire server running on port ${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to start server', {
      error: error instanceof Error ? error.message : String(error),
    });
    process.exit(1);
  }
}

startServer();

export default app;
