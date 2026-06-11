-- Phase 7: pgvector embeddings over grants.
-- Requires the pgvector extension (provided by the pgvector/pgvector:pg16 image).
-- Hand-authored: Prisma cannot express the `vector` type's HNSW index, so the index
-- and extension live only here. Apply with `prisma migrate deploy`; never run plain
-- `prisma migrate dev` against this DB (it would flag the HNSW index as drift).

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE "grant_embeddings" (
    "grant_id"   INTEGER NOT NULL,
    "embedding"  vector(1024) NOT NULL,
    "model"      TEXT NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "grant_embeddings_pkey" PRIMARY KEY ("grant_id")
);

-- CASCADE is intentional (derived data), unlike the Restrict default on dimension FKs.
ALTER TABLE "grant_embeddings"
    ADD CONSTRAINT "grant_embeddings_grant_id_fkey"
    FOREIGN KEY ("grant_id") REFERENCES "grants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Approximate-nearest-neighbour index for cosine distance (pgvector >= 0.5).
CREATE INDEX "grant_embeddings_hnsw"
    ON "grant_embeddings" USING hnsw ("embedding" vector_cosine_ops);
