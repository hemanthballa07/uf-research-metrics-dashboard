import type { Request, Response, NextFunction } from 'express';
import { cacheGet, cacheSet } from '../lib/cache.js';
import { cacheHitsTotal, cacheMissesTotal } from './prometheusMetrics.js';

export const METRICS_CACHE_TTL = 300; // 5 minutes

export function withCache(ttlSeconds: number = METRICS_CACHE_TTL) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const key = `api:${req.path}:${JSON.stringify(req.query)}`;

    const cached = await cacheGet(key);
    if (cached !== null) {
      cacheHitsTotal.inc({ route: req.path });
      res.status(200).json(cached);
      return;
    }

    cacheMissesTotal.inc({ route: req.path });

    // Intercept res.json to store the response before sending
    const originalJson = res.json.bind(res);
    res.json = (body: unknown) => {
      if (res.statusCode === 200) {
        cacheSet(key, body, ttlSeconds).catch(() => {});
      }
      return originalJson(body);
    };

    next();
  };
}
