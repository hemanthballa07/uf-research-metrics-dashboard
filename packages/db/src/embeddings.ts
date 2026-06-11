import { Prisma } from '@prisma/client';
import { prisma } from './client.js';

// Grant rows with the relations needed to build embedding text + render results.
const grantInclude = {
  sponsor: true,
  pi: { include: { department: true } },
  department: true,
} satisfies Prisma.GrantInclude;

export type GrantWithRelations = Prisma.GrantGetPayload<{ include: typeof grantInclude }>;

/** Canonical text embedded per grant. */
export function embedTextFor(g: {
  title: string;
  sponsor?: { name: string } | null;
  pi?: { name: string } | null;
}): string {
  return `${g.title} — ${g.sponsor?.name ?? 'Unknown sponsor'} — ${g.pi?.name ?? 'Unknown PI'}`;
}

/** Fetch grants (with relations) by id. Order is not guaranteed — callers re-order if needed. */
export function getGrantsByIds(ids: number[]): Promise<GrantWithRelations[]> {
  if (ids.length === 0) return Promise.resolve([]);
  return prisma.grant.findMany({ where: { id: { in: ids } }, include: grantInclude });
}

/** pgvector literal: a JS number[] → `[1,2,3]` (bound as text, cast `::vector` in SQL). */
function toVectorLiteral(vec: number[]): string {
  return `[${vec.join(',')}]`;
}

/** Insert/refresh one grant's embedding. */
export async function upsertEmbedding(
  grantId: number,
  vector: number[],
  model: string,
): Promise<void> {
  await prisma.$executeRawUnsafe(
    `INSERT INTO grant_embeddings (grant_id, embedding, model, updated_at)
     VALUES ($1, $2::vector, $3, now())
     ON CONFLICT (grant_id) DO UPDATE
       SET embedding = EXCLUDED.embedding, model = EXCLUDED.model, updated_at = now()`,
    grantId,
    toVectorLiteral(vector),
    model,
  );
}

/**
 * Top-K grant ids nearest the query vector by cosine similarity (1 - cosine distance),
 * highest first. `excludeGrantId` omits a grant from its own neighbours.
 */
export async function nearestEmbeddings(
  queryVec: number[],
  k: number,
  excludeGrantId?: number,
): Promise<Array<{ grantId: number; score: number }>> {
  const lit = toVectorLiteral(queryVec);
  const rows =
    excludeGrantId === undefined
      ? await prisma.$queryRawUnsafe<Array<{ grant_id: number; score: number }>>(
          `SELECT grant_id, 1 - (embedding <=> $1::vector) AS score
           FROM grant_embeddings
           ORDER BY embedding <=> $1::vector
           LIMIT $2`,
          lit,
          k,
        )
      : await prisma.$queryRawUnsafe<Array<{ grant_id: number; score: number }>>(
          `SELECT grant_id, 1 - (embedding <=> $1::vector) AS score
           FROM grant_embeddings
           WHERE grant_id <> $2
           ORDER BY embedding <=> $1::vector
           LIMIT $3`,
          lit,
          excludeGrantId,
          k,
        );
  return rows.map((r) => ({ grantId: r.grant_id, score: Number(r.score) }));
}

/** The stored embedding vector for a grant, or null if not yet embedded. */
export async function getEmbedding(grantId: number): Promise<number[] | null> {
  const rows = await prisma.$queryRawUnsafe<Array<{ embedding: string }>>(
    `SELECT embedding::text AS embedding FROM grant_embeddings WHERE grant_id = $1`,
    grantId,
  );
  if (rows.length === 0) return null;
  return JSON.parse(rows[0].embedding) as number[];
}
