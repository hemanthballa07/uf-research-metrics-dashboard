/**
 * Shared data-access package: the Prisma client singleton plus the
 * idempotent upsert and expiry queries used by both the API and the
 * ingest-worker. Owns the Prisma schema + migrations (packages/db/prisma).
 */
export { prisma } from './client.js';
export { upsertBatch, BATCH_SIZE, type GrantUpsertRow, type IngestionReport } from './upsert.js';
export { getExpiringGrants } from './expiry.js';
export {
  embedTextFor,
  getGrantsByIds,
  upsertEmbedding,
  nearestEmbeddings,
  getEmbedding,
  type GrantWithRelations,
} from './embeddings.js';
