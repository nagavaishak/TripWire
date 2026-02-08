import { decrypt, zeroBuffer } from './encryption';
import logger from './logger';

/**
 * Secure Key Handler
 * CRITICAL: Ensures private keys are always zeroed from memory
 * Part of P0_005: Private Key Memory Safety Audit
 *
 * Provides safe wrappers that guarantee cleanup even on errors
 */

/**
 * Safely execute operation with decrypted private key
 * CRITICAL: Ensures key is zeroed from memory even if operation throws
 *
 * This is the ONLY way to work with private keys - never decrypt keys manually
 *
 * @param encrypted - Encrypted private key (hex string)
 * @param iv - Initialization vector (hex string)
 * @param authTag - Authentication tag (hex string)
 * @param masterKey - Master encryption key (32-byte hex string)
 * @param operation - Operation to perform with decrypted key
 * @returns Result of operation
 *
 * @example
 * const signature = await withSecureKey(
 *   wallet.encrypted_private_key,
 *   wallet.iv,
 *   wallet.auth_tag,
 *   masterKey,
 *   async (privateKeyBytes) => {
 *     const keypair = Keypair.fromSecretKey(privateKeyBytes);
 *     transaction.partialSign(keypair);
 *     return transaction.signature;
 *   }
 * );
 */
export async function withSecureKey<T>(
  encrypted: string,
  iv: string,
  authTag: string,
  masterKey: string,
  operation: (privateKeyBytes: Buffer) => Promise<T> | T,
): Promise<T> {
  let decryptedKey: Buffer | null = null;

  try {
    // Decrypt private key
    decryptedKey = decrypt(encrypted, iv, authTag, masterKey);

    logger.debug('Private key decrypted for operation', {
      keyLength: decryptedKey.length,
    });

    // Execute operation with decrypted key
    const result = await operation(decryptedKey);

    logger.debug('Operation completed successfully');

    return result;
  } catch (error) {
    logger.error('Error during secure key operation', {
      error: error instanceof Error ? error.message : String(error),
      // NEVER log the key itself
    });
    throw error;
  } finally {
    // CRITICAL: Always zero out the key, even on error
    if (decryptedKey) {
      zeroBuffer(decryptedKey);
      logger.debug('Private key zeroed from memory');
    }
  }
}

/**
 * Synchronous version of withSecureKey for non-async operations
 * CRITICAL: Use this for operations that don't require async/await
 *
 * @param encrypted - Encrypted private key (hex string)
 * @param iv - Initialization vector (hex string)
 * @param authTag - Authentication tag (hex string)
 * @param masterKey - Master encryption key (32-byte hex string)
 * @param operation - Synchronous operation to perform
 * @returns Result of operation
 *
 * @example
 * const publicKey = withSecureKeySync(
 *   wallet.encrypted_private_key,
 *   wallet.iv,
 *   wallet.auth_tag,
 *   masterKey,
 *   (privateKeyBytes) => {
 *     const keypair = Keypair.fromSecretKey(privateKeyBytes);
 *     return keypair.publicKey.toBase58();
 *   }
 * );
 */
export function withSecureKeySync<T>(
  encrypted: string,
  iv: string,
  authTag: string,
  masterKey: string,
  operation: (privateKeyBytes: Buffer) => T,
): T {
  let decryptedKey: Buffer | null = null;

  try {
    // Decrypt private key
    decryptedKey = decrypt(encrypted, iv, authTag, masterKey);

    logger.debug('Private key decrypted for sync operation', {
      keyLength: decryptedKey.length,
    });

    // Execute operation with decrypted key
    const result = operation(decryptedKey);

    logger.debug('Sync operation completed successfully');

    return result;
  } catch (error) {
    logger.error('Error during secure key sync operation', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  } finally {
    // CRITICAL: Always zero out the key, even on error
    if (decryptedKey) {
      zeroBuffer(decryptedKey);
      logger.debug('Private key zeroed from memory');
    }
  }
}

/**
 * Safely extract public key from encrypted private key
 * CRITICAL: Ensures private key is zeroed after deriving public key
 *
 * @param encrypted - Encrypted private key (hex string)
 * @param iv - Initialization vector (hex string)
 * @param authTag - Authentication tag (hex string)
 * @param masterKey - Master encryption key (32-byte hex string)
 * @param derivePublicKey - Function to derive public key from private key bytes
 * @returns Public key (string or other format)
 *
 * @example
 * import { Keypair } from '@solana/web3.js';
 *
 * const publicKey = extractPublicKey(
 *   wallet.encrypted_private_key,
 *   wallet.iv,
 *   wallet.auth_tag,
 *   masterKey,
 *   (privateKeyBytes) => {
 *     const keypair = Keypair.fromSecretKey(privateKeyBytes);
 *     return keypair.publicKey.toBase58();
 *   }
 * );
 */
export function extractPublicKey<T>(
  encrypted: string,
  iv: string,
  authTag: string,
  masterKey: string,
  derivePublicKey: (privateKeyBytes: Buffer) => T,
): T {
  return withSecureKeySync(encrypted, iv, authTag, masterKey, derivePublicKey);
}

/**
 * Memory safety checker for development/testing
 * CRITICAL: Use this to verify keys are being zeroed properly
 *
 * This is a development utility to help detect memory leaks
 * In production, keys should always be zeroed via withSecureKey
 */
export class MemorySafetyChecker {
  private activeKeys: Set<string> = new Set();

  /**
   * Track that a key has been decrypted
   * @param keyId - Unique identifier for the key (e.g., wallet ID)
   */
  trackKeyDecrypted(keyId: string): void {
    if (this.activeKeys.has(keyId)) {
      logger.warn('Key already tracked as active - potential memory leak', {
        keyId,
      });
    }
    this.activeKeys.add(keyId);
  }

  /**
   * Track that a key has been zeroed
   * @param keyId - Unique identifier for the key
   */
  trackKeyZeroed(keyId: string): void {
    if (!this.activeKeys.has(keyId)) {
      logger.warn('Key not tracked as active when zeroing', { keyId });
    }
    this.activeKeys.delete(keyId);
  }

  /**
   * Get list of keys that haven't been zeroed
   * CRITICAL: This should be empty in production
   */
  getActiveKeys(): string[] {
    return Array.from(this.activeKeys);
  }

  /**
   * Check if there are any active keys (potential memory leaks)
   */
  hasActiveKeys(): boolean {
    return this.activeKeys.size > 0;
  }

  /**
   * Clear all tracked keys (for testing)
   */
  reset(): void {
    this.activeKeys.clear();
  }
}

// Export singleton instance for development use
export const memorySafetyChecker = new MemorySafetyChecker();
