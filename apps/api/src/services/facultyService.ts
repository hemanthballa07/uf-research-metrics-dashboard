import { prisma } from '../db/client.js';
import type { FacultyLeaderboardEntry } from '@uf-research-metrics-platform/shared';
import { DatabaseError } from '@uf-research-metrics-platform/shared';

export interface FacultyLeaderboardParams {
  department?: number;
}

export async function getFacultyLeaderboard(
  params: FacultyLeaderboardParams
): Promise<FacultyLeaderboardEntry[]> {
  try {
    const now = new Date();
    const twelveMonthsAgo = new Date(now);
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    // Use WINDOW FUNCTION (RANK() OVER) to rank faculty by awarded amount
    // RANK() OVER computes ranking efficiently in SQL without multiple queries
    // Handles ties correctly (same amount = same rank, next rank skips)
    // CTE (WITH clause) aggregates totals before ranking for clarity and performance
    // Build query with conditional department filter
    let results: Array<{
      faculty_id: number;
      faculty_name: string;
      department_name: string;
      total_awarded: number;
      rank: bigint;
    }>;

    if (params.department) {
      results = await prisma.$queryRaw`
        WITH faculty_totals AS (
          SELECT 
            f.id AS faculty_id,
            f.name AS faculty_name,
            d.name AS department_name,
            COALESCE(SUM(g.amount), 0)::numeric AS total_awarded
            -- COALESCE ensures faculty with no awards show 0, not NULL
          FROM "faculty" f
          INNER JOIN "departments" d ON f."departmentId" = d.id
          LEFT JOIN grants g ON g."piId" = f.id
            AND g.status = 'awarded'
            AND g."awardedAt" >= ${twelveMonthsAgo}
            AND g."departmentId" = ${params.department}
            -- LEFT JOIN ensures faculty with no awards still appear
          WHERE f."departmentId" = ${params.department}
          GROUP BY f.id, f.name, d.name
        )
        SELECT 
          faculty_id,
          faculty_name,
          department_name,
          total_awarded,
          RANK() OVER (
            ORDER BY total_awarded DESC
          ) AS rank
          -- RANK() handles ties: same amount = same rank, next rank skips
        FROM faculty_totals
        ORDER BY total_awarded DESC, faculty_name ASC
      `;
    } else {
      results = await prisma.$queryRaw`
        WITH faculty_totals AS (
          SELECT 
            f.id AS faculty_id,
            f.name AS faculty_name,
            d.name AS department_name,
            COALESCE(SUM(g.amount), 0)::numeric AS total_awarded
            -- COALESCE ensures faculty with no awards show 0, not NULL
          FROM "faculty" f
          INNER JOIN "departments" d ON f."departmentId" = d.id
          LEFT JOIN grants g ON g."piId" = f.id
            AND g.status = 'awarded'
            AND g."awardedAt" >= ${twelveMonthsAgo}
            -- LEFT JOIN ensures faculty with no awards still appear
          GROUP BY f.id, f.name, d.name
        )
        SELECT 
          faculty_id,
          faculty_name,
          department_name,
          total_awarded,
          RANK() OVER (
            ORDER BY total_awarded DESC
          ) AS rank
          -- RANK() handles ties: same amount = same rank, next rank skips
        FROM faculty_totals
        ORDER BY total_awarded DESC, faculty_name ASC
      `;
    }

    // Transform results to match FacultyLeaderboardEntry type
    const leaderboard: FacultyLeaderboardEntry[] = results.map((row) => ({
      facultyId: row.faculty_id,
      facultyName: row.faculty_name,
      departmentName: row.department_name,
      totalAwarded: Number(row.total_awarded),
      rank: Number(row.rank),
    }));

    return leaderboard;
  } catch (error) {
    throw new DatabaseError('Failed to fetch faculty leaderboard', error);
  }
}

