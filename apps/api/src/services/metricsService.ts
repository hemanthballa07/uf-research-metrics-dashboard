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

    // Calculate award rate: percentage of submissions that resulted in awards
    // Division by zero protection: returns 0 if no submissions
    const awardRate =
      totalSubmissions > 0
        ? awardedGrants.length / totalSubmissions
        : 0;

    // Calculate median time-to-award using SQL window function
    // PERCENTILE_CONT(0.5) computes the median (50th percentile) efficiently in the database
    // This is more accurate than fetching all rows and computing median in application code
    // EXTRACT(EPOCH FROM ...) / 86400 converts timestamp difference to days
    // Filter ensures we only consider awarded grants with valid dates in the last 12 months
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

export async function getStatusBreakdown() {
  try {
    const now = new Date();
    const twelveMonthsAgo = new Date(now);
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    const statusCounts = await prisma.grant.groupBy({
      by: ['status'],
      where: {
        submittedAt: {
          gte: twelveMonthsAgo,
        },
      },
      _count: {
        id: true,
      },
    });

    return statusCounts.map((item) => ({
      status: item.status,
      count: item._count.id,
    }));
  } catch (error) {
    throw new DatabaseError('Failed to fetch status breakdown', error);
  }
}

export interface TimeSeriesDataPoint {
  month: string; // Format: "YYYY-MM"
  submissions: number;
  awards: number;
  awardedAmount: number;
}

export async function getTimeSeries(months: number = 12): Promise<TimeSeriesDataPoint[]> {
  try {
    const now = new Date();
    const startDate = new Date(now);
    startDate.setMonth(startDate.getMonth() - months);

    // Generate complete month series using generate_series
    // Then LEFT JOIN with actual grant data to include months with zero values
    const results = await prisma.$queryRaw<Array<{
      month: string;
      submissions: bigint;
      awards: bigint;
      awarded_amount: number | null;
    }>>`
      WITH month_series AS (
        SELECT 
          TO_CHAR(month_start, 'YYYY-MM') AS month
        FROM generate_series(
          DATE_TRUNC('month', ${startDate}::timestamp),
          DATE_TRUNC('month', ${now}::timestamp),
          '1 month'::interval
        ) AS month_start
      ),
      submissions_by_month AS (
        SELECT 
          TO_CHAR(DATE_TRUNC('month', "submittedAt"), 'YYYY-MM') AS month,
          COUNT(*)::bigint AS count
        FROM grants
        WHERE "submittedAt" >= ${startDate}
          AND "submittedAt" IS NOT NULL
        GROUP BY DATE_TRUNC('month', "submittedAt")
      ),
      awards_by_month AS (
        SELECT 
          TO_CHAR(DATE_TRUNC('month', "awardedAt"), 'YYYY-MM') AS month,
          COUNT(*)::bigint AS count,
          SUM(amount)::numeric AS total_amount
        FROM grants
        WHERE status = 'awarded'
          AND "awardedAt" >= ${startDate}
          AND "awardedAt" IS NOT NULL
        GROUP BY DATE_TRUNC('month', "awardedAt")
      )
      SELECT 
        ms.month,
        COALESCE(sbm.count, 0)::bigint AS submissions,
        COALESCE(abm.count, 0)::bigint AS awards,
        COALESCE(abm.total_amount, 0)::numeric AS awarded_amount
      FROM month_series ms
      LEFT JOIN submissions_by_month sbm ON ms.month = sbm.month
      LEFT JOIN awards_by_month abm ON ms.month = abm.month
      ORDER BY ms.month ASC
    `;

    return results.map((row) => ({
      month: row.month,
      submissions: Number(row.submissions),
      awards: Number(row.awards),
      awardedAmount: row.awarded_amount ? Number(row.awarded_amount) : 0,
    }));
  } catch (error) {
    throw new DatabaseError('Failed to fetch time series data', error);
  }
}
