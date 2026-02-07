import dotenv from 'dotenv';
dotenv.config();

import { runMigrations, closePool } from '../utils/db';
import logger from '../utils/logger';

async function main() {
  try {
    logger.info('Starting database migrations...');
    await runMigrations();
    logger.info('Migrations completed successfully');
    process.exit(0);
  } catch (error) {
    logger.error('Migration script failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    process.exit(1);
  } finally {
    await closePool();
  }
}

main();
