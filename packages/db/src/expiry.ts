import { prisma } from './client.js';
import type { ExpiryBucket, ExpiryResponse } from '@uf-research-metrics-platform/shared';

/**
 * Awarded grants expiring within 90 days, grouped into 0-30 / 31-60 / 61-90 buckets.
 * Shared by the API expiry endpoint and the ingest-worker BullMQ notification job.
 */
export async function getExpiringGrants(): Promise<ExpiryResponse> {
  const now = new Date();
  const cutoff = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

  const grants = await prisma.grant.findMany({
    where: {
      status: 'AWARDED',
      endAt: { gte: now, lte: cutoff },
    },
    include: {
      sponsor: true,
      pi: { include: { department: true } },
      department: true,
    },
    orderBy: { endAt: 'asc' },
  });

  const buckets: ExpiryBucket[] = [
    { label: '0-30', daysFrom: 0, daysTo: 30, count: 0, totalAmount: 0, grants: [] },
    { label: '31-60', daysFrom: 31, daysTo: 60, count: 0, totalAmount: 0, grants: [] },
    { label: '61-90', daysFrom: 61, daysTo: 90, count: 0, totalAmount: 0, grants: [] },
  ];

  for (const g of grants) {
    const days = Math.ceil((g.endAt!.getTime() - now.getTime()) / 86_400_000);
    const amount = Number(g.amount);
    const expiringGrant = {
      ...g,
      amount,
      endAt: g.endAt,
      daysUntilExpiry: days,
    };
    const bucket = buckets.find((b) => days >= b.daysFrom && days <= b.daysTo);
    if (bucket) {
      bucket.grants.push(expiringGrant);
      bucket.count++;
      bucket.totalAmount += amount;
    }
  }

  return {
    buckets,
    totalCount: grants.length,
    totalAmount: buckets.reduce((s, b) => s + b.totalAmount, 0),
  };
}
