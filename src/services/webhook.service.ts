import axios from 'axios';
import { query } from '../utils/db';
import logger from '../utils/logger';

/**
 * Webhook Service
 * Handles user notifications via HTTP webhooks, email, Slack, Discord
 */

export type WebhookType = 'HTTP' | 'EMAIL' | 'SLACK' | 'DISCORD';
export type WebhookEvent =
  | 'RULE_TRIGGERED'
  | 'EXECUTION_STARTED'
  | 'EXECUTION_SUCCEEDED'
  | 'EXECUTION_FAILED'
  | 'RULE_PAUSED'
  | 'WALLET_LOW_BALANCE';

interface WebhookConfig {
  id?: number;
  userId: number;
  type: WebhookType;
  url?: string;
  email?: string;
  events: WebhookEvent[];
  enabled: boolean;
  metadata?: any;
}

interface NotificationPayload {
  event: WebhookEvent;
  userId: number;
  timestamp: Date;
  data: {
    ruleId?: number;
    ruleName?: string;
    executionId?: number;
    marketId?: string;
    probability?: number;
    threshold?: number;
    txSignature?: string;
    errorMessage?: string;
    walletBalance?: number;
    [key: string]: any;
  };
}

export class WebhookService {
  private maxRetries = 3;
  private retryDelayMs = 1000;

  /**
   * Create webhook configuration
   */
  async createWebhook(config: WebhookConfig): Promise<any> {
    const result = await query(
      `INSERT INTO webhooks (user_id, type, url, email, events, enabled, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        config.userId,
        config.type,
        config.url || null,
        config.email || null,
        JSON.stringify(config.events),
        config.enabled,
        JSON.stringify(config.metadata || {}),
      ],
    );

    logger.info('Webhook created', {
      webhookId: result.rows[0].id,
      userId: config.userId,
      type: config.type,
    });

    return result.rows[0];
  }

  /**
   * Get user webhooks
   */
  async getUserWebhooks(userId: number): Promise<any[]> {
    const result = await query(
      `SELECT * FROM webhooks WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId],
    );
    return result.rows.map(this.parseWebhook);
  }

  /**
   * Update webhook
   */
  async updateWebhook(
    webhookId: number,
    userId: number,
    updates: Partial<WebhookConfig>,
  ): Promise<any> {
    const setClauses: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (updates.type !== undefined) {
      setClauses.push(`type = $${paramIndex++}`);
      params.push(updates.type);
    }

    if (updates.url !== undefined) {
      setClauses.push(`url = $${paramIndex++}`);
      params.push(updates.url);
    }

    if (updates.email !== undefined) {
      setClauses.push(`email = $${paramIndex++}`);
      params.push(updates.email);
    }

    if (updates.events !== undefined) {
      setClauses.push(`events = $${paramIndex++}`);
      params.push(JSON.stringify(updates.events));
    }

    if (updates.enabled !== undefined) {
      setClauses.push(`enabled = $${paramIndex++}`);
      params.push(updates.enabled);
    }

    if (updates.metadata !== undefined) {
      setClauses.push(`metadata = $${paramIndex++}`);
      params.push(JSON.stringify(updates.metadata));
    }

    if (setClauses.length === 0) {
      throw new Error('No updates provided');
    }

    params.push(webhookId, userId);

    const result = await query(
      `UPDATE webhooks
       SET ${setClauses.join(', ')}, updated_at = NOW()
       WHERE id = $${paramIndex++} AND user_id = $${paramIndex++}
       RETURNING *`,
      params,
    );

    if (result.rows.length === 0) {
      throw new Error('Webhook not found or unauthorized');
    }

    logger.info('Webhook updated', { webhookId, userId });
    return this.parseWebhook(result.rows[0]);
  }

  /**
   * Delete webhook
   */
  async deleteWebhook(webhookId: number, userId: number): Promise<void> {
    const result = await query(
      `DELETE FROM webhooks WHERE id = $1 AND user_id = $2`,
      [webhookId, userId],
    );

    if (result.rowCount === 0) {
      throw new Error('Webhook not found or unauthorized');
    }

    logger.info('Webhook deleted', { webhookId, userId });
  }

  /**
   * Send notification to all configured webhooks for a user
   */
  async notify(payload: NotificationPayload): Promise<void> {
    const webhooks = await this.getWebhooksForEvent(
      payload.userId,
      payload.event,
    );

    if (webhooks.length === 0) {
      logger.debug('No webhooks configured for event', {
        userId: payload.userId,
        event: payload.event,
      });
      return;
    }

    // Send to all webhooks in parallel
    const promises = webhooks.map((webhook) =>
      this.sendWebhook(webhook, payload),
    );

    await Promise.allSettled(promises);
  }

  /**
   * Get webhooks that should receive this event
   */
  private async getWebhooksForEvent(
    userId: number,
    event: WebhookEvent,
  ): Promise<any[]> {
    const result = await query(
      `SELECT * FROM webhooks
       WHERE user_id = $1
       AND enabled = true
       AND events @> $2::jsonb`,
      [userId, JSON.stringify([event])],
    );

    return result.rows.map(this.parseWebhook);
  }

  /**
   * Send webhook notification with retries
   */
  private async sendWebhook(
    webhook: any,
    payload: NotificationPayload,
  ): Promise<void> {
    const message = this.formatMessage(webhook.type, payload);

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        switch (webhook.type) {
          case 'HTTP':
            await this.sendHTTPWebhook(webhook.url, message);
            break;
          case 'SLACK':
            await this.sendSlackWebhook(webhook.url, message);
            break;
          case 'DISCORD':
            await this.sendDiscordWebhook(webhook.url, message);
            break;
          case 'EMAIL':
            await this.sendEmailNotification(webhook.email, message);
            break;
        }

        // Success - log and update last_triggered
        await this.updateWebhookStats(webhook.id, true);
        logger.info('Webhook notification sent', {
          webhookId: webhook.id,
          type: webhook.type,
          event: payload.event,
          attempt,
        });
        return;
      } catch (error: any) {
        logger.warn('Webhook delivery failed', {
          webhookId: webhook.id,
          type: webhook.type,
          attempt,
          error: error.message,
        });

        if (attempt < this.maxRetries) {
          // Exponential backoff
          await new Promise((resolve) =>
            setTimeout(resolve, this.retryDelayMs * Math.pow(2, attempt)),
          );
        } else {
          // Final failure - update stats
          await this.updateWebhookStats(webhook.id, false);
          logger.error('Webhook notification failed after retries', {
            webhookId: webhook.id,
            type: webhook.type,
            error: error.message,
          });
        }
      }
    }
  }

  /**
   * Send HTTP webhook
   */
  private async sendHTTPWebhook(url: string, payload: any): Promise<void> {
    await axios.post(url, payload, {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'TripWire-Webhook/1.0',
      },
      timeout: 5000,
    });
  }

  /**
   * Send Slack webhook
   */
  private async sendSlackWebhook(url: string, payload: any): Promise<void> {
    const slackPayload = {
      text: payload.title,
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: payload.title,
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: payload.description,
          },
        },
      ],
    };

    await axios.post(url, slackPayload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 5000,
    });
  }

  /**
   * Send Discord webhook
   */
  private async sendDiscordWebhook(url: string, payload: any): Promise<void> {
    const discordPayload = {
      embeds: [
        {
          title: payload.title,
          description: payload.description,
          color: this.getColorForEvent(payload.event),
          timestamp: payload.timestamp,
          fields: Object.entries(payload.data || {}).map(([key, value]) => ({
            name: this.formatFieldName(key),
            value: String(value),
            inline: true,
          })),
        },
      ],
    };

    await axios.post(url, discordPayload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 5000,
    });
  }

  /**
   * Send email notification (placeholder - integrate with SendGrid/SES)
   */
  private async sendEmailNotification(
    email: string,
    payload: any,
  ): Promise<void> {
    // TODO: Integrate with email service (SendGrid, AWS SES, etc.)
    logger.info('Email notification (not implemented)', {
      email,
      subject: payload.title,
    });

    // For now, just log - you'll need to add email service integration
    // Example with SendGrid:
    // await sendgrid.send({
    //   to: email,
    //   from: 'notifications@tripwire.com',
    //   subject: payload.title,
    //   text: payload.description,
    //   html: this.formatEmailHTML(payload),
    // });
  }

  /**
   * Format message based on event type
   */
  private formatMessage(type: WebhookType, payload: NotificationPayload): any {
    const { event, data } = payload;

    const baseMessage = {
      event,
      timestamp: payload.timestamp.toISOString(),
      data,
    };

    // Add human-readable title and description
    let title = '';
    let description = '';

    switch (event) {
      case 'RULE_TRIGGERED':
        title = '🎯 Rule Triggered';
        description = `Rule "${data.ruleName}" triggered! Market ${data.marketId} probability is now ${(data.probability! * 100).toFixed(1)}% (threshold: ${(data.threshold! * 100).toFixed(1)}%)`;
        break;

      case 'EXECUTION_STARTED':
        title = '⚙️ Execution Started';
        description = `Executing rule "${data.ruleName}" for market ${data.marketId}`;
        break;

      case 'EXECUTION_SUCCEEDED':
        title = '✅ Execution Succeeded';
        description = `Successfully executed rule "${data.ruleName}". Transaction: ${data.txSignature || 'N/A'}`;
        break;

      case 'EXECUTION_FAILED':
        title = '❌ Execution Failed';
        description = `Failed to execute rule "${data.ruleName}". Error: ${data.errorMessage || 'Unknown error'}`;
        break;

      case 'RULE_PAUSED':
        title = '⏸️ Rule Paused';
        description = `Rule "${data.ruleName}" has been paused due to repeated failures`;
        break;

      case 'WALLET_LOW_BALANCE':
        title = '⚠️ Low Wallet Balance';
        description = `Automation wallet balance is low: ${data.walletBalance} SOL`;
        break;
    }

    return {
      ...baseMessage,
      title,
      description,
    };
  }

  /**
   * Get color for Discord embed based on event
   */
  private getColorForEvent(event: WebhookEvent): number {
    const colors: Record<WebhookEvent, number> = {
      RULE_TRIGGERED: 0x8b5cf6, // Purple
      EXECUTION_STARTED: 0x3b82f6, // Blue
      EXECUTION_SUCCEEDED: 0x10b981, // Green
      EXECUTION_FAILED: 0xef4444, // Red
      RULE_PAUSED: 0xf59e0b, // Orange
      WALLET_LOW_BALANCE: 0xf59e0b, // Orange
    };
    return colors[event] || 0x6b7280; // Gray default
  }

  /**
   * Format field name for display
   */
  private formatFieldName(key: string): string {
    return key
      .split(/(?=[A-Z])/)
      .join(' ')
      .replace(/^\w/, (c) => c.toUpperCase());
  }

  /**
   * Update webhook statistics
   */
  private async updateWebhookStats(
    webhookId: number,
    success: boolean,
  ): Promise<void> {
    await query(
      `UPDATE webhooks
       SET last_triggered_at = NOW(),
           failure_count = CASE WHEN $2 THEN 0 ELSE failure_count + 1 END
       WHERE id = $1`,
      [webhookId, success],
    );
  }

  /**
   * Parse webhook row from database
   */
  private parseWebhook(row: any): any {
    return {
      ...row,
      events: typeof row.events === 'string' ? JSON.parse(row.events) : row.events,
      metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata,
    };
  }

  /**
   * Test webhook delivery
   */
  async testWebhook(webhookId: number, userId: number): Promise<void> {
    const webhooks = await query(
      `SELECT * FROM webhooks WHERE id = $1 AND user_id = $2`,
      [webhookId, userId],
    );

    if (webhooks.rows.length === 0) {
      throw new Error('Webhook not found or unauthorized');
    }

    const webhook = this.parseWebhook(webhooks.rows[0]);

    const testPayload: NotificationPayload = {
      event: 'RULE_TRIGGERED',
      userId,
      timestamp: new Date(),
      data: {
        ruleId: 1,
        ruleName: 'Test Rule',
        marketId: 'TEST-MARKET',
        probability: 0.75,
        threshold: 0.65,
      },
    };

    await this.sendWebhook(webhook, testPayload);
  }
}

// Export singleton instance
export const webhookService = new WebhookService();
