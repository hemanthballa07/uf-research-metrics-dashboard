import type { Request, Response } from 'express';
import { z } from 'zod';
import { login } from '../services/authService.js';
import { changePassword } from '../services/userService.js';
import { blockToken } from '../services/tokenRevocationService.js';
import { ValidationError } from '@uf-research-metrics-platform/shared';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function loginHandler(req: Request, res: Response): Promise<void> {
  const parsed = loginSchema.safeParse(req.body);

  if (!parsed.success) {
    const fields: Record<string, string[]> = {};
    parsed.error.errors.forEach((err) => {
      const path = err.path.join('.') || 'body';
      if (!fields[path]) fields[path] = [];
      fields[path].push(err.message);
    });
    throw new ValidationError('Invalid request body', fields);
  }

  const result = await login(parsed.data.email, parsed.data.password);
  res.status(200).json(result);
}

export async function meHandler(req: Request, res: Response): Promise<void> {
  res.status(200).json({ user: req.user });
}

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

export async function logoutHandler(req: Request, res: Response): Promise<void> {
  const user = req.user!;
  if (user.jti && user.exp) {
    await blockToken(user.jti, user.exp).catch(() => {
      // best-effort — if Redis is down, the token expires naturally in ≤8h
    });
  }
  res.status(200).json({ message: 'Logged out successfully' });
}

export async function changePasswordHandler(req: Request, res: Response): Promise<void> {
  const parsed = changePasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    const fields: Record<string, string[]> = {};
    parsed.error.errors.forEach((err) => {
      const path = err.path.join('.') || 'body';
      if (!fields[path]) fields[path] = [];
      fields[path].push(err.message);
    });
    throw new ValidationError('Invalid request body', fields);
  }

  const userId = req.user!.userId;
  await changePassword(userId, parsed.data.currentPassword, parsed.data.newPassword);
  res.status(200).json({ message: 'Password changed successfully' });
}
