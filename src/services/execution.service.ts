import crypto from 'crypto';
import { query, withTransaction, transactionQuery } from '../utils/db';
import { transactionStatusService } from './transaction-status.service';
import logger from '../utils/logger';
import { PoolClient } from 'pg';

/**
 * Execution Service
 * CRITICAL: Implements idempotent execution to prevent double-draining
 * Part of P0_002: Idempotent Execution
 */
export class ExecutionService {
  /**
   * Generate deterministic idempotency key
   * CRITICAL: Same rule + trigger timestamp always produces same key
   *
   * @param ruleId - Rule ID
   * @param triggeredAt - Exact trigger timestamp
   * @returns Deterministic idempotency key
   */
  generateIdempotencyKey(ruleId: number, triggeredAt: Date): string {
    const data = `${ruleId}:${triggeredAt.toISOString()}`;
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Create execution with idempotency check
   * CRITICAL: Prevents duplicate executions on retry
   *
   * @param ruleId - Rule ID
   * @param triggeredAt - Trigger timestamp
   * @param marketCondition - Kalshi market condition that triggered
   * @param client - Optional transaction client for atomic operations
   * @returns Execution ID or existing execution info
   */
  async createExecution(
    ruleId: number,
    triggeredAt: Date,
    marketCondition: any,
    client?: PoolClient,
  ): Promise<{ id: number; isNew: boolean; existingSignature?: string }> {
    // Generate idempotency key
    const idempotencyKey = this.generateIdempotencyKey(ruleId, triggeredAt);

    logger.info('Creating execution with idempotency check', {
      ruleId,
      triggeredAt,
      idempotencyKey,
    });

    // Check if execution already exists
    const existingResult = client
      ? await transactionQuery(
          client,
          'SELECT id, tx_signature, status FROM executions WHERE idempotency_key = $1',
          [idempotencyKey],
        )
      : await query(
          'SELECT id, tx_signature, status FROM executions WHERE idempotency_key = $1',
          [idempotencyKey],
        );

    if (existingResult.rows.length > 0) {
      const existing = existingResult.rows[0];
      logger.warn('Execution already exists (idempotent retry detected)', {
        executionId: existing.id,
        existingStatus: existing.status,
        txSignature: existing.tx_signature,
        idempotencyKey,
      });

      // If transaction was sent, check if it landed on-chain
      if (existing.tx_signature) {
        const txStatus = await transactionStatusService.checkTransactionStatus(
          existing.tx_signature,
        );

        logger.info('Checked existing transaction status', {
          executionId: existing.id,
          signature: existing.tx_signature,
          onChainStatus: txStatus.status,
        });

        // If transaction landed, we're done
        if (
          txStatus.status === 'finalized' ||
          txStatus.status === 'confirmed'
        ) {
          logger.info('Existing transaction confirmed on-chain', {
            executionId: existing.id,
            signature: existing.tx_signature,
          });
          return {
            id: existing.id,
            isNew: false,
            existingSignature: existing.tx_signature,
          };
        }

        // If transaction failed or not found, we can retry
        // But for now, return existing execution ID
        logger.warn('Existing transaction not confirmed, may need retry', {
          executionId: existing.id,
          signature: existing.tx_signature,
          onChainStatus: txStatus.status,
        });
      }

      return {
        id: existing.id,
        isNew: false,
        existingSignature: existing.tx_signature,
      };
    }

    // Create new execution
    const result = client
      ? await transactionQuery(
          client,
          `INSERT INTO executions
       (rule_id, triggered_at, market_condition, status, idempotency_key, created_at, updated_at)
       VALUES ($1, $2, $3, 'TRIGGERED', $4, NOW(), NOW())
       RETURNING id`,
          [ruleId, triggeredAt, JSON.stringify(marketCondition), idempotencyKey],
        )
      : await query(
          `INSERT INTO executions
       (rule_id, triggered_at, market_condition, status, idempotency_key, created_at, updated_at)
       VALUES ($1, $2, $3, 'TRIGGERED', $4, NOW(), NOW())
       RETURNING id`,
          [ruleId, triggeredAt, JSON.stringify(marketCondition), idempotencyKey],
        );

    const executionId = result.rows[0].id;

    logger.info('New execution created', {
      executionId,
      ruleId,
      idempotencyKey,
    });

    // Log to audit log
    if (client) {
      await transactionQuery(
        client,
        `INSERT INTO audit_log (event_type, resource_type, resource_id, action, details)
       VALUES ('EXECUTION', 'execution', $1, 'created', $2)`,
        [
          executionId,
          JSON.stringify({
            ruleId,
            triggeredAt,
            idempotencyKey,
          }),
        ],
      );
    } else {
      await query(
        `INSERT INTO audit_log (event_type, resource_type, resource_id, action, details)
       VALUES ('EXECUTION', 'execution', $1, 'created', $2)`,
        [
          executionId,
          JSON.stringify({
            ruleId,
            triggeredAt,
            idempotencyKey,
          }),
        ],
      );
    }

    return {
      id: executionId,
      isNew: true,
    };
  }

  /**
   * Update execution with transaction info
   * CRITICAL: Store tx_sent_at and tx_blockhash for retry logic
   *
   * @param executionId - Execution ID
   * @param txSignature - Transaction signature
   * @param blockhash - Blockhash used in transaction
   */
  async updateExecutionWithTransaction(
    executionId: number,
    txSignature: string,
    blockhash: string,
  ): Promise<void> {
    await query(
      `UPDATE executions
       SET tx_signature = $1,
           tx_blockhash = $2,
           tx_sent_at = NOW(),
           status = 'EXECUTING',
           updated_at = NOW()
       WHERE id = $3`,
      [txSignature, blockhash, executionId],
    );

    logger.info('Execution updated with transaction info', {
      executionId,
      txSignature,
      blockhash,
    });

    // Log to audit log
    await query(
      `INSERT INTO audit_log (event_type, resource_type, resource_id, action, details)
       VALUES ('EXECUTION', 'execution', $1, 'transaction_sent', $2)`,
      [
        executionId,
        JSON.stringify({
          txSignature,
          blockhash,
        }),
      ],
    );
  }

  /**
   * Check if execution's transaction blockhash is still valid
   * CRITICAL: Determines if retry needs fresh blockhash
   *
   * @param executionId - Execution ID
   * @returns true if valid, false if expired or not set
   */
  async isExecutionBlockhashValid(executionId: number): Promise<boolean> {
    const result = await query(
      'SELECT tx_blockhash, tx_sent_at FROM executions WHERE id = $1',
      [executionId],
    );

    if (result.rows.length === 0) {
      logger.error('Execution not found', { executionId });
      return false;
    }

    const { tx_blockhash, tx_sent_at } = result.rows[0];

    if (!tx_blockhash || !tx_sent_at) {
      logger.debug('No blockhash or send time recorded', { executionId });
      return false;
    }

    // Check age (Solana blockhashes expire after ~80 seconds)
    const age = Date.now() - new Date(tx_sent_at).getTime();
    const BLOCKHASH_EXPIRY_MS = 80 * 1000; // 80 seconds

    if (age > BLOCKHASH_EXPIRY_MS) {
      logger.info('Blockhash expired by age', {
        executionId,
        age,
        threshold: BLOCKHASH_EXPIRY_MS,
      });
      return false;
    }

    // TODO: When blockhash manager is available, check on-chain validity
    // For now, assume valid if within time window
    return true;
  }

  /**
   * Mark execution as completed
   *
   * @param executionId - Execution ID
   * @param txSignature - Final transaction signature
   */
  async markExecutionCompleted(
    executionId: number,
    txSignature: string,
  ): Promise<void> {
    await query(
      `UPDATE executions
       SET status = 'EXECUTED',
           tx_signature = $1,
           updated_at = NOW()
       WHERE id = $2`,
      [txSignature, executionId],
    );

    logger.info('Execution marked as completed', {
      executionId,
      txSignature,
    });

    await query(
      `INSERT INTO audit_log (event_type, resource_type, resource_id, action, details)
       VALUES ('EXECUTION', 'execution', $1, 'completed', $2)`,
      [executionId, JSON.stringify({ txSignature })],
    );
  }

  /**
   * Mark execution as failed
   *
   * @param executionId - Execution ID
   * @param error - Error message
   */
  async markExecutionFailed(executionId: number, error: string): Promise<void> {
    await query(
      `UPDATE executions
       SET status = 'FAILED',
           error_message = $1,
           updated_at = NOW()
       WHERE id = $2`,
      [error, executionId],
    );

    logger.error('Execution marked as failed', {
      executionId,
      error,
    });

    await query(
      `INSERT INTO audit_log (event_type, resource_type, resource_id, action, details)
       VALUES ('EXECUTION', 'execution', $1, 'failed', $2)`,
      [executionId, JSON.stringify({ error })],
    );
  }

  /**
   * Get execution by ID
   *
   * @param executionId - Execution ID
   * @returns Execution record or null
   */
  async getExecution(executionId: number): Promise<any | null> {
    const result = await query('SELECT * FROM executions WHERE id = $1', [
      executionId,
    ]);

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0];
  }

  /**
   * Get executions for a rule
   *
   * @param ruleId - Rule ID
   * @param limit - Maximum number of executions to return
   * @returns Array of execution records
   */
  async getExecutionsForRule(
    ruleId: number,
    limit: number = 100,
  ): Promise<any[]> {
    const result = await query(
      `SELECT * FROM executions
       WHERE rule_id = $1
       ORDER BY triggered_at DESC
       LIMIT $2`,
      [ruleId, limit],
    );

    return result.rows;
  }
}

// Export singleton instance
export const executionService = new ExecutionService();
