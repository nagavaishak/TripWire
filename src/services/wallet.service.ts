import { Keypair, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { query, withTransaction, transactionQuery } from '../utils/db';
import { encrypt, zeroBuffer } from '../utils/encryption';
import { getSolanaConnection } from '../utils/solana';
import { secretsManager } from './secrets-manager.service';
import { withdrawalService } from './withdrawal.service';
import logger from '../utils/logger';
import { WalletResponse } from '../types/wallets';

/**
 * Wallet Service
 * Manages automation wallets with encrypted private keys
 */
export class WalletService {
  /**
   * Create a new automation wallet
   * CRITICAL: Generates Solana keypair and encrypts private key
   */
  async createWallet(userId: number, name: string): Promise<WalletResponse> {
    return await withTransaction(async (client) => {
      // Generate new Solana keypair
      const keypair = Keypair.generate();
      const publicKey = keypair.publicKey.toBase58();
      const privateKeyBytes = keypair.secretKey;

      try {
        // Get master encryption key
        const masterKey = await secretsManager.getMasterKey(
          'automation_wallet',
        );

        // Encrypt private key
        const encrypted = encrypt(Buffer.from(privateKeyBytes), masterKey);

        // Store in database
        const result = await transactionQuery(
          client,
          `INSERT INTO automation_wallets
           (user_id, name, public_key, encrypted_private_key, iv, auth_tag, key_version, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, 1, NOW(), NOW())
           RETURNING id, user_id, name, public_key, key_version, created_at, updated_at`,
          [
            userId,
            name,
            publicKey,
            encrypted.encrypted,
            encrypted.iv,
            encrypted.authTag,
          ],
        );

        const wallet = result.rows[0];

        logger.info('Automation wallet created', {
          walletId: wallet.id,
          userId,
          publicKey,
        });

        // Audit log
        await transactionQuery(
          client,
          `INSERT INTO audit_log (event_type, resource_type, resource_id, action, details)
           VALUES ('WALLET', 'automation_wallet', $1, 'created', $2)`,
          [wallet.id, JSON.stringify({ userId, name, publicKey })],
        );

        return this.formatWalletResponse(wallet);
      } finally {
        // CRITICAL: Zero out private key from memory
        zeroBuffer(Buffer.from(privateKeyBytes));
      }
    });
  }

  /**
   * Get wallet by ID
   */
  async getWallet(
    walletId: number,
    userId: number,
    includeBalance: boolean = false,
  ): Promise<WalletResponse | null> {
    const result = await query(
      'SELECT id, user_id, name, public_key, key_version, created_at, updated_at FROM automation_wallets WHERE id = $1 AND user_id = $2',
      [walletId, userId],
    );

    if (result.rows.length === 0) {
      return null;
    }

    const wallet = this.formatWalletResponse(result.rows[0]);

    // Fetch balance if requested
    if (includeBalance) {
      wallet.balance = await this.getWalletBalance(wallet.public_key);
    }

    return wallet;
  }

  /**
   * List wallets for a user
   */
  async listWallets(
    userId: number,
    includeBalance: boolean = false,
  ): Promise<WalletResponse[]> {
    const result = await query(
      'SELECT id, user_id, name, public_key, key_version, created_at, updated_at FROM automation_wallets WHERE user_id = $1 ORDER BY created_at DESC',
      [userId],
    );

    const wallets = result.rows.map((row) => this.formatWalletResponse(row));

    // Fetch balances if requested
    if (includeBalance) {
      await Promise.all(
        wallets.map(async (wallet) => {
          wallet.balance = await this.getWalletBalance(wallet.public_key);
        }),
      );
    }

    return wallets;
  }

  /**
   * Get wallet balance from Solana
   */
  async getWalletBalance(publicKey: string): Promise<number> {
    try {
      const connection = getSolanaConnection();
      const pubkey = new PublicKey(publicKey);
      const balance = await connection.getBalance(pubkey, 'finalized');

      logger.debug('Fetched wallet balance', {
        publicKey,
        balance,
        balanceSOL: balance / LAMPORTS_PER_SOL,
      });

      return balance;
    } catch (error) {
      logger.error('Error fetching wallet balance', {
        publicKey,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error('Failed to fetch wallet balance from Solana');
    }
  }

  /**
   * Initiate withdrawal from automation wallet
   * Uses withdrawal service with replay protection
   */
  async initiateWithdrawal(
    walletId: number,
    userId: number,
    amount: bigint,
    destinationAddress: string,
  ): Promise<{ withdrawalId: number; isNew: boolean }> {
    // Verify wallet ownership
    const wallet = await this.getWallet(walletId, userId);
    if (!wallet) {
      throw new Error('Wallet not found');
    }

    // Check balance
    const balance = await this.getWalletBalance(wallet.public_key);
    if (balance < Number(amount)) {
      throw new Error(
        `Insufficient balance: ${balance} lamports available, ${amount} requested`,
      );
    }

    // Use withdrawal service for replay protection
    const result = await withdrawalService.initiateWithdrawal({
      userId,
      walletId,
      destinationAddress,
      amount,
    });

    logger.info('Withdrawal initiated', {
      withdrawalId: result.id,
      walletId,
      userId,
      amount: amount.toString(),
      destinationAddress,
      isNew: result.isNew,
    });

    return {
      withdrawalId: result.id,
      isNew: result.isNew,
    };
  }

  /**
   * Get wallet statistics
   */
  async getWalletStats(
    walletId: number,
    userId: number,
  ): Promise<{
    totalDeposits: string;
    totalWithdrawals: string;
    executionCount: number;
  }> {
    // Verify ownership
    const wallet = await this.getWallet(walletId, userId);
    if (!wallet) {
      throw new Error('Wallet not found');
    }

    // Get withdrawal stats
    const withdrawalStats = await query(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'CONFIRMED') as withdrawal_count,
         SUM(amount) FILTER (WHERE status = 'CONFIRMED') as total_withdrawn
       FROM withdrawals
       WHERE wallet_id = $1`,
      [walletId],
    );

    // Get execution stats
    const executionStats = await query(
      `SELECT COUNT(*) as execution_count
       FROM executions e
       JOIN rules r ON e.rule_id = r.id
       WHERE r.automation_wallet_id = $1
       AND e.status = 'EXECUTED'`,
      [walletId],
    );

    return {
      totalDeposits: '0', // TODO: Track deposits when implemented
      totalWithdrawals:
        withdrawalStats.rows[0].total_withdrawn?.toString() || '0',
      executionCount: parseInt(executionStats.rows[0].execution_count) || 0,
    };
  }

  /**
   * Format wallet for API response
   */
  private formatWalletResponse(wallet: any): WalletResponse {
    return {
      id: wallet.id,
      user_id: wallet.user_id,
      name: wallet.name,
      public_key: wallet.public_key,
      balance: wallet.balance, // Optional, may be undefined
      key_version: wallet.key_version,
      created_at: wallet.created_at.toISOString(),
      updated_at: wallet.updated_at.toISOString(),
    };
  }
}

// Export singleton instance
export const walletService = new WalletService();
