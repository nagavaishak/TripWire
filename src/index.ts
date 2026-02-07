import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import logger from './utils/logger';
import { errorHandler } from './middleware/errorHandler';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Health check
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Error handling
app.use(errorHandler);

app.listen(PORT, () => {
  logger.info(`TripWire server running on port ${PORT}`);
});

export default app;
