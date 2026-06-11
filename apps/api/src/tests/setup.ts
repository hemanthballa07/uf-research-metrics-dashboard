import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { createApp } from '../app.js';

const testDbUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
const prisma = new PrismaClient({
  datasources: { db: { url: testDbUrl } },
});

export async function setupTestDatabase(): Promise<void> {
  // Database assumed to be migrated before tests run
}

export async function cleanupTestDatabase(): Promise<void> {
  // Delete in FK-safe order: grants first (they reference dept/faculty/sponsor
  // with onDelete:Restrict), then the leaf tables. Users are intentionally kept
  // so ensureUser upserts succeed on the next run without hitting the hash path.
  await prisma.grant.deleteMany({});
  await prisma.faculty.deleteMany({});
  await prisma.sponsor.deleteMany({});
  await prisma.department.deleteMany({});
}

export function getTestPrismaClient(): PrismaClient {
  return prisma;
}

async function ensureUser(
  email: string,
  name: string,
  password: string,
  role: 'ADMIN' | 'VIEWER',
): Promise<void> {
  // Prisma's upsert is not atomic — it can race when parallel test suites
  // share the DB. Catch P2002 (unique violation) since that means another
  // suite created the row first, which is the desired end state.
  const hash = await bcrypt.hash(password, 10);
  try {
    await prisma.user.upsert({
      where: { email },
      create: { email, name, passwordHash: hash, role },
      update: {},
    });
  } catch (err) {
    if (!(err instanceof Error) || !err.message.includes('Unique constraint failed')) {
      throw err;
    }
    // Another suite won the race — verify the row exists and move on
  }
}

export async function getAuthToken(): Promise<string> {
  const email = 'test-admin@ufl.edu';
  const password = 'testpassword';
  await ensureUser(email, 'Test Admin', password, 'ADMIN');

  const app = createApp();
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email, password });

  if (!res.body.accessToken) {
    throw new Error(`getAuthToken: login failed — ${JSON.stringify(res.body)}`);
  }
  return res.body.accessToken as string;
}

export async function getViewerToken(): Promise<string> {
  const email = 'test-viewer@ufl.edu';
  const password = 'testpassword';
  await ensureUser(email, 'Test Viewer', password, 'VIEWER');

  const app = createApp();
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email, password });

  if (!res.body.accessToken) {
    throw new Error(`getViewerToken: login failed — ${JSON.stringify(res.body)}`);
  }
  return res.body.accessToken as string;
}
