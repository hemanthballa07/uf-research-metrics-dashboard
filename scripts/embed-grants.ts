import 'dotenv/config';
import { prisma, embedTextFor, upsertEmbedding } from '@uf-research-metrics-platform/db';
import {
  embed,
  embeddingsEnabled,
  EMBEDDING_MODEL,
} from '@uf-research-metrics-platform/embeddings';

// Backfill / re-embed every grant into pgvector. Authoritative source of truth for the
// index (run after a bulk load, a model change, or an embed-text-template change).
// Usage: VOYAGE_API_KEY=… DATABASE_URL=… pnpm embed:grants
const PAGE = 100;

async function main(): Promise<void> {
  if (!embeddingsEnabled()) {
    console.error('VOYAGE_API_KEY is not set — cannot embed.');
    process.exit(1);
  }

  let cursor: number | undefined;
  let total = 0;
  for (;;) {
    const grants = await prisma.grant.findMany({
      take: PAGE,
      ...(cursor !== undefined ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: 'asc' },
      include: { sponsor: true, pi: true },
    });
    if (grants.length === 0) break;

    const vectors = await embed(grants.map(embedTextFor));
    for (let i = 0; i < grants.length; i++) {
      await upsertEmbedding(grants[i].id, vectors[i], EMBEDDING_MODEL);
    }

    total += grants.length;
    cursor = grants[grants.length - 1].id;
    console.log(`embedded ${total} grants…`);
  }

  console.log(`done — ${total} grants embedded with ${EMBEDDING_MODEL}`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
