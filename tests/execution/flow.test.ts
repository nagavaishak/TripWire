import { ruleEvaluatorService } from '../../src/services/rule-evaluator.service';
import { executionService } from '../../src/services/execution.service';
import { executionLockService } from '../../src/services/execution-lock.service';
import { deadLetterQueueService } from '../../src/services/dead-letter-queue.service';
import { executionCoordinatorService } from '../../src/services/execution-coordinator.service';
import { jupiterSwapService } from '../../src/services/jupiter-swap.service';
import { query } from '../../src/utils/db';
import {
  cleanupTestDatabase,
  createTestUser,
  createTestWallet,
  createTestRule,
  mockKalshiData,
} from '../helpers/test-utils';
import { RuleResponse } from '../../src/types/rules';

// Mock Jupiter swap service to avoid real swaps
jest.mock('../../src/services/jupiter-swap.service');

describe('Execution Flow Tests', () => {
  let testUser: any;
  let testWallet: any;
  let testRule: any;

  beforeAll(async () => {
    const { user } = await createTestUser();
    testUser = user;
    testWallet = await createTestWallet(user.id);
    testRule = await createTestRule(user.id, testWallet.id, {
      threshold_probability: 0.65,
      condition_type: 'THRESHOLD_ABOVE',
    });
  });

  afterAll(async () => {
    await cleanupTestDatabase();
  });

  describe('Rule Evaluator Service', () => {
    test('evaluates THRESHOLD_ABOVE correctly - should trigger', () => {
      const rule: RuleResponse = {
        ...testRule,
        status: 'ACTIVE',
        condition_type: 'THRESHOLD_ABOVE',
        threshold_probability: 0.65,
        last_triggered_at: null,
      };

      const marketData = mockKalshiData(0.75); // Above threshold

      const result = ruleEvaluatorService.evaluateRule(rule, marketData);

      expect(result.shouldTrigger).toBe(true);
      expect(result.reason).toContain('above threshold');
    });

    test('evaluates THRESHOLD_ABOVE correctly - should not trigger', () => {
      const rule: RuleResponse = {
        ...testRule,
        status: 'ACTIVE',
        condition_type: 'THRESHOLD_ABOVE',
        threshold_probability: 0.65,
        last_triggered_at: null,
      };

      const marketData = mockKalshiData(0.55); // Below threshold

      const result = ruleEvaluatorService.evaluateRule(rule, marketData);

      expect(result.shouldTrigger).toBe(false);
      expect(result.reason).toContain('not above threshold');
    });

    test('evaluates THRESHOLD_BELOW correctly - should trigger', () => {
      const rule: RuleResponse = {
        ...testRule,
        status: 'ACTIVE',
        condition_type: 'THRESHOLD_BELOW',
        threshold_probability: 0.35,
        last_triggered_at: null,
      };

      const marketData = mockKalshiData(0.25); // Below threshold

      const result = ruleEvaluatorService.evaluateRule(rule, marketData);

      expect(result.shouldTrigger).toBe(true);
      expect(result.reason).toContain('below threshold');
    });

    test('does not trigger rule in cooldown', () => {
      const lastTriggered = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2 hours ago

      const rule: RuleResponse = {
        ...testRule,
        status: 'ACTIVE',
        condition_type: 'THRESHOLD_ABOVE',
        threshold_probability: 0.65,
        last_triggered_at: lastTriggered,
        cooldown_hours: 24, // 24 hour cooldown
      };

      const marketData = mockKalshiData(0.75); // Above threshold

      const result = ruleEvaluatorService.evaluateRule(rule, marketData);

      expect(result.shouldTrigger).toBe(false);
      expect(result.reason).toContain('cooldown');
    });

    test('triggers rule after cooldown expires', () => {
      const lastTriggered = new Date(Date.now() - 25 * 60 * 60 * 1000); // 25 hours ago

      const rule: RuleResponse = {
        ...testRule,
        status: 'ACTIVE',
        condition_type: 'THRESHOLD_ABOVE',
        threshold_probability: 0.65,
        last_triggered_at: lastTriggered,
        cooldown_hours: 24, // 24 hour cooldown
      };

      const marketData = mockKalshiData(0.75); // Above threshold

      const result = ruleEvaluatorService.evaluateRule(rule, marketData);

      expect(result.shouldTrigger).toBe(true);
      expect(result.reason).toContain('above threshold');
    });

    test('does not trigger inactive rule', () => {
      const rule: RuleResponse = {
        ...testRule,
        status: 'PAUSED',
        condition_type: 'THRESHOLD_ABOVE',
        threshold_probability: 0.65,
        last_triggered_at: null,
      };

      const marketData = mockKalshiData(0.75); // Above threshold

      const result = ruleEvaluatorService.evaluateRule(rule, marketData);

      expect(result.shouldTrigger).toBe(false);
      expect(result.reason).toContain('not ACTIVE');
    });

    test('validates market data freshness', () => {
      const staleData = mockKalshiData(0.75);
      staleData.timestamp = new Date(Date.now() - 60 * 60 * 1000); // 60 minutes old

      const result = ruleEvaluatorService.validateMarketData(staleData, 30 * 60 * 1000);

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('stale');
    });

    test('validates market data probability range', () => {
      const invalidData = mockKalshiData(1.5); // Invalid probability

      const result = ruleEvaluatorService.validateMarketData(invalidData);

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('Invalid probability');
    });

    test('batch evaluates multiple rules', () => {
      const rules: RuleResponse[] = [
        {
          ...testRule,
          id: 1,
          status: 'ACTIVE',
          condition_type: 'THRESHOLD_ABOVE',
          threshold_probability: 0.65,
          kalshi_market_id: 'MARKET-A',
        },
        {
          ...testRule,
          id: 2,
          status: 'ACTIVE',
          condition_type: 'THRESHOLD_BELOW',
          threshold_probability: 0.35,
          kalshi_market_id: 'MARKET-B',
        },
      ];

      const marketDataMap = new Map([
        ['MARKET-A', mockKalshiData(0.75)], // Should trigger rule 1
        ['MARKET-B', mockKalshiData(0.25)], // Should trigger rule 2
      ]);

      const triggeredRules = ruleEvaluatorService.batchEvaluateRules(
        rules,
        marketDataMap,
      );

      expect(triggeredRules.length).toBe(2);
      expect(triggeredRules[0].rule.id).toBe(1);
      expect(triggeredRules[1].rule.id).toBe(2);
    });
  });

  describe('Execution Service - Idempotency', () => {
    test('generates deterministic idempotency key', () => {
      const ruleId = 123;
      const triggeredAt = new Date('2026-02-08T12:00:00.000Z');

      const key1 = executionService.generateIdempotencyKey(ruleId, triggeredAt);
      const key2 = executionService.generateIdempotencyKey(ruleId, triggeredAt);

      expect(key1).toBe(key2);
      expect(key1).toHaveLength(64); // SHA-256 hex
    });

    test('generates different keys for different timestamps', () => {
      const ruleId = 123;
      const triggeredAt1 = new Date('2026-02-08T12:00:00.000Z');
      const triggeredAt2 = new Date('2026-02-08T12:00:01.000Z');

      const key1 = executionService.generateIdempotencyKey(ruleId, triggeredAt1);
      const key2 = executionService.generateIdempotencyKey(ruleId, triggeredAt2);

      expect(key1).not.toBe(key2);
    });

    test('creates new execution on first attempt', async () => {
      const rule = await createTestRule(testUser.id, testWallet.id);
      const triggeredAt = new Date();
      const marketData = mockKalshiData(0.75);

      const result = await executionService.createExecution(
        rule.id,
        triggeredAt,
        marketData,
      );

      expect(result.isNew).toBe(true);
      expect(result.id).toBeGreaterThan(0);
      expect(result.existingSignature).toBeUndefined();
    });

    test('detects duplicate execution on retry', async () => {
      const rule = await createTestRule(testUser.id, testWallet.id);
      const triggeredAt = new Date();
      const marketData = mockKalshiData(0.75);

      // First execution
      const result1 = await executionService.createExecution(
        rule.id,
        triggeredAt,
        marketData,
      );

      // Retry with same parameters
      const result2 = await executionService.createExecution(
        rule.id,
        triggeredAt,
        marketData,
      );

      expect(result2.isNew).toBe(false);
      expect(result2.id).toBe(result1.id);
    });
  });

  describe('Execution Lock Service', () => {
    test('acquires lock successfully', async () => {
      const rule = await createTestRule(testUser.id, testWallet.id);

      const result = await executionLockService.acquireLock(rule.id);

      expect(result.acquired).toBe(true);
      expect(result.lockedBy).toBeUndefined();

      // Clean up
      await executionLockService.releaseLock(rule.id);
    });

    test('prevents concurrent execution', async () => {
      const rule = await createTestRule(testUser.id, testWallet.id);

      // First lock acquisition
      const result1 = await executionLockService.acquireLock(rule.id);
      expect(result1.acquired).toBe(true);

      // Second lock acquisition should fail
      const result2 = await executionLockService.acquireLock(rule.id);
      expect(result2.acquired).toBe(false);
      expect(result2.lockedBy).toBeDefined();

      // Clean up
      await executionLockService.releaseLock(rule.id);
    });

    test('allows lock acquisition after release', async () => {
      const rule = await createTestRule(testUser.id, testWallet.id);

      // Acquire and release
      const result1 = await executionLockService.acquireLock(rule.id);
      expect(result1.acquired).toBe(true);

      await executionLockService.releaseLock(rule.id);

      // Should be able to acquire again
      const result2 = await executionLockService.acquireLock(rule.id);
      expect(result2.acquired).toBe(true);

      // Clean up
      await executionLockService.releaseLock(rule.id);
    });
  });

  describe('Dead Letter Queue Service', () => {
    test('increments retry count on failure', async () => {
      const rule = await createTestRule(testUser.id, testWallet.id);
      const execution = await executionService.createExecution(
        rule.id,
        new Date(),
        mockKalshiData(0.75),
      );

      const retryCount = await deadLetterQueueService.incrementRetryCount(
        execution.id,
      );

      expect(retryCount).toBe(1);
    });

    test('does not move to DLQ before max retries', async () => {
      const rule = await createTestRule(testUser.id, testWallet.id);
      const execution = await executionService.createExecution(
        rule.id,
        new Date(),
        mockKalshiData(0.75),
      );

      // First failure
      const result = await deadLetterQueueService.handleExecutionFailure(
        execution.id,
        'Test error',
      );

      expect(result.movedToDLQ).toBe(false);
      expect(result.retryCount).toBe(1);
    });

    test('moves to DLQ after max retries', async () => {
      const rule = await createTestRule(testUser.id, testWallet.id);
      const execution = await executionService.createExecution(
        rule.id,
        new Date(),
        mockKalshiData(0.75),
      );

      // Fail 3 times (max retries)
      await deadLetterQueueService.handleExecutionFailure(execution.id, 'Error 1');
      await deadLetterQueueService.handleExecutionFailure(execution.id, 'Error 2');
      const result = await deadLetterQueueService.handleExecutionFailure(
        execution.id,
        'Error 3',
      );

      expect(result.movedToDLQ).toBe(true);
      expect(result.retryCount).toBe(3);
      expect(result.dlqId).toBeGreaterThan(0);
    });

    test('retrieves DLQ item by execution ID', async () => {
      const rule = await createTestRule(testUser.id, testWallet.id);
      const execution = await executionService.createExecution(
        rule.id,
        new Date(),
        mockKalshiData(0.75),
      );

      // Move to DLQ
      const dlqId = await deadLetterQueueService.moveToDeadLetterQueue(
        execution.id,
        'Test failure',
        3,
      );

      const dlqItem = await deadLetterQueueService.getDLQItemByExecutionId(
        execution.id,
      );

      expect(dlqItem).not.toBeNull();
      expect(dlqItem!.id).toBe(dlqId);
      expect(dlqItem!.execution_id).toBe(execution.id);
      expect(dlqItem!.status).toBe('PENDING');
    });

    test('gets DLQ statistics', async () => {
      const stats = await deadLetterQueueService.getDLQStatistics();

      expect(stats).toHaveProperty('pending');
      expect(stats).toHaveProperty('retrying');
      expect(stats).toHaveProperty('resolved');
      expect(stats).toHaveProperty('abandoned');
      expect(stats).toHaveProperty('total');
      expect(typeof stats.pending).toBe('number');
    });
  });

  describe('Execution Coordinator - End-to-End', () => {
    beforeEach(() => {
      // Mock Jupiter swap service to return successful swap
      jest.spyOn(jupiterSwapService, 'executeSwap').mockResolvedValue({
        success: true,
        signature: 'mock-signature-' + Math.random().toString(36).substring(7),
        inputAmount: 1000000,
        outputAmount: 50000000,
      });
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    test('executes rule successfully with all safety features', async () => {
      // Create active rule
      const rule = await createTestRule(testUser.id, testWallet.id);
      await query('UPDATE rules SET status = $1 WHERE id = $2', ['ACTIVE', rule.id]);

      // Fetch updated rule
      const ruleResult = await query('SELECT * FROM rules WHERE id = $1', [
        rule.id,
      ]);
      const activeRule = ruleResult.rows[0];

      const marketData = mockKalshiData(0.75); // Above threshold

      const result = await executionCoordinatorService.executeRule(
        activeRule,
        marketData,
      );

      expect(result.success).toBe(true);
      expect(result.executionId).toBeGreaterThan(0);
      expect(result.message).toContain('completed');

      // Verify execution was created
      const execution = await executionService.getExecution(result.executionId);
      expect(execution).not.toBeNull();
      expect(execution.status).toBe('EXECUTED');
      expect(execution.tx_signature).toBeDefined();

      // Verify rule returned to ACTIVE
      const updatedRuleResult = await query('SELECT * FROM rules WHERE id = $1', [
        rule.id,
      ]);
      expect(updatedRuleResult.rows[0].status).toBe('ACTIVE');
    });

    test('respects kill switch when execution disabled', async () => {
      const rule = await createTestRule(testUser.id, testWallet.id);
      await query('UPDATE rules SET status = $1 WHERE id = $2', ['ACTIVE', rule.id]);

      const ruleResult = await query('SELECT * FROM rules WHERE id = $1', [
        rule.id,
      ]);
      const activeRule = ruleResult.rows[0];

      // Temporarily disable execution
      const originalValue = process.env.EXECUTION_ENABLED;
      process.env.EXECUTION_ENABLED = 'false';

      const marketData = mockKalshiData(0.75);
      const result = await executionCoordinatorService.executeRule(
        activeRule,
        marketData,
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain('kill switch');

      // Restore
      process.env.EXECUTION_ENABLED = originalValue;
    });

    test('handles concurrent execution attempts', async () => {
      const rule = await createTestRule(testUser.id, testWallet.id);
      await query('UPDATE rules SET status = $1 WHERE id = $2', ['ACTIVE', rule.id]);

      const ruleResult = await query('SELECT * FROM rules WHERE id = $1', [
        rule.id,
      ]);
      const activeRule = ruleResult.rows[0];

      const marketData = mockKalshiData(0.75);

      // Execute in parallel (simulating concurrent requests)
      const results = await Promise.all([
        executionCoordinatorService.executeRule(activeRule, marketData),
        executionCoordinatorService.executeRule(activeRule, marketData),
      ]);

      // One should succeed, one should fail due to lock
      const successCount = results.filter((r) => r.success).length;
      const lockFailureCount = results.filter(
        (r) => !r.success && r.message.includes('already'),
      ).length;

      expect(successCount).toBeGreaterThanOrEqual(1);
      expect(lockFailureCount).toBeGreaterThanOrEqual(0);
    });

    test('handles swap failure and moves to DLQ after retries', async () => {
      // Mock Jupiter to fail
      jest.spyOn(jupiterSwapService, 'executeSwap').mockResolvedValue({
        success: false,
        signature: null,
        inputAmount: 1000000,
        outputAmount: null,
        error: 'Swap failed: Insufficient liquidity',
      });

      const rule = await createTestRule(testUser.id, testWallet.id);
      await query('UPDATE rules SET status = $1 WHERE id = $2', ['ACTIVE', rule.id]);

      const ruleResult = await query('SELECT * FROM rules WHERE id = $1', [
        rule.id,
      ]);
      const activeRule = ruleResult.rows[0];

      const marketData = mockKalshiData(0.75);

      // Execute and fail 3 times
      for (let i = 0; i < 3; i++) {
        await executionCoordinatorService.executeRule(activeRule, marketData);
      }

      // Check if execution moved to DLQ
      const executions = await executionService.getExecutionsForRule(rule.id);
      const latestExecution = executions[0];

      const dlqItem = await deadLetterQueueService.getDLQItemByExecutionId(
        latestExecution.id,
      );

      expect(dlqItem).not.toBeNull();
      expect(dlqItem!.status).toBe('PENDING');
      expect(dlqItem!.retry_count).toBe(3);
    });

    test('prevents duplicate execution with idempotency', async () => {
      const rule = await createTestRule(testUser.id, testWallet.id);
      await query('UPDATE rules SET status = $1 WHERE id = $2', ['ACTIVE', rule.id]);

      const ruleResult = await query('SELECT * FROM rules WHERE id = $1', [
        rule.id,
      ]);
      const activeRule = ruleResult.rows[0];

      const triggeredAt = new Date();
      const marketData = mockKalshiData(0.75);

      // Create execution manually with same idempotency key
      await executionService.createExecution(rule.id, triggeredAt, marketData);

      // Try to execute with same triggered_at
      const result = await executionCoordinatorService.executeRule(
        activeRule,
        marketData,
      );

      expect(result.success).toBe(true);
      expect(result.message).toContain('already in progress');
    });

    test('updates rule status through execution lifecycle', async () => {
      const rule = await createTestRule(testUser.id, testWallet.id);
      await query('UPDATE rules SET status = $1 WHERE id = $2', ['ACTIVE', rule.id]);

      const ruleResult = await query('SELECT * FROM rules WHERE id = $1', [
        rule.id,
      ]);
      const activeRule = ruleResult.rows[0];

      const marketData = mockKalshiData(0.75);

      const result = await executionCoordinatorService.executeRule(
        activeRule,
        marketData,
      );

      expect(result.success).toBe(true);

      // Verify state transitions occurred
      const execution = await executionService.getExecution(result.executionId);
      expect(execution.status).toBe('EXECUTED');

      // Verify last_triggered_at was set
      const updatedRuleResult = await query('SELECT * FROM rules WHERE id = $1', [
        rule.id,
      ]);
      expect(updatedRuleResult.rows[0].last_triggered_at).not.toBeNull();
    });
  });
});
