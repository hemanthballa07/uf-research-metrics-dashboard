import type { Request, Response } from 'express';
import { facultyLeaderboardQuerySchema } from '@uf-research-metrics-platform/shared';
import { ValidationError } from '@uf-research-metrics-platform/shared';
import { getFacultyLeaderboard } from '../services/facultyService.js';

export async function getFacultyLeaderboardHandler(
  req: Request,
  res: Response
): Promise<void> {
  // Validate query parameters
  const validationResult = facultyLeaderboardQuerySchema.safeParse(req.query);

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

  const leaderboard = await getFacultyLeaderboard({
    department: params.department,
  });

  res.status(200).json(leaderboard);
}

