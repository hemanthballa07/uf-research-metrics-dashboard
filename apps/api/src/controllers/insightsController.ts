import type { Request, Response } from 'express';
import { insightsQuerySchema } from '@uf-research-metrics-platform/shared';
import { ValidationError } from '@uf-research-metrics-platform/shared';
import { getInsightsData } from '../services/insightsService.js';
import { GrantStatus, SponsorType } from '@prisma/client';

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

  // VIEWER users with a departmentId are pinned to their own department.
  const user = req.user!;
  const scopedDepartmentId =
    user.role === 'VIEWER' && user.departmentId != null ? user.departmentId : undefined;

  const insights = await getInsightsData({
    months: params.months,
    departmentId: scopedDepartmentId ?? params.departmentId,
    sponsorType: params.sponsorType ? (params.sponsorType.toUpperCase() as SponsorType) : undefined,
    status: statusArray as GrantStatus[],
  });

  res.status(200).json(insights);
}

