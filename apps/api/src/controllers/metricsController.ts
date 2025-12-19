import type { Request, Response } from 'express';
import { getMetricsSummary, getStatusBreakdown } from '../services/metricsService.js';

export async function getMetricsSummaryHandler(req: Request, res: Response): Promise<void> {
  const metrics = await getMetricsSummary();
  res.status(200).json(metrics);
}

export async function getStatusBreakdownHandler(req: Request, res: Response): Promise<void> {
  const breakdown = await getStatusBreakdown();
  res.status(200).json(breakdown);
}
