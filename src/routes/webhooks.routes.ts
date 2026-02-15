import express, { Request, Response } from 'express';
import { webhookService, WebhookType, WebhookEvent } from '../services/webhook.service';
import logger from '../utils/logger';

const router = express.Router();

/**
 * Webhook Routes
 * User-facing endpoints for managing notification webhooks
 * Note: All routes are protected by authentication middleware at /api level
 */

/**
 * GET /api/webhooks
 * Get all webhooks for the authenticated user
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const webhooks = await webhookService.getUserWebhooks(userId);

    res.json({
      success: true,
      webhooks,
    });
  } catch (error: any) {
    logger.error('Error fetching webhooks', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/webhooks
 * Create a new webhook
 *
 * Request body:
 * {
 *   "type": "HTTP" | "EMAIL" | "SLACK" | "DISCORD",
 *   "url": "https://...",  // required for HTTP/SLACK/DISCORD
 *   "email": "user@example.com",  // required for EMAIL
 *   "events": ["RULE_TRIGGERED", "EXECUTION_SUCCEEDED", ...],
 *   "enabled": true,
 *   "metadata": { ... }  // optional
 * }
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { type, url, email, events, enabled = true, metadata } = req.body;

    // Validation
    if (!type || !['HTTP', 'EMAIL', 'SLACK', 'DISCORD'].includes(type)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid type. Must be HTTP, EMAIL, SLACK, or DISCORD',
      });
    }

    if (!events || !Array.isArray(events) || events.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Events array is required and must not be empty',
      });
    }

    const validEvents: WebhookEvent[] = [
      'RULE_TRIGGERED',
      'EXECUTION_STARTED',
      'EXECUTION_SUCCEEDED',
      'EXECUTION_FAILED',
      'RULE_PAUSED',
      'WALLET_LOW_BALANCE',
    ];

    const invalidEvents = events.filter((e: string) => !validEvents.includes(e as WebhookEvent));
    if (invalidEvents.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Invalid events: ${invalidEvents.join(', ')}`,
      });
    }

    if (type === 'EMAIL') {
      if (!email) {
        return res.status(400).json({
          success: false,
          error: 'Email is required for EMAIL type webhooks',
        });
      }
    } else {
      if (!url) {
        return res.status(400).json({
          success: false,
          error: 'URL is required for HTTP/SLACK/DISCORD type webhooks',
        });
      }
    }

    const webhook = await webhookService.createWebhook({
      userId,
      type: type as WebhookType,
      url,
      email,
      events: events as WebhookEvent[],
      enabled,
      metadata,
    });

    res.status(201).json({
      success: true,
      webhook,
    });
  } catch (error: any) {
    logger.error('Error creating webhook', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * PUT /api/webhooks/:id
 * Update a webhook
 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const webhookId = parseInt(String(req.params.id));

    if (isNaN(webhookId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid webhook ID',
      });
    }

    const { type, url, email, events, enabled, metadata } = req.body;

    const webhook = await webhookService.updateWebhook(webhookId, userId, {
      type: type as WebhookType,
      url,
      email,
      events: events as WebhookEvent[],
      enabled,
      metadata,
    });

    res.json({
      success: true,
      webhook,
    });
  } catch (error: any) {
    logger.error('Error updating webhook', { error: error.message });
    const status = error.message.includes('not found') || error.message.includes('unauthorized') ? 404 : 500;
    res.status(status).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * DELETE /api/webhooks/:id
 * Delete a webhook
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const webhookId = parseInt(String(req.params.id));

    if (isNaN(webhookId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid webhook ID',
      });
    }

    await webhookService.deleteWebhook(webhookId, userId);

    res.json({
      success: true,
      message: 'Webhook deleted successfully',
    });
  } catch (error: any) {
    logger.error('Error deleting webhook', { error: error.message });
    const status = error.message.includes('not found') || error.message.includes('unauthorized') ? 404 : 500;
    res.status(status).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/webhooks/:id/test
 * Test a webhook by sending a test notification
 */
router.post('/:id/test', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const webhookId = parseInt(String(req.params.id));

    if (isNaN(webhookId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid webhook ID',
      });
    }

    await webhookService.testWebhook(webhookId, userId);

    res.json({
      success: true,
      message: 'Test notification sent successfully',
    });
  } catch (error: any) {
    logger.error('Error testing webhook', { error: error.message });
    const status = error.message.includes('not found') || error.message.includes('unauthorized') ? 404 : 500;
    res.status(status).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;
