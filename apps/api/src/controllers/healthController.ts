import type { Request, Response } from 'express';
import { prisma } from '../db/client.js';

export async function getHealth(req: Request, res: Response): Promise<void> {
  try {
    // Simple health check - verify database connection
    await prisma.$queryRaw`SELECT 1`;

    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'uf-research-metrics-api',
    });
  } catch (error) {
    // Health check failed - return 503 Service Unavailable
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      service: 'uf-research-metrics-api',
      error: 'Database connection failed',
    });
  }
}

