import type { Request, Response, NextFunction } from 'express';

/**
 * Middleware factory that restricts access to users whose role is one of the
 * supplied `roles`. Must run after the `authenticate` middleware so that
 * `req.user` is already populated.
 *
 * Returns 403 if the user's role is not in the allowed list.
 */
export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({
        error: {
          message: 'Insufficient permissions',
          code: 'FORBIDDEN',
          statusCode: 403,
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }
    next();
  };
}
