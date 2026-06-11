import { getRedisClient } from '../lib/cache.js';

const BLOCKLIST_PREFIX = 'auth:blocklist:';
const REVOKE_EPOCH_PREFIX = 'auth:revoked_before:';

/**
 * Add a single token's JTI to the blocklist. TTL is set to the remaining
 * lifetime of the token so the key auto-expires rather than accumulating.
 */
export async function blockToken(jti: string, exp: number): Promise<void> {
  const ttl = exp - Math.floor(Date.now() / 1000);
  if (ttl <= 0) return;
  await getRedisClient().set(`${BLOCKLIST_PREFIX}${jti}`, '1', 'EX', ttl);
}

/**
 * Returns true if the JTI is on the blocklist (i.e. the token was explicitly
 * revoked via logout). Fails open (returns false) on Redis unavailability so
 * a cache outage doesn't lock everyone out.
 */
export async function isTokenBlocked(jti: string): Promise<boolean> {
  try {
    const val = await getRedisClient().get(`${BLOCKLIST_PREFIX}${jti}`);
    return val !== null;
  } catch {
    return false;
  }
}

/**
 * Record the current timestamp as the revocation epoch for a user. Any token
 * issued (iat) before this epoch is treated as revoked. TTL = 8 h (the access
 * token max lifetime), after which only the JTI blocklist is consulted.
 * Used for immediate deprovisioning by admins.
 */
export async function revokeUserSessions(userId: number): Promise<void> {
  const epoch = Math.floor(Date.now() / 1000);
  await getRedisClient().set(`${REVOKE_EPOCH_PREFIX}${userId}`, String(epoch), 'EX', 8 * 3600);
}

/**
 * Returns the revocation epoch for a user, or null if none has been set.
 * Fails open (returns null) on Redis unavailability.
 */
export async function getUserRevocationEpoch(userId: number): Promise<number | null> {
  try {
    const val = await getRedisClient().get(`${REVOKE_EPOCH_PREFIX}${userId}`);
    return val ? parseInt(val, 10) : null;
  } catch {
    return null;
  }
}
