// B15 contract-test harness: loads the published spec, builds a response-validating
// app, seeds fixtures, and declares the route table that drives the contract suite.
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createApp } from '../../app.js';
import { getTestPrismaClient } from '../setup.js';

const SPEC_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../../packages/shared/dist/openapi.json',
);

export interface OpenApiSpec {
  paths: Record<string, Record<string, { responses: Record<string, unknown> }>>;
  components: { schemas: Record<string, unknown> };
}

export const spec = JSON.parse(readFileSync(SPEC_PATH, 'utf8')) as OpenApiSpec;

/** App with OpenAPI response validation turned on (the contract assertion engine). */
export function buildValidatedApp() {
  return createApp({ validateResponses: true });
}

// ── Fixtures ────────────────────────────────────────────────────────────────
const prisma = getTestPrismaClient();

export interface Fixtures {
  grantId: number;
  roleTargetUserId: number;
  revokeTargetUserId: number;
  deleteTargetUserId: number;
}

export async function seedContractFixtures(): Promise<Fixtures> {
  const stamp = Date.now();
  const dept = await prisma.department.create({ data: { name: `Contract Dept ${stamp}` } });
  const faculty = await prisma.faculty.create({
    data: { name: 'Dr. Contract', email: `contract.${stamp}@ufl.edu`, departmentId: dept.id },
  });
  const sponsor = await prisma.sponsor.create({
    data: { name: `Contract Sponsor ${stamp}`, sponsorType: 'FEDERAL' },
  });
  const grant = await prisma.grant.create({
    data: {
      title: 'Contract Grant',
      sponsorId: sponsor.id,
      piId: faculty.id,
      departmentId: dept.id,
      amount: 250000,
      status: 'AWARDED',
      submittedAt: new Date(stamp - 60 * 864e5),
      awardedAt: new Date(stamp - 30 * 864e5),
      endAt: new Date(stamp + 20 * 864e5), // within the 0-30 day expiry bucket
    },
  });

  const disposable = (suffix: string) =>
    prisma.user.create({
      data: {
        email: `disposable-${suffix}-${stamp}@ufl.edu`,
        name: `Disposable ${suffix}`,
        passwordHash: 'x',
        role: 'VIEWER',
      },
    });

  const roleTarget = await disposable('role');
  const revokeTarget = await disposable('revoke');
  const deleteTarget = await disposable('delete');

  return {
    grantId: grant.id,
    roleTargetUserId: roleTarget.id,
    revokeTargetUserId: revokeTarget.id,
    deleteTargetUserId: deleteTarget.id,
  };
}

/** Remove the throwaway users this suite creates (cleanupTestDatabase keeps users). */
export async function cleanupContractUsers(): Promise<void> {
  await prisma.user.deleteMany({
    where: { OR: [{ email: { contains: 'disposable-' } }, { email: { contains: 'created-' } }] },
  });
}

// ── Route table ──────────────────────────────────────────────────────────────
export interface RouteCase {
  name: string;
  method: 'get' | 'post' | 'patch' | 'delete';
  url: (f: Fixtures) => string;
  auth: 'admin' | 'viewer' | 'none' | 'freshAdmin';
  body?: (f: Fixtures) => unknown;
  contentType?: string;
  expectStatus: number;
  expectContentType?: string;
}

const RECONCILE_CSV =
  'grant_number,title,sponsor_name,sponsor_type,pi_name,pi_email,department_name,amount,status\n' +
  'UF-999,New Grant,New Sponsor,FEDERAL,Jane Doe,jane.doe@ufl.edu,New Dept,123000,AWARDED';

export const routeTable: RouteCase[] = [
  { name: 'health', method: 'get', url: () => '/api/health', auth: 'none', expectStatus: 200 },
  {
    name: 'prometheus metrics',
    method: 'get',
    url: () => '/metrics',
    auth: 'none',
    expectStatus: 200,
    expectContentType: 'text/plain',
  },
  {
    name: 'login',
    method: 'post',
    url: () => '/api/auth/login',
    auth: 'none',
    body: () => ({ email: 'test-admin@ufl.edu', password: 'testpassword' }),
    expectStatus: 200,
  },
  { name: 'auth me', method: 'get', url: () => '/api/auth/me', auth: 'admin', expectStatus: 200 },
  {
    name: 'logout',
    method: 'post',
    url: () => '/api/auth/logout',
    auth: 'freshAdmin',
    expectStatus: 200,
  },
  { name: 'list users', method: 'get', url: () => '/api/users', auth: 'admin', expectStatus: 200 },
  {
    name: 'create user',
    method: 'post',
    url: () => '/api/users',
    auth: 'admin',
    body: () => ({
      email: `created-${Date.now()}@ufl.edu`,
      name: 'Created User',
      password: 'password123',
      role: 'VIEWER',
    }),
    expectStatus: 201,
  },
  {
    name: 'metrics summary',
    method: 'get',
    url: () => '/api/metrics/summary',
    auth: 'admin',
    expectStatus: 200,
  },
  {
    name: 'status breakdown',
    method: 'get',
    url: () => '/api/metrics/status-breakdown',
    auth: 'admin',
    expectStatus: 200,
  },
  {
    name: 'timeseries',
    method: 'get',
    url: () => '/api/metrics/timeseries',
    auth: 'admin',
    expectStatus: 200,
  },
  {
    name: 'awards by sponsor type',
    method: 'get',
    url: () => '/api/metrics/awards-by-sponsor-type',
    auth: 'admin',
    expectStatus: 200,
  },
  { name: 'insights', method: 'get', url: () => '/api/insights', auth: 'admin', expectStatus: 200 },
  { name: 'grants list', method: 'get', url: () => '/api/grants', auth: 'admin', expectStatus: 200 },
  {
    name: 'grants export csv',
    method: 'get',
    url: () => '/api/grants/export',
    auth: 'admin',
    expectStatus: 200,
    expectContentType: 'text/csv',
  },
  {
    name: 'grants expiring',
    method: 'get',
    url: () => '/api/grants/expiring',
    auth: 'admin',
    expectStatus: 200,
  },
  {
    name: 'grant by id',
    method: 'get',
    url: (f) => `/api/grants/${f.grantId}`,
    auth: 'admin',
    expectStatus: 200,
  },
  {
    name: 'similar grants',
    method: 'get',
    url: (f) => `/api/grants/${f.grantId}/similar`,
    auth: 'admin',
    expectStatus: 200,
  },
  {
    name: 'faculty leaderboard',
    method: 'get',
    url: () => '/api/faculty/leaderboard',
    auth: 'admin',
    expectStatus: 200,
  },
  {
    name: 'departments',
    method: 'get',
    url: () => '/api/departments',
    auth: 'admin',
    expectStatus: 200,
  },
  { name: 'sponsors', method: 'get', url: () => '/api/sponsors', auth: 'admin', expectStatus: 200 },
  {
    name: 'ask (rag disabled)',
    method: 'post',
    url: () => '/api/ask',
    auth: 'admin',
    body: () => ({ question: 'How many federal grants were awarded?' }),
    expectStatus: 503,
  },
  {
    name: 'reconcile',
    method: 'post',
    url: () => '/api/reconcile',
    auth: 'admin',
    contentType: 'text/plain',
    body: () => RECONCILE_CSV,
    expectStatus: 200,
  },
  {
    name: 'ingest forbidden (viewer)',
    method: 'post',
    url: () => '/api/ingest/grants',
    auth: 'viewer',
    contentType: 'text/plain',
    body: () => 'title\nX',
    expectStatus: 403,
  },
  {
    name: 'update user role',
    method: 'patch',
    url: (f) => `/api/users/${f.roleTargetUserId}/role`,
    auth: 'admin',
    body: () => ({ role: 'VIEWER' }),
    expectStatus: 200,
  },
  {
    name: 'revoke user sessions',
    method: 'post',
    url: (f) => `/api/users/${f.revokeTargetUserId}/revoke-sessions`,
    auth: 'admin',
    expectStatus: 200,
  },
  {
    name: 'delete user',
    method: 'delete',
    url: (f) => `/api/users/${f.deleteTargetUserId}`,
    auth: 'admin',
    expectStatus: 204,
  },
];
