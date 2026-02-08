import { Request, Response, NextFunction } from 'express';
import { query } from '../utils/db';
import logger from '../utils/logger';

/**
 * Authorization helpers
 * Check if user owns/can access specific resources
 */

/**
 * Check if user owns a rule
 */
export function authorizeRuleAccess(
  ruleUserId: number,
  requestUserId: number,
): boolean {
  return ruleUserId === requestUserId;
}

/**
 * Check if user owns an automation wallet
 */
export function authorizeWalletAccess(
  walletUserId: number,
  requestUserId: number,
): boolean {
  return walletUserId === requestUserId;
}

/**
 * Middleware: Require user to own the rule specified in req.params.id
 * Use after authenticate() middleware
 */
export async function requireRuleOwnership(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({
        error: 'Authentication required',
        code: 'AUTH_REQUIRED',
      });
      return;
    }

    const ruleId = req.params.id || req.params.ruleId;

    if (!ruleId) {
      res.status(400).json({
        error: 'Rule ID is required',
        code: 'MISSING_RULE_ID',
      });
      return;
    }

    // Fetch rule and check ownership
    const result = await query(
      'SELECT user_id FROM rules WHERE id = $1',
      [ruleId],
    );

    if (result.rows.length === 0) {
      res.status(404).json({
        error: 'Rule not found',
        code: 'RULE_NOT_FOUND',
      });
      return;
    }

    const rule = result.rows[0];

    if (!authorizeRuleAccess(rule.user_id, req.user.id)) {
      logger.warn('Unauthorized rule access attempt', {
        userId: req.user.id,
        ruleId,
        ruleOwnerId: rule.user_id,
      });

      res.status(403).json({
        error: 'Forbidden: You do not own this rule',
        code: 'FORBIDDEN',
      });
      return;
    }

    next();
  } catch (error) {
    logger.error('Authorization middleware error', {
      error: error instanceof Error ? error.message : String(error),
    });

    res.status(500).json({
      error: 'Internal server error during authorization',
      code: 'AUTH_ERROR',
    });
  }
}

/**
 * Middleware: Require user to own the automation wallet specified in req.params
 * Use after authenticate() middleware
 */
export async function requireWalletOwnership(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({
        error: 'Authentication required',
        code: 'AUTH_REQUIRED',
      });
      return;
    }

    const walletAddress = req.params.address || req.params.walletAddress;

    if (!walletAddress) {
      res.status(400).json({
        error: 'Wallet address is required',
        code: 'MISSING_WALLET_ADDRESS',
      });
      return;
    }

    // Fetch wallet and check ownership
    const result = await query(
      'SELECT user_id FROM automation_wallets WHERE address = $1',
      [walletAddress],
    );

    if (result.rows.length === 0) {
      res.status(404).json({
        error: 'Automation wallet not found',
        code: 'WALLET_NOT_FOUND',
      });
      return;
    }

    const wallet = result.rows[0];

    if (!authorizeWalletAccess(wallet.user_id, req.user.id)) {
      logger.warn('Unauthorized wallet access attempt', {
        userId: req.user.id,
        walletAddress,
        walletOwnerId: wallet.user_id,
      });

      res.status(403).json({
        error: 'Forbidden: You do not own this automation wallet',
        code: 'FORBIDDEN',
      });
      return;
    }

    next();
  } catch (error) {
    logger.error('Authorization middleware error', {
      error: error instanceof Error ? error.message : String(error),
    });

    res.status(500).json({
      error: 'Internal server error during authorization',
      code: 'AUTH_ERROR',
    });
  }
}

/**
 * Middleware: Filter query results to only show user's own resources
 * Adds WHERE user_id = $1 to queries automatically
 * Use in list endpoints
 */
export function filterByUserId(req: Request): number {
  if (!req.user) {
    throw new Error('User not authenticated');
  }
  return req.user.id;
}
