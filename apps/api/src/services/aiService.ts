import Anthropic from '@anthropic-ai/sdk';
import {
  nearestEmbeddings,
  getGrantsByIds,
  getEmbedding,
  type GrantWithRelations as DbGrant,
} from '@uf-research-metrics-platform/db';
import { embed, embeddingsEnabled } from '@uf-research-metrics-platform/embeddings';
import type { GrantWithRelations } from '@uf-research-metrics-platform/shared';

const DEFAULT_MODEL = 'claude-sonnet-4-6';
const TOP_K = 10;

/** RAG needs both an embedding provider (retrieval) and Anthropic (generation). */
export function ragEnabled(): boolean {
  return embeddingsEnabled() && Boolean(process.env.ANTHROPIC_API_KEY);
}

function serialize(g: DbGrant): GrantWithRelations {
  return {
    id: g.id,
    title: g.title,
    sponsorId: g.sponsorId,
    piId: g.piId,
    departmentId: g.departmentId,
    amount: Number(g.amount),
    status: g.status as GrantWithRelations['status'],
    submittedAt: g.submittedAt,
    awardedAt: g.awardedAt,
    endAt: g.endAt ?? null,
    createdAt: g.createdAt,
    updatedAt: g.updatedAt,
    sponsor: g.sponsor
      ? {
          id: g.sponsor.id,
          name: g.sponsor.name,
          sponsorType: g.sponsor.sponsorType as NonNullable<GrantWithRelations['sponsor']>['sponsorType'],
        }
      : undefined,
    pi: g.pi
      ? { id: g.pi.id, name: g.pi.name, email: g.pi.email, departmentId: g.pi.departmentId }
      : undefined,
    department: g.department ? { id: g.department.id, name: g.department.name } : undefined,
  };
}

/** Cosine-nearest grants to the given grant (excluding itself). Empty if it has no embedding. */
export async function findSimilarGrants(
  grantId: number,
  k = TOP_K,
): Promise<Array<GrantWithRelations & { score: number }>> {
  const vec = await getEmbedding(grantId);
  if (!vec) return [];
  const hits = await nearestEmbeddings(vec, k, grantId);
  const grants = await getGrantsByIds(hits.map((h) => h.grantId));
  const byId = new Map(grants.map((g) => [g.id, g]));
  return hits
    .map((h) => {
      const g = byId.get(h.grantId);
      return g ? { ...serialize(g), score: h.score } : null;
    })
    .filter((x): x is GrantWithRelations & { score: number } => x !== null);
}

/** Embed the question, retrieve top-K grants, and build a citation-instructed prompt. */
async function buildAskContext(
  question: string,
): Promise<{ grants: GrantWithRelations[]; prompt: string }> {
  const [qVec] = await embed([question]);
  const hits = await nearestEmbeddings(qVec, TOP_K);
  const grants = await getGrantsByIds(hits.map((h) => h.grantId));
  const byId = new Map(grants.map((g) => [g.id, g]));
  const ordered = hits.map((h) => byId.get(h.grantId)).filter((g): g is DbGrant => Boolean(g));

  const context = ordered
    .map(
      (g) =>
        `grant_id=${g.id} | title="${g.title}" | PI=${g.pi?.name ?? '?'} | sponsor=${g.sponsor?.name ?? '?'} (${g.sponsor?.sponsorType ?? '?'}) | status=${g.status} | amount=${Number(g.amount)} | end_at=${g.endAt?.toISOString().slice(0, 10) ?? 'n/a'}`,
    )
    .join('\n');

  const prompt = `You are a research-grants analyst for a university Office of Research. Answer the question using ONLY the grants below. Cite the grant_id in square brackets (e.g. [123]) for every claim. If the grants do not contain the answer, say so.

Grants:
${context}

Question: ${question}`;

  return { grants: ordered.map(serialize), prompt };
}

/**
 * Stream a Claude answer for `question`. `onText` is called with each text delta;
 * returns the retrieved grants (for citation rendering). Caller handles transport (SSE).
 */
export async function streamAnswer(
  question: string,
  onText: (delta: string) => void,
): Promise<{ grants: GrantWithRelations[] }> {
  const { grants, prompt } = await buildAskContext(question);
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const model = process.env.ANTHROPIC_MODEL ?? DEFAULT_MODEL;

  const stream = client.messages.stream({
    model,
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  });
  stream.on('text', onText);
  await stream.finalMessage();

  return { grants };
}
