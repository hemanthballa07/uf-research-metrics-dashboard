// Shared error types and contracts

export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code?: string
  ) {
    super(message);
    this.name = 'AppError';
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, public fields?: Record<string, string[]>) {
    super(message, 400, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id?: string | number) {
    super(
      id ? `${resource} with id ${id} not found` : `${resource} not found`,
      404,
      'NOT_FOUND'
    );
    this.name = 'NotFoundError';
    Object.setPrototypeOf(this, NotFoundError.prototype);
  }
}

export class DatabaseError extends AppError {
  constructor(message: string, public originalError?: unknown) {
    super(message, 500, 'DATABASE_ERROR');
    this.name = 'DatabaseError';
    Object.setPrototypeOf(this, DatabaseError.prototype);
  }
}

// Standardized error response shape
export interface ErrorResponse {
  error: {
    message: string;
    code?: string;
    statusCode: number;
    fields?: Record<string, string[]>;
    timestamp: string;
  };
}

export function createErrorResponse(
  error: Error | AppError,
  includeStack = false
): ErrorResponse {
  const isAppError = error instanceof AppError;
  return {
    error: {
      message: error.message,
      code: isAppError ? error.code : 'INTERNAL_ERROR',
      statusCode: isAppError ? error.statusCode : 500,
      fields: error instanceof ValidationError ? error.fields : undefined,
      timestamp: new Date().toISOString(),
      ...(includeStack && { stack: error.stack }),
    },
  };
}

