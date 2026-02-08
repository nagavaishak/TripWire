import { getSolanaConnection } from '../utils/solana';
import logger from '../utils/logger';
import { TransactionConfirmationResult, TransactionStatus } from '../types/solana';

/**
 * Transaction Status Service
 * CRITICAL: Checks if a transaction landed on-chain before retry
 * Part of P0_002: Idempotent Execution
 */
export class TransactionStatusService {
  /**
   * Check if a transaction signature exists on-chain
   * Used to prevent double-execution on retry
   *
   * @param signature - Transaction signature to check
   * @returns Transaction confirmation result with status
   */
  async checkTransactionStatus(
    signature: string,
  ): Promise<TransactionConfirmationResult> {
    const connection = getSolanaConnection();

    try {
      // Get transaction status
      const statusResponse = await connection.getSignatureStatus(signature, {
        searchTransactionHistory: true,
      });

      // Transaction not found
      if (!statusResponse.value) {
        logger.debug('Transaction not found on-chain', { signature });
        return {
          status: 'not_found',
          signature,
        };
      }

      const status = statusResponse.value;

      // Check for errors
      if (status.err) {
        logger.warn('Transaction failed on-chain', {
          signature,
          error: JSON.stringify(status.err),
        });
        return {
          status: 'failed',
          signature,
          slot: status.slot,
          error: JSON.stringify(status.err),
        };
      }

      // Determine confirmation level
      let transactionStatus: TransactionStatus;
      if (status.confirmationStatus === 'finalized') {
        transactionStatus = 'finalized';
      } else if (status.confirmationStatus === 'confirmed') {
        transactionStatus = 'confirmed';
      } else {
        transactionStatus = 'pending';
      }

      // Get block time if available
      let blockTime: Date | undefined;
      if (status.slot) {
        try {
          const blockTimeSeconds = await connection.getBlockTime(status.slot);
          if (blockTimeSeconds) {
            blockTime = new Date(blockTimeSeconds * 1000);
          }
        } catch (error) {
          logger.debug('Could not fetch block time', {
            slot: status.slot,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      logger.info('Transaction status checked', {
        signature,
        status: transactionStatus,
        slot: status.slot,
        confirmations: status.confirmations,
      });

      return {
        status: transactionStatus,
        signature,
        slot: status.slot,
        blockTime,
      };
    } catch (error) {
      logger.error('Error checking transaction status', {
        signature,
        error: error instanceof Error ? error.message : String(error),
      });

      // On error, assume not found (safer for retry)
      return {
        status: 'not_found',
        signature,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Wait for transaction confirmation with timeout
   * CRITICAL: Only use this for initial send, not for checking old transactions
   *
   * @param signature - Transaction signature
   * @param timeoutMs - Timeout in milliseconds (default: 60s)
   * @returns Transaction confirmation result
   */
  async waitForConfirmation(
    signature: string,
    timeoutMs: number = 60000,
  ): Promise<TransactionConfirmationResult> {
    const connection = getSolanaConnection();
    const startTime = Date.now();

    logger.info('Waiting for transaction confirmation', {
      signature,
      timeoutMs,
    });

    try {
      // Use Solana's built-in confirmation waiter
      const result = await connection.confirmTransaction(
        signature,
        'finalized', // Wait for finalized commitment
      );

      const elapsed = Date.now() - startTime;

      if (result.value.err) {
        logger.error('Transaction confirmation failed', {
          signature,
          error: JSON.stringify(result.value.err),
          elapsed,
        });

        return {
          status: 'failed',
          signature,
          error: JSON.stringify(result.value.err),
        };
      }

      logger.info('Transaction confirmed', {
        signature,
        elapsed,
      });

      return {
        status: 'finalized',
        signature,
      };
    } catch (error) {
      const elapsed = Date.now() - startTime;

      // Timeout or other error
      logger.warn('Transaction confirmation timeout or error', {
        signature,
        elapsed,
        error: error instanceof Error ? error.message : String(error),
      });

      // Check if transaction actually landed despite timeout
      const status = await this.checkTransactionStatus(signature);

      if (status.status !== 'not_found') {
        logger.info('Transaction found on-chain despite timeout', {
          signature,
          status: status.status,
        });
        return status;
      }

      return {
        status: 'not_found',
        signature,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Check if transaction is finalized
   * Simple helper for checking if we should mark execution as complete
   *
   * @param signature - Transaction signature
   * @returns true if finalized, false otherwise
   */
  async isTransactionFinalized(signature: string): Promise<boolean> {
    const result = await this.checkTransactionStatus(signature);
    return result.status === 'finalized';
  }
}

// Export singleton instance
export const transactionStatusService = new TransactionStatusService();
