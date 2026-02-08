import { kalshiService } from './kalshi.service';
import { ruleService } from './rule.service';
import { ruleEvaluatorService } from './rule-evaluator.service';
import { executionCoordinatorService } from './execution-coordinator.service';
import { KalshiProbabilityData } from '../types/kalshi';
import logger from '../utils/logger';
import { CONFIG } from '../utils/config';

/**
 * Market Poller Service
 * Periodically polls Kalshi markets and triggers rule executions
 * CRITICAL: This is the main event loop that makes the system work
 */
export class MarketPollerService {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private isPaused: boolean = false;
  private lastPollTime: Date | null = null;
  private pollCount: number = 0;
  private errorCount: number = 0;

  /**
   * Start the market poller
   * Begins polling on configured interval
   */
  start(): void {
    if (this.isRunning) {
      logger.warn('Market poller already running');
      return;
    }

    if (!CONFIG.EXECUTION_ENABLED) {
      logger.warn(
        'Market poller not started - execution disabled by kill switch',
      );
      return;
    }

    const intervalMs = CONFIG.KALSHI_POLL_INTERVAL_MS;

    logger.info('Starting market poller', {
      intervalMs,
      intervalMinutes: intervalMs / 60000,
    });

    this.isRunning = true;
    this.isPaused = false;

    // Run immediately on start
    this.poll().catch((error) => {
      logger.error('Error in initial poll', {
        error: error instanceof Error ? error.message : String(error),
      });
    });

    // Then run on interval
    this.intervalId = setInterval(() => {
      if (!this.isPaused) {
        this.poll().catch((error) => {
          logger.error('Error in scheduled poll', {
            error: error instanceof Error ? error.message : String(error),
          });
        });
      }
    }, intervalMs);

    logger.info('Market poller started successfully');
  }

  /**
   * Stop the market poller
   * Gracefully shuts down polling
   */
  stop(): void {
    if (!this.isRunning) {
      logger.warn('Market poller not running');
      return;
    }

    logger.info('Stopping market poller');

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.isRunning = false;
    this.isPaused = false;

    logger.info('Market poller stopped');
  }

  /**
   * Pause polling temporarily
   */
  pause(): void {
    if (!this.isRunning) {
      logger.warn('Cannot pause - poller not running');
      return;
    }

    this.isPaused = true;
    logger.info('Market poller paused');
  }

  /**
   * Resume polling
   */
  resume(): void {
    if (!this.isRunning) {
      logger.warn('Cannot resume - poller not running');
      return;
    }

    this.isPaused = false;
    logger.info('Market poller resumed');
  }

  /**
   * Main polling logic
   * CRITICAL: Core execution flow
   */
  private async poll(): Promise<void> {
    const startTime = Date.now();
    this.pollCount++;

    logger.info('Starting market poll cycle', {
      pollCount: this.pollCount,
      lastPollTime: this.lastPollTime,
    });

    try {
      // Step 1: Get all active rules that need evaluation
      const activeRules = await ruleService.getActiveRulesForEvaluation();

      if (activeRules.length === 0) {
        logger.info('No active rules to evaluate');
        this.lastPollTime = new Date();
        return;
      }

      logger.info('Found active rules for evaluation', {
        ruleCount: activeRules.length,
      });

      // Step 2: Get unique market IDs
      const marketIds = [...new Set(activeRules.map((r) => r.kalshi_market_id))];

      logger.info('Fetching market data', {
        marketCount: marketIds.length,
        marketIds,
      });

      // Step 3: Fetch market data for all unique markets
      const marketDataMap = new Map<string, KalshiProbabilityData>();

      for (const marketId of marketIds) {
        try {
          const marketData = await kalshiService.fetchProbability(marketId);
          marketDataMap.set(marketId, marketData);

          logger.debug('Fetched market data', {
            marketId,
            probability: marketData.probability,
          });
        } catch (error) {
          logger.error('Failed to fetch market data', {
            marketId,
            error: error instanceof Error ? error.message : String(error),
          });
          // Continue with other markets even if one fails
        }
      }

      if (marketDataMap.size === 0) {
        logger.warn('No market data fetched - skipping evaluation');
        this.lastPollTime = new Date();
        return;
      }

      // Step 4: Evaluate all rules against market data
      const triggeredRules = ruleEvaluatorService.batchEvaluateRules(
        activeRules,
        marketDataMap,
      );

      if (triggeredRules.length === 0) {
        logger.info('No rules triggered in this cycle');
        this.lastPollTime = new Date();
        return;
      }

      logger.info('Rules triggered', {
        triggeredCount: triggeredRules.length,
      });

      // Step 5: Execute triggered rules
      const executionResults = [];

      for (const { rule, marketData, reason } of triggeredRules) {
        try {
          logger.info('Executing triggered rule', {
            ruleId: rule.id,
            ruleName: rule.name,
            reason,
          });

          const result = await executionCoordinatorService.executeRule(
            rule,
            marketData,
          );

          executionResults.push({
            ruleId: rule.id,
            success: result.success,
            executionId: result.executionId,
            message: result.message,
          });

          logger.info('Rule execution completed', {
            ruleId: rule.id,
            success: result.success,
            executionId: result.executionId,
          });
        } catch (error) {
          logger.error('Error executing rule', {
            ruleId: rule.id,
            error: error instanceof Error ? error.message : String(error),
          });

          executionResults.push({
            ruleId: rule.id,
            success: false,
            executionId: 0,
            message: error instanceof Error ? error.message : String(error),
          });
        }
      }

      // Log summary
      const successCount = executionResults.filter((r) => r.success).length;
      const failCount = executionResults.length - successCount;

      logger.info('Poll cycle completed', {
        pollCount: this.pollCount,
        duration: Date.now() - startTime,
        rulesEvaluated: activeRules.length,
        rulesTriggered: triggeredRules.length,
        executionsSucceeded: successCount,
        executionsFailed: failCount,
      });

      this.lastPollTime = new Date();
    } catch (error) {
      this.errorCount++;

      logger.error('Error in market poll cycle', {
        pollCount: this.pollCount,
        errorCount: this.errorCount,
        error: error instanceof Error ? error.message : String(error),
      });

      this.lastPollTime = new Date();
    }
  }

  /**
   * Get poller status (for health checks)
   */
  getStatus(): {
    isRunning: boolean;
    isPaused: boolean;
    lastPollTime: Date | null;
    pollCount: number;
    errorCount: number;
  } {
    return {
      isRunning: this.isRunning,
      isPaused: this.isPaused,
      lastPollTime: this.lastPollTime,
      pollCount: this.pollCount,
      errorCount: this.errorCount,
    };
  }

  /**
   * Trigger manual poll (for testing/debugging)
   */
  async triggerManualPoll(): Promise<void> {
    if (!this.isRunning) {
      throw new Error('Poller is not running');
    }

    logger.info('Manual poll triggered');
    await this.poll();
  }
}

// Export singleton instance
export const marketPollerService = new MarketPollerService();
