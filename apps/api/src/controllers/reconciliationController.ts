import type { Request, Response } from 'express';
import { reconcileFromStream } from '../services/reconciliationService.js';

/**
 * POST /api/reconcile — dry-run: parse the uploaded CSV, compare against DB
 * state, and return a structured exception report. No data is written.
 * Accepts Content-Type: text/plain (same as the ingest endpoint).
 * ADMIN only.
 */
export async function reconcileHandler(req: Request, res: Response): Promise<void> {
  const report = await reconcileFromStream(req);
  res.status(200).json(report);
}
