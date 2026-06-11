import http from 'k6/http';
import { check, group } from 'k6';
import { Trend } from 'k6/metrics';

// Shared bench helpers for the k6 read-load / stress / reporting-week scripts.
// Centralising the login, the weighted working-hours read mix, and the synthetic
// CSV generator here means all three scripts exercise the *identical* endpoint
// distribution and ingest payload — no drift between the baseline and the new
// concurrency/contention scenarios.

// Per-endpoint latency trends, so summaries break down by route, not just global.
export const trends = {
  summary: new Trend('ep_summary', true),
  grants: new Trend('ep_grants_search', true),
  leaderboard: new Trend('ep_leaderboard', true),
  timeseries: new Trend('ep_timeseries', true),
  similar: new Trend('ep_similar', true),
};

export function login(apiUrl, email, password) {
  const res = http.post(`${apiUrl}/api/auth/login`, JSON.stringify({ email, password }), {
    headers: { 'Content-Type': 'application/json' },
  });
  const token = res.json('accessToken');
  if (!token) throw new Error(`login failed (${res.status}): ${res.body}`);
  return token;
}

// Grab some real grant ids so the /similar endpoint hits live rows.
export function sampleGrantIds(apiUrl, token, n = 50) {
  const auth = { headers: { Authorization: `Bearer ${token}` } };
  const items = http.get(`${apiUrl}/api/grants?pageSize=${n}`, auth).json('items') || [];
  return items.map((g) => g.id);
}

const SEARCH = ['cancer', 'research', 'health', 'grant', 'study', 'data'];

// One weighted working-hours read iteration. `extraTags` is merged into every
// request so callers (e.g. reporting-week) can label requests by phase/kind for
// tagged sub-metrics in the summary.
export function readMix(apiUrl, token, ids, extraTags = {}) {
  const params = { headers: { Authorization: `Bearer ${token}` }, tags: extraTags };
  const r = Math.random();

  if (r < 0.25) {
    group('summary', () => {
      const res = http.get(`${apiUrl}/api/metrics/summary`, params);
      trends.summary.add(res.timings.duration);
      check(res, { 'summary 200': (x) => x.status === 200 });
    });
  } else if (r < 0.45) {
    group('grants_search', () => {
      const q = SEARCH[Math.floor(Math.random() * SEARCH.length)];
      const res = http.get(`${apiUrl}/api/grants?search=${q}&pageSize=20`, params);
      trends.grants.add(res.timings.duration);
      check(res, { 'grants 200': (x) => x.status === 200 });
    });
  } else if (r < 0.55) {
    group('leaderboard', () => {
      const res = http.get(`${apiUrl}/api/faculty/leaderboard`, params);
      trends.leaderboard.add(res.timings.duration);
      check(res, { 'leaderboard 200': (x) => x.status === 200 });
    });
  } else if (r < 0.63) {
    group('timeseries', () => {
      const res = http.get(`${apiUrl}/api/metrics/timeseries`, params);
      trends.timeseries.add(res.timings.duration);
      check(res, { 'timeseries 200': (x) => x.status === 200 });
    });
  } else if (r < 0.7 && ids.length) {
    group('similar', () => {
      const id = ids[Math.floor(Math.random() * ids.length)];
      const res = http.get(`${apiUrl}/api/grants/${id}/similar?k=5`, params);
      trends.similar.add(res.timings.duration);
      check(res, { 'similar 200': (x) => x.status === 200 });
    });
  } else {
    // background poll (cached status breakdown)
    http.get(`${apiUrl}/api/metrics/status-breakdown`, params);
  }
}

const SPONSORS = [
  ['National Institutes of Health', 'FEDERAL'],
  ['National Science Foundation', 'FEDERAL'],
  ['Pfizer Inc.', 'INDUSTRY'],
  ['American Heart Association', 'FOUNDATION'],
];
const STATUSES = ['SUBMITTED', 'UNDER_REVIEW', 'AWARDED', 'DECLINED'];

// Synthetic text/plain CSV for POST /api/ingest/grants. `seqBase` must be offset
// per VU by the caller (e.g. exec.vu.idInTest) so concurrent ingest VUs never
// collide on grant_number/title — every row is a fresh INSERT, maximising the
// worker write-pressure the reporting-week scenario is trying to create.
export function makeCsv(rows, seqBase) {
  const lines = [
    'title,grant_number,sponsor_name,sponsor_type,pi_name,pi_email,department_name,amount,status,submitted_at,awarded_at,end_at',
  ];
  for (let i = 0; i < rows; i++) {
    const seq = seqBase + i;
    const [sName, sType] = SPONSORS[i % SPONSORS.length];
    lines.push(
      `Load Grant ${seq},LOAD-${seq},${sName},${sType},PI ${i % 50},pi${i % 50}@load.edu,Dept ${i % 10},${100000 + i},${STATUSES[i % STATUSES.length]},2025-02-01,,2026-09-01`,
    );
  }
  return lines.join('\n');
}
