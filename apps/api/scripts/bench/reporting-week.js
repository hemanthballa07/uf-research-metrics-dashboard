import http from 'k6/http';
import { check } from 'k6';
import { Counter } from 'k6/metrics';
import exec from 'k6/execution';
import { login, sampleGrantIds, readMix, makeCsv } from './lib/mix.js';

// Reporting-week contention scenario: a steady read load runs through a "quiet"
// window and then a "spike" window during which a concurrent ingest write-spike
// (the NIH-deadline shape) hammers POST /api/ingest/grants. Reads are tagged
// quiet vs spike so the summary shows the read-p95 hit caused by worker-commit
// contention on the grants table.
//
// IMPORTANT — async path: POST /api/ingest/grants returns 202; the actual upserts
// happen in the ingest-worker (Redpanda -> batched INSERT ... ON CONFLICT under
// SET LOCAL lock_timeout='2s'). So the contention measured is *worker commits vs
// reads*, NOT the 202 latency. The ingest-worker AND Redpanda MUST be running or
// the spike queues but never commits. This is why the scenario is local-only
// (CI runs stress-read.js instead — see .github/workflows/ci.yml load-test job).
//
//   RATE_LIMIT_MAX=100000 INGEST_RATE_MAX=100000 ...  (raise caps so k6 isn't throttled)
//   k6 run scripts/bench/reporting-week.js
const API_URL = __ENV.API_URL || 'http://localhost:3001';
const ADMIN_EMAIL = __ENV.ADMIN_EMAIL || 'admin@ufl.edu';
const ADMIN_PASSWORD = __ENV.ADMIN_PASSWORD || 'changeme';
const READ_VUS = Number(__ENV.READ_VUS || 15);
const QUIET_SECONDS = Number(__ENV.QUIET_SECONDS || 30);
const SPIKE_SECONDS = Number(__ENV.SPIKE_SECONDS || 30);
const INGEST_VUS = Number(__ENV.INGEST_VUS || 4);
const INGEST_ROWS = Number(__ENV.INGEST_ROWS || 2000);

const ingestAccepted = new Counter('ingest_accepted');
const ingestErrors = new Counter('ingest_errors');

export const options = {
  scenarios: {
    reads_quiet: {
      executor: 'constant-vus',
      vus: READ_VUS,
      duration: `${QUIET_SECONDS}s`,
      startTime: '0s',
      exec: 'reads',
      tags: { phase: 'quiet' },
    },
    reads_spike: {
      executor: 'constant-vus',
      vus: READ_VUS,
      duration: `${SPIKE_SECONDS}s`,
      startTime: `${QUIET_SECONDS}s`,
      exec: 'reads',
      tags: { phase: 'spike' },
    },
    ingest_spike: {
      executor: 'constant-vus',
      vus: INGEST_VUS,
      duration: `${SPIKE_SECONDS}s`,
      startTime: `${QUIET_SECONDS}s`,
      exec: 'ingest',
      tags: { phase: 'spike' },
    },
  },
  thresholds: {
    // Reads should be healthy in the quiet window; the spike threshold is lenient
    // on purpose — we EXPECT degradation and want the number surfaced, not a hard fail.
    'http_req_duration{phase:quiet,kind:read}': ['p(95)<800'],
    'http_req_duration{phase:spike,kind:read}': ['p(95)<3000'],
    ingest_errors: ['count<1'],
  },
};

export function setup() {
  const token = login(API_URL, ADMIN_EMAIL, ADMIN_PASSWORD);
  const ids = sampleGrantIds(API_URL, token, 50);
  return { token, ids };
}

export function reads(data) {
  readMix(API_URL, data.token, data.ids, { kind: 'read' });
}

export function ingest(data) {
  // Unique seq space per VU+iteration so concurrent uploads never collide.
  const seqBase = exec.vu.idInTest * 10_000_000 + exec.vu.iterationInScenario * INGEST_ROWS;
  const res = http.post(`${API_URL}/api/ingest/grants`, makeCsv(INGEST_ROWS, seqBase), {
    headers: { 'Content-Type': 'text/plain', Authorization: `Bearer ${data.token}` },
    tags: { kind: 'ingest' },
  });
  if (res.status === 202) ingestAccepted.add(1);
  else ingestErrors.add(1);
  check(res, { 'ingest 202': (x) => x.status === 202 });
}
