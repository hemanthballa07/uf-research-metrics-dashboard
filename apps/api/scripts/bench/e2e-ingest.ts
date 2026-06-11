import 'dotenv/config';
import { prisma } from '@uf-research-metrics-platform/db';
import { createConsumer, TOPICS, grantBatchDlqSchema } from '@uf-research-metrics-platform/events';

/**
 * End-to-end async-ingest stress: drives the LIVE pipeline
 *   POST /api/ingest/grants (202 {jobId}) → Kafka → ingest-worker → Postgres → poll job to completed
 * under concurrency, measuring upload→completed latency + throughput, asserting correctness,
 * and exercising the dead-letter path with a deliberate poison batch.
 *
 * Requires a running api + worker + Postgres + Redpanda. Config via env:
 *   API_URL (http://localhost:3001), E2E_CONCURRENCY (20), E2E_ROWS (4000), ADMIN_PASSWORD (changeme)
 */
const API_URL = process.env.API_URL ?? 'http://localhost:3001';
const CONCURRENCY = Number(process.env.E2E_CONCURRENCY ?? 20);
const ROWS = Number(process.env.E2E_ROWS ?? 4000);
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'admin@ufl.edu';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'changeme';
const POLL_DEADLINE_MS = Number(process.env.E2E_POLL_DEADLINE_MS ?? 120_000);

const SPONSORS: Array<[string, string]> = [
  ['National Institutes of Health', 'FEDERAL'],
  ['National Science Foundation', 'FEDERAL'],
  ['Pfizer Inc.', 'INDUSTRY'],
  ['American Heart Association', 'FOUNDATION'],
];
const STATUSES = ['SUBMITTED', 'UNDER_REVIEW', 'AWARDED', 'DECLINED'];

function csv(runId: string, rows: number, poison = false): string {
  const lines = [
    'title,sponsor_name,sponsor_type,pi_name,pi_email,department_name,amount,status,submitted_at,awarded_at,end_at',
  ];
  for (let i = 0; i < rows; i++) {
    const [sName, sType] = SPONSORS[i % SPONSORS.length];
    const title = poison && i === 0 ? 'X'.repeat(600) : `Bench Grant ${runId}-${i}`; // >500 chars → DB error → DLQ
    lines.push(
      `${title},${sName},${sType},PI ${i % 50},pi${i % 50}@bench.edu,Dept ${i % 10},${100000 + i},${STATUSES[i % STATUSES.length]},2025-02-01,,2026-09-01`,
    );
  }
  return lines.join('\n');
}

async function login(): Promise<string> {
  const res = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  if (!res.ok) throw new Error(`login failed (${res.status})`);
  return ((await res.json()) as { accessToken: string }).accessToken;
}

async function ingest(token: string, body: string): Promise<{ jobId: string; totalRows: number }> {
  const res = await fetch(`${API_URL}/api/ingest/grants`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain', Authorization: `Bearer ${token}` },
    body,
  });
  if (res.status !== 202) throw new Error(`ingest expected 202, got ${res.status}: ${await res.text()}`);
  return (await res.json()) as { jobId: string; totalRows: number };
}

async function pollComplete(token: string, jobId: string): Promise<{ inserted: number; updated: number }> {
  const deadline = Date.now() + POLL_DEADLINE_MS;
  for (;;) {
    const res = await fetch(`${API_URL}/api/ingest/jobs/${jobId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const job = (await res.json()) as { status: string; inserted: number; updated: number };
    if (job.status === 'completed') return job;
    if (Date.now() > deadline) throw new Error(`job ${jobId} did not complete in ${POLL_DEADLINE_MS}ms`);
    await new Promise((r) => setTimeout(r, 250));
  }
}

function pct(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
}

async function collectDlq(poisonJobId: string, ms: number): Promise<number> {
  const consumer = createConsumer(`bench-dlq-${Date.now()}`);
  await consumer.connect();
  await consumer.subscribe({ topic: TOPICS.GRANT_BATCH_DLQ, fromBeginning: true });
  let count = 0;
  await consumer.run({
    eachMessage: async ({ message }) => {
      try {
        const dlq = grantBatchDlqSchema.parse(JSON.parse(message.value?.toString() ?? ''));
        if (dlq.jobId === poisonJobId) count++;
      } catch {
        /* ignore */
      }
    },
  });
  await new Promise((r) => setTimeout(r, ms));
  await consumer.disconnect();
  return count;
}

async function main(): Promise<void> {
  const token = await login();
  const before = await prisma.grant.count();
  console.log(`E2E stress: ${CONCURRENCY} concurrent uploads × ${ROWS} rows (+1 poison upload)`);

  const t0 = Date.now();

  // Healthy uploads, concurrent.
  const healthy = await Promise.all(
    Array.from({ length: CONCURRENCY }, async (_, k) => {
      const start = Date.now();
      const { jobId, totalRows } = await ingest(token, csv(`${t0}-${k}`, ROWS));
      const job = await pollComplete(token, jobId);
      return { latency: Date.now() - start, totalRows, ...job };
    }),
  );

  // Poison upload (one oversized-title row → batch fails → DLQ).
  const poison = await ingest(token, csv(`${t0}-poison`, 50, true));
  await pollComplete(token, poison.jobId); // job still completes (worker advances after DLQ)
  const dlqCount = await collectDlq(poison.jobId, 6000);

  const wallSec = (Date.now() - t0) / 1000;
  const after = await prisma.grant.count();
  const latencies = healthy.map((h) => h.latency).sort((a, b) => a - b);
  const totalRows = healthy.reduce((s, h) => s + h.totalRows, 0);
  const ingestedRows = healthy.reduce((s, h) => s + h.inserted + h.updated, 0);

  console.log('\nResults');
  console.log(`  uploads (healthy):   ${CONCURRENCY}`);
  console.log(`  rows submitted:      ${totalRows}`);
  console.log(`  rows ingested:       ${ingestedRows} (job-reported inserted+updated)`);
  console.log(`  DB grant delta:      ${after - before}`);
  console.log(`  wall time:           ${wallSec.toFixed(1)}s`);
  console.log(`  worker throughput:   ${Math.round(ingestedRows / wallSec)} rows/sec (end-to-end)`);
  console.log(`  upload→completed:    p50 ${pct(latencies, 50)}ms  p95 ${pct(latencies, 95)}ms  p99 ${pct(latencies, 99)}ms`);
  console.log(`  poison → DLQ msgs:   ${dlqCount} (expect ≥1)`);

  const ok = ingestedRows === totalRows && after - before >= ingestedRows && dlqCount >= 1;
  console.log(`\n  correctness: ${ok ? 'PASS' : 'FAIL'}`);
  await prisma.$disconnect();
  process.exit(ok ? 0 : 1);
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
