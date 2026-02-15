import express, { Request, Response } from 'express';
import { monitoringService } from '../services/monitoring.service';
import { query } from '../utils/db';
import logger from '../utils/logger';

const router = express.Router();

/**
 * Admin Routes
 * Internal monitoring and observability endpoints
 *
 * NOTE: In production, these should be protected by admin authentication
 * For now, they're open for prototype testing
 */

/**
 * GET /api/admin/health
 * System health check
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    const health = await monitoringService.checkHealth();

    const statusCode = health.healthy ? 200 : 503;
    res.status(statusCode).json({
      success: health.healthy,
      ...health,
    });
  } catch (error: any) {
    logger.error('Health check failed', { error: error.message });
    res.status(503).json({
      success: false,
      healthy: false,
      error: error.message,
      checks: {
        database: false,
        dlqSize: false,
        executionRate: false,
      },
    });
  }
});

/**
 * GET /api/admin/metrics
 * Comprehensive system metrics
 */
router.get('/metrics', async (req: Request, res: Response) => {
  try {
    const metrics = await monitoringService.getSystemMetrics();

    res.json({
      success: true,
      metrics,
    });
  } catch (error: any) {
    logger.error('Error fetching metrics', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/admin/executions
 * Execution history with filtering
 *
 * Query params:
 * - limit: number of results (default 100)
 * - status: filter by status
 * - userId: filter by user ID
 * - ruleId: filter by rule ID
 */
router.get('/executions', async (req: Request, res: Response) => {
  try {
    const {
      limit = '100',
      status,
      userId,
      ruleId,
    } = req.query;

    const options = {
      limit: parseInt(limit as string) || 100,
      status: status as string | undefined,
      userId: userId ? parseInt(userId as string) : undefined,
      ruleId: ruleId ? parseInt(ruleId as string) : undefined,
    };

    const executions = await monitoringService.getExecutionHistory(options);

    res.json({
      success: true,
      executions,
      count: executions.length,
    });
  } catch (error: any) {
    logger.error('Error fetching executions', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/admin/dlq
 * Dead letter queue items
 *
 * Query params:
 * - status: PENDING | RESOLVED | FAILED (default: PENDING)
 * - limit: number of results (default 50)
 */
router.get('/dlq', async (req: Request, res: Response) => {
  try {
    const { status = 'PENDING', limit = '50' } = req.query;

    const result = await query(
      `SELECT
        dlq.id,
        dlq.execution_id,
        dlq.error_message,
        dlq.retry_count,
        dlq.status,
        dlq.created_at,
        dlq.resolved_at,
        e.rule_id,
        r.name as rule_name,
        r.user_id,
        u.email as user_email
       FROM dead_letter_queue dlq
       JOIN executions e ON dlq.execution_id = e.id
       JOIN rules r ON e.rule_id = r.id
       JOIN users u ON r.user_id = u.id
       WHERE dlq.status = $1
       ORDER BY dlq.created_at DESC
       LIMIT $2`,
      [status, parseInt(limit as string)],
    );

    res.json({
      success: true,
      items: result.rows,
      count: result.rows.length,
    });
  } catch (error: any) {
    logger.error('Error fetching DLQ items', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/admin/dlq/:id/retry
 * Manually retry a DLQ item
 */
router.post('/dlq/:id/retry', async (req: Request, res: Response) => {
  try {
    const dlqId = parseInt(String(req.params.id));

    if (isNaN(dlqId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid DLQ ID',
      });
    }

    // Get DLQ item
    const dlqResult = await query(
      `SELECT * FROM dead_letter_queue WHERE id = $1`,
      [dlqId],
    );

    if (dlqResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'DLQ item not found',
      });
    }

    const dlqItem = dlqResult.rows[0];

    if (dlqItem.status !== 'PENDING') {
      return res.status(400).json({
        success: false,
        error: 'Can only retry PENDING items',
      });
    }

    // Get execution details
    const execResult = await query(
      `SELECT e.*, r.* FROM executions e
       JOIN rules r ON e.rule_id = r.id
       WHERE e.id = $1`,
      [dlqItem.execution_id],
    );

    if (execResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Execution not found',
      });
    }

    // Reset execution to TRIGGERED status for retry
    await query(
      `UPDATE executions SET status = 'TRIGGERED' WHERE id = $1`,
      [dlqItem.execution_id],
    );

    // Update DLQ item
    await query(
      `UPDATE dead_letter_queue
       SET status = 'RESOLVED', resolved_at = NOW()
       WHERE id = $1`,
      [dlqId],
    );

    logger.info('DLQ item marked for retry', {
      dlqId,
      executionId: dlqItem.execution_id,
    });

    res.json({
      success: true,
      message: 'DLQ item marked for retry. It will be picked up on the next poll cycle.',
    });
  } catch (error: any) {
    logger.error('Error retrying DLQ item', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/admin/rules
 * All rules with statistics
 */
router.get('/rules', async (req: Request, res: Response) => {
  try {
    const result = await query(
      `SELECT
        r.id,
        r.name,
        r.user_id,
        r.kalshi_market_id,
        r.status,
        r.created_at,
        r.last_triggered_at,
        u.email as user_email,
        COUNT(e.id) as execution_count,
        COUNT(e.id) FILTER (WHERE e.status = 'EXECUTED') as success_count,
        COUNT(e.id) FILTER (WHERE e.status = 'FAILED') as failure_count
       FROM rules r
       JOIN users u ON r.user_id = u.id
       LEFT JOIN executions e ON r.id = e.rule_id
       GROUP BY r.id, u.email
       ORDER BY r.created_at DESC`,
      [],
    );

    res.json({
      success: true,
      rules: result.rows,
      count: result.rows.length,
    });
  } catch (error: any) {
    logger.error('Error fetching rules', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/admin/users
 * All users with statistics
 */
router.get('/users', async (req: Request, res: Response) => {
  try {
    const result = await query(
      `SELECT
        u.id,
        u.email,
        u.wallet_address,
        u.created_at,
        u.last_login_at,
        COUNT(DISTINCT r.id) as rule_count,
        COUNT(DISTINCT r.id) FILTER (WHERE r.status = 'ACTIVE') as active_rule_count,
        COUNT(DISTINCT aw.id) as wallet_count,
        COUNT(DISTINCT e.id) as execution_count
       FROM users u
       LEFT JOIN rules r ON u.id = r.user_id
       LEFT JOIN automation_wallets aw ON u.id = aw.user_id
       LEFT JOIN executions e ON r.id = e.rule_id
       GROUP BY u.id
       ORDER BY u.created_at DESC`,
      [],
    );

    res.json({
      success: true,
      users: result.rows,
      count: result.rows.length,
    });
  } catch (error: any) {
    logger.error('Error fetching users', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/admin/logs
 * Recent system logs (from database audit_log)
 *
 * Query params:
 * - limit: number of results (default 100)
 * - eventType: filter by event type
 */
router.get('/logs', async (req: Request, res: Response) => {
  try {
    const { limit = '100', eventType } = req.query;

    let sql = `
      SELECT * FROM audit_log
      WHERE 1=1
    `;
    const params: any[] = [];

    if (eventType) {
      params.push(eventType);
      sql += ` AND event_type = $${params.length}`;
    }

    params.push(parseInt(limit as string));
    sql += ` ORDER BY created_at DESC LIMIT $${params.length}`;

    const result = await query(sql, params);

    res.json({
      success: true,
      logs: result.rows,
      count: result.rows.length,
    });
  } catch (error: any) {
    logger.error('Error fetching logs', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;
