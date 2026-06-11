import 'dotenv/config';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Redis from 'ioredis';
import pino from 'pino';
import type { Consumer } from 'kafkajs';
import { prisma } from '@uf-research-metrics-platform/db';
import {
  getProducer,
  createConsumer,
  disconnectProducer,
  createJob,
  getJob,
  grantBatchReceivedSchema,
  TOPICS,
  type GrantBatchReceived,
} from '@uf-research-metrics-platform/events';
import { handleBatch } from '../src/handler.js';

// True produce → consume → upsert → job-completion round-trip against a real
// broker. Unique names keep the run isolated and self-cleaning.
const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';
const log = pino({ level: 'silent' });
const redis = new Redis(REDIS_URL, { maxRetriesPerRequest: null });

const unique = Date.now();
const JOB_ID = `it-${unique}`;
const TITLE = `IT Round-trip Grant ${unique}`;
const SPONSOR = `IT Sponsor ${unique}`;
const DEPT = `IT Dept ${unique}`;
const PI_NAME = `IT PI ${unique}`;
const PI_EMAIL = `it-roundtrip-${unique}@university.edu`;

let consumer: Consumer;

beforeAll(async () => {
  consumer = createConsumer(`it-roundtrip-${unique}`);
  await consumer.connect();
  // Unique group + fromBeginning avoids the join/rebalance race; the handler
  // only acts on our job, so replayed history is ignored.
  await consumer.subscribe({ topic: TOPICS.GRANT_BATCH_RECEIVED, fromBeginning: true });
  await consumer.run({
    eachMessage: async ({ message }) => {
      const env = grantBatchReceivedSchema.parse(JSON.parse(message.value!.toString()));
      if (env.jobId !== JOB_ID) return;
      await handleBatch(env, { redis, log, maxAttempts: 3 });
    },
  });
});

afterAll(async () => {
  await consumer?.disconnect().catch(() => undefined);
  await disconnectProducer().catch(() => undefined);
  await prisma.grant.deleteMany({ where: { title: TITLE } });
  await prisma.faculty.deleteMany({ where: { email: PI_EMAIL } });
  await prisma.sponsor.deleteMany({ where: { name: SPONSOR } });
  await prisma.department.deleteMany({ where: { name: DEPT } });
  await redis.del(`ingest:job:${JOB_ID}`).catch(() => undefined);
  await redis.quit().catch(() => undefined);
  await prisma.$disconnect();
});

describe('Kafka round-trip: grant.batch.received → worker handler', () => {
  it('upserts the row and marks the job completed', async () => {
    const env: GrantBatchReceived = {
      jobId: JOB_ID,
      batchIndex: 0,
      totalBatches: 1,
      rows: [
        {
          title: TITLE,
          sponsor_name: SPONSOR,
          sponsor_type: 'FEDERAL',
          pi_name: PI_NAME,
          pi_email: PI_EMAIL,
          department_name: DEPT,
          amount: 123456,
          status: 'AWARDED',
          submitted_at: new Date('2025-01-01'),
          awarded_at: new Date('2025-03-01'),
          end_at: new Date('2026-09-01'),
        },
      ],
    };

    await createJob(redis, { jobId: JOB_ID, totalRows: 1, totalBatches: 1 });

    const producer = await getProducer();
    await producer.send({
      topic: TOPICS.GRANT_BATCH_RECEIVED,
      messages: [{ key: JOB_ID, value: JSON.stringify(env) }],
    });

    const deadline = Date.now() + 20000;
    let job = await getJob(redis, JOB_ID);
    while ((!job || job.status !== 'completed') && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 500));
      job = await getJob(redis, JOB_ID);
    }

    expect(job?.status).toBe('completed');
    expect((job?.inserted ?? 0) + (job?.updated ?? 0)).toBe(1);

    const grant = await prisma.grant.findFirst({ where: { title: TITLE } });
    expect(grant).not.toBeNull();
    expect(Number(grant?.amount)).toBe(123456);
  });
});
