/**
 * Embedding provider for grant text. Currently Voyage AI `voyage-3` (1024-dim).
 * Provider-agnostic signature so OpenAI / a local model can swap in later — only
 * this module and the vector dimension in the migration would change.
 */

export const EMBEDDING_MODEL = 'voyage-3';
export const EMBEDDING_DIM = 1024;

const VOYAGE_URL = 'https://api.voyageai.com/v1/embeddings';
const MAX_BATCH = 128; // Voyage accepts up to 128 inputs per request.

/** Thrown when no API key is configured, so callers can degrade (e.g. 503 / skip). */
export class EmbeddingsUnavailableError extends Error {
  constructor(message = 'VOYAGE_API_KEY is not set') {
    super(message);
    this.name = 'EmbeddingsUnavailableError';
  }
}

interface VoyageResponse {
  data: Array<{ embedding: number[]; index: number }>;
}

async function embedChunk(texts: string[], apiKey: string): Promise<number[][]> {
  const res = await fetch(VOYAGE_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: EMBEDDING_MODEL, input: texts }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Voyage embeddings failed (${res.status}): ${body.slice(0, 200)}`);
  }
  const json = (await res.json()) as VoyageResponse;
  // Voyage returns results indexed; sort to preserve input order.
  return json.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
}

/**
 * Embed a batch of texts → one 1024-dim vector each (input order preserved).
 * Splits into ≤128-input requests. Throws EmbeddingsUnavailableError if the key is missing.
 */
export async function embed(texts: string[]): Promise<number[][]> {
  const apiKey = process.env.VOYAGE_API_KEY;
  if (!apiKey) throw new EmbeddingsUnavailableError();
  if (texts.length === 0) return [];

  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += MAX_BATCH) {
    out.push(...(await embedChunk(texts.slice(i, i + MAX_BATCH), apiKey)));
  }
  return out;
}

/** True when an embedding provider is configured. */
export function embeddingsEnabled(): boolean {
  return Boolean(process.env.VOYAGE_API_KEY);
}
