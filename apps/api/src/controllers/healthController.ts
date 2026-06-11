import type { Request, Response } from 'express';
import { prisma } from '@uf-research-metrics-platform/db';
import { getRedisClient } from '../lib/cache.js';

type CheckStatus = 'ok' | 'error';
type OverallStatus = 'ok' | 'degraded' | 'unhealthy';

interface CheckResult {
  status: CheckStatus;
  latencyMs: number;
}

interface HealthResponse {
  status: OverallStatus;
  timestamp: string;
  service: string;
  checks: {
    database: CheckResult;
    redis: CheckResult;
  };
}

export async function getHealth(req: Request, res: Response): Promise<void> {
  // Run DB and Redis checks concurrently
  const [dbResult, redisResult] = await Promise.all([checkDatabase(), checkRedis()]);

  // Determine overall status:
  // - unhealthy: DB is down
  // - degraded: DB ok but Redis down
  // - ok: all checks pass
  let overallStatus: OverallStatus;
  if (dbResult.status === 'error') {
    overallStatus = 'unhealthy';
  } else if (redisResult.status === 'error') {
    overallStatus = 'degraded';
  } else {
    overallStatus = 'ok';
  }

  const body: HealthResponse = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    service: 'api',
    checks: {
      database: dbResult,
      redis: redisResult,
    },
  };

  // 503 only if DB is down; degraded (redis down) still returns 200
  const httpStatus = overallStatus === 'unhealthy' ? 503 : 200;
  res.status(httpStatus).json(body);
}

async function checkDatabase(): Promise<CheckResult> {
  const start = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { status: 'ok', latencyMs: Date.now() - start };
  } catch {
    return { status: 'error', latencyMs: Date.now() - start };
  }
}

async function checkRedis(): Promise<CheckResult> {
  const start = Date.now();
  try {
    const client = getRedisClient();
    await client.ping();
    return { status: 'ok', latencyMs: Date.now() - start };
  } catch {
    return { status: 'error', latencyMs: Date.now() - start };
  }
}
