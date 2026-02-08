import os from 'os';
import { query, withTransaction, transactionQuery } from '../utils/db';
import logger from '../utils/logger';
import { PoolClient } from 'pg';

/**
 * Execution Lock Service
 * CRITICAL: Prevents race conditions during concurrent rule execution
 * Part of P0_004: Concurrent Execution Locks
 *
 * Uses PostgreSQL advisory locks for distributed locking
 */

const LOCK_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
const PROCESS_ID = `${os.hostname()}:${process.pid}`;

export class ExecutionLockService {
  /**
   * Acquire execution lock for a rule
   * CRITICAL: Prevents multiple processes from executing same rule concurrently
   *
   * Uses PostgreSQL advisory locks for robust distributed locking
   *
   * @param ruleId - Rule ID to lock
   * @param client - Optional transaction client
   * @returns true if lock acquired, false if already locked
   */
  async acquireLock(
    ruleId: number,
    client?: PoolClient,
  ): Promise<{ acquired: boolean; lockedBy?: string }> {
    logger.info('Attempting to acquire execution lock', {
      ruleId,
      processId: PROCESS_ID,
    });

    // Clean up expired locks first
    await this.cleanupExpiredLocks(client);

    // Try to acquire PostgreSQL advisory lock
    // This ensures distributed locking across multiple processes/servers
    const advisoryLockResult = await (client ? transactionQuery : query)(
      client,
      'SELECT pg_try_advisory_lock($1) as acquired',
      [ruleId],
    );

    const advisoryLockAcquired = advisoryLockResult.rows[0].acquired;

    if (!advisoryLockAcquired) {
      logger.warn('Advisory lock already held by another process', {
        ruleId,
        processId: PROCESS_ID,
      });

      // Check who holds the lock
      const lockInfo = await this.getLockInfo(ruleId, client);
      return {
        acquired: false,
        lockedBy: lockInfo?.locked_by,
      };
    }

    // Advisory lock acquired, now create database record
    try {
      const expiresAt = new Date(Date.now() + LOCK_TIMEOUT_MS);

      await (client ? transactionQuery : query)(
        client,
        `INSERT INTO execution_locks (rule_id, locked_by, locked_at, expires_at)
         VALUES ($1, $2, NOW(), $3)
         ON CONFLICT (rule_id) WHERE expires_at > NOW()
         DO NOTHING`,
        [ruleId, PROCESS_ID, expiresAt],
      );

      // Verify lock was created (could fail if another process beat us)
      const verifyResult = await (client ? transactionQuery : query)(
        client,
        `SELECT locked_by FROM execution_locks
         WHERE rule_id = $1 AND expires_at > NOW()`,
        [ruleId],
      );

      if (verifyResult.rows.length === 0) {
        // Lock record not created, release advisory lock
        await this.releaseAdvisoryLock(ruleId, client);
        logger.warn('Lock record creation failed (race condition)', {
          ruleId,
          processId: PROCESS_ID,
        });
        return { acquired: false };
      }

      const lockHolder = verifyResult.rows[0].locked_by;

      if (lockHolder !== PROCESS_ID) {
        // Another process holds the lock, release our advisory lock
        await this.releaseAdvisoryLock(ruleId, client);
        logger.warn('Lock held by different process', {
          ruleId,
          processId: PROCESS_ID,
          lockHolder,
        });
        return {
          acquired: false,
          lockedBy: lockHolder,
        };
      }

      logger.info('Execution lock acquired successfully', {
        ruleId,
        processId: PROCESS_ID,
        expiresAt,
      });

      // Audit log
      await (client ? transactionQuery : query)(
        client,
        `INSERT INTO audit_log (event_type, resource_type, resource_id, action, details)
         VALUES ('LOCK', 'rule', $1, 'lock_acquired', $2)`,
        [ruleId, JSON.stringify({ processId: PROCESS_ID, expiresAt })],
      );

      return { acquired: true };
    } catch (error) {
      // Error creating lock record, release advisory lock
      await this.releaseAdvisoryLock(ruleId, client);
      logger.error('Error acquiring execution lock', {
        ruleId,
        processId: PROCESS_ID,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Release execution lock for a rule
   * CRITICAL: Must be called after execution completes or fails
   *
   * @param ruleId - Rule ID to unlock
   * @param client - Optional transaction client
   */
  async releaseLock(ruleId: number, client?: PoolClient): Promise<void> {
    logger.info('Releasing execution lock', {
      ruleId,
      processId: PROCESS_ID,
    });

    try {
      // Remove lock record
      const result = await (client ? transactionQuery : query)(
        client,
        `DELETE FROM execution_locks
         WHERE rule_id = $1 AND locked_by = $2
         RETURNING id`,
        [ruleId, PROCESS_ID],
      );

      if (result.rows.length > 0) {
        logger.info('Execution lock released', {
          ruleId,
          processId: PROCESS_ID,
        });

        // Audit log
        await (client ? transactionQuery : query)(
          client,
          `INSERT INTO audit_log (event_type, resource_type, resource_id, action, details)
           VALUES ('LOCK', 'rule', $1, 'lock_released', $2)`,
          [ruleId, JSON.stringify({ processId: PROCESS_ID })],
        );
      } else {
        logger.warn('Lock record not found or held by different process', {
          ruleId,
          processId: PROCESS_ID,
        });
      }

      // Release PostgreSQL advisory lock
      await this.releaseAdvisoryLock(ruleId, client);
    } catch (error) {
      logger.error('Error releasing execution lock', {
        ruleId,
        processId: PROCESS_ID,
        error: error instanceof Error ? error.message : String(error),
      });
      // Still try to release advisory lock
      await this.releaseAdvisoryLock(ruleId, client);
      throw error;
    }
  }

  /**
   * Check if rule is currently locked
   *
   * @param ruleId - Rule ID to check
   * @param client - Optional transaction client
   * @returns Lock info if locked, null if not locked
   */
  async isLocked(
    ruleId: number,
    client?: PoolClient,
  ): Promise<{ locked: boolean; lockedBy?: string; expiresAt?: Date }> {
    // Clean up expired locks first
    await this.cleanupExpiredLocks(client);

    const result = await (client ? transactionQuery : query)(
      client,
      `SELECT locked_by, expires_at FROM execution_locks
       WHERE rule_id = $1 AND expires_at > NOW()`,
      [ruleId],
    );

    if (result.rows.length === 0) {
      return { locked: false };
    }

    const lock = result.rows[0];
    return {
      locked: true,
      lockedBy: lock.locked_by,
      expiresAt: lock.expires_at,
    };
  }

  /**
   * Get lock info for a rule
   *
   * @param ruleId - Rule ID
   * @param client - Optional transaction client
   * @returns Lock info or null
   */
  private async getLockInfo(
    ruleId: number,
    client?: PoolClient,
  ): Promise<{ locked_by: string; expires_at: Date } | null> {
    const result = await (client ? transactionQuery : query)(
      client,
      `SELECT locked_by, expires_at FROM execution_locks
       WHERE rule_id = $1 AND expires_at > NOW()`,
      [ruleId],
    );

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0];
  }

  /**
   * Release PostgreSQL advisory lock
   *
   * @param ruleId - Rule ID
   * @param client - Optional transaction client
   */
  private async releaseAdvisoryLock(
    ruleId: number,
    client?: PoolClient,
  ): Promise<void> {
    try {
      await (client ? transactionQuery : query)(
        client,
        'SELECT pg_advisory_unlock($1)',
        [ruleId],
      );
      logger.debug('Advisory lock released', { ruleId });
    } catch (error) {
      logger.warn('Error releasing advisory lock', {
        ruleId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Clean up expired locks
   * Removes lock records that have passed their expiration time
   *
   * @param client - Optional transaction client
   */
  async cleanupExpiredLocks(client?: PoolClient): Promise<number> {
    try {
      const result = await (client ? transactionQuery : query)(
        client,
        'SELECT cleanup_expired_locks() as count',
        [],
      );

      const count = result.rows[0].count;

      if (count > 0) {
        logger.info('Cleaned up expired locks', { count });
      }

      return count;
    } catch (error) {
      logger.error('Error cleaning up expired locks', {
        error: error instanceof Error ? error.message : String(error),
      });
      return 0;
    }
  }

  /**
   * Release all locks held by current process
   * CRITICAL: Call during graceful shutdown
   */
  async releaseAllLocksForProcess(): Promise<void> {
    logger.info('Releasing all locks for current process', {
      processId: PROCESS_ID,
    });

    try {
      const result = await query(
        `DELETE FROM execution_locks
         WHERE locked_by = $1
         RETURNING rule_id`,
        [PROCESS_ID],
      );

      const ruleIds = result.rows.map((row) => row.rule_id);

      if (ruleIds.length > 0) {
        logger.info('Released locks for rules', {
          processId: PROCESS_ID,
          ruleIds,
        });

        // Release advisory locks
        for (const ruleId of ruleIds) {
          await this.releaseAdvisoryLock(ruleId);
        }

        // Audit log
        await query(
          `INSERT INTO audit_log (event_type, resource_type, action, details)
           VALUES ('LOCK', 'process', 'shutdown_cleanup', $1)`,
          [JSON.stringify({ processId: PROCESS_ID, ruleIds })],
        );
      }
    } catch (error) {
      logger.error('Error releasing all locks for process', {
        processId: PROCESS_ID,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Get all active locks (for monitoring)
   *
   * @returns Array of active locks
   */
  async getActiveLocks(): Promise<
    Array<{
      rule_id: number;
      locked_by: string;
      locked_at: Date;
      expires_at: Date;
    }>
  > {
    const result = await query(
      `SELECT rule_id, locked_by, locked_at, expires_at
       FROM execution_locks
       WHERE expires_at > NOW()
       ORDER BY locked_at DESC`,
      [],
    );

    return result.rows;
  }
}

// Export singleton instance
export const executionLockService = new ExecutionLockService();
