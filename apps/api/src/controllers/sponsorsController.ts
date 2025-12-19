import type { Request, Response } from 'express';
import { getAllSponsors } from '../services/sponsorsService.js';

export async function getSponsorsHandler(req: Request, res: Response): Promise<void> {
  const sponsors = await getAllSponsors();
  res.status(200).json(sponsors);
}

