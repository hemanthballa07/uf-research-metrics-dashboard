// Fire-and-forget audit logger — never throws or crashes the caller
export const AuditAction = {
  USER_CREATED: 'USER_CREATED',
  ROLE_CHANGED: 'ROLE_CHANGED',
  USER_DELETED: 'USER_DELETED',
  PASSWORD_CHANGED: 'PASSWORD_CHANGED',
  GRANT_INGESTED: 'GRANT_INGESTED',
} as const;

export type AuditActionType = typeof AuditAction[keyof typeof AuditAction];

import { Prisma } from '@prisma/client';
import { prisma } from '@uf-research-metrics-platform/db';
import logger from '../lib/logger.js';

export async function logAudit(
  action: AuditActionType,
  targetType: string,
  targetId: string,
  actorId: number,
  metadata?: Record<string, unknown>,
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: { action, targetType, targetId, actorId, metadata: metadata as Prisma.InputJsonValue },
    });
  } catch (err) {
    logger.error({ err, action, targetType, targetId }, 'auditLog write failed');
  }
}
