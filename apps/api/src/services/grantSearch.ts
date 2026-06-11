import { prisma } from '@uf-research-metrics-platform/db';

/**
 * Builds the Prisma `OR` clause for faceted grant search so the pg_trgm GIN index
 * (`grants_title_trgm`) is actually usable.
 *
 * The naive `{ pi: { name: { contains } } }` relation filter compiles to a correlated
 * subquery, and `title ILIKE x OR piId IN (<subquery>)` forces Postgres into a full
 * sequential scan over `grants` regardless of selectivity — the dominant read-path
 * bottleneck found in B17 load testing (docs/BENCHMARKS.md). Instead we resolve the
 * matching PI ids up front (cheap: `faculty` is small and indexed) and pass them as a
 * literal `piId IN (...)`. Both OR branches are then plain predicates on `grants`
 * (title + piId), so the planner BitmapOrs `grants_title_trgm` with `grants_piId_idx`.
 *
 * An empty pi-id list collapses to a pure title index scan. See migration
 * `20260609000000_add_grant_search_trigram`.
 */
export async function buildGrantSearchOr(search: string): Promise<Record<string, unknown>[]> {
  const matchingPis = await prisma.faculty.findMany({
    where: { name: { contains: search, mode: 'insensitive' } },
    select: { id: true },
  });
  const piIds = matchingPis.map((f) => f.id);

  return [
    { title: { contains: search, mode: 'insensitive' } },
    { piId: { in: piIds } },
  ];
}
