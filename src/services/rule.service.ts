import { query, withTransaction, transactionQuery } from '../utils/db';
import logger from '../utils/logger';
import {
  CreateRuleRequest,
  UpdateRuleRequest,
  RuleResponse,
  RuleStatus,
} from '../types/rules';
import { PoolClient } from 'pg';

/**
 * Rule Service
 * Business logic for rule management
 */
export class RuleService {
  /**
   * Create a new rule
   * CRITICAL: Validates wallet ownership before creating
   */
  async createRule(
    userId: number,
    data: CreateRuleRequest,
  ): Promise<RuleResponse> {
    return await withTransaction(async (client) => {
      // Verify wallet belongs to user
      const walletCheck = await transactionQuery(
        client,
        'SELECT user_id FROM automation_wallets WHERE id = $1',
        [data.automation_wallet_id],
      );

      if (walletCheck.rows.length === 0) {
        throw new Error('Automation wallet not found');
      }

      if (walletCheck.rows[0].user_id !== userId) {
        throw new Error(
          'Unauthorized: Automation wallet does not belong to user',
        );
      }

      // Set defaults
      const swapPercentage = data.swap_percentage || 100;
      const cooldownHours = data.cooldown_hours || 24;

      // Insert rule
      const result = await transactionQuery(
        client,
        `INSERT INTO rules
         (user_id, name, kalshi_market_id, condition_type, threshold_probability,
          trigger_type, automation_wallet_id, swap_percentage, cooldown_hours,
          status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'CREATED', NOW(), NOW())
         RETURNING *`,
        [
          userId,
          data.name,
          data.kalshi_market_id,
          data.condition_type,
          data.threshold_probability,
          data.trigger_type,
          data.automation_wallet_id,
          swapPercentage,
          cooldownHours,
        ],
      );

      const rule = result.rows[0];

      logger.info('Rule created', {
        ruleId: rule.id,
        userId,
        name: data.name,
        kalshiMarketId: data.kalshi_market_id,
      });

      // Audit log
      await transactionQuery(
        client,
        `INSERT INTO audit_log (event_type, resource_type, resource_id, action, details)
         VALUES ('RULE', 'rule', $1, 'created', $2)`,
        [
          rule.id,
          JSON.stringify({
            userId,
            name: data.name,
            kalshiMarketId: data.kalshi_market_id,
            conditionType: data.condition_type,
            threshold: data.threshold_probability,
          }),
        ],
      );

      return this.formatRuleResponse(rule);
    });
  }

  /**
   * Get rule by ID
   */
  async getRule(ruleId: number, userId: number): Promise<RuleResponse | null> {
    const result = await query(
      'SELECT * FROM rules WHERE id = $1 AND user_id = $2',
      [ruleId, userId],
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.formatRuleResponse(result.rows[0]);
  }

  /**
   * List rules for a user
   */
  async listRules(
    userId: number,
    params?: {
      status?: RuleStatus;
      limit?: number;
      offset?: number;
    },
  ): Promise<{ rules: RuleResponse[]; total: number }> {
    const limit = params?.limit || 100;
    const offset = params?.offset || 0;

    let sql = 'SELECT * FROM rules WHERE user_id = $1';
    const queryParams: any[] = [userId];

    if (params?.status) {
      sql += ' AND status = $2';
      queryParams.push(params.status);
    }

    sql += ' ORDER BY created_at DESC LIMIT $' + (queryParams.length + 1);
    queryParams.push(limit);

    sql += ' OFFSET $' + (queryParams.length + 1);
    queryParams.push(offset);

    const result = await query(sql, queryParams);

    // Get total count
    let countSql = 'SELECT COUNT(*) FROM rules WHERE user_id = $1';
    const countParams: any[] = [userId];

    if (params?.status) {
      countSql += ' AND status = $2';
      countParams.push(params.status);
    }

    const countResult = await query(countSql, countParams);
    const total = parseInt(countResult.rows[0].count);

    const rules = result.rows.map((row) => this.formatRuleResponse(row));

    return { rules, total };
  }

  /**
   * Update rule
   * CRITICAL: Enforces valid status transitions
   */
  async updateRule(
    ruleId: number,
    userId: number,
    data: UpdateRuleRequest,
  ): Promise<RuleResponse> {
    return await withTransaction(async (client) => {
      // Get current rule
      const currentResult = await transactionQuery(
        client,
        'SELECT * FROM rules WHERE id = $1 AND user_id = $2',
        [ruleId, userId],
      );

      if (currentResult.rows.length === 0) {
        throw new Error('Rule not found');
      }

      const currentRule = currentResult.rows[0];

      // Validate status transition if status is being updated
      if (data.status) {
        this.validateStatusTransition(currentRule.status, data.status);
      }

      // Build update query
      const updates: string[] = [];
      const values: any[] = [];
      let paramCount = 1;

      if (data.name !== undefined) {
        updates.push(`name = $${paramCount++}`);
        values.push(data.name);
      }

      if (data.threshold_probability !== undefined) {
        updates.push(`threshold_probability = $${paramCount++}`);
        values.push(data.threshold_probability);
      }

      if (data.swap_percentage !== undefined) {
        updates.push(`swap_percentage = $${paramCount++}`);
        values.push(data.swap_percentage);
      }

      if (data.cooldown_hours !== undefined) {
        updates.push(`cooldown_hours = $${paramCount++}`);
        values.push(data.cooldown_hours);
      }

      if (data.status !== undefined) {
        updates.push(`status = $${paramCount++}`);
        values.push(data.status);
      }

      if (updates.length === 0) {
        return this.formatRuleResponse(currentRule);
      }

      updates.push(`updated_at = NOW()`);
      values.push(ruleId, userId);

      const sql = `
        UPDATE rules
        SET ${updates.join(', ')}
        WHERE id = $${paramCount++} AND user_id = $${paramCount++}
        RETURNING *
      `;

      const result = await transactionQuery(client, sql, values);

      const updatedRule = result.rows[0];

      logger.info('Rule updated', {
        ruleId,
        userId,
        updates: Object.keys(data),
      });

      // Audit log
      await transactionQuery(
        client,
        `INSERT INTO audit_log (event_type, resource_type, resource_id, action, details)
         VALUES ('RULE', 'rule', $1, 'updated', $2)`,
        [ruleId, JSON.stringify({ updates: data })],
      );

      return this.formatRuleResponse(updatedRule);
    });
  }

  /**
   * Delete rule (soft delete by setting status to CANCELLED)
   */
  async deleteRule(ruleId: number, userId: number): Promise<void> {
    const result = await query(
      `UPDATE rules
       SET status = 'CANCELLED', updated_at = NOW()
       WHERE id = $1 AND user_id = $2
       RETURNING id`,
      [ruleId, userId],
    );

    if (result.rows.length === 0) {
      throw new Error('Rule not found');
    }

    logger.info('Rule deleted (cancelled)', { ruleId, userId });

    await query(
      `INSERT INTO audit_log (event_type, resource_type, resource_id, action, details)
       VALUES ('RULE', 'rule', $1, 'deleted', NULL)`,
      [ruleId],
    );
  }

  /**
   * Validate status transition
   * CRITICAL: Prevents invalid state changes
   */
  private validateStatusTransition(
    currentStatus: RuleStatus,
    newStatus: string,
  ): void {
    const validTransitions: Record<RuleStatus, RuleStatus[]> = {
      CREATED: ['ACTIVE', 'CANCELLED'],
      ACTIVE: ['PAUSED', 'TRIGGERED', 'CANCELLED'],
      TRIGGERED: ['EXECUTING', 'FAILED', 'CANCELLED'],
      EXECUTING: ['EXECUTED', 'FAILED'],
      EXECUTED: ['ACTIVE'], // Can be reactivated
      FAILED: ['ACTIVE', 'CANCELLED'], // Can retry or cancel
      PAUSED: ['ACTIVE', 'CANCELLED'],
      CANCELLED: [], // Terminal state
    };

    const allowed = validTransitions[currentStatus] || [];

    if (!allowed.includes(newStatus as RuleStatus)) {
      throw new Error(
        `Invalid status transition: cannot change from ${currentStatus} to ${newStatus}`,
      );
    }
  }

  /**
   * Format rule for API response
   */
  private formatRuleResponse(rule: any): RuleResponse {
    return {
      id: rule.id,
      user_id: rule.user_id,
      name: rule.name,
      kalshi_market_id: rule.kalshi_market_id,
      condition_type: rule.condition_type,
      threshold_probability: parseFloat(rule.threshold_probability),
      trigger_type: rule.trigger_type,
      automation_wallet_id: rule.automation_wallet_id,
      swap_percentage: parseInt(rule.swap_percentage),
      cooldown_hours: parseInt(rule.cooldown_hours),
      status: rule.status,
      last_triggered_at: rule.last_triggered_at
        ? rule.last_triggered_at.toISOString()
        : null,
      created_at: rule.created_at.toISOString(),
      updated_at: rule.updated_at.toISOString(),
    };
  }

  /**
   * Get active rules that need evaluation
   * Used by execution engine
   */
  async getActiveRulesForEvaluation(): Promise<RuleResponse[]> {
    const result = await query(
      `SELECT * FROM rules
       WHERE status = 'ACTIVE'
       AND (
         last_triggered_at IS NULL
         OR last_triggered_at < NOW() - (cooldown_hours || ' hours')::INTERVAL
       )
       ORDER BY created_at ASC`,
      [],
    );

    return result.rows.map((row) => this.formatRuleResponse(row));
  }
}

// Export singleton instance
export const ruleService = new RuleService();
