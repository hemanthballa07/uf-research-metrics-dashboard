import { prisma } from '../db/client.js';
import { DatabaseError } from '@uf-research-metrics-platform/shared';

export interface InsightsSummary {
  submissions: number;
  awards: number;
  awardRate: number;
  totalAwardedAmount: number;
  medianTimeToAward: number | null;
  avgAwardSize: number;
}

export interface InsightsTimeSeriesPoint {
  month: string;
  submissions: number;
  awards: number;
  awardedAmount: number;
  statusCounts: {
    draft: number;
    submitted: number;
    under_review: number;
    awarded: number;
    declined: number;
  };
}

export interface DailyActivityPoint {
  date: string; // Format: "YYYY-MM-DD"
  submissions: number;
  awards: number;
  awardedAmount: number;
}

export interface SponsorBreakdownPoint {
  name: string;
  sponsorType: string | null;
  awardedAmount: number;
  count: number;
}

export interface DepartmentBreakdownPoint {
  departmentId: number;
  name: string;
  awardedAmount: number;
  awards: number;
  submissions: number;
}

export interface FunnelData {
  submitted: number;
  underReview: number;
  awarded: number;
  declined: number;
}

export interface InsightsData {
  summary: InsightsSummary;
  timeseries: InsightsTimeSeriesPoint[];
  dailyActivity: DailyActivityPoint[];
  sponsorBreakdown: SponsorBreakdownPoint[];
  departmentBreakdown: DepartmentBreakdownPoint[];
  funnel: FunnelData;
}

export async function getInsightsData(params: {
  months: number;
  departmentId?: number;
  sponsorType?: string;
  status?: string[];
}): Promise<InsightsData> {
  try {
    const { months, departmentId, sponsorType, status } = params;
    const now = new Date();
    const startDate = new Date(now);
    startDate.setMonth(startDate.getMonth() - months);

    // Build where clause for filtering
    const whereClause: Record<string, unknown> = {
      submittedAt: {
        gte: startDate,
      },
    };

    if (departmentId) {
      whereClause.departmentId = departmentId;
    }

    if (sponsorType) {
      whereClause.sponsor = {
        sponsorType: sponsorType,
      };
    }

    if (status && status.length > 0) {
      whereClause.status = {
        in: status,
      };
    }

    // 1. Summary KPIs
    const totalSubmissions = await prisma.grant.count({
      where: whereClause,
    });

    const awardedWhere = {
      ...whereClause,
      status: 'awarded',
      awardedAt: {
        gte: startDate,
      },
    };

    const awardedGrants = await prisma.grant.findMany({
      where: awardedWhere,
      select: {
        amount: true,
        submittedAt: true,
        awardedAt: true,
      },
    });

    const totalAwardedAmount = awardedGrants.reduce((sum, grant) => sum + Number(grant.amount), 0);
    const awardCount = awardedGrants.length;
    const awardRate = totalSubmissions > 0 ? awardCount / totalSubmissions : 0;
    const avgAwardSize = awardCount > 0 ? totalAwardedAmount / awardCount : 0;

    // Median time-to-award
    let medianQuery = `
      SELECT 
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY 
          EXTRACT(EPOCH FROM ("awardedAt" - "submittedAt")) / 86400
        ) AS median_days
      FROM grants
      WHERE status = 'awarded'
        AND "submittedAt" IS NOT NULL
        AND "awardedAt" IS NOT NULL
        AND "awardedAt" >= $1
    `;
    const medianParams: unknown[] = [startDate];
    if (departmentId) {
      medianQuery += ` AND "departmentId" = $${medianParams.length + 1}`;
      medianParams.push(departmentId);
    }

    const medianResult = await prisma.$queryRawUnsafe<Array<{ median_days: number | null }>>(
      medianQuery,
      ...medianParams
    );

    const medianTimeToAward =
      medianResult[0]?.median_days !== null && medianResult[0]?.median_days !== undefined
        ? Math.round(medianResult[0].median_days)
        : null;

    const summary: InsightsSummary = {
      submissions: totalSubmissions,
      awards: awardCount,
      awardRate: Math.round(awardRate * 10000) / 100,
      totalAwardedAmount,
      medianTimeToAward,
      avgAwardSize: Math.round(avgAwardSize),
    };

    // 2. Time Series with status counts
    // Get timeseries - build query with proper parameters
    let timeseriesQuery = `
      WITH month_series AS (
        SELECT 
          TO_CHAR(month_start, 'YYYY-MM') AS month
        FROM generate_series(
          DATE_TRUNC('month', $1::timestamp),
          DATE_TRUNC('month', $2::timestamp),
          '1 month'::interval
        ) AS month_start
      ),
      submissions_by_month AS (
        SELECT 
          TO_CHAR(DATE_TRUNC('month', "submittedAt"), 'YYYY-MM') AS month,
          COUNT(*)::bigint AS count
        FROM grants
        WHERE "submittedAt" >= $1
    `;
    const timeseriesParams: unknown[] = [startDate, now];
    if (departmentId) {
      timeseriesQuery += ` AND "departmentId" = $${timeseriesParams.length + 1}`;
      timeseriesParams.push(departmentId);
    }
    timeseriesQuery += `
        GROUP BY DATE_TRUNC('month', "submittedAt")
      ),
      awards_by_month AS (
        SELECT 
          TO_CHAR(DATE_TRUNC('month', "awardedAt"), 'YYYY-MM') AS month,
          COUNT(*)::bigint AS count,
          SUM(amount)::numeric AS total_amount
        FROM grants
        WHERE status = 'awarded'
          AND "awardedAt" >= $1
    `;
    if (departmentId) {
      timeseriesQuery += ` AND "departmentId" = $${timeseriesParams.length + 1}`;
      timeseriesParams.push(departmentId);
    }
    timeseriesQuery += `
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

    const timeseriesResults = await prisma.$queryRawUnsafe<Array<{
      month: string;
      submissions: bigint;
      awards: bigint;
      awarded_amount: number | null;
    }>>(timeseriesQuery, ...timeseriesParams);

    // Get status counts by month separately
    const statusCountsByMonth = await prisma.grant.groupBy({
      by: ['submittedAt', 'status'],
      where: whereClause,
      _count: {
        id: true,
      },
    });

    // Group status counts by month
    const statusCountsMap = new Map<string, Record<string, number>>();
    statusCountsByMonth.forEach((item) => {
      if (!item.submittedAt) return;
      const month = item.submittedAt.toISOString().substring(0, 7); // YYYY-MM
      if (!statusCountsMap.has(month)) {
        statusCountsMap.set(month, {
          draft: 0,
          submitted: 0,
          under_review: 0,
          awarded: 0,
          declined: 0,
        });
      }
      const counts = statusCountsMap.get(month)!;
      counts[item.status] = item._count.id;
    });

    const timeseries: InsightsTimeSeriesPoint[] = timeseriesResults.map((row) => {
      const statusCounts = statusCountsMap.get(row.month) || {
        draft: 0,
        submitted: 0,
        under_review: 0,
        awarded: 0,
        declined: 0,
      };
      return {
        month: row.month,
        submissions: Number(row.submissions),
        awards: Number(row.awards),
        awardedAmount: row.awarded_amount ? Number(row.awarded_amount) : 0,
        statusCounts,
      };
    });

    // 3. Daily Activity (simplified - last 365 days)
    const dailyStartDate = new Date(now);
    dailyStartDate.setDate(dailyStartDate.getDate() - Math.min(365, months * 30));

    // Daily activity query
    let dailyQuery = `
      WITH date_series AS (
        SELECT 
          TO_CHAR(date_day, 'YYYY-MM-DD') AS date
        FROM generate_series(
          DATE_TRUNC('day', $1::timestamp),
          DATE_TRUNC('day', $2::timestamp),
          '1 day'::interval
        ) AS date_day
      ),
      daily_submissions AS (
        SELECT 
          TO_CHAR(DATE_TRUNC('day', "submittedAt"), 'YYYY-MM-DD') AS date,
          COUNT(*)::bigint AS count
        FROM grants
        WHERE "submittedAt" >= $1
    `;
    const dailyParams: unknown[] = [dailyStartDate, now];
    if (departmentId) {
      dailyQuery += ` AND "departmentId" = $${dailyParams.length + 1}`;
      dailyParams.push(departmentId);
    }
    dailyQuery += `
        GROUP BY DATE_TRUNC('day', "submittedAt")
      ),
      daily_awards AS (
        SELECT 
          TO_CHAR(DATE_TRUNC('day', "awardedAt"), 'YYYY-MM-DD') AS date,
          COUNT(*)::bigint AS count,
          SUM(amount)::numeric AS total_amount
        FROM grants
        WHERE status = 'awarded'
          AND "awardedAt" >= $1
    `;
    if (departmentId) {
      dailyQuery += ` AND "departmentId" = $${dailyParams.length + 1}`;
      dailyParams.push(departmentId);
    }
    dailyQuery += `
        GROUP BY DATE_TRUNC('day', "awardedAt")
      )
      SELECT 
        ds.date,
        COALESCE(dsub.count, 0)::bigint AS submissions,
        COALESCE(da.count, 0)::bigint AS awards,
        COALESCE(da.total_amount, 0)::numeric AS awarded_amount
      FROM date_series ds
      LEFT JOIN daily_submissions dsub ON ds.date = dsub.date
      LEFT JOIN daily_awards da ON ds.date = da.date
      ORDER BY ds.date ASC
    `;

    const dailyResults = await prisma.$queryRawUnsafe<Array<{
      date: string;
      submissions: bigint;
      awards: bigint;
      awarded_amount: number | null;
    }>>(dailyQuery, ...dailyParams);

    const dailyActivity: DailyActivityPoint[] = dailyResults.map((row) => ({
      date: row.date,
      submissions: Number(row.submissions),
      awards: Number(row.awards),
      awardedAmount: row.awarded_amount ? Number(row.awarded_amount) : 0,
    }));

    // 4. Sponsor Breakdown
    const sponsorWhere: Record<string, unknown> = {
      status: 'awarded',
      awardedAt: { gte: startDate, not: null },
    };
    if (departmentId) {
      sponsorWhere.departmentId = departmentId;
    }

    const sponsorGrants = await prisma.grant.findMany({
      where: sponsorWhere,
      include: {
        sponsor: true,
      },
      select: {
        amount: true,
        sponsor: {
          select: {
            name: true,
            sponsorType: true,
          },
        },
      },
    });

    const sponsorMap = new Map<string, { name: string; sponsorType: string | null; amount: number; count: number }>();
    sponsorGrants.forEach((grant) => {
      const key = grant.sponsor.name;
      const existing = sponsorMap.get(key) || {
        name: grant.sponsor.name,
        sponsorType: grant.sponsor.sponsorType,
        amount: 0,
        count: 0,
      };
      existing.amount += Number(grant.amount);
      existing.count += 1;
      sponsorMap.set(key, existing);
    });

    const sponsorBreakdown: SponsorBreakdownPoint[] = Array.from(sponsorMap.values())
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 20)
      .map((item) => ({
        name: item.name,
        sponsorType: item.sponsorType,
        awardedAmount: item.amount,
        count: item.count,
      }));

    // 5. Department Breakdown
    const deptGrants = await prisma.grant.groupBy({
      by: ['departmentId'],
      where: whereClause,
      _count: {
        id: true,
      },
      _sum: {
        amount: true,
      },
    });

    const deptAwards = await prisma.grant.groupBy({
      by: ['departmentId'],
      where: {
        ...whereClause,
        status: 'awarded',
      },
      _count: {
        id: true,
      },
      _sum: {
        amount: true,
      },
    });

    const deptAwardsMap = new Map(
      deptAwards.map((item) => [item.departmentId, { count: item._count.id, amount: Number(item._sum.amount || 0) }])
    );

    const departments = await prisma.department.findMany({
      where: {
        id: {
          in: deptGrants.map((g) => g.departmentId),
        },
      },
    });

    const deptMap = new Map(departments.map((d) => [d.id, d.name]));

    const departmentBreakdown: DepartmentBreakdownPoint[] = deptGrants
      .map((grant) => {
        const awards = deptAwardsMap.get(grant.departmentId) || { count: 0, amount: 0 };
        return {
          departmentId: grant.departmentId,
          name: deptMap.get(grant.departmentId) || 'Unknown',
          awardedAmount: awards.amount,
          awards: awards.count,
          submissions: grant._count.id,
        };
      })
      .sort((a, b) => b.awardedAmount - a.awardedAmount);

    // 6. Funnel Data
    const funnelCounts = await prisma.grant.groupBy({
      by: ['status'],
      where: whereClause,
      _count: {
        id: true,
      },
    });

    const funnelMap: Record<string, number> = {};
    funnelCounts.forEach((item) => {
      funnelMap[item.status] = item._count.id;
    });

    const funnel: FunnelData = {
      submitted: funnelMap.submitted || 0,
      underReview: funnelMap.under_review || 0,
      awarded: funnelMap.awarded || 0,
      declined: funnelMap.declined || 0,
    };

    return {
      summary,
      timeseries,
      dailyActivity,
      sponsorBreakdown,
      departmentBreakdown,
      funnel,
    };
  } catch (error) {
    throw new DatabaseError('Failed to fetch insights data', error);
  }
}
