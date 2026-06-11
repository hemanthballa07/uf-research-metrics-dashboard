import type { Request, Response } from 'express';
import { z } from 'zod';
import { ValidationError } from '@uf-research-metrics-platform/shared';
import {
  listUsers,
  createUser,
  updateUserRole,
  deleteUser,
} from '../services/userService.js';
import { revokeUserSessions } from '../services/tokenRevocationService.js';

const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(255),
  password: z.string().min(8),
  role: z.enum(['ADMIN', 'VIEWER']),
});

const updateRoleSchema = z.object({
  role: z.enum(['ADMIN', 'VIEWER']),
});

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

function parseOrThrow<S extends z.ZodType>(schema: S, body: unknown): z.infer<S> {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const fields: Record<string, string[]> = {};
    parsed.error.errors.forEach((err) => {
      const path = err.path.join('.') || 'body';
      if (!fields[path]) fields[path] = [];
      fields[path].push(err.message);
    });
    throw new ValidationError('Invalid request body', fields);
  }
  return parsed.data;
}

export async function listUsersHandler(req: Request, res: Response): Promise<void> {
  const { page, pageSize } = parseOrThrow(listQuerySchema, req.query);
  const result = await listUsers(page, pageSize);
  res.status(200).json(result);
}

export async function createUserHandler(req: Request, res: Response): Promise<void> {
  const data = parseOrThrow(createUserSchema, req.body);
  const actorId = req.user!.userId;
  const user = await createUser(data, actorId);
  res.status(201).json(user);
}

export async function updateUserRoleHandler(req: Request, res: Response): Promise<void> {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    throw new ValidationError('Invalid user id');
  }
  const { role } = parseOrThrow(updateRoleSchema, req.body);
  const requesterId = req.user!.userId;
  const user = await updateUserRole(id, role, requesterId);
  res.status(200).json(user);
}

export async function deleteUserHandler(req: Request, res: Response): Promise<void> {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    throw new ValidationError('Invalid user id');
  }
  const requesterId = req.user!.userId;
  await deleteUser(id, requesterId);
  res.status(204).send();
}

export async function revokeUserSessionsHandler(req: Request, res: Response): Promise<void> {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    throw new ValidationError('Invalid user id');
  }
  await revokeUserSessions(id);
  res.status(200).json({ message: 'All active sessions revoked' });
}
