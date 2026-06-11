// Walks the live Express router stack and asserts every (method, path) is
// documented in the published spec — and that the spec has no stale paths.
import { describe, it, expect } from 'vitest';
import listEndpoints from 'express-list-endpoints';
import { createApp } from '../../app.js';
import { spec } from './harness.js';

describe('spec completeness', () => {
  const endpoints = listEndpoints(createApp());

  const liveOps = new Set<string>();
  for (const ep of endpoints) {
    const path = ep.path.replace(/:([A-Za-z0-9_]+)/g, '{$1}');
    for (const m of ep.methods) {
      if (m === 'HEAD' || m === 'OPTIONS') continue;
      liveOps.add(`${m.toLowerCase()} ${path}`);
    }
  }

  const specOps = new Set<string>();
  for (const [path, methods] of Object.entries(spec.paths)) {
    for (const m of Object.keys(methods)) specOps.add(`${m.toLowerCase()} ${path}`);
  }

  it('documents every live route', () => {
    const undocumented = [...liveOps].filter((o) => !specOps.has(o)).sort();
    expect(undocumented).toEqual([]);
  });

  it('has no stale spec paths', () => {
    const stale = [...specOps].filter((o) => !liveOps.has(o)).sort();
    expect(stale).toEqual([]);
  });
});
