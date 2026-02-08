import logger from '../utils/logger';
import { RuleResponse } from '../types/rules';
import { KalshiProbabilityData } from '../types/kalshi';

/**
 * Rule Evaluator Service
 * Determines if a rule should trigger based on market conditions
 */
export class RuleEvaluatorService {
  /**
   * Evaluate if a rule should trigger
   * CRITICAL: Core business logic for conditional execution
   *
   * @param rule - Rule to evaluate
   * @param marketData - Current market probability data
   * @returns Object with shouldTrigger flag and reason
   */
  evaluateRule(
    rule: RuleResponse,
    marketData: KalshiProbabilityData,
  ): { shouldTrigger: boolean; reason: string } {
    // Check rule status
    if (rule.status !== 'ACTIVE') {
      return {
        shouldTrigger: false,
        reason: `Rule is not ACTIVE (status: ${rule.status})`,
      };
    }

    // Check cooldown period
    if (rule.last_triggered_at) {
      const lastTriggered = new Date(rule.last_triggered_at);
      const cooldownEnd = new Date(
        lastTriggered.getTime() + rule.cooldown_hours * 60 * 60 * 1000,
      );
      const now = new Date();

      if (now < cooldownEnd) {
        const remainingMinutes = Math.ceil(
          (cooldownEnd.getTime() - now.getTime()) / 60000,
        );
        return {
          shouldTrigger: false,
          reason: `Rule is in cooldown period (${remainingMinutes} minutes remaining)`,
        };
      }
    }

    // Evaluate condition
    const currentProbability = marketData.probability;
    const threshold = rule.threshold_probability;

    let conditionMet = false;
    let conditionReason = '';

    switch (rule.condition_type) {
      case 'THRESHOLD_ABOVE':
        conditionMet = currentProbability > threshold;
        conditionReason = conditionMet
          ? `Probability ${currentProbability.toFixed(3)} is above threshold ${threshold.toFixed(3)}`
          : `Probability ${currentProbability.toFixed(3)} is not above threshold ${threshold.toFixed(3)}`;
        break;

      case 'THRESHOLD_BELOW':
        conditionMet = currentProbability < threshold;
        conditionReason = conditionMet
          ? `Probability ${currentProbability.toFixed(3)} is below threshold ${threshold.toFixed(3)}`
          : `Probability ${currentProbability.toFixed(3)} is not below threshold ${threshold.toFixed(3)}`;
        break;

      default:
        return {
          shouldTrigger: false,
          reason: `Unknown condition type: ${rule.condition_type}`,
        };
    }

    if (conditionMet) {
      logger.info('Rule condition met', {
        ruleId: rule.id,
        ruleName: rule.name,
        conditionType: rule.condition_type,
        threshold: threshold,
        currentProbability: currentProbability,
        marketId: marketData.marketId,
      });
    } else {
      logger.debug('Rule condition not met', {
        ruleId: rule.id,
        ruleName: rule.name,
        conditionType: rule.condition_type,
        threshold: threshold,
        currentProbability: currentProbability,
      });
    }

    return {
      shouldTrigger: conditionMet,
      reason: conditionReason,
    };
  }

  /**
   * Validate market data is fresh and valid
   * CRITICAL: Ensures we don't act on stale data
   *
   * @param marketData - Market probability data
   * @param maxAgeMs - Maximum age in milliseconds (default: 30 minutes)
   * @returns Object with isValid flag and reason
   */
  validateMarketData(
    marketData: KalshiProbabilityData,
    maxAgeMs: number = 30 * 60 * 1000,
  ): { isValid: boolean; reason: string } {
    const now = new Date();
    const dataAge = now.getTime() - new Date(marketData.timestamp).getTime();

    if (dataAge > maxAgeMs) {
      return {
        isValid: false,
        reason: `Market data is stale (age: ${Math.round(dataAge / 60000)} minutes)`,
      };
    }

    if (
      marketData.probability < 0 ||
      marketData.probability > 1 ||
      isNaN(marketData.probability)
    ) {
      return {
        isValid: false,
        reason: `Invalid probability value: ${marketData.probability}`,
      };
    }

    return {
      isValid: true,
      reason: 'Market data is valid',
    };
  }

  /**
   * Batch evaluate multiple rules against market data
   * Efficient for processing many rules at once
   *
   * @param rules - Array of rules to evaluate
   * @param marketDataMap - Map of marketId -> probability data
   * @returns Array of rules that should trigger with their market data
   */
  batchEvaluateRules(
    rules: RuleResponse[],
    marketDataMap: Map<string, KalshiProbabilityData>,
  ): Array<{
    rule: RuleResponse;
    marketData: KalshiProbabilityData;
    reason: string;
  }> {
    const triggeredRules: Array<{
      rule: RuleResponse;
      marketData: KalshiProbabilityData;
      reason: string;
    }> = [];

    for (const rule of rules) {
      const marketData = marketDataMap.get(rule.kalshi_market_id);

      if (!marketData) {
        logger.warn('No market data found for rule', {
          ruleId: rule.id,
          marketId: rule.kalshi_market_id,
        });
        continue;
      }

      // Validate market data freshness
      const validation = this.validateMarketData(marketData);
      if (!validation.isValid) {
        logger.warn('Skipping rule due to invalid market data', {
          ruleId: rule.id,
          marketId: rule.kalshi_market_id,
          reason: validation.reason,
        });
        continue;
      }

      // Evaluate rule
      const evaluation = this.evaluateRule(rule, marketData);
      if (evaluation.shouldTrigger) {
        triggeredRules.push({
          rule,
          marketData,
          reason: evaluation.reason,
        });
      }
    }

    logger.info('Batch rule evaluation completed', {
      totalRules: rules.length,
      triggeredRules: triggeredRules.length,
    });

    return triggeredRules;
  }
}

// Export singleton instance
export const ruleEvaluatorService = new RuleEvaluatorService();
