import axios, { AxiosInstance } from 'axios';
import {
  Transaction,
  VersionedTransaction,
  PublicKey,
  Keypair,
} from '@solana/web3.js';
import { getSolanaConnection } from '../utils/solana';
import { buildTransaction } from '../utils/transaction-builder';
import { transactionStatusService } from './transaction-status.service';
import logger from '../utils/logger';
import { CONFIG } from '../utils/config';
import {
  SwapParams,
  SwapQuote,
  SwapResult,
  JupiterQuote,
  validateSwapParams,
} from '../types/swap';

/**
 * Jupiter Swap Service
 * Integrates with Jupiter v6 API for optimal Solana swaps
 */
export class JupiterSwapService {
  private client: AxiosInstance;
  private apiUrl: string;

  constructor() {
    this.apiUrl = CONFIG.JUPITER_API_URL;

    this.client = axios.create({
      baseURL: this.apiUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    logger.info('Jupiter swap service initialized', {
      apiUrl: this.apiUrl,
    });
  }

  /**
   * Get swap quote from Jupiter
   * CRITICAL: Fetches best swap route across all DEXs
   *
   * @param params - Swap parameters
   * @returns Swap quote with expected output and route
   */
  async getQuote(params: SwapParams): Promise<SwapQuote> {
    // Validate parameters
    const validation = validateSwapParams(params);
    if (!validation.valid) {
      throw new Error(`Invalid swap params: ${validation.error}`);
    }

    logger.info('Fetching Jupiter quote', {
      inputMint: params.inputMint,
      outputMint: params.outputMint,
      amount: params.amount,
      slippageBps: params.slippageBps,
    });

    try {
      const response = await this.client.get<JupiterQuote>('/quote', {
        params: {
          inputMint: params.inputMint,
          outputMint: params.outputMint,
          amount: params.amount,
          slippageBps: params.slippageBps,
          onlyDirectRoutes: false,
          asLegacyTransaction: false,
        },
      });

      const quote = response.data;

      // Parse amounts
      const inputAmount = parseInt(quote.inAmount);
      const outputAmount = parseInt(quote.outAmount);
      const minimumOutputAmount = parseInt(quote.otherAmountThreshold);
      const priceImpactPercent = parseFloat(quote.priceImpactPct);

      // Build route description
      const routeDescription =
        quote.routePlan.length > 0
          ? quote.routePlan.map((r: any) => r.swapInfo?.label || 'Unknown').join(' → ')
          : 'Direct';

      logger.info('Jupiter quote received', {
        inputAmount,
        outputAmount,
        minimumOutputAmount,
        priceImpactPercent,
        route: routeDescription,
      });

      return {
        inputMint: params.inputMint,
        outputMint: params.outputMint,
        inputAmount,
        outputAmount,
        minimumOutputAmount,
        priceImpactPercent,
        route: routeDescription,
        quote,
      };
    } catch (error) {
      logger.error('Failed to fetch Jupiter quote', {
        error: error instanceof Error ? error.message : String(error),
        params,
      });

      if (axios.isAxiosError(error) && error.response) {
        throw new Error(
          `Jupiter API error: ${error.response.data?.error || error.message}`,
        );
      }

      throw new Error('Failed to fetch swap quote from Jupiter');
    }
  }

  /**
   * Build swap transaction from quote
   * Returns unsigned transaction that needs to be signed
   *
   * @param quote - Jupiter quote
   * @param userPublicKey - User's wallet public key
   * @returns Serialized transaction ready for signing
   */
  async buildSwapTransaction(
    quote: JupiterQuote,
    userPublicKey: string,
  ): Promise<string> {
    logger.info('Building swap transaction from Jupiter', {
      inputMint: quote.inputMint,
      outputMint: quote.outputMint,
      userPublicKey,
    });

    try {
      const response = await this.client.post<{ swapTransaction: string }>(
        '/swap',
        {
          quoteResponse: quote,
          userPublicKey,
          wrapAndUnwrapSol: true,
          dynamicComputeUnitLimit: true,
          prioritizationFeeLamports: 'auto',
        },
      );

      const serializedTransaction = response.data.swapTransaction;

      logger.info('Swap transaction built successfully', {
        userPublicKey,
      });

      return serializedTransaction;
    } catch (error) {
      logger.error('Failed to build swap transaction', {
        error: error instanceof Error ? error.message : String(error),
        userPublicKey,
      });

      if (axios.isAxiosError(error) && error.response) {
        throw new Error(
          `Jupiter API error: ${error.response.data?.error || error.message}`,
        );
      }

      throw new Error('Failed to build swap transaction');
    }
  }

  /**
   * Execute complete swap flow
   * CRITICAL: Main entry point for executing swaps
   *
   * @param params - Swap parameters
   * @param keypair - Keypair to sign transaction
   * @returns Swap result with signature and amounts
   */
  async executeSwap(
    params: SwapParams,
    keypair: Keypair,
  ): Promise<SwapResult> {
    logger.info('Executing Jupiter swap', {
      inputMint: params.inputMint,
      outputMint: params.outputMint,
      amount: params.amount,
      userPublicKey: keypair.publicKey.toBase58(),
    });

    try {
      // Step 1: Get quote
      const quote = await this.getQuote(params);

      // Step 2: Build transaction
      const serializedTransaction = await this.buildSwapTransaction(
        quote.quote,
        keypair.publicKey.toBase58(),
      );

      // Step 3: Deserialize and sign transaction
      const transactionBuf = Buffer.from(serializedTransaction, 'base64');
      const transaction = VersionedTransaction.deserialize(transactionBuf);

      // Sign transaction
      transaction.sign([keypair]);

      logger.info('Transaction signed, sending to Solana', {
        userPublicKey: keypair.publicKey.toBase58(),
      });

      // Step 4: Send transaction
      const connection = getSolanaConnection();
      const signature = await connection.sendRawTransaction(
        transaction.serialize(),
        {
          skipPreflight: false,
          preflightCommitment: 'confirmed',
          maxRetries: 3,
        },
      );

      logger.info('Swap transaction sent', {
        signature,
        userPublicKey: keypair.publicKey.toBase58(),
      });

      // Step 5: Wait for confirmation
      const confirmationResult =
        await transactionStatusService.waitForConfirmation(signature, 60000);

      if (confirmationResult.status === 'failed') {
        throw new Error(
          `Transaction failed: ${confirmationResult.error || 'Unknown error'}`,
        );
      }

      if (confirmationResult.status === 'not_found') {
        throw new Error('Transaction not found on-chain (possible timeout)');
      }

      logger.info('Swap executed successfully', {
        signature,
        status: confirmationResult.status,
        inputAmount: quote.inputAmount,
        outputAmount: quote.outputAmount,
      });

      return {
        success: true,
        signature,
        inputAmount: quote.inputAmount,
        outputAmount: quote.outputAmount,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      logger.error('Swap execution failed', {
        error: errorMessage,
        params,
      });

      return {
        success: false,
        signature: null,
        inputAmount: params.amount,
        outputAmount: null,
        error: errorMessage,
      };
    }
  }

  /**
   * Check if Jupiter API is healthy
   */
  async checkHealth(): Promise<boolean> {
    try {
      await this.client.get('/health');
      return true;
    } catch {
      return false;
    }
  }
}

// Export singleton instance
export const jupiterSwapService = new JupiterSwapService();
