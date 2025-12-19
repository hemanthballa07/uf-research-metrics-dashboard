import type { Request, Response } from 'express';
import { timeseriesQuerySchema } from '@uf-research-metrics-platform/shared';
import { ValidationError } from '@uf-research-metrics-platform/shared';
import { getMetricsSummary, getStatusBreakdown, getTimeSeries } from '../services/metricsService.js';

export async function getMetricsSummaryHandler(req: Request, res: Response): Promise<void> {
  const metrics = await getMetricsSummary();
  res.status(200).json(metrics);
}

export async function getStatusBreakdownHandler(req: Request, res: Response): Promise<void> {
  const breakdown = await getStatusBreakdown();
  res.status(200).json(breakdown);
}

export async function getTimeSeriesHandler(req: Request, res: Response): Promise<void> {
  // Validate query parameters
  const validationResult = timeseriesQuerySchema.safeParse(req.query);

  if (!validationResult.success) {
    const fields: Record<string, string[]> = {};
    validationResult.error.errors.forEach((err) => {
      const path = err.path.join('.');
      if (!fields[path]) {
        fields[path] = [];
      }
      fields[path].push(err.message);
    });
    throw new ValidationError('Invalid query parameters', fields);
  }

  const params = validationResult.data;
  const timeseries = await getTimeSeries(params.months);
  res.status(200).json(timeseries);
}
