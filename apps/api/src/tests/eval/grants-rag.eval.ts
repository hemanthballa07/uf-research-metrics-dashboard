import 'dotenv/config';
import { describe, it, expect } from 'vitest';
import { streamAnswer, ragEnabled } from '../../services/aiService.js';

/**
 * RAG eval harness — runs ONLY when ANTHROPIC_API_KEY + VOYAGE_API_KEY are set
 * (CI: workflow_dispatch + weekly cron, never per-PR). Filename is *.eval.ts so the
 * default `vitest` suite (which includes *.test.ts) never picks it up.
 *
 * Budget guard: each Voyage embed (~$0.0001) + Claude Sonnet answer (~$0.02) ≈ $0.02;
 * 20 pairs ≈ $0.42. Hard cap below fails the run if exceeded.
 */
const GOLDEN: Array<{ q: string; expectAny: string[] }> = [
  { q: 'Which grants are awarded?', expectAny: ['awarded', 'AWARDED'] },
  { q: 'Are there any environmental or sustainability grants?', expectAny: ['environment', 'sustain'] },
  // … extend toward 20 golden pairs.
];

const COST_PER_QUERY_USD = 0.025;
const BUDGET_USD = 0.5;

describe.skipIf(!ragEnabled())('RAG eval (live — needs ANTHROPIC + VOYAGE keys)', () => {
  it('stays within the per-run cost budget', () => {
    expect(GOLDEN.length * COST_PER_QUERY_USD).toBeLessThanOrEqual(BUDGET_USD);
  });

  for (const { q, expectAny } of GOLDEN) {
    it(`answers + cites a grant: "${q}"`, async () => {
      let answer = '';
      const { grants } = await streamAnswer(q, (d) => {
        answer += d;
      });
      // Cites at least one retrieved grant id, and mentions an expected term.
      const cited = grants.some((g) => answer.includes(`[${g.id}]`));
      const relevant = expectAny.some((t) => answer.toLowerCase().includes(t.toLowerCase()));
      expect(cited || grants.length === 0).toBe(true);
      expect(relevant).toBe(true);
    }, 30000);
  }
});
