import type { Request, Response } from 'express';
import { insightsQuerySchema } from '@uf-research-metrics-platform/shared';
import { ValidationError } from '@uf-research-metrics-platform/shared';
import { getInsightsData } from '../services/insightsService.js';

export async function getInsightsHandler(req: Request, res: Response): Promise<void> {
  // Validate query parameters
  const validationResult = insightsQuerySchema.safeParse(req.query);

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
  
  // Parse status comma-separated string to array
  const statusArray = params.status ? params.status.split(',').filter((s) => s.trim().length > 0) : undefined;

  const insights = await getInsightsData({
    months: params.months,
    departmentId: params.departmentId,
    sponsorType: params.sponsorType,
    status: statusArray,
  });

  res.status(200).json(insights);
}

