import { PrismaClient } from '@prisma/client';

// Use test database URL if available, otherwise use regular DATABASE_URL
const testDbUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: testDbUrl,
    },
  },
});

// Setup test database
export async function setupTestDatabase(): Promise<void> {
  // For integration tests, we assume the database is already set up
  // In CI, migrations should be run before tests
  // For local development, use TEST_DATABASE_URL or ensure DATABASE_URL points to test DB
}

// Cleanup after tests
export async function cleanupTestDatabase(): Promise<void> {
  await prisma.$disconnect();
}

// Helper to get test Prisma client
export function getTestPrismaClient(): PrismaClient {
  return prisma;
}

