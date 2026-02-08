import { query, withTransaction, transactionQuery } from '../utils/db';
import logger from '../utils/logger';
import { PoolClient } from 'pg';

/**
 * Dead Letter Queue Service
 * CRITICAL: Handles failed executions that need manual intervention
 * Part of P0_006: Dead Letter Queue for FAILED Recovery
 *
 * When an execution fails after max retries, it's moved to DLQ for review
 */

const MAX_RETRIES = 3; // Maximum retry attempts before DLQ

interface DLQItem {
  id: number;
  execution_id: number;
  failure_reason: string;
  retry_count: number;
  last_attempt_at: Date;
  moved_to_dlq_at: Date;
  status: string;
  resolution_notes: string | null;
  resolved_at: Date | null;
}

export class DeadLetterQueueService {
  /**
   * Move failed execution to dead letter queue
   * CRITICAL: Call this after max retries exhausted
   *
   * @param executionId - Execution ID
   * @param failureReason - Reason for failure
   * @param retryCount - Number of retry attempts made
   * @param client - Optional transaction client
   */
  async moveToDeadLetterQueue(
    executionId: number,
    failureReason: string,
    retryCount: number,
    client?: PoolClient,
  ): Promise<number> {
    logger.warn('Moving execution to dead letter queue', {
      executionId,
      failureReason,
      retryCount,
    });

    // Check if execution already in DLQ
    const existingResult = await (client ? transactionQuery : query)(
      client,
      `SELECT id, status FROM dead_letter_queue
       WHERE execution_id = $1 AND status IN ('PENDING', 'RETRYING')`,
      [executionId],
    );

    if (existingResult.rows.length > 0) {
      logger.info('Execution already in dead letter queue', {
        executionId,
        dlqId: existingResult.rows[0].id,
        status: existingResult.rows[0].status,
      });
      return existingResult.rows[0].id;
    }

    // Get last attempt timestamp from execution
    const executionResult = await (client ? transactionQuery : query)(
      client,
      'SELECT updated_at FROM executions WHERE id = $1',
      [executionId],
    );

    if (executionResult.rows.length === 0) {
      throw new Error(`Execution ${executionId} not found`);
    }

    const lastAttemptAt = executionResult.rows[0].updated_at;

    // Insert into DLQ
    const result = await (client ? transactionQuery : query)(
      client,
      `INSERT INTO dead_letter_queue
       (execution_id, failure_reason, retry_count, last_attempt_at, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'PENDING', NOW(), NOW())
       RETURNING id`,
      [executionId, failureReason, retryCount, lastAttemptAt],
    );

    const dlqId = result.rows[0].id;

    logger.error('Execution moved to dead letter queue', {
      executionId,
      dlqId,
      failureReason,
      retryCount,
    });

    // Audit log
    await (client ? transactionQuery : query)(
      client,
      `INSERT INTO audit_log (event_type, resource_type, resource_id, action, details)
       VALUES ('DLQ', 'execution', $1, 'moved_to_dlq', $2)`,
      [
        executionId,
        JSON.stringify({
          dlqId,
          failureReason,
          retryCount,
        }),
      ],
    );

    return dlqId;
  }

  /**
   * Get all DLQ items with optional status filter
   *
   * @param status - Optional status filter
   * @param limit - Maximum number of items to return
   * @returns Array of DLQ items
   */
  async getDLQItems(
    status?: string,
    limit: number = 100,
  ): Promise<DLQItem[]> {
    let sql = `
      SELECT dlq.*, e.rule_id, e.tx_signature, e.error_message
      FROM dead_letter_queue dlq
      JOIN executions e ON e.id = dlq.execution_id
    `;

    const params: any[] = [];

    if (status) {
      sql += ' WHERE dlq.status = $1';
      params.push(status);
    }

    sql += ' ORDER BY dlq.moved_to_dlq_at DESC LIMIT $' + (params.length + 1);
    params.push(limit);

    const result = await query(sql, params);
    return result.rows as DLQItem[];
  }

  /**
   * Get DLQ item by execution ID
   *
   * @param executionId - Execution ID
   * @returns DLQ item or null
   */
  async getDLQItemByExecutionId(executionId: number): Promise<DLQItem | null> {
    const result = await query(
      `SELECT dlq.*, e.rule_id, e.tx_signature, e.error_message
       FROM dead_letter_queue dlq
       JOIN executions e ON e.id = dlq.execution_id
       WHERE dlq.execution_id = $1
       ORDER BY dlq.moved_to_dlq_at DESC
       LIMIT 1`,
      [executionId],
    );

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0] as DLQItem;
  }

  /**
   * Get pending DLQ items (need manual review)
   *
   * @param limit - Maximum number of items to return
   * @returns Array of pending DLQ items
   */
  async getPendingDLQItems(limit: number = 100): Promise<DLQItem[]> {
    return await this.getDLQItems('PENDING', limit);
  }

  /**
   * Mark DLQ item as retrying
   * CRITICAL: Call before attempting retry from DLQ
   *
   * @param dlqId - DLQ item ID
   */
  async markDLQRetrying(dlqId: number): Promise<void> {
    await query(
      `UPDATE dead_letter_queue
       SET status = 'RETRYING',
           updated_at = NOW()
       WHERE id = $1`,
      [dlqId],
    );

    logger.info('DLQ item marked as retrying', { dlqId });

    await query(
      `INSERT INTO audit_log (event_type, resource_type, resource_id, action, details)
       VALUES ('DLQ', 'dlq_item', $1, 'retrying', NULL)`,
      [dlqId],
    );
  }

  /**
   * Mark DLQ item as resolved
   * CRITICAL: Call after successful retry or manual fix
   *
   * @param dlqId - DLQ item ID
   * @param resolutionNotes - Optional notes about resolution
   */
  async markDLQResolved(
    dlqId: number,
    resolutionNotes?: string,
  ): Promise<void> {
    await query(
      `UPDATE dead_letter_queue
       SET status = 'RESOLVED',
           resolution_notes = $1,
           resolved_at = NOW(),
           updated_at = NOW()
       WHERE id = $2`,
      [resolutionNotes || 'Resolved', dlqId],
    );

    logger.info('DLQ item marked as resolved', {
      dlqId,
      resolutionNotes,
    });

    await query(
      `INSERT INTO audit_log (event_type, resource_type, resource_id, action, details)
       VALUES ('DLQ', 'dlq_item', $1, 'resolved', $2)`,
      [dlqId, JSON.stringify({ resolutionNotes })],
    );
  }

  /**
   * Mark DLQ item as abandoned
   * Use when item cannot be resolved and should be given up on
   *
   * @param dlqId - DLQ item ID
   * @param reason - Reason for abandonment
   */
  async markDLQAbandoned(dlqId: number, reason: string): Promise<void> {
    await query(
      `UPDATE dead_letter_queue
       SET status = 'ABANDONED',
           resolution_notes = $1,
           resolved_at = NOW(),
           updated_at = NOW()
       WHERE id = $2`,
      [reason, dlqId],
    );

    logger.warn('DLQ item marked as abandoned', {
      dlqId,
      reason,
    });

    await query(
      `INSERT INTO audit_log (event_type, resource_type, resource_id, action, details)
       VALUES ('DLQ', 'dlq_item', $1, 'abandoned', $2)`,
      [dlqId, JSON.stringify({ reason })],
    );
  }

  /**
   * Check if execution should be moved to DLQ
   * CRITICAL: Call after execution fails to determine if DLQ needed
   *
   * @param executionId - Execution ID
   * @param retryCount - Current retry count
   * @returns true if should move to DLQ, false otherwise
   */
  shouldMoveToDeadLetterQueue(retryCount: number): boolean {
    return retryCount >= MAX_RETRIES;
  }

  /**
   * Increment execution retry count
   *
   * @param executionId - Execution ID
   * @param client - Optional transaction client
   * @returns New retry count
   */
  async incrementRetryCount(
    executionId: number,
    client?: PoolClient,
  ): Promise<number> {
    const result = await (client ? transactionQuery : query)(
      client,
      `UPDATE executions
       SET retry_count = retry_count + 1,
           updated_at = NOW()
       WHERE id = $1
       RETURNING retry_count`,
      [executionId],
    );

    if (result.rows.length === 0) {
      throw new Error(`Execution ${executionId} not found`);
    }

    const newRetryCount = result.rows[0].retry_count;

    logger.info('Execution retry count incremented', {
      executionId,
      retryCount: newRetryCount,
    });

    return newRetryCount;
  }

  /**
   * Handle execution failure with retry logic
   * CRITICAL: Main entry point for failed execution handling
   *
   * @param executionId - Execution ID
   * @param errorMessage - Error message
   * @param client - Optional transaction client
   * @returns Object indicating if moved to DLQ
   */
  async handleExecutionFailure(
    executionId: number,
    errorMessage: string,
    client?: PoolClient,
  ): Promise<{ movedToDLQ: boolean; retryCount: number; dlqId?: number }> {
    // Increment retry count
    const retryCount = await this.incrementRetryCount(executionId, client);

    logger.info('Handling execution failure', {
      executionId,
      retryCount,
      maxRetries: MAX_RETRIES,
    });

    // Check if should move to DLQ
    if (this.shouldMoveToDeadLetterQueue(retryCount)) {
      const dlqId = await this.moveToDeadLetterQueue(
        executionId,
        errorMessage,
        retryCount,
        client,
      );

      return {
        movedToDLQ: true,
        retryCount,
        dlqId,
      };
    }

    return {
      movedToDLQ: false,
      retryCount,
    };
  }

  /**
   * Get DLQ statistics
   *
   * @returns DLQ statistics
   */
  async getDLQStatistics(): Promise<{
    pending: number;
    retrying: number;
    resolved: number;
    abandoned: number;
    total: number;
  }> {
    const result = await query(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'PENDING') as pending,
         COUNT(*) FILTER (WHERE status = 'RETRYING') as retrying,
         COUNT(*) FILTER (WHERE status = 'RESOLVED') as resolved,
         COUNT(*) FILTER (WHERE status = 'ABANDONED') as abandoned,
         COUNT(*) as total
       FROM dead_letter_queue`,
      [],
    );

    return {
      pending: parseInt(result.rows[0].pending) || 0,
      retrying: parseInt(result.rows[0].retrying) || 0,
      resolved: parseInt(result.rows[0].resolved) || 0,
      abandoned: parseInt(result.rows[0].abandoned) || 0,
      total: parseInt(result.rows[0].total) || 0,
    };
  }

  /**
   * Clean up old resolved/abandoned DLQ items
   * Remove items older than specified days
   *
   * @param daysOld - Age threshold in days (default: 30)
   * @returns Number of items deleted
   */
  async cleanupOldDLQItems(daysOld: number = 30): Promise<number> {
    const result = await query(
      `DELETE FROM dead_letter_queue
       WHERE status IN ('RESOLVED', 'ABANDONED')
       AND resolved_at < NOW() - INTERVAL '${daysOld} days'
       RETURNING id`,
      [],
    );

    const count = result.rows.length;

    if (count > 0) {
      logger.info('Cleaned up old DLQ items', { count, daysOld });

      await query(
        `INSERT INTO audit_log (event_type, resource_type, action, details)
         VALUES ('DLQ', 'cleanup', 'old_items_deleted', $1)`,
        [JSON.stringify({ count, daysOld })],
      );
    }

    return count;
  }
}

// Export singleton instance
export const deadLetterQueueService = new DeadLetterQueueService();
