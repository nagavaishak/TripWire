import { Connection, Commitment } from '@solana/web3.js';
import { CONFIG } from './config';
import logger from './logger';

let connection: Connection | null = null;

/**
 * Get Solana connection (singleton)
 * Uses commitment level from config (finalized by default)
 */
export function getSolanaConnection(): Connection {
  if (!connection) {
    const commitment: Commitment = CONFIG.TRANSACTION_CONFIRMATION_COMMITMENT as Commitment;

    connection = new Connection(CONFIG.SOLANA_RPC_URL, {
      commitment,
      confirmTransactionInitialTimeout: CONFIG.TRANSACTION_TIMEOUT_MS,
    });

    logger.info('Solana connection initialized', {
      rpcUrl: CONFIG.SOLANA_RPC_URL,
      commitment,
    });
  }

  return connection;
}

/**
 * Check if Solana RPC is healthy
 */
export async function checkSolanaHealth(): Promise<boolean> {
  try {
    const connection = getSolanaConnection();
    const slot = await connection.getSlot();

    logger.debug('Solana health check passed', { slot });
    return true;
  } catch (error) {
    logger.error('Solana health check failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

/**
 * Get current slot number
 */
export async function getCurrentSlot(): Promise<number> {
  const connection = getSolanaConnection();
  return await connection.getSlot();
}

/**
 * Close Solana connection (for graceful shutdown)
 */
export function closeSolanaConnection(): void {
  if (connection) {
    // Solana web3.js doesn't have explicit close, but clear reference
    connection = null;
    logger.info('Solana connection closed');
  }
}
