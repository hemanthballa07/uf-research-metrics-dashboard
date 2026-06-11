import 'dotenv/config';
import { prisma, upsertEmbedding } from '@uf-research-metrics-platform/db';

// Seed SYNTHETIC random unit vectors for every grant so /api/grants/:id/similar can be
// load-tested without a Voyage API key (validates the pgvector cosine query + HTTP path,
// not embedding quality). Not for production use.
const DIM = 1024;

function randomUnitVector(): number[] {
  const v = Array.from({ length: DIM }, () => Math.random() * 2 - 1);
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
  return v.map((x) => x / norm);
}

async function main(): Promise<void> {
  const grants = await prisma.grant.findMany({ select: { id: true } });
  for (const { id } of grants) {
    await upsertEmbedding(id, randomUnitVector(), 'synthetic-bench');
  }
  console.log(`seeded synthetic embeddings for ${grants.length} grants`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
