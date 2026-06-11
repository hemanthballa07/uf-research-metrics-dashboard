import { login, sampleGrantIds, readMix } from './lib/mix.js';

// Stepped concurrency sweep to find the read-path CEILING.
//
// k6's end-of-run summary only reports the *aggregate* p95, not per-stage, so a
// single ramping run can't tell you which VU level broke. Instead we run a series
// of fixed-VU scenarios back-to-back (sequential `startTime`s), each tagged by its
// VU level. A non-aborting threshold per level forces k6 to print that level's
// sub-metric in the summary — so one run yields p95 + pass/fail per level. The
// CEILING is the highest level still under p95<800ms AND fail<1%.
//
//   k6 run scripts/bench/stress-read.js                          # 25→50→100→150→200, 30s each
//   LEVELS=10,25,50 STEP_SECONDS=20 k6 run scripts/bench/stress-read.js   # custom / CI smoke
const API_URL = __ENV.API_URL || 'http://localhost:3001';
const ADMIN_EMAIL = __ENV.ADMIN_EMAIL || 'admin@ufl.edu';
const ADMIN_PASSWORD = __ENV.ADMIN_PASSWORD || 'changeme';
const STEP_SECONDS = Number(__ENV.STEP_SECONDS || 30);
const LEVELS = (__ENV.LEVELS || '25,50,100,150,200')
  .split(',')
  .map((s) => Number(s.trim()))
  .filter((n) => n > 0);
// CI runs a smoke just to prove the scripts execute and the API stays error-free
// under load — latency on a shared runner is not an SLA. SOFT_LATENCY=1 drops the
// per-level p95 thresholds (so a slow runner can't fail the job) while keeping the
// http_req_failed error gate. k6 exits non-zero on ANY crossed threshold, which is
// why this matters for CI.
const SOFT_LATENCY = __ENV.SOFT_LATENCY === '1' || __ENV.SOFT_LATENCY === 'true';

const scenarios = {};
const thresholds = { http_req_failed: ['rate<0.01'] };
LEVELS.forEach((level, k) => {
  scenarios[`vu_${level}`] = {
    executor: 'constant-vus',
    vus: level,
    duration: `${STEP_SECONDS}s`,
    startTime: `${k * STEP_SECONDS}s`,
    exec: 'read',
    tags: { level: String(level) },
  };
  // A (non-aborting) threshold per level makes k6 print that tagged sub-metric's
  // p95 in the summary — the ceiling = highest level still under 800ms. Skipped
  // under SOFT_LATENCY so a slow CI runner can't fail the job on latency alone.
  if (!SOFT_LATENCY) thresholds[`http_req_duration{level:${level}}`] = ['p(95)<800'];
});

export const options = { scenarios, thresholds };

export function setup() {
  const token = login(API_URL, ADMIN_EMAIL, ADMIN_PASSWORD);
  const ids = sampleGrantIds(API_URL, token, 50);
  return { token, ids };
}

export function read(data) {
  readMix(API_URL, data.token, data.ids);
}
