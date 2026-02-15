import { Keypair } from '@solana/web3.js';
import { RuleResponse } from '../types/rules';
import { KalshiProbabilityData } from '../types/kalshi';
import { executionService } from './execution.service';
import { executionLockService } from './execution-lock.service';
import { deadLetterQueueService } from './dead-letter-queue.service';
import { jupiterSwapService } from './jupiter-swap.service';
import { walletService } from './wallet.service';
import { secretsManager } from './secrets-manager.service';
import { webhookService } from './webhook.service';
import { monitoringService } from './monitoring.service';
import { withSecureKey } from '../utils/secure-key-handler';
import { getTokenMint, getStablecoinMint, SwapParams } from '../types/swap';
import { query } from '../utils/db';
import logger from '../utils/logger';
import { CONFIG } from '../utils/config';

/**
 * Execution Coordinator Service
 * Orchestrates the complete execution flow with all P0 safety features
 * CRITICAL: This is the main business logic that executes swaps
 */
export class ExecutionCoordinatorService {
  /**
   * Execute a rule
   * CRITICAL: Main entry point for rule execution
   * Handles: locks, idempotency, transaction building, confirmation, DLQ
   *
   * @param rule - Rule to execute
   * @param marketData - Market data that triggered the rule
   * @returns Execution result
   */
  async executeRule(
    rule: RuleResponse,
    marketData: KalshiProbabilityData,
  ): Promise<{
    success: boolean;
    executionId: number;
    message: string;
  }> {
    logger.info('Starting rule execution', {
      ruleId: rule.id,
      ruleName: rule.name,
      marketId: marketData.marketId,
      probability: marketData.probability,
    });

    // Check kill switch
    if (!CONFIG.EXECUTION_ENABLED) {
      logger.warn('Execution disabled by kill switch', {
        ruleId: rule.id,
      });
      return {
        success: false,
        executionId: 0,
        message: 'Execution disabled by kill switch (EXECUTION_ENABLED=false)',
      };
    }

    let lockAcquired = false;

    try {
      // Step 1: Acquire execution lock
      logger.debug('Acquiring execution lock', { ruleId: rule.id });
      const lockResult = await executionLockService.acquireLock(rule.id);

      if (!lockResult.acquired) {
        logger.warn('Failed to acquire lock - rule already executing', {
          ruleId: rule.id,
          lockedBy: lockResult.lockedBy,
        });
        return {
          success: false,
          executionId: 0,
          message: `Rule is already being executed by ${lockResult.lockedBy}`,
        };
      }

      lockAcquired = true;
      logger.info('Execution lock acquired', { ruleId: rule.id });

      // Step 2: Create execution with idempotency check
      logger.debug('Creating execution record', { ruleId: rule.id });
      const executionResult = await executionService.createExecution(
        rule.id,
        new Date(), // triggered_at
        marketData, // market_condition
      );

      if (!executionResult.isNew) {
        logger.info('Execution already exists (idempotent)', {
          executionId: executionResult.id,
          existingSignature: executionResult.existingSignature,
        });

        // Release lock and return
        await executionLockService.releaseLock(rule.id);
        lockAcquired = false;

        return {
          success: true,
          executionId: executionResult.id,
          message: 'Execution already in progress or completed',
        };
      }

      const executionId = executionResult.id;
      logger.info('Execution record created', { executionId });

      // Step 3: Update rule status to TRIGGERED
      await this.updateRuleStatus(rule.id, 'TRIGGERED', new Date());

      // Notify: Rule triggered
      await webhookService.notify({
        event: 'RULE_TRIGGERED',
        userId: rule.user_id,
        timestamp: new Date(),
        data: {
          ruleId: rule.id,
          ruleName: rule.name,
          marketId: marketData.marketId,
          probability: marketData.probability,
          threshold: rule.threshold_probability,
        },
      });

      // Notify: Execution started
      await webhookService.notify({
        event: 'EXECUTION_STARTED',
        userId: rule.user_id,
        timestamp: new Date(),
        data: {
          ruleId: rule.id,
          ruleName: rule.name,
          executionId,
          marketId: marketData.marketId,
        },
      });

      // Log execution start for monitoring
      await monitoringService.logExecution({
        ruleId: rule.id,
        executionId,
        status: 'started',
      });

      // Step 4: Execute swap via Jupiter
      try {
        const signature = await this.executeSwap(rule, executionId, marketData);

        // Step 5: Mark execution as completed
        await executionService.markExecutionCompleted(executionId, signature);

        // Step 6: Update rule back to ACTIVE (can trigger again after cooldown)
        await this.updateRuleStatus(rule.id, 'ACTIVE', null);

        logger.info('Rule execution completed successfully', {
          ruleId: rule.id,
          executionId,
        });

        // Notify: Execution succeeded
        await webhookService.notify({
          event: 'EXECUTION_SUCCEEDED',
          userId: rule.user_id,
          timestamp: new Date(),
          data: {
            ruleId: rule.id,
            ruleName: rule.name,
            executionId,
            marketId: marketData.marketId,
            txSignature: signature,
          },
        });

        // Log execution success for monitoring
        await monitoringService.logExecution({
          ruleId: rule.id,
          executionId,
          status: 'succeeded',
        });

        return {
          success: true,
          executionId,
          message: 'Execution completed successfully',
        };
      } catch (error) {
        // Execution failed
        const errorMessage =
          error instanceof Error ? error.message : String(error);

        logger.error('Execution failed', {
          ruleId: rule.id,
          executionId,
          error: errorMessage,
        });

        // Mark execution as failed
        await executionService.markExecutionFailed(executionId, errorMessage);

        // Notify: Execution failed
        await webhookService.notify({
          event: 'EXECUTION_FAILED',
          userId: rule.user_id,
          timestamp: new Date(),
          data: {
            ruleId: rule.id,
            ruleName: rule.name,
            executionId,
            marketId: marketData.marketId,
            errorMessage,
          },
        });

        // Log execution failure for monitoring
        await monitoringService.logExecution({
          ruleId: rule.id,
          executionId,
          status: 'failed',
          error: errorMessage,
        });

        // Handle failure with DLQ
        const dlqResult = await deadLetterQueueService.handleExecutionFailure(
          executionId,
          errorMessage,
        );

        if (dlqResult.movedToDLQ) {
          logger.error('Execution moved to dead letter queue', {
            executionId,
            dlqId: dlqResult.dlqId,
            retryCount: dlqResult.retryCount,
          });

          // Update rule to FAILED state
          await this.updateRuleStatus(rule.id, 'FAILED', null);

          // Notify: Rule paused due to failures
          await webhookService.notify({
            event: 'RULE_PAUSED',
            userId: rule.user_id,
            timestamp: new Date(),
            data: {
              ruleId: rule.id,
              ruleName: rule.name,
              errorMessage,
              retryCount: dlqResult.retryCount,
            },
          });
        } else {
          // Not moved to DLQ yet, update rule to ACTIVE for retry
          await this.updateRuleStatus(rule.id, 'ACTIVE', null);
        }

        return {
          success: false,
          executionId,
          message: `Execution failed: ${errorMessage}`,
        };
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      logger.error('Error in execution coordinator', {
        ruleId: rule.id,
        error: errorMessage,
      });

      return {
        success: false,
        executionId: 0,
        message: `Execution error: ${errorMessage}`,
      };
    } finally {
      // Always release lock
      if (lockAcquired) {
        try {
          await executionLockService.releaseLock(rule.id);
          logger.debug('Execution lock released', { ruleId: rule.id });
        } catch (error) {
          logger.error('Error releasing lock', {
            ruleId: rule.id,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }
  }

  /**
   * Execute swap transaction via Jupiter
   * CRITICAL: Real Solana swap execution
   */
  private async executeSwap(
    rule: RuleResponse,
    executionId: number,
    marketData: KalshiProbabilityData,
  ): Promise<string> {
    logger.info('Executing real swap via Jupiter', {
      ruleId: rule.id,
      executionId,
      triggerType: rule.trigger_type,
      swapPercentage: rule.swap_percentage,
      walletId: rule.automation_wallet_id,
    });

    // Step 1: Get wallet details
    const walletResult = await query(
      'SELECT * FROM automation_wallets WHERE id = $1',
      [rule.automation_wallet_id],
    );

    if (walletResult.rows.length === 0) {
      throw new Error('Automation wallet not found');
    }

    const wallet = walletResult.rows[0];

    // Step 2: Get wallet balance
    const balance = await walletService.getWalletBalance(wallet.public_key);

    if (balance === 0) {
      throw new Error('Wallet balance is zero - cannot execute swap');
    }

    // Step 3: Determine swap parameters based on trigger type
    let inputMint: string;
    let outputMint: string;

    if (rule.trigger_type === 'SWAP_TO_STABLECOIN') {
      // Selling SOL for USDC
      inputMint = getTokenMint('SOL');
      outputMint = getStablecoinMint();
    } else if (rule.trigger_type === 'SWAP_TO_SOL') {
      // Buying SOL with USDC (assume wallet has USDC)
      inputMint = getStablecoinMint();
      outputMint = getTokenMint('SOL');
    } else {
      throw new Error(`Unknown trigger type: ${rule.trigger_type}`);
    }

    // Step 4: Calculate swap amount (percentage of balance)
    const swapAmount = Math.floor((balance * rule.swap_percentage) / 100);

    if (swapAmount === 0) {
      throw new Error(
        `Swap amount too small (${swapAmount} lamports) - increase balance or percentage`,
      );
    }

    logger.info('Swap parameters determined', {
      inputMint,
      outputMint,
      balance,
      swapPercentage: rule.swap_percentage,
      swapAmount,
    });

    // Step 5: Execute swap with private key
    const masterKey = await secretsManager.getMasterKey(
      'automation_wallet',
      rule.automation_wallet_id,
    );

    const swapResult = await withSecureKey(
      wallet.encrypted_private_key,
      wallet.iv,
      wallet.auth_tag,
      masterKey,
      async (privateKeyBytes) => {
        // Create keypair from private key
        const keypair = Keypair.fromSecretKey(privateKeyBytes);

        // Build swap parameters
        const swapParams: SwapParams = {
          inputMint,
          outputMint,
          amount: swapAmount,
          slippageBps: CONFIG.SLIPPAGE_TOLERANCE_BPS,
          userPublicKey: wallet.public_key,
        };

        // Execute swap via Jupiter
        return await jupiterSwapService.executeSwap(swapParams, keypair);
      },
    );

    if (!swapResult.success) {
      throw new Error(`Swap failed: ${swapResult.error}`);
    }

    logger.info('Swap executed successfully', {
      executionId,
      ruleId: rule.id,
      signature: swapResult.signature,
      inputAmount: swapResult.inputAmount,
      outputAmount: swapResult.outputAmount,
    });

    // Step 6: Update execution with transaction info
    await executionService.updateExecutionWithTransaction(
      executionId,
      swapResult.signature!,
      'jupiter-swap', // blockhash (not critical for Jupiter swaps)
    );

    return swapResult.signature!;
  }

  /**
   * Update rule status
   */
  private async updateRuleStatus(
    ruleId: number,
    status: string,
    lastTriggeredAt: Date | null,
  ): Promise<void> {
    if (lastTriggeredAt) {
      await query(
        `UPDATE rules
         SET status = $1, last_triggered_at = $2, updated_at = NOW()
         WHERE id = $3`,
        [status, lastTriggeredAt, ruleId],
      );
    } else {
      await query(
        `UPDATE rules
         SET status = $1, updated_at = NOW()
         WHERE id = $2`,
        [status, ruleId],
      );
    }

    logger.debug('Rule status updated', { ruleId, status });
  }
}

// Export singleton instance
export const executionCoordinatorService =
  new ExecutionCoordinatorService();
