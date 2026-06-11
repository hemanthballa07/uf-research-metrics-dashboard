import { Router } from 'express';
import type { Request, Response } from 'express';
import { registry } from '../middleware/prometheusMetrics.js';

const router = Router();

router.get('/metrics', async (_req: Request, res: Response) => {
  res.set('Content-Type', registry.contentType);
  res.end(await registry.metrics());
});

export default router;
