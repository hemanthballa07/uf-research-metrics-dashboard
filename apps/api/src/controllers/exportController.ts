import type { Request, Response } from 'express';
import { GrantStatus } from '@prisma/client';
import { grantsQuerySchema } from '@uf-research-metrics-platform/shared';
import { ValidationError } from '@uf-research-metrics-platform/shared';
import { exportGrantsCSV, exportGrantsJSON } from '../services/exportService.js';

export async function exportGrantsHandler(req: Request, res: Response): Promise<void> {
  const format = (req.query.format as string) || 'csv';

  const parsed = grantsQuerySchema.omit({ page: true, pageSize: true }).safeParse(req.query);

  if (!parsed.success) {
    const fields: Record<string, string[]> = {};
    parsed.error.errors.forEach((err) => {
      const path = err.path.join('.');
      if (!fields[path]) fields[path] = [];
      fields[path].push(err.message);
    });
    throw new ValidationError('Invalid query parameters', fields);
  }

  const { department, sponsor, status, date_from, date_to, search } = parsed.data;
  const params = {
    department,
    sponsor,
    status: status as GrantStatus | undefined,
    dateFrom: date_from,
    dateTo: date_to,
    search,
  };

  if (format === 'json') {
    const data = await exportGrantsJSON(params);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="grants-export.json"');
    res.status(200).json(data);
  } else {
    const csv = await exportGrantsCSV(params);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="grants-export.csv"');
    res.status(200).send(csv);
  }
}
