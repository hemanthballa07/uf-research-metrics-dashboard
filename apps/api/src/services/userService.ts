import bcrypt from 'bcryptjs';
import { prisma } from '@uf-research-metrics-platform/db';
import { AppError, ValidationError, NotFoundError } from '@uf-research-metrics-platform/shared';
import { hashPassword } from './authService.js';
import { logAudit, AuditAction } from './auditService.js';

export interface UserRow {
  id: number;
  email: string;
  name: string;
  role: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaginatedUsers {
  items: UserRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export async function listUsers(page: number, pageSize: number): Promise<PaginatedUsers> {
  const skip = (page - 1) * pageSize;
  const [total, items] = await Promise.all([
    prisma.user.count(),
    prisma.user.findMany({
      skip,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
      select: { id: true, email: true, name: true, role: true, createdAt: true, updatedAt: true },
    }),
  ]);
  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

export async function createUser(
  data: {
    email: string;
    name: string;
    password: string;
    role: string;
  },
  actorId: number,
): Promise<UserRow> {
  const existing = await prisma.user.findUnique({ where: { email: data.email } });
  if (existing) {
    throw new ValidationError('Email already in use', { email: ['Email already in use'] });
  }

  const passwordHash = await hashPassword(data.password);

  const newUser = await prisma.user.create({
    data: {
      email: data.email,
      name: data.name,
      passwordHash,
      role: data.role as 'ADMIN' | 'VIEWER',
    },
    select: { id: true, email: true, name: true, role: true, createdAt: true, updatedAt: true },
  });

  // PII minimization (B13): the user id is in targetId; never store the email in audit metadata.
  void logAudit(AuditAction.USER_CREATED, 'User', String(newUser.id), actorId, { role: data.role });

  return newUser;
}

export async function updateUserRole(
  id: number,
  role: string,
  requesterId: number,
): Promise<UserRow> {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    throw new NotFoundError('User', id);
  }

  const existingRole = user.role;

  // Prevent demoting last admin
  if (role === 'VIEWER' && user.role === 'ADMIN') {
    const adminCount = await prisma.user.count({ where: { role: 'ADMIN' } });
    if (adminCount <= 1) {
      throw new AppError('Cannot demote the last admin', 400, 'LAST_ADMIN');
    }
  }

  const updated = await prisma.user.update({
    where: { id },
    data: { role: role as 'ADMIN' | 'VIEWER' },
    select: { id: true, email: true, name: true, role: true, createdAt: true, updatedAt: true },
  });

  void logAudit(AuditAction.ROLE_CHANGED, 'User', String(id), requesterId, { from: existingRole, to: role });

  return updated;
}

export async function deleteUser(id: number, requesterId: number): Promise<void> {
  if (id === requesterId) {
    throw new AppError('Cannot delete your own account', 400, 'SELF_DELETE');
  }

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    throw new NotFoundError('User', id);
  }

  await prisma.user.delete({ where: { id } });

  // PII minimization (B13): record only the deleted user's id (in targetId), not the email.
  void logAudit(AuditAction.USER_DELETED, 'User', String(id), requesterId);
}

export async function changePassword(
  userId: number,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new NotFoundError('User', userId);
  }

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) {
    throw new AppError('Current password is incorrect', 401, 'INVALID_PASSWORD');
  }

  const passwordHash = await hashPassword(newPassword);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });

  void logAudit(AuditAction.PASSWORD_CHANGED, 'User', String(userId), userId, {});
}
