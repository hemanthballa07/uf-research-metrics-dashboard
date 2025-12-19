import { prisma } from '../db/client.js';
import type { MetricsSummary } from '@uf-research-metrics-platform/shared';
import { DatabaseError } from '@uf-research-metrics-platform/shared';

export async function getMetricsSummary(): Promise<MetricsSummary> {
  try {
    const now = new Date();
    const twelveMonthsAgo = new Date(now);
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    // Get total submissions in last 12 months
    const totalSubmissions = await prisma.grant.count({
      where: {
        submittedAt: {
          gte: twelveMonthsAgo,
        },
      },
    });

    // Get total awarded amount in last 12 months
    const awardedGrants = await prisma.grant.findMany({
      where: {
        status: 'awarded',
        awardedAt: {
          gte: twelveMonthsAgo,
        },
      },
      select: {
        amount: true,
      },
    });

    const totalAwardedAmount = awardedGrants.reduce(
      (sum, grant) => sum + Number(grant.amount),
      0
    );

    // Calculate award rate
    const awardRate =
      totalSubmissions > 0
        ? awardedGrants.length / totalSubmissions
        : 0;

    // Calculate median time-to-award using SQL window function
    // This uses PERCENTILE_CONT to get the median
    const medianResult = await prisma.$queryRaw<Array<{ median_days: number | null }>>`
      SELECT 
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY 
          EXTRACT(EPOCH FROM ("awardedAt" - "submittedAt")) / 86400
        ) AS median_days
      FROM grants
      WHERE status = 'awarded'
        AND "submittedAt" IS NOT NULL
        AND "awardedAt" IS NOT NULL
        AND "awardedAt" >= ${twelveMonthsAgo}
    `;

    const medianTimeToAward =
      medianResult[0]?.median_days !== null && medianResult[0]?.median_days !== undefined
        ? Math.round(medianResult[0].median_days)
        : null;

    return {
      totalSubmissions,
      totalAwardedAmount,
      awardRate: Math.round(awardRate * 10000) / 100, // Round to 2 decimal places as percentage
      medianTimeToAward,
    };
  } catch (error) {
    throw new DatabaseError('Failed to fetch metrics summary', error);
  }
}

