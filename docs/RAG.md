# Semantic Search + RAG (pgvector)

Grants are embedded into pgvector to power two features:

1. **Find similar grants** — `GET /api/grants/:id/similar` returns cosine-nearest grants.
2. **/ask** — a natural-language question is embedded, the top-K nearest grants are retrieved,
   and an Anthropic Claude answer is **streamed** back (SSE) with `grant_id` citations.

It is a from-scratch RAG pipeline (no LangChain): embed → pgvector top-K → prompt → Claude stream.

## Storage (pgvector)

- Postgres runs the `pgvector/pgvector:pg16` image (the `vector` extension).
- Migration `20260520000000_add_grant_embeddings` creates:
  - `grant_embeddings(grant_id int PK → grants ON DELETE CASCADE, embedding vector(1024), model text, updated_at timestamptz)`
  - an HNSW cosine index: `USING hnsw (embedding vector_cosine_ops)`.
- The table is modeled in `schema.prisma` as `GrantEmbedding` with `embedding Unsupported("vector(1024)")`;
  the extension + HNSW index live **only** in the SQL migration. Apply with `prisma migrate deploy`;
  never run plain `prisma migrate dev` against this DB (it would flag the HNSW index as drift). All
  vector reads/writes use `$queryRawUnsafe` (`packages/db/src/embeddings.ts`).
- `ON DELETE CASCADE` is intentional (embeddings are derived data) — it deviates from the repo's
  `onDelete: Restrict` convention for dimension FKs.

## Embeddings

- Provider: **Voyage AI `voyage-3`** (1024-dim) via `packages/embeddings` (`embed(texts)`), `VOYAGE_API_KEY`.
  Provider-swappable — changing it means editing that module + the migration's vector dimension + a re-embed.
- Embedded text per grant: `"{title} — {sponsorName} — {piName}"` (`embedTextFor`).
- **Two write paths:**
  - **Backfill** — `pnpm embed:grants` (`scripts/embed-grants.ts`) cursor-pages all grants and bulk-embeds.
    Authoritative source of truth; run after a bulk load, a model change, or a text-template change.
  - **Incremental** — the ingest-worker embeds each batch's grants right after upsert, **best-effort**
    (try/catch + `embeddings_total` metric; never blocks ingestion). Gated by `EMBED_ON_INGEST` (default
    on); set `EMBED_ON_INGEST=false` for large/bulk loads and rely on the backfill script.

## /ask (retrieval + streaming)

- `POST /api/ask { question }` → embed the question, `nearestEmbeddings(vec, 10)`, build a prompt with the
  retrieved grant rows + a "cite grant_id in [brackets]" instruction, stream Claude `messages.stream()`
  (`ANTHROPIC_MODEL`, default latest Sonnet) as SSE events: `text` (deltas), `sources` (grants), `done`, `error`.
- Guards: a dedicated `askLimiter` (10 req/min) since each call costs money; auth required (ADMIN+VIEWER);
  **503** if `VOYAGE_API_KEY` or `ANTHROPIC_API_KEY` is unset (never crashes).
- SSE bypasses the global `compression()` middleware (a `filter` that skips `text/event-stream`) +
  `Cache-Control: no-transform`, so tokens stream incrementally.

## Env

| Var | Purpose |
|---|---|
| `VOYAGE_API_KEY` | Voyage embeddings; absent → embedding + /ask disabled |
| `EMBED_ON_INGEST` | Worker embeds on ingest (default true; false for bulk loads) |
| `ANTHROPIC_API_KEY` | Claude generation for /ask |
| `ANTHROPIC_MODEL` | Claude model (default `claude-sonnet-4-6`) |

## Run it locally

```bash
docker compose up -d postgres redis            # postgres = pgvector image
pnpm --filter @uf-research-metrics-platform/db exec prisma migrate deploy
VOYAGE_API_KEY=… pnpm embed:grants             # backfill embeddings
# then run api (ANTHROPIC_API_KEY + VOYAGE_API_KEY set) and open /ask in the web app
```

## Eval harness

`apps/api/src/tests/eval/grants-rag.eval.ts` holds golden Q&A pairs. It runs **only** on
`workflow_dispatch` + a weekly cron (never per-PR), is **key-gated** (skips without
`ANTHROPIC_API_KEY`/`VOYAGE_API_KEY`), and enforces a **≤ $0.50/run** budget cap. The default
`vitest` suite stays key-free and pgvector-free.
