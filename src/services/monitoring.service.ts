import { query } from '../utils/db';
import logger from '../utils/logger';

/**
 * Monitoring Service
 * Tracks system metrics and execution statistics
 */

interface ExecutionStats {
  total: number;
  succeeded: number;
  failed: number;
  pending: number;
  successRate: number;
}

interface SystemMetrics {
  executions: ExecutionStats;
  rules: {
    total: number;
    active: number;
    paused: number;
    failed: number;
  };
  users: {
    total: number;
    withActiveRules: number;
  };
  dlq: {
    pending: number;
    resolved: number;
  };
  uptime: number;
  timestamp: Date;
}

export class MonitoringService {
  private startTime: Date;

  constructor() {
    this.startTime = new Date();
  }

  /**
   * Get comprehensive system metrics
   */
  async getSystemMetrics(): Promise<SystemMetrics> {
    const [executions, rules, users, dlq] = await Promise.all([
      this.getExecutionStats(),
      this.getRuleStats(),
      this.getUserStats(),
      this.getDLQStats(),
    ]);

    return {
      executions,
      rules,
      users,
      dlq,
      uptime: Date.now() - this.startTime.getTime(),
      timestamp: new Date(),
    };
  }

  /**
   * Get execution statistics
   */
  private async getExecutionStats(): Promise<ExecutionStats> {
    const result = await query(
      `SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'EXECUTED') as succeeded,
        COUNT(*) FILTER (WHERE status = 'FAILED') as failed,
        COUNT(*) FILTER (WHERE status IN ('TRIGGERED', 'EXECUTING')) as pending
       FROM executions
       WHERE created_at > NOW() - INTERVAL '24 hours'`,
      [],
    );

    const stats = result.rows[0];
    const total = parseInt(stats.total) || 0;
    const succeeded = parseInt(stats.succeeded) || 0;

    return {
      total,
      succeeded,
      failed: parseInt(stats.failed) || 0,
      pending: parseInt(stats.pending) || 0,
      successRate: total > 0 ? (succeeded / total) * 100 : 0,
    };
  }

  /**
   * Get rule statistics
   */
  private async getRuleStats() {
    const result = await query(
      `SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'ACTIVE') as active,
        COUNT(*) FILTER (WHERE status = 'PAUSED') as paused,
        COUNT(*) FILTER (WHERE status = 'FAILED') as failed
       FROM rules`,
      [],
    );

    const stats = result.rows[0];
    return {
      total: parseInt(stats.total) || 0,
      active: parseInt(stats.active) || 0,
      paused: parseInt(stats.paused) || 0,
      failed: parseInt(stats.failed) || 0,
    };
  }

  /**
   * Get user statistics
   */
  private async getUserStats() {
    const result = await query(
      `SELECT
        COUNT(*) as total,
        COUNT(DISTINCT r.user_id) as with_active_rules
       FROM users u
       LEFT JOIN rules r ON u.id = r.user_id AND r.status = 'ACTIVE'`,
      [],
    );

    const stats = result.rows[0];
    return {
      total: parseInt(stats.total) || 0,
      withActiveRules: parseInt(stats.with_active_rules) || 0,
    };
  }

  /**
   * Get DLQ statistics
   */
  private async getDLQStats() {
    const result = await query(
      `SELECT
        COUNT(*) FILTER (WHERE status = 'PENDING') as pending,
        COUNT(*) FILTER (WHERE status = 'RESOLVED') as resolved
       FROM dead_letter_queue`,
      [],
    );

    const stats = result.rows[0];
    return {
      pending: parseInt(stats.pending) || 0,
      resolved: parseInt(stats.resolved) || 0,
    };
  }

  /**
   * Log execution event for monitoring
   */
  async logExecution(data: {
    ruleId: number;
    executionId: number;
    status: 'started' | 'succeeded' | 'failed';
    duration?: number;
    error?: string;
  }) {
    logger.info('Execution event', {
      ...data,
      timestamp: new Date().toISOString(),
    });

    // Could send to external monitoring service here
    // e.g., Datadog, New Relic, etc.
  }

  /**
   * Check system health
   */
  async checkHealth(): Promise<{
    healthy: boolean;
    checks: {
      database: boolean;
      dlqSize: boolean;
      executionRate: boolean;
    };
  }> {
    const checks = {
      database: false,
      dlqSize: false,
      executionRate: false,
    };

    // Check database connection
    try {
      await query('SELECT 1', []);
      checks.database = true;
    } catch (error) {
      logger.error('Database health check failed', { error });
    }

    // Check DLQ size (alert if > 10 pending items)
    const dlqStats = await this.getDLQStats();
    checks.dlqSize = dlqStats.pending < 10;

    if (!checks.dlqSize) {
      logger.warn('DLQ size alert', { pending: dlqStats.pending });
    }

    // Check execution success rate (alert if < 80%)
    const execStats = await this.getExecutionStats();
    checks.executionRate = execStats.successRate >= 80 || execStats.total === 0;

    if (!checks.executionRate) {
      logger.warn('Low execution success rate', {
        successRate: execStats.successRate,
      });
    }

    const healthy = Object.values(checks).every((check) => check);

    return { healthy, checks };
  }

  /**
   * Get execution history with filtering
   */
  async getExecutionHistory(options: {
    limit?: number;
    status?: string;
    userId?: number;
    ruleId?: number;
  }) {
    const { limit = 100, status, userId, ruleId } = options;
    const params: any[] = [];
    let sql = `
      SELECT
        e.id,
        e.rule_id,
        e.status,
        e.triggered_at,
        e.tx_signature,
        e.error_message,
        e.created_at,
        r.name as rule_name,
        r.user_id,
        u.email as user_email
      FROM executions e
      JOIN rules r ON e.rule_id = r.id
      JOIN users u ON r.user_id = u.id
      WHERE 1=1
    `;

    if (status) {
      params.push(status);
      sql += ` AND e.status = $${params.length}`;
    }

    if (userId) {
      params.push(userId);
      sql += ` AND r.user_id = $${params.length}`;
    }

    if (ruleId) {
      params.push(ruleId);
      sql += ` AND e.rule_id = $${params.length}`;
    }

    params.push(limit);
    sql += ` ORDER BY e.created_at DESC LIMIT $${params.length}`;

    const result = await query(sql, params);
    return result.rows;
  }
}

// Export singleton instance
export const monitoringService = new MonitoringService();
