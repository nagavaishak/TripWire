import { Blockhash } from '@solana/web3.js';
import { getSolanaConnection } from '../utils/solana';
import logger from '../utils/logger';

/**
 * Solana blockhash constants
 * - Blockhashes expire after ~150 blocks (~80 seconds on mainnet)
 * - We cache them for 60 seconds to stay safe
 */
const BLOCKHASH_CACHE_TTL_MS = 60 * 1000; // 60 seconds
const BLOCKHASH_EXPIRY_BLOCKS = 150; // Solana default

interface CachedBlockhash {
  blockhash: Blockhash;
  slot: number;
  fetchedAt: number; // timestamp in ms
  expiresAt: number; // timestamp in ms
}

export class BlockhashManager {
  private cache: CachedBlockhash | null = null;
  private fetchPromise: Promise<CachedBlockhash> | null = null;

  /**
   * Get a fresh blockhash
   * Uses cache if available and not expired, otherwise fetches new one
   *
   * CRITICAL: This is used for ALL Solana transactions
   */
  async getFreshBlockhash(): Promise<{ blockhash: Blockhash; slot: number }> {
    // Check if cached blockhash is still valid
    if (this.cache && this.isBlockhashValid(this.cache)) {
      logger.debug('Using cached blockhash', {
        blockhash: this.cache.blockhash,
        slot: this.cache.slot,
        age: Date.now() - this.cache.fetchedAt,
      });
      return {
        blockhash: this.cache.blockhash,
        slot: this.cache.slot,
      };
    }

    // If already fetching, wait for that promise
    if (this.fetchPromise) {
      logger.debug('Waiting for in-flight blockhash fetch');
      const result = await this.fetchPromise;
      return {
        blockhash: result.blockhash,
        slot: result.slot,
      };
    }

    // Fetch new blockhash
    this.fetchPromise = this.fetchBlockhash();

    try {
      const result = await this.fetchPromise;
      return {
        blockhash: result.blockhash,
        slot: result.slot,
      };
    } finally {
      this.fetchPromise = null;
    }
  }

  /**
   * Fetch new blockhash from RPC
   */
  private async fetchBlockhash(): Promise<CachedBlockhash> {
    const connection = getSolanaConnection();
    const start = Date.now();

    try {
      const { blockhash, lastValidBlockHeight } =
        await connection.getLatestBlockhash('finalized');

      const slot = await connection.getSlot('finalized');
      const fetchedAt = Date.now();
      const duration = fetchedAt - start;

      // Calculate expiry
      const expiresAt = fetchedAt + BLOCKHASH_CACHE_TTL_MS;

      const cached: CachedBlockhash = {
        blockhash,
        slot,
        fetchedAt,
        expiresAt,
      };

      this.cache = cached;

      logger.info('Fetched new blockhash', {
        blockhash,
        slot,
        lastValidBlockHeight,
        duration,
        cacheFor: BLOCKHASH_CACHE_TTL_MS,
      });

      return cached;
    } catch (error) {
      logger.error('Failed to fetch blockhash', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error('Failed to fetch blockhash from Solana RPC');
    }
  }

  /**
   * Check if cached blockhash is still valid (not expired)
   */
  private isBlockhashValid(cached: CachedBlockhash): boolean {
    const now = Date.now();
    const age = now - cached.fetchedAt;
    const expired = now >= cached.expiresAt;

    if (expired) {
      logger.debug('Cached blockhash expired', {
        age,
        ttl: BLOCKHASH_CACHE_TTL_MS,
      });
      return false;
    }

    return true;
  }

  /**
   * Check if a blockhash is still valid on-chain
   * CRITICAL: Used before retrying failed transactions
   *
   * @param blockhash - Blockhash to check
   * @returns true if valid, false if expired
   */
  async isBlockhashValidOnChain(blockhash: Blockhash): Promise<boolean> {
    const connection = getSolanaConnection();

    try {
      const isValid = await connection.isBlockhashValid(blockhash, 'finalized');

      logger.debug('Checked blockhash validity on-chain', {
        blockhash,
        isValid,
      });

      return isValid;
    } catch (error) {
      logger.error('Error checking blockhash validity', {
        blockhash,
        error: error instanceof Error ? error.message : String(error),
      });

      // On error, assume expired (safer to retry with new blockhash)
      return false;
    }
  }

  /**
   * Force refresh blockhash (clear cache)
   * Use this after a transaction fails to ensure fresh blockhash for retry
   */
  async refreshBlockhash(): Promise<{ blockhash: Blockhash; slot: number }> {
    logger.info('Forcing blockhash refresh');
    this.cache = null;
    return await this.getFreshBlockhash();
  }

  /**
   * Get cache info (for monitoring/debugging)
   */
  getCacheInfo():
    | { cached: true; blockhash: Blockhash; age: number; expiresIn: number }
    | { cached: false } {
    if (!this.cache || !this.isBlockhashValid(this.cache)) {
      return { cached: false };
    }

    const now = Date.now();
    return {
      cached: true,
      blockhash: this.cache.blockhash,
      age: now - this.cache.fetchedAt,
      expiresIn: this.cache.expiresAt - now,
    };
  }

  /**
   * Clear cache (for testing or graceful shutdown)
   */
  clearCache(): void {
    this.cache = null;
    this.fetchPromise = null;
    logger.debug('Blockhash cache cleared');
  }
}

// Export singleton instance
export const blockhashManager = new BlockhashManager();
