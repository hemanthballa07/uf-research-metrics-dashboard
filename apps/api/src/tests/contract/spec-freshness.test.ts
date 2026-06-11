// Fails if the committed openapi.json drifts from a fresh regeneration —
// i.e. someone changed a schema without re-running generate-openapi.ts.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { buildDocument } from '../../../../../scripts/generate-openapi.js';

describe('spec freshness', () => {
  it('committed openapi.json matches a fresh regeneration', () => {
    const committed = readFileSync(
      join(
        dirname(fileURLToPath(import.meta.url)),
        '../../../../../packages/shared/dist/openapi.json',
      ),
      'utf8',
    );
    const regenerated = JSON.stringify(buildDocument(), null, 2);
    expect(regenerated).toBe(committed);
  });
});
