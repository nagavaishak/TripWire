import crypto from 'crypto';
import logger from './logger';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 128 bits
const AUTH_TAG_LENGTH = 16; // 128 bits

/**
 * Encrypt data using AES-256-GCM
 * CRITICAL: This is used to encrypt Solana private keys - any bug here means lost funds
 *
 * @param data - Data to encrypt (e.g., Solana private key bytes)
 * @param masterKey - 32-byte hex string from MASTER_ENCRYPTION_KEY
 * @returns Object containing encrypted data, IV, and auth tag
 */
export function encrypt(
  data: Buffer,
  masterKey: string,
): { encrypted: string; iv: string; authTag: string } {
  // Validate master key
  if (!masterKey || masterKey.length !== 64) {
    throw new Error('Master key must be 32 bytes (64 hex characters)');
  }

  const keyBuffer = Buffer.from(masterKey, 'hex');
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, keyBuffer, iv);

  const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);

  const authTag = cipher.getAuthTag();

  // Zero out the key buffer from memory (security best practice)
  keyBuffer.fill(0);

  return {
    encrypted: encrypted.toString('hex'),
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
  };
}

/**
 * Decrypt data using AES-256-GCM
 * CRITICAL: This decrypts Solana private keys - incorrect decryption = lost funds
 *
 * @param encrypted - Encrypted data (hex string)
 * @param iv - Initialization vector (hex string)
 * @param authTag - Authentication tag (hex string)
 * @param masterKey - 32-byte hex string from MASTER_ENCRYPTION_KEY
 * @returns Decrypted data as Buffer
 */
export function decrypt(
  encrypted: string,
  iv: string,
  authTag: string,
  masterKey: string,
): Buffer {
  // Validate master key
  if (!masterKey || masterKey.length !== 64) {
    throw new Error('Master key must be 32 bytes (64 hex characters)');
  }

  // Validate inputs
  if (!encrypted || !iv || !authTag) {
    throw new Error('Missing required decryption parameters');
  }

  const keyBuffer = Buffer.from(masterKey, 'hex');
  const ivBuffer = Buffer.from(iv, 'hex');
  const authTagBuffer = Buffer.from(authTag, 'hex');
  const encryptedBuffer = Buffer.from(encrypted, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, keyBuffer, ivBuffer);
  decipher.setAuthTag(authTagBuffer);

  try {
    const decrypted = Buffer.concat([
      decipher.update(encryptedBuffer),
      decipher.final(),
    ]);

    // Zero out the key buffer from memory
    keyBuffer.fill(0);

    return decrypted;
  } catch (error) {
    // Zero out the key buffer even on error
    keyBuffer.fill(0);

    logger.error('Decryption failed - auth tag verification failed', {
      error: error instanceof Error ? error.message : String(error),
    });

    // Auth tag verification failed = data was tampered with
    throw new Error(
      'Decryption failed: data may have been tampered with or wrong key used',
    );
  }
}

/**
 * Securely zero out a buffer from memory
 * CRITICAL: Call this immediately after using decrypted private keys
 *
 * @param buffer - Buffer to zero out
 */
export function zeroBuffer(buffer: Buffer): void {
  if (buffer && Buffer.isBuffer(buffer)) {
    buffer.fill(0);
  }
}

/**
 * Validate master encryption key format
 *
 * @param key - Key to validate
 * @returns true if valid, throws otherwise
 */
export function validateMasterKey(key: string): boolean {
  if (!key) {
    throw new Error('Master encryption key is not set');
  }

  if (key.length !== 64) {
    throw new Error(
      `Master encryption key must be 32 bytes (64 hex characters), got ${key.length}`,
    );
  }

  // Validate it's valid hex
  if (!/^[0-9a-fA-F]{64}$/.test(key)) {
    throw new Error('Master encryption key must be valid hexadecimal');
  }

  return true;
}
