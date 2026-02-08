import { query } from '../../src/utils/db';
import { userService } from '../../src/services/user.service';
import { walletService } from '../../src/services/wallet.service';
import { ruleService } from '../../src/services/rule.service';
import { CreateRuleRequest } from '../../src/types/rules';

/**
 * Test Utilities
 * Helper functions for integration tests
 */

/**
 * Clean up test database
 * Deletes all test data in reverse dependency order
 */
export async function cleanupTestDatabase(): Promise<void> {
  await query('DELETE FROM dead_letter_queue', []);
  await query('DELETE FROM secrets_audit', []);
  await query('DELETE FROM execution_locks', []);
  await query('DELETE FROM withdrawals', []);
  await query('DELETE FROM executions', []);
  await query('DELETE FROM rules', []);
  await query('DELETE FROM automation_wallets', []);
  await query('DELETE FROM users WHERE email LIKE %test%', []);
  await query('DELETE FROM audit_log WHERE event_type = %TEST%', []);
}

/**
 * Create test user
 */
export async function createTestUser(
  email?: string,
  walletAddress?: string,
): Promise<{ user: any; apiKey: string }> {
  const testEmail = email || `test-${Date.now()}@example.com`;
  const testWallet =
    walletAddress || `Test${Math.random().toString(36).substring(2, 15)}Wallet`;

  return await userService.createUser(testEmail, testWallet);
}

/**
 * Create test automation wallet
 */
export async function createTestWallet(
  userId: number,
  name?: string,
): Promise<any> {
  const walletName = name || `Test Wallet ${Date.now()}`;
  return await walletService.createWallet(userId, walletName);
}

/**
 * Create test rule
 */
export async function createTestRule(
  userId: number,
  walletId: number,
  overrides?: Partial<CreateRuleRequest>,
): Promise<any> {
  const ruleData: CreateRuleRequest = {
    name: overrides?.name || `Test Rule ${Date.now()}`,
    kalshi_market_id: overrides?.kalshi_market_id || 'USRECESSION-2026',
    condition_type: overrides?.condition_type || 'THRESHOLD_ABOVE',
    threshold_probability: overrides?.threshold_probability || 0.65,
    trigger_type: overrides?.trigger_type || 'SWAP_TO_STABLECOIN',
    automation_wallet_id: walletId,
    swap_percentage: overrides?.swap_percentage || 80,
    cooldown_hours: overrides?.cooldown_hours || 24,
  };

  return await ruleService.createRule(userId, ruleData);
}

/**
 * Wait for condition with timeout
 */
export async function waitFor(
  condition: () => Promise<boolean>,
  timeoutMs: number = 5000,
  intervalMs: number = 100,
): Promise<boolean> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    if (await condition()) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  return false;
}

/**
 * Generate random Solana address (for testing)
 */
export function generateRandomSolanaAddress(): string {
  const chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let address = '';
  for (let i = 0; i < 44; i++) {
    address += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return address;
}

/**
 * Mock Kalshi probability data
 */
export function mockKalshiData(probability: number) {
  return {
    marketId: 'USRECESSION-2026',
    probability,
    timestamp: new Date(),
    lastPrice: Math.round(probability * 100),
    volume: 10000,
    openInterest: 5000,
  };
}
