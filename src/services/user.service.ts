import crypto from 'crypto';
import { query, withTransaction, transactionQuery } from '../utils/db';
import logger from '../utils/logger';

export interface User {
  id: number;
  email: string;
  main_wallet_address: string;
  api_key_hash: string;
  created_at: Date;
  updated_at: Date;
}

export class UserService {
  /**
   * Generate a secure API key
   * Format: tw_<32_bytes_base64url>
   */
  generateApiKey(): string {
    const key = crypto.randomBytes(32).toString('base64url');
    return `tw_${key}`;
  }

  /**
   * Hash API key for storage (SHA-256)
   * SECURITY: Never store plaintext API keys
   */
  hashApiKey(apiKey: string): string {
    return crypto.createHash('sha256').update(apiKey).digest('hex');
  }

  /**
   * Verify API key against stored hash
   * SECURITY: Uses timing-safe comparison to prevent timing attacks
   */
  async verifyApiKey(providedKey: string, storedHash: string): Promise<boolean> {
    try {
      const providedHash = this.hashApiKey(providedKey);
      return crypto.timingSafeEqual(
        Buffer.from(providedHash, 'hex'),
        Buffer.from(storedHash, 'hex'),
      );
    } catch (error) {
      // timingSafeEqual throws if buffer lengths don't match
      return false;
    }
  }

  /**
   * Create a new user
   * Returns user object and plaintext API key (only time it's visible)
   */
  async createUser(
    email: string,
    mainWalletAddress: string,
  ): Promise<{ user: User; apiKey: string }> {
    // Generate API key
    const apiKey = this.generateApiKey();
    const apiKeyHash = this.hashApiKey(apiKey);

    // Insert user in transaction
    const user = await withTransaction(async (client) => {
      // Check if user already exists
      const existing = await transactionQuery(
        client,
        'SELECT id FROM users WHERE email = $1 OR main_wallet_address = $2',
        [email, mainWalletAddress],
      );

      if (existing.rows.length > 0) {
        throw new Error('User with this email or wallet address already exists');
      }

      // Create user
      const result = await transactionQuery<User>(
        client,
        `INSERT INTO users (email, main_wallet_address, api_key_hash)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [email, mainWalletAddress, apiKeyHash],
      );

      const newUser = result.rows[0];

      // Audit log
      await transactionQuery(
        client,
        `INSERT INTO audit_log (event_type, user_id, resource_type, resource_id, action, details)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          'AUTH',
          newUser.id,
          'user',
          newUser.id.toString(),
          'USER_CREATED',
          JSON.stringify({ email, main_wallet_address: mainWalletAddress }),
        ],
      );

      return newUser;
    });

    logger.info('User created', {
      userId: user.id,
      email: user.email,
      wallet: user.main_wallet_address,
    });

    return { user, apiKey };
  }

  /**
   * Authenticate user by API key
   * Returns user if valid, null if invalid
   */
  async authenticateUser(apiKey: string): Promise<User | null> {
    if (!apiKey || !apiKey.startsWith('tw_')) {
      return null;
    }

    const apiKeyHash = this.hashApiKey(apiKey);

    try {
      const result = await query<User>(
        'SELECT * FROM users WHERE api_key_hash = $1',
        [apiKeyHash],
      );

      if (result.rows.length === 0) {
        return null;
      }

      const user = result.rows[0];

      // Verify using timing-safe comparison
      const valid = await this.verifyApiKey(apiKey, user.api_key_hash);

      if (!valid) {
        return null;
      }

      logger.debug('User authenticated', { userId: user.id });

      return user;
    } catch (error) {
      logger.error('Authentication error', {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Get user by ID
   */
  async getUserById(userId: number): Promise<User | null> {
    try {
      const result = await query<User>('SELECT * FROM users WHERE id = $1', [
        userId,
      ]);

      return result.rows[0] || null;
    } catch (error) {
      logger.error('Error fetching user', {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Get user by email
   */
  async getUserByEmail(email: string): Promise<User | null> {
    try {
      const result = await query<User>('SELECT * FROM users WHERE email = $1', [
        email,
      ]);

      return result.rows[0] || null;
    } catch (error) {
      logger.error('Error fetching user by email', {
        email,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Regenerate API key for user (key rotation)
   */
  async regenerateApiKey(userId: number): Promise<string> {
    const newApiKey = this.generateApiKey();
    const newApiKeyHash = this.hashApiKey(newApiKey);

    await withTransaction(async (client) => {
      // Update user's API key
      await transactionQuery(
        client,
        'UPDATE users SET api_key_hash = $1, updated_at = NOW() WHERE id = $2',
        [newApiKeyHash, userId],
      );

      // Audit log
      await transactionQuery(
        client,
        `INSERT INTO audit_log (event_type, user_id, resource_type, resource_id, action, details)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          'AUTH',
          userId,
          'user',
          userId.toString(),
          'API_KEY_REGENERATED',
          JSON.stringify({ timestamp: new Date().toISOString() }),
        ],
      );
    });

    logger.info('API key regenerated', { userId });

    return newApiKey;
  }
}

// Export singleton instance
export const userService = new UserService();
