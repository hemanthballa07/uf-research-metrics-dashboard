import type { Request, Response } from 'express';
import { grantsQuerySchema } from '@uf-research-metrics-platform/shared';
import { ValidationError } from '@uf-research-metrics-platform/shared';
import { getGrants } from '../services/grantsService.js';

export async function getGrantsHandler(req: Request, res: Response): Promise<void> {
  // Validate query parameters
  const validationResult = grantsQuerySchema.safeParse(req.query);

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

  // Convert date strings to Date objects if present
  const result = await getGrants({
    department: params.department,
    sponsor: params.sponsor,
    status: params.status,
    dateFrom: params.date_from,
    dateTo: params.date_to,
    search: params.search,
    page: params.page,
    pageSize: params.pageSize,
  });

  res.status(200).json(result);
}

