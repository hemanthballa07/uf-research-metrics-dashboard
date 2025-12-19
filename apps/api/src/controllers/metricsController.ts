import type { Request, Response } from 'express';
import { getMetricsSummary } from '../services/metricsService.js';

export async function getMetricsSummaryHandler(
  req: Request,
  res: Response
): Promise<void> {
  const summary = await getMetricsSummary();
  res.status(200).json(summary);
}

