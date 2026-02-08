import crypto from 'crypto';
import { query, withTransaction, transactionQuery } from '../utils/db';
import { transactionStatusService } from './transaction-status.service';
import logger from '../utils/logger';
import { PoolClient } from 'pg';

/**
 * Withdrawal Service
 * CRITICAL: Implements replay protection to prevent duplicate withdrawals
 * Part of P0_003: Withdrawal Replay Protection
 */

interface WithdrawalParams {
  userId: number;
  walletId: number;
  destinationAddress: string;
  amount: bigint; // Amount in lamports
}

interface Withdrawal {
  id: number;
  user_id: number;
  wallet_id: number;
  amount: string;
  destination_address: string;
  tx_signature: string | null;
  status: string;
  idempotency_key: string;
  initiated_at: Date;
  sent_at: Date | null;
  completed_at: Date | null;
}

export class WithdrawalService {
  /**
   * Generate deterministic idempotency key for withdrawal
   * CRITICAL: Same params always produce same key (prevents replay)
   *
   * @param params - Withdrawal parameters
   * @returns Deterministic idempotency key
   */
  generateIdempotencyKey(params: WithdrawalParams): string {
    const data = `${params.userId}:${params.walletId}:${params.destinationAddress}:${params.amount}:${Date.now()}`;
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Initiate withdrawal with replay protection
   * CRITICAL: Checks for duplicate withdrawals before creating
   *
   * @param params - Withdrawal parameters
   * @param client - Optional transaction client
   * @returns Withdrawal ID or existing withdrawal info
   */
  async initiateWithdrawal(
    params: WithdrawalParams,
    client?: PoolClient,
  ): Promise<{ id: number; isNew: boolean; existingSignature?: string }> {
    const idempotencyKey = this.generateIdempotencyKey(params);

    logger.info('Initiating withdrawal with replay protection', {
      userId: params.userId,
      walletId: params.walletId,
      destinationAddress: params.destinationAddress,
      amount: params.amount.toString(),
      idempotencyKey,
    });

    // Check for existing withdrawal with same idempotency key
    const existingResult = await (client ? transactionQuery : query)(
      client,
      'SELECT id, tx_signature, status FROM withdrawals WHERE idempotency_key = $1',
      [idempotencyKey],
    );

    if (existingResult.rows.length > 0) {
      const existing = existingResult.rows[0];
      logger.warn('Withdrawal already exists (replay attempt detected)', {
        withdrawalId: existing.id,
        existingStatus: existing.status,
        txSignature: existing.tx_signature,
        idempotencyKey,
      });

      // If transaction was sent, check if it landed on-chain
      if (existing.tx_signature) {
        const txStatus = await transactionStatusService.checkTransactionStatus(
          existing.tx_signature,
        );

        logger.info('Checked existing withdrawal transaction status', {
          withdrawalId: existing.id,
          signature: existing.tx_signature,
          onChainStatus: txStatus.status,
        });

        // If transaction confirmed, withdrawal is complete
        if (
          txStatus.status === 'finalized' ||
          txStatus.status === 'confirmed'
        ) {
          logger.info('Existing withdrawal confirmed on-chain', {
            withdrawalId: existing.id,
            signature: existing.tx_signature,
          });
          return {
            id: existing.id,
            isNew: false,
            existingSignature: existing.tx_signature,
          };
        }
      }

      return {
        id: existing.id,
        isNew: false,
        existingSignature: existing.tx_signature || undefined,
      };
    }

    // Check for near-duplicate withdrawal (same params within 1 second)
    const duplicateCheckResult = await (client ? transactionQuery : query)(
      client,
      `SELECT id, tx_signature, status FROM withdrawals
       WHERE user_id = $1
         AND wallet_id = $2
         AND destination_address = $3
         AND amount = $4
         AND initiated_at > NOW() - INTERVAL '1 second'
         AND status != 'CANCELLED'`,
      [
        params.userId,
        params.walletId,
        params.destinationAddress,
        params.amount.toString(),
      ],
    );

    if (duplicateCheckResult.rows.length > 0) {
      const duplicate = duplicateCheckResult.rows[0];
      logger.warn('Near-duplicate withdrawal detected', {
        existingWithdrawalId: duplicate.id,
        status: duplicate.status,
      });

      // Audit log for security monitoring
      await (client ? transactionQuery : query)(
        client,
        `INSERT INTO audit_log (event_type, resource_type, resource_id, action, details)
         VALUES ('SECURITY', 'withdrawal', $1, 'replay_attempt_blocked', $2)`,
        [
          duplicate.id,
          JSON.stringify({
            userId: params.userId,
            walletId: params.walletId,
            destinationAddress: params.destinationAddress,
            amount: params.amount.toString(),
          }),
        ],
      );

      return {
        id: duplicate.id,
        isNew: false,
        existingSignature: duplicate.tx_signature || undefined,
      };
    }

    // Verify wallet belongs to user
    const walletCheck = await (client ? transactionQuery : query)(
      client,
      'SELECT user_id FROM automation_wallets WHERE id = $1',
      [params.walletId],
    );

    if (walletCheck.rows.length === 0) {
      throw new Error('Wallet not found');
    }

    if (walletCheck.rows[0].user_id !== params.userId) {
      logger.error('Unauthorized withdrawal attempt', {
        userId: params.userId,
        walletId: params.walletId,
      });

      await (client ? transactionQuery : query)(
        client,
        `INSERT INTO audit_log (event_type, resource_type, resource_id, action, details)
         VALUES ('SECURITY', 'withdrawal', NULL, 'unauthorized_attempt', $1)`,
        [
          JSON.stringify({
            userId: params.userId,
            walletId: params.walletId,
          }),
        ],
      );

      throw new Error('Unauthorized: Wallet does not belong to user');
    }

    // Create new withdrawal
    const result = await (client ? transactionQuery : query)(
      client,
      `INSERT INTO withdrawals
       (user_id, wallet_id, amount, destination_address, status, idempotency_key, initiated_at, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'INITIATED', $5, NOW(), NOW(), NOW())
       RETURNING id`,
      [
        params.userId,
        params.walletId,
        params.amount.toString(),
        params.destinationAddress,
        idempotencyKey,
      ],
    );

    const withdrawalId = result.rows[0].id;

    logger.info('New withdrawal initiated', {
      withdrawalId,
      userId: params.userId,
      walletId: params.walletId,
      amount: params.amount.toString(),
      idempotencyKey,
    });

    // Audit log
    await (client ? transactionQuery : query)(
      client,
      `INSERT INTO audit_log (event_type, resource_type, resource_id, action, details)
       VALUES ('WITHDRAWAL', 'withdrawal', $1, 'initiated', $2)`,
      [
        withdrawalId,
        JSON.stringify({
          userId: params.userId,
          walletId: params.walletId,
          amount: params.amount.toString(),
          destinationAddress: params.destinationAddress,
        }),
      ],
    );

    return {
      id: withdrawalId,
      isNew: true,
    };
  }

  /**
   * Record withdrawal transaction info
   * CRITICAL: Store tx_signature and tx_blockhash for retry logic
   *
   * @param withdrawalId - Withdrawal ID
   * @param txSignature - Transaction signature
   * @param blockhash - Blockhash used in transaction
   */
  async recordWithdrawalTransaction(
    withdrawalId: number,
    txSignature: string,
    blockhash: string,
  ): Promise<void> {
    await query(
      `UPDATE withdrawals
       SET tx_signature = $1,
           tx_blockhash = $2,
           sent_at = NOW(),
           status = 'SENT',
           updated_at = NOW()
       WHERE id = $3`,
      [txSignature, blockhash, withdrawalId],
    );

    logger.info('Withdrawal transaction recorded', {
      withdrawalId,
      txSignature,
      blockhash,
    });

    await query(
      `INSERT INTO audit_log (event_type, resource_type, resource_id, action, details)
       VALUES ('WITHDRAWAL', 'withdrawal', $1, 'transaction_sent', $2)`,
      [withdrawalId, JSON.stringify({ txSignature, blockhash })],
    );
  }

  /**
   * Check withdrawal transaction status on-chain
   * CRITICAL: Verifies transaction landed before marking complete
   *
   * @param withdrawalId - Withdrawal ID
   * @returns Transaction status
   */
  async checkWithdrawalStatus(withdrawalId: number): Promise<{
    status: string;
    onChainStatus?: string;
    signature?: string;
  }> {
    const result = await query(
      'SELECT tx_signature, status FROM withdrawals WHERE id = $1',
      [withdrawalId],
    );

    if (result.rows.length === 0) {
      throw new Error('Withdrawal not found');
    }

    const withdrawal = result.rows[0];

    // If no transaction sent yet, return current status
    if (!withdrawal.tx_signature) {
      return {
        status: withdrawal.status,
      };
    }

    // Check on-chain status
    const txStatus = await transactionStatusService.checkTransactionStatus(
      withdrawal.tx_signature,
    );

    logger.info('Withdrawal transaction status checked', {
      withdrawalId,
      signature: withdrawal.tx_signature,
      dbStatus: withdrawal.status,
      onChainStatus: txStatus.status,
    });

    return {
      status: withdrawal.status,
      onChainStatus: txStatus.status,
      signature: withdrawal.tx_signature,
    };
  }

  /**
   * Mark withdrawal as confirmed
   * CRITICAL: Only call after verifying transaction on-chain
   *
   * @param withdrawalId - Withdrawal ID
   */
  async completeWithdrawal(withdrawalId: number): Promise<void> {
    // Verify transaction is actually confirmed
    const statusCheck = await this.checkWithdrawalStatus(withdrawalId);

    if (
      statusCheck.onChainStatus !== 'finalized' &&
      statusCheck.onChainStatus !== 'confirmed'
    ) {
      throw new Error(
        `Cannot complete withdrawal: transaction not confirmed (status: ${statusCheck.onChainStatus})`,
      );
    }

    await query(
      `UPDATE withdrawals
       SET status = 'CONFIRMED',
           completed_at = NOW(),
           updated_at = NOW()
       WHERE id = $1`,
      [withdrawalId],
    );

    logger.info('Withdrawal marked as confirmed', {
      withdrawalId,
    });

    await query(
      `INSERT INTO audit_log (event_type, resource_type, resource_id, action, details)
       VALUES ('WITHDRAWAL', 'withdrawal', $1, 'confirmed', NULL)`,
      [withdrawalId],
    );
  }

  /**
   * Mark withdrawal as failed
   *
   * @param withdrawalId - Withdrawal ID
   * @param error - Error message
   */
  async markWithdrawalFailed(
    withdrawalId: number,
    error: string,
  ): Promise<void> {
    await query(
      `UPDATE withdrawals
       SET status = 'FAILED',
           error_message = $1,
           updated_at = NOW()
       WHERE id = $2`,
      [error, withdrawalId],
    );

    logger.error('Withdrawal marked as failed', {
      withdrawalId,
      error,
    });

    await query(
      `INSERT INTO audit_log (event_type, resource_type, resource_id, action, details)
       VALUES ('WITHDRAWAL', 'withdrawal', $1, 'failed', $2)`,
      [withdrawalId, JSON.stringify({ error })],
    );
  }

  /**
   * Get withdrawal by ID
   *
   * @param withdrawalId - Withdrawal ID
   * @returns Withdrawal record or null
   */
  async getWithdrawal(withdrawalId: number): Promise<Withdrawal | null> {
    const result = await query('SELECT * FROM withdrawals WHERE id = $1', [
      withdrawalId,
    ]);

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0] as Withdrawal;
  }

  /**
   * Get withdrawals for a user
   *
   * @param userId - User ID
   * @param limit - Maximum number of withdrawals to return
   * @returns Array of withdrawal records
   */
  async getWithdrawalsForUser(
    userId: number,
    limit: number = 100,
  ): Promise<Withdrawal[]> {
    const result = await query(
      `SELECT * FROM withdrawals
       WHERE user_id = $1
       ORDER BY initiated_at DESC
       LIMIT $2`,
      [userId, limit],
    );

    return result.rows as Withdrawal[];
  }

  /**
   * Get withdrawals for a wallet
   *
   * @param walletId - Wallet ID
   * @param limit - Maximum number of withdrawals to return
   * @returns Array of withdrawal records
   */
  async getWithdrawalsForWallet(
    walletId: number,
    limit: number = 100,
  ): Promise<Withdrawal[]> {
    const result = await query(
      `SELECT * FROM withdrawals
       WHERE wallet_id = $1
       ORDER BY initiated_at DESC
       LIMIT $2`,
      [walletId, limit],
    );

    return result.rows as Withdrawal[];
  }
}

// Export singleton instance
export const withdrawalService = new WithdrawalService();
