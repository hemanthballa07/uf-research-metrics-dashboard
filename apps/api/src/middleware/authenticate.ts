import type { Request, Response, NextFunction } from 'express';
import { verifyToken, type TokenPayload } from '../services/authService.js';
import { isTokenBlocked, getUserRevocationEpoch } from '../services/tokenRevocationService.js';

declare global {
  // Global namespace augmentation is the only supported way to extend Express's
  // Request type; the no-namespace rule doesn't apply to ambient module augmentation.
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: TokenPayload & { iat?: number; exp?: number };
    }
  }
}

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({
      error: { message: 'Missing or invalid Authorization header', code: 'UNAUTHORIZED', statusCode: 401, timestamp: new Date().toISOString() },
    });
    return;
  }

  const token = authHeader.slice(7);

  (async () => {
    let payload: TokenPayload & { iat?: number; exp?: number };
    try {
      payload = verifyToken(token) as TokenPayload & { iat?: number; exp?: number };
    } catch {
      res.status(401).json({
        error: { message: 'Invalid or expired token', code: 'UNAUTHORIZED', statusCode: 401, timestamp: new Date().toISOString() },
      });
      return;
    }

    // JTI blocklist check (explicit logout). Fails open on Redis unavailability.
    if (payload.jti && (await isTokenBlocked(payload.jti))) {
      res.status(401).json({
        error: { message: 'Token has been revoked', code: 'UNAUTHORIZED', statusCode: 401, timestamp: new Date().toISOString() },
      });
      return;
    }

    // User-level revocation epoch (admin deprovisioning). Fails open on Redis unavailability.
    const epoch = await getUserRevocationEpoch(payload.userId);
    if (epoch !== null && payload.iat !== undefined && payload.iat < epoch) {
      res.status(401).json({
        error: { message: 'Session has been revoked', code: 'UNAUTHORIZED', statusCode: 401, timestamp: new Date().toISOString() },
      });
      return;
    }

    req.user = payload;
    next();
  })().catch(next);
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({
        error: { message: 'Insufficient permissions', code: 'FORBIDDEN', statusCode: 403 },
      });
      return;
    }
    next();
  };
}
