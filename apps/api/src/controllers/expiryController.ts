import type { Request, Response } from 'express';
import { getExpiringGrants } from '../services/expiryService.js';

export async function getExpiringGrantsHandler(_req: Request, res: Response): Promise<void> {
  const data = await getExpiringGrants();
  res.json(data);
}
