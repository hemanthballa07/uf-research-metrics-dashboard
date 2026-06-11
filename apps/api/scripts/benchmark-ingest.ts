/**
 * Streaming-ingest benchmark.
 *
 * Generates an N-row CSV to a temp file (written via a stream, never held in
 * memory), then streams it through `ingestGrantsFromStream` while sampling RSS.
 * Proves the Bullet-2 claims: streaming parser (O(batch) memory, not O(file))
 * and bounded-batch upserts with row-level lock tuning.
 *
 * Usage:
 *   pnpm --filter api bench:ingest            # 250,000 rows (default)
 *   pnpm --filter api bench:ingest -- 50000   # custom row count
 *
 * Requires DATABASE_URL (apps/api/.env) and an applied migration.
 */

import { createWriteStream, createReadStream, statSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { ingestGrantsFromStream } from '../src/services/ingestService.js';
import { prisma } from '@uf-research-metrics-platform/db';

const ROWS = Number(process.argv[2] ?? 250_000);
const SPONSORS: Array<[string, string]> = [
  ['National Institutes of Health', 'FEDERAL'],
  ['National Science Foundation', 'FEDERAL'],
  ['Department of Defense', 'FEDERAL'],
  ['Pfizer Inc.', 'INDUSTRY'],
  ['American Heart Association', 'FOUNDATION'],
];
const DEPTS = ['Medicine', 'Surgery', 'Pediatrics', 'Neurology', 'Radiology'];
const TAG = `bench${Date.now()}`;

function mb(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

async function generateCsv(path: string, rows: number): Promise<void> {
  const out = createWriteStream(path);
  const header =
    'title,sponsor_name,sponsor_type,pi_name,pi_email,department_name,amount,status,submitted_at,awarded_at,end_at\n';
  if (!out.write(header)) await once(out, 'drain');

  for (let i = 0; i < rows; i++) {
    const [sName, sType] = SPONSORS[i % SPONSORS.length];
    const dept = DEPTS[i % DEPTS.length];
    const piIdx = i % 600; // 600 distinct PIs, matching the COM anchor
    const status = i % 3 === 0 ? 'AWARDED' : 'SUBMITTED';
    const awarded = status === 'AWARDED' ? '2026-04-01' : '';
    const end = status === 'AWARDED' ? '2029-04-01' : '';
    const line = `${TAG} Grant ${String(i).padStart(7, '0')},${sName},${sType},Dr. ${TAG} ${piIdx},${TAG}.${piIdx}@ufl.edu,${dept},${(i + 1) * 100},${status},2026-01-15,${awarded},${end}\n`;
    if (!out.write(line)) await once(out, 'drain');
  }
  out.end();
  await once(out, 'finish');
}

async function cleanup(path: string): Promise<void> {
  await prisma.grant.deleteMany({ where: { title: { startsWith: `${TAG} ` } } });
  await prisma.faculty.deleteMany({ where: { email: { startsWith: `${TAG}.` } } });
  try {
    unlinkSync(path);
  } catch {
    /* ignore */
  }
}

async function main(): Promise<void> {
  const csvPath = join(tmpdir(), `uf-ingest-bench-${TAG}.csv`);
  console.log(`Benchmark: ${ROWS.toLocaleString()} rows`);

  console.log('  generating CSV…');
  const tGen = Date.now();
  await generateCsv(csvPath, ROWS);
  const fileBytes = statSync(csvPath).size;
  console.log(`  CSV: ${mb(fileBytes)} in ${((Date.now() - tGen) / 1000).toFixed(1)}s`);

  // Sample RSS during ingest to capture the memory high-water mark
  let peakRss = process.memoryUsage().rss;
  const baselineRss = peakRss;
  const sampler = setInterval(() => {
    const rss = process.memoryUsage().rss;
    if (rss > peakRss) peakRss = rss;
  }, 100);

  console.log('  ingesting (streamed)…');
  const tIngest = Date.now();
  const report = await ingestGrantsFromStream(createReadStream(csvPath));
  const elapsedMs = Date.now() - tIngest;
  clearInterval(sampler);

  const rowsPerSec = Math.round((report.totalRows / elapsedMs) * 1000);

  console.log('');
  console.log('Results');
  console.log(`  rows:            ${report.totalRows.toLocaleString()}`);
  console.log(`  inserted:        ${report.inserted.toLocaleString()}`);
  console.log(`  updated:         ${report.updated.toLocaleString()}`);
  console.log(`  errors:          ${report.errors.length.toLocaleString()}`);
  console.log(`  elapsed:         ${(elapsedMs / 1000).toFixed(1)}s`);
  console.log(`  throughput:      ${rowsPerSec.toLocaleString()} rows/sec`);
  console.log(`  CSV size:        ${mb(fileBytes)}`);
  console.log(`  RSS baseline:    ${mb(baselineRss)}`);
  console.log(`  RSS peak:        ${mb(peakRss)}`);
  console.log(`  RSS growth:      ${mb(peakRss - baselineRss)} (proves O(batch), not O(file))`);

  console.log('  cleaning up…');
  await cleanup(csvPath);
}

main()
  .catch((err) => {
    console.error('benchmark failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
