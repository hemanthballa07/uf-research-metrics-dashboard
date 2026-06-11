import type { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import {
  AppError,
  createErrorResponse,
  ValidationError,
  NotFoundError,
  DatabaseError,
} from '@uf-research-metrics-platform/shared';
import logger from '../lib/logger.js';

export function errorHandler(
  err: Error | AppError,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Log error for debugging
  logger.error({ err: err, path: req.path, method: req.method }, err.message);

  // Handle Prisma errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    const dbError = new DatabaseError(
      'Database operation failed',
      err
    );
    res.status(dbError.statusCode).json(createErrorResponse(dbError));
    return;
  }

  if (err instanceof Prisma.PrismaClientValidationError) {
    const validationError = new ValidationError('Invalid database query');
    res.status(validationError.statusCode).json(createErrorResponse(validationError));
    return;
  }

  // Handle known error types
  if (err instanceof ValidationError) {
    res.status(err.statusCode).json(createErrorResponse(err));
    return;
  }

  if (err instanceof NotFoundError) {
    res.status(err.statusCode).json(createErrorResponse(err));
    return;
  }

  if (err instanceof DatabaseError) {
    res.status(err.statusCode).json(createErrorResponse(err));
    return;
  }

  if (err instanceof AppError) {
    res.status(err.statusCode).json(createErrorResponse(err));
    return;
  }

  // Handle unknown errors
  const isDevelopment = process.env.NODE_ENV === 'development';
  res.status(500).json(
    createErrorResponse(err, isDevelopment)
  );
}

