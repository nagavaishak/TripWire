import { Request, Response, NextFunction } from 'express';
import { userService, User } from '../services/user.service';
import { query } from '../utils/db';
import logger from '../utils/logger';

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

/**
 * Authentication middleware
 * Validates Bearer token and attaches user to request
 *
 * Usage:
 *   app.use('/api', authenticate); // Protect all /api routes
 *   app.get('/api/rules', authenticate, handler); // Protect specific route
 */
export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    // Extract Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      logAuthAttempt(req, null, false, 'missing_header');
      res.status(401).json({
        error: 'Authentication required',
        code: 'MISSING_AUTH_HEADER',
      });
      return;
    }

    if (!authHeader.startsWith('Bearer ')) {
      logAuthAttempt(req, null, false, 'invalid_format');
      res.status(401).json({
        error: 'Invalid authorization header format. Use: Bearer <api_key>',
        code: 'INVALID_AUTH_FORMAT',
      });
      return;
    }

    // Extract API key
    const apiKey = authHeader.substring(7); // Remove 'Bearer '

    if (!apiKey) {
      logAuthAttempt(req, null, false, 'empty_token');
      res.status(401).json({
        error: 'API key is required',
        code: 'EMPTY_API_KEY',
      });
      return;
    }

    // Authenticate user
    const user = await userService.authenticateUser(apiKey);

    if (!user) {
      logAuthAttempt(req, null, false, 'invalid_key');
      res.status(401).json({
        error: 'Invalid API key',
        code: 'INVALID_API_KEY',
      });
      return;
    }

    // Attach user to request
    req.user = user;

    logAuthAttempt(req, user.id, true);

    next();
  } catch (error) {
    logger.error('Authentication middleware error', {
      error: error instanceof Error ? error.message : String(error),
      path: req.path,
    });

    res.status(500).json({
      error: 'Internal server error during authentication',
      code: 'AUTH_ERROR',
    });
  }
}

/**
 * Log authentication attempts for security monitoring
 */
function logAuthAttempt(
  req: Request,
  userId: number | null,
  success: boolean,
  reason?: string,
): void {
  const logData = {
    userId,
    success,
    reason,
    ip: req.ip || req.socket.remoteAddress,
    method: req.method,
    path: req.path,
    userAgent: req.headers['user-agent'],
  };

  if (success) {
    logger.debug('Authentication successful', logData);
  } else {
    logger.warn('Authentication failed', logData);
  }

  // Also write to audit log (async, don't wait)
  query(
    `INSERT INTO audit_log (event_type, user_id, resource_type, action, details, ip_address, user_agent)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      'AUTH',
      userId,
      'user',
      success ? 'AUTH_SUCCESS' : 'AUTH_FAILED',
      JSON.stringify({ reason, method: req.method, path: req.path }),
      logData.ip,
      logData.userAgent,
    ],
  ).catch((error) => {
    logger.error('Failed to write audit log', { error: error.message });
  });
}

/**
 * Optional middleware: Require user to be authenticated
 * Use this after authenticate() for routes that absolutely need auth
 */
export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!req.user) {
    res.status(401).json({
      error: 'Authentication required',
      code: 'AUTH_REQUIRED',
    });
    return;
  }
  next();
}
