import type { Request, Response } from 'express';
import { getGrants } from '../services/grantsService.js';
import { grantsQuerySchema } from '@uf-research-metrics-platform/shared';
import { ValidationError } from '@uf-research-metrics-platform/shared';

export async function exportGrantsHandler(req: Request, res: Response): Promise<void> {
  const format = req.query.format as string || 'json';

  // Validate query parameters (same as getGrants)
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

  // Get all grants (no pagination for export)
  const result = await getGrants({
    department: params.department,
    sponsor: params.sponsor,
    status: params.status,
    dateFrom: params.date_from,
    dateTo: params.date_to,
    search: params.search,
    page: 1,
    pageSize: 10000, // Large limit for export
  });

  if (format === 'csv') {
    // Generate CSV
    const headers = [
      'ID',
      'Title',
      'PI Name',
      'PI Email',
      'Department',
      'Sponsor',
      'Sponsor Type',
      'Amount',
      'Status',
      'Submitted At',
      'Awarded At',
    ];

    const rows = result.items.map((grant) => [
      grant.id.toString(),
      grant.title,
      grant.pi?.name || '',
      grant.pi?.email || '',
      grant.department?.name || '',
      grant.sponsor?.name || '',
      grant.sponsor?.sponsorType || '',
      grant.amount.toString(),
      grant.status,
      grant.submittedAt?.toISOString() || '',
      grant.awardedAt?.toISOString() || '',
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="grants-export.csv"');
    res.status(200).send(csvContent);
  } else {
    // JSON export
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="grants-export.json"');
    res.status(200).json(result.items);
  }
}

