import type { Request, Response } from 'express';
import { ingestGrantsFromCSV } from '../services/ingestService.js';
import { ValidationError } from '@uf-research-metrics-platform/shared';

export async function ingestGrantsHandler(req: Request, res: Response): Promise<void> {
  // Accept CSV as raw text body (simplest reliable approach)
  const csvText = req.body;

  if (!csvText || typeof csvText !== 'string') {
    throw new ValidationError('CSV data is required as text/plain body');
  }

  if (csvText.trim().length === 0) {
    throw new ValidationError('CSV data cannot be empty');
  }

  const report = await ingestGrantsFromCSV(csvText);

  res.status(200).json(report);
}

