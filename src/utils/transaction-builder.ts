import {
  Transaction,
  TransactionInstruction,
  PublicKey,
  Blockhash,
} from '@solana/web3.js';
import { blockhashManager } from '../services/blockhash-manager.service';
import logger from './logger';

/**
 * Build a Solana transaction with fresh blockhash
 * CRITICAL: All Solana transactions must use this to ensure blockhash validity
 *
 * @param instructions - Transaction instructions
 * @param feePayer - Public key of fee payer
 * @returns Transaction with fresh blockhash and metadata
 */
export async function buildTransaction(
  instructions: TransactionInstruction[],
  feePayer: PublicKey,
): Promise<{ transaction: Transaction; blockhash: Blockhash; slot: number }> {
  // Get fresh blockhash
  const { blockhash, slot } = await blockhashManager.getFreshBlockhash();

  // Create transaction
  const transaction = new Transaction({
    feePayer,
    blockhash,
    lastValidBlockHeight: undefined, // Will be set by blockhash
  });

  // Add instructions
  transaction.add(...instructions);

  logger.debug('Transaction built', {
    blockhash,
    slot,
    feePayer: feePayer.toBase58(),
    instructionCount: instructions.length,
  });

  return {
    transaction,
    blockhash,
    slot,
  };
}

/**
 * Rebuild transaction with fresh blockhash (for retries)
 * CRITICAL: Use this when retrying failed transactions
 *
 * @param originalTransaction - Original transaction to rebuild
 * @returns New transaction with fresh blockhash
 */
export async function rebuildTransactionWithFreshBlockhash(
  originalTransaction: Transaction,
): Promise<{ transaction: Transaction; blockhash: Blockhash; slot: number }> {
  logger.info('Rebuilding transaction with fresh blockhash');

  // Force refresh blockhash
  const { blockhash, slot } = await blockhashManager.refreshBlockhash();

  // Create new transaction with same instructions
  const transaction = new Transaction({
    feePayer: originalTransaction.feePayer,
    blockhash,
    lastValidBlockHeight: undefined,
  });

  // Copy instructions from original
  transaction.instructions = [...originalTransaction.instructions];

  logger.debug('Transaction rebuilt', {
    newBlockhash: blockhash,
    slot,
    instructionCount: transaction.instructions.length,
  });

  return {
    transaction,
    blockhash,
    slot,
  };
}

/**
 * Check if transaction's blockhash is still valid
 * Used before retrying to decide if we need fresh blockhash
 *
 * @param blockhash - Blockhash from original transaction
 * @returns true if valid, false if expired
 */
export async function isTransactionBlockhashValid(
  blockhash: Blockhash,
): Promise<boolean> {
  return await blockhashManager.isBlockhashValidOnChain(blockhash);
}
