import Redis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

let redisClient: Redis | null = null;

export function getRedisClient(): Redis {
  if (!redisClient) {
    redisClient = new Redis(REDIS_URL, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
    });

    redisClient.on('error', (err) => {
      // Log but don't crash — cache is best-effort
      console.error('[cache] Redis error:', err.message);
    });
  }
  return redisClient;
}

/**
 * Eagerly opens the lazy Redis connection at process startup so the first
 * health check / cache op doesn't fail the cold-start race (lazyConnect +
 * enableOfflineQueue:false rejects the first command before the socket is up).
 * Best-effort: a connection failure is logged by the error handler, not thrown.
 */
export function warmRedis(): void {
  const client = getRedisClient();
  if (client.status === 'wait') {
    client.connect().catch(() => {
      /* best-effort — error handler already logs; cache stays optional */
    });
  }
}

export async function cacheGet(key: string): Promise<unknown | null> {
  try {
    const value = await getRedisClient().get(key);
    return value ? (JSON.parse(value) as unknown) : null;
  } catch {
    return null;
  }
}

export async function cacheSet(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  try {
    await getRedisClient().set(key, JSON.stringify(value), 'EX', ttlSeconds);
  } catch {
    // best-effort — miss silently
  }
}

export async function cacheDel(...keys: string[]): Promise<void> {
  try {
    if (keys.length > 0) await getRedisClient().del(...keys);
  } catch {
    // best-effort
  }
}

export async function cacheDelPattern(pattern: string): Promise<void> {
  try {
    const client = getRedisClient();
    let cursor = '0';
    const keysToDelete: string[] = [];
    // SCAN is non-blocking unlike KEYS; safe for production key counts
    do {
      const [nextCursor, keys] = await client.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = nextCursor;
      keysToDelete.push(...keys);
    } while (cursor !== '0');
    if (keysToDelete.length > 0) await client.del(...keysToDelete);
  } catch {
    // best-effort
  }
}
