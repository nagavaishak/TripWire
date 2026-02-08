import { Router, Request, Response } from 'express';
import { ruleService } from '../services/rule.service';
import {
  validateCreateRuleRequest,
  validateUpdateRuleRequest,
  CreateRuleRequest,
  UpdateRuleRequest,
} from '../types/rules';
import logger from '../utils/logger';

const router = Router();

/**
 * POST /api/rules
 * Create a new rule
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    // Validate request body
    const validation = validateCreateRuleRequest(req.body);
    if (!validation.valid) {
      res.status(400).json({
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        errors: validation.errors,
      });
      return;
    }

    const data: CreateRuleRequest = req.body;

    // Create rule
    const rule = await ruleService.createRule(userId, data);

    res.status(201).json({
      message: 'Rule created successfully',
      rule,
    });
  } catch (error) {
    logger.error('Error creating rule', {
      userId: req.user?.id,
      error: error instanceof Error ? error.message : String(error),
    });

    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        res.status(404).json({
          error: error.message,
          code: 'NOT_FOUND',
        });
        return;
      }

      if (error.message.includes('Unauthorized')) {
        res.status(403).json({
          error: error.message,
          code: 'FORBIDDEN',
        });
        return;
      }
    }

    res.status(500).json({
      error: 'Failed to create rule',
      code: 'INTERNAL_ERROR',
    });
  }
});

/**
 * GET /api/rules
 * List all rules for the authenticated user
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const status = req.query.status as string | undefined;
    const limit = req.query.limit
      ? parseInt(req.query.limit as string)
      : undefined;
    const offset = req.query.offset
      ? parseInt(req.query.offset as string)
      : undefined;

    const { rules, total } = await ruleService.listRules(userId, {
      status: status as any,
      limit,
      offset,
    });

    res.json({
      rules,
      total,
      page: Math.floor((offset || 0) / (limit || 100)) + 1,
      limit: limit || 100,
    });
  } catch (error) {
    logger.error('Error listing rules', {
      userId: req.user?.id,
      error: error instanceof Error ? error.message : String(error),
    });

    res.status(500).json({
      error: 'Failed to list rules',
      code: 'INTERNAL_ERROR',
    });
  }
});

/**
 * GET /api/rules/:id
 * Get a specific rule by ID
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const ruleId = parseInt(String(req.params.id));

    if (isNaN(ruleId)) {
      res.status(400).json({
        error: 'Invalid rule ID',
        code: 'INVALID_ID',
      });
      return;
    }

    const rule = await ruleService.getRule(ruleId, userId);

    if (!rule) {
      res.status(404).json({
        error: 'Rule not found',
        code: 'NOT_FOUND',
      });
      return;
    }

    res.json({ rule });
  } catch (error) {
    logger.error('Error getting rule', {
      userId: req.user?.id,
      ruleId: req.params.id,
      error: error instanceof Error ? error.message : String(error),
    });

    res.status(500).json({
      error: 'Failed to get rule',
      code: 'INTERNAL_ERROR',
    });
  }
});

/**
 * PUT /api/rules/:id
 * Update a rule
 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const ruleId = parseInt(String(req.params.id));

    if (isNaN(ruleId)) {
      res.status(400).json({
        error: 'Invalid rule ID',
        code: 'INVALID_ID',
      });
      return;
    }

    // Validate request body
    const validation = validateUpdateRuleRequest(req.body);
    if (!validation.valid) {
      res.status(400).json({
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        errors: validation.errors,
      });
      return;
    }

    const data: UpdateRuleRequest = req.body;

    // Update rule
    const rule = await ruleService.updateRule(ruleId, userId, data);

    res.json({
      message: 'Rule updated successfully',
      rule,
    });
  } catch (error) {
    logger.error('Error updating rule', {
      userId: req.user?.id,
      ruleId: req.params.id,
      error: error instanceof Error ? error.message : String(error),
    });

    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        res.status(404).json({
          error: error.message,
          code: 'NOT_FOUND',
        });
        return;
      }

      if (error.message.includes('transition')) {
        res.status(400).json({
          error: error.message,
          code: 'INVALID_TRANSITION',
        });
        return;
      }
    }

    res.status(500).json({
      error: 'Failed to update rule',
      code: 'INTERNAL_ERROR',
    });
  }
});

/**
 * DELETE /api/rules/:id
 * Delete (cancel) a rule
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const ruleId = parseInt(String(req.params.id));

    if (isNaN(ruleId)) {
      res.status(400).json({
        error: 'Invalid rule ID',
        code: 'INVALID_ID',
      });
      return;
    }

    await ruleService.deleteRule(ruleId, userId);

    res.json({
      message: 'Rule deleted successfully',
    });
  } catch (error) {
    logger.error('Error deleting rule', {
      userId: req.user?.id,
      ruleId: req.params.id,
      error: error instanceof Error ? error.message : String(error),
    });

    if (error instanceof Error && error.message.includes('not found')) {
      res.status(404).json({
        error: error.message,
        code: 'NOT_FOUND',
      });
      return;
    }

    res.status(500).json({
      error: 'Failed to delete rule',
      code: 'INTERNAL_ERROR',
    });
  }
});

export default router;
