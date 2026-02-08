import { PublicKey, Transaction } from '@solana/web3.js';

/**
 * Transaction build result
 */
export interface TransactionBuildResult {
  transaction: Transaction;
  blockhash: string;
  slot: number;
}

/**
 * Transaction send result
 */
export interface TransactionSendResult {
  signature: string;
  blockhash: string;
  slot: number;
  sentAt: Date;
}

/**
 * Transaction confirmation status
 */
export type TransactionStatus =
  | 'pending'
  | 'confirmed'
  | 'finalized'
  | 'failed'
  | 'not_found';

/**
 * Transaction confirmation result
 */
export interface TransactionConfirmationResult {
  status: TransactionStatus;
  signature: string;
  slot?: number;
  blockTime?: Date;
  error?: string;
}

/**
 * Swap instruction parameters
 */
export interface SwapInstructionParams {
  userPublicKey: PublicKey;
  inputMint: PublicKey;
  outputMint: PublicKey;
  amount: number;
  slippageBps: number;
}

/**
 * Priority fee configuration
 */
export interface PriorityFeeConfig {
  computeUnitLimit?: number;
  computeUnitPriceMicroLamports?: number;
}
