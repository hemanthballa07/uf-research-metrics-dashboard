import { login, sampleGrantIds, readMix } from './lib/mix.js';

// Read-path load test (k6). Replays a working-hours endpoint mix against the running api.
// The login, weighted endpoint mix, and per-endpoint trends now live in ./lib/mix.js,
// shared with stress-read.js and reporting-week.js so all three stay in lock-step.
//   k6 run scripts/bench/read-load.js              # defaults: ~20 VUs, ramped
//   API_URL=... VUS=40 k6 run scripts/bench/read-load.js
const API_URL = __ENV.API_URL || 'http://localhost:3001';
const VUS = Number(__ENV.VUS || 20);
const ADMIN_EMAIL = __ENV.ADMIN_EMAIL || 'admin@ufl.edu';
const ADMIN_PASSWORD = __ENV.ADMIN_PASSWORD || 'changeme';

export const options = {
  scenarios: {
    daily: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '15s', target: VUS }, // ramp
        { duration: '40s', target: VUS }, // plateau
        { duration: '10s', target: 0 },   // ramp down
      ],
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],          // <1% errors
    http_req_duration: ['p(95)<800'],        // tune after first run
  },
};

export function setup() {
  const token = login(API_URL, ADMIN_EMAIL, ADMIN_PASSWORD);
  const ids = sampleGrantIds(API_URL, token, 50);
  return { token, ids };
}

export default function (data) {
  readMix(API_URL, data.token, data.ids);
}
