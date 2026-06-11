import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '@uf-research-metrics-platform/db';
import { ValidationError } from '@uf-research-metrics-platform/shared';

if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET must be set in production');
}
const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-secret-change-in-production';
const JWT_EXPIRES_IN = '8h';

export interface TokenPayload {
  userId: number;
  email: string;
  role: string;
  departmentId: number | null;
  jti: string;
}

export interface LoginResult {
  accessToken: string;
  expiresIn: string;
  user: { id: number; email: string; name: string; role: string; departmentId: number | null };
}

export async function login(email: string, password: string): Promise<LoginResult> {
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    throw new ValidationError('Invalid email or password');
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    throw new ValidationError('Invalid email or password');
  }

  const payload: TokenPayload = {
    userId: user.id,
    email: user.email,
    role: user.role,
    departmentId: user.departmentId,
    jti: randomUUID(),
  };
  const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

  return {
    accessToken,
    expiresIn: JWT_EXPIRES_IN,
    user: { id: user.id, email: user.email, name: user.name, role: user.role, departmentId: user.departmentId },
  };
}

export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, JWT_SECRET) as TokenPayload;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}
