import os from 'os';
import { query, withTransaction, transactionQuery } from '../utils/db';
import { validateMasterKey, encrypt, decrypt } from '../utils/encryption';
import logger from '../utils/logger';
import { PoolClient } from 'pg';

/**
 * Secrets Manager Service
 * CRITICAL: Centralizes all secret access with auditing
 * Part of P0_008: Secrets Management Hardening
 */

const PROCESS_ID = `${os.hostname()}:${process.pid}`;

export class SecretsManagerService {
  private masterKeyCache: string | null = null;
  private masterKeyValidated: boolean = false;

  /**
   * Get master encryption key with validation and auditing
   * CRITICAL: All encryption operations must use this method
   *
   * @param auditResourceType - Type of resource accessing the key
   * @param auditResourceId - ID of resource accessing the key
   * @returns Validated master encryption key
   */
  async getMasterKey(
    auditResourceType?: string,
    auditResourceId?: number,
  ): Promise<string> {
    const masterKey = process.env.MASTER_ENCRYPTION_KEY;

    if (!masterKey) {
      await this.auditSecretAccess({
        keyType: 'master_key',
        action: 'validate',
        success: false,
        errorMessage: 'Master encryption key not set in environment',
      });
      throw new Error('MASTER_ENCRYPTION_KEY is not set');
    }

    // Validate master key format (only once per process)
    if (!this.masterKeyValidated) {
      try {
        validateMasterKey(masterKey);
        this.masterKeyValidated = true;
        this.masterKeyCache = masterKey;

        await this.auditSecretAccess({
          keyType: 'master_key',
          action: 'validate',
          success: true,
        });

        logger.info('Master encryption key validated successfully');
      } catch (error) {
        await this.auditSecretAccess({
          keyType: 'master_key',
          action: 'validate',
          success: false,
          errorMessage: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    }

    // Audit access
    if (auditResourceType) {
      await this.auditSecretAccess({
        keyType: 'master_key',
        resourceType: auditResourceType,
        resourceId: auditResourceId,
        action: 'access',
        success: true,
      });
    }

    return this.masterKeyCache!;
  }

  /**
   * Audit secret access
   * CRITICAL: All secret operations must be audited
   *
   * @param params - Audit parameters
   */
  async auditSecretAccess(params: {
    keyType: string;
    resourceType?: string;
    resourceId?: number;
    action: string;
    success: boolean;
    errorMessage?: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<void> {
    try {
      await query(
        `INSERT INTO secrets_audit
         (key_type, resource_type, resource_id, action, accessed_by, accessed_at, success, error_message, ip_address, user_agent)
         VALUES ($1, $2, $3, $4, $5, NOW(), $6, $7, $8, $9)`,
        [
          params.keyType,
          params.resourceType || null,
          params.resourceId || null,
          params.action,
          PROCESS_ID,
          params.success,
          params.errorMessage || null,
          params.ipAddress || null,
          params.userAgent || null,
        ],
      );

      if (!params.success) {
        logger.warn('Secret access failed', {
          keyType: params.keyType,
          action: params.action,
          error: params.errorMessage,
        });
      }
    } catch (error) {
      // Don't throw on audit failure - log and continue
      logger.error('Failed to audit secret access', {
        error: error instanceof Error ? error.message : String(error),
        params,
      });
    }
  }

  /**
   * Rotate master encryption key
   * CRITICAL: Re-encrypts all automation wallet private keys with new key
   *
   * WARNING: This is a dangerous operation that must be run carefully
   * - Ensure database backups are recent
   * - Run during maintenance window
   * - Verify all wallets are re-encrypted successfully
   *
   * @param newMasterKey - New master encryption key (32-byte hex string)
   */
  async rotateMasterKey(newMasterKey: string): Promise<{
    walletsRotated: number;
    errors: Array<{ walletId: number; error: string }>;
  }> {
    logger.warn('Starting master key rotation - DANGEROUS OPERATION', {
      processId: PROCESS_ID,
    });

    // Validate new master key
    try {
      validateMasterKey(newMasterKey);
    } catch (error) {
      await this.auditSecretAccess({
        keyType: 'master_key',
        action: 'rotate',
        success: false,
        errorMessage: `Invalid new master key: ${error instanceof Error ? error.message : String(error)}`,
      });
      throw new Error(
        `Invalid new master key: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    // Get current master key
    const oldMasterKey = await this.getMasterKey();

    // Get all automation wallets
    const walletsResult = await query(
      'SELECT id, encrypted_private_key, iv, auth_tag, key_version FROM automation_wallets',
      [],
    );

    const wallets = walletsResult.rows;
    const errors: Array<{ walletId: number; error: string }> = [];
    let walletsRotated = 0;

    logger.info('Rotating encryption for wallets', {
      totalWallets: wallets.length,
    });

    // Rotate each wallet
    for (const wallet of wallets) {
      try {
        // Decrypt with old key
        const privateKeyBytes = decrypt(
          wallet.encrypted_private_key,
          wallet.iv,
          wallet.auth_tag,
          oldMasterKey,
        );

        try {
          // Re-encrypt with new key
          const encrypted = encrypt(privateKeyBytes, newMasterKey);

          // Update wallet with new encrypted data
          await query(
            `UPDATE automation_wallets
             SET encrypted_private_key = $1,
                 iv = $2,
                 auth_tag = $3,
                 key_version = key_version + 1,
                 updated_at = NOW()
             WHERE id = $4`,
            [
              encrypted.encrypted,
              encrypted.iv,
              encrypted.authTag,
              wallet.id,
            ],
          );

          walletsRotated++;

          await this.auditSecretAccess({
            keyType: 'wallet_key',
            resourceType: 'automation_wallet',
            resourceId: wallet.id,
            action: 'rotate',
            success: true,
          });

          logger.debug('Wallet key rotated', {
            walletId: wallet.id,
            oldKeyVersion: wallet.key_version,
            newKeyVersion: wallet.key_version + 1,
          });
        } finally {
          // Always zero out decrypted key
          privateKeyBytes.fill(0);
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        errors.push({
          walletId: wallet.id,
          error: errorMessage,
        });

        await this.auditSecretAccess({
          keyType: 'wallet_key',
          resourceType: 'automation_wallet',
          resourceId: wallet.id,
          action: 'rotate',
          success: false,
          errorMessage,
        });

        logger.error('Failed to rotate wallet key', {
          walletId: wallet.id,
          error: errorMessage,
        });
      }
    }

    // Audit log for master key rotation
    await query(
      `INSERT INTO audit_log (event_type, resource_type, action, details)
       VALUES ('SECURITY', 'master_key', 'rotated', $1)`,
      [
        JSON.stringify({
          walletsRotated,
          totalWallets: wallets.length,
          errorCount: errors.length,
          processId: PROCESS_ID,
        }),
      ],
    );

    logger.warn('Master key rotation completed', {
      walletsRotated,
      totalWallets: wallets.length,
      errorCount: errors.length,
    });

    return {
      walletsRotated,
      errors,
    };
  }

  /**
   * Get secret access audit trail for a resource
   *
   * @param resourceType - Resource type
   * @param resourceId - Resource ID
   * @param limit - Maximum number of entries to return
   * @returns Array of audit entries
   */
  async getSecretAuditTrail(
    resourceType: string,
    resourceId: number,
    limit: number = 100,
  ): Promise<any[]> {
    const result = await query(
      `SELECT *
       FROM secrets_audit
       WHERE resource_type = $1 AND resource_id = $2
       ORDER BY accessed_at DESC
       LIMIT $3`,
      [resourceType, resourceId, limit],
    );

    return result.rows;
  }

  /**
   * Get failed secret access attempts
   * CRITICAL: Use for security monitoring
   *
   * @param hours - Look back this many hours
   * @param limit - Maximum number of entries to return
   * @returns Array of failed access attempts
   */
  async getFailedSecretAccess(
    hours: number = 24,
    limit: number = 100,
  ): Promise<any[]> {
    const result = await query(
      `SELECT *
       FROM secrets_audit
       WHERE success = FALSE
       AND accessed_at > NOW() - INTERVAL '${hours} hours'
       ORDER BY accessed_at DESC
       LIMIT $1`,
      [limit],
    );

    return result.rows;
  }

  /**
   * Get secret access statistics
   *
   * @param hours - Look back this many hours
   * @returns Statistics object
   */
  async getSecretAccessStatistics(hours: number = 24): Promise<{
    totalAccess: number;
    successfulAccess: number;
    failedAccess: number;
    byKeyType: Record<string, number>;
    byAction: Record<string, number>;
  }> {
    const result = await query(
      `SELECT
         COUNT(*) as total_access,
         COUNT(*) FILTER (WHERE success = TRUE) as successful_access,
         COUNT(*) FILTER (WHERE success = FALSE) as failed_access
       FROM secrets_audit
       WHERE accessed_at > NOW() - INTERVAL '${hours} hours'`,
      [],
    );

    const byKeyTypeResult = await query(
      `SELECT key_type, COUNT(*) as count
       FROM secrets_audit
       WHERE accessed_at > NOW() - INTERVAL '${hours} hours'
       GROUP BY key_type`,
      [],
    );

    const byActionResult = await query(
      `SELECT action, COUNT(*) as count
       FROM secrets_audit
       WHERE accessed_at > NOW() - INTERVAL '${hours} hours'
       GROUP BY action`,
      [],
    );

    const byKeyType: Record<string, number> = {};
    for (const row of byKeyTypeResult.rows) {
      byKeyType[row.key_type] = parseInt(row.count);
    }

    const byAction: Record<string, number> = {};
    for (const row of byActionResult.rows) {
      byAction[row.action] = parseInt(row.count);
    }

    return {
      totalAccess: parseInt(result.rows[0].total_access) || 0,
      successfulAccess: parseInt(result.rows[0].successful_access) || 0,
      failedAccess: parseInt(result.rows[0].failed_access) || 0,
      byKeyType,
      byAction,
    };
  }

  /**
   * Clean up old secret audit logs
   *
   * @param daysToKeep - Keep logs for this many days
   * @returns Number of logs deleted
   */
  async cleanupOldAuditLogs(daysToKeep: number = 90): Promise<number> {
    const result = await query(
      'SELECT cleanup_old_secrets_audit($1) as count',
      [daysToKeep],
    );

    const count = result.rows[0].count;

    if (count > 0) {
      logger.info('Cleaned up old secret audit logs', { count, daysToKeep });
    }

    return count;
  }

  /**
   * Validate all secrets on startup
   * CRITICAL: Call this during application startup
   */
  async validateSecretsOnStartup(): Promise<void> {
    logger.info('Validating secrets on startup');

    // Validate master encryption key
    try {
      await this.getMasterKey();
      logger.info('✓ Master encryption key validated');
    } catch (error) {
      logger.error('✗ Master encryption key validation failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error('Secrets validation failed: master encryption key');
    }

    // Validate database encryption key if set
    if (process.env.DATABASE_ENCRYPTION_KEY) {
      // TODO: Add validation if database-level encryption is implemented
      logger.info('✓ Database encryption key present');
    }

    // Check for common misconfigurations
    if (process.env.NODE_ENV === 'production') {
      if (!process.env.MASTER_ENCRYPTION_KEY) {
        throw new Error(
          'Production environment requires MASTER_ENCRYPTION_KEY',
        );
      }

      // Warn about weak configuration
      if (process.env.MASTER_ENCRYPTION_KEY.length < 64) {
        logger.warn(
          'Master encryption key is shorter than recommended 32 bytes (64 hex chars)',
        );
      }
    }

    logger.info('All secrets validated successfully');
  }
}

// Export singleton instance
export const secretsManager = new SecretsManagerService();
