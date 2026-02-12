/**
 * Base application error
 */
export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly details?: Record<string, unknown>;

  constructor(
    message: string,
    options: {
      code: string;
      statusCode?: number;
      isOperational?: boolean;
      details?: Record<string, unknown>;
    }
  ) {
    super(message);
    this.name = 'AppError';
    this.code = options.code;
    this.statusCode = options.statusCode ?? 500;
    this.isOperational = options.isOperational ?? true;
    this.details = options.details;

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Validation error (400)
 */
export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, {
      code: 'VALIDATION_ERROR',
      statusCode: 400,
      details,
    });
    this.name = 'ValidationError';
  }
}

/**
 * Authentication error (401)
 */
export class AuthenticationError extends AppError {
  constructor(message = 'Authentication required') {
    super(message, {
      code: 'AUTHENTICATION_REQUIRED',
      statusCode: 401,
    });
    this.name = 'AuthenticationError';
  }
}

/**
 * Authorization error (403)
 */
export class ForbiddenError extends AppError {
  constructor(message = 'Access denied') {
    super(message, {
      code: 'FORBIDDEN',
      statusCode: 403,
    });
    this.name = 'ForbiddenError';
  }
}

/**
 * Not found error (404)
 */
export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource} not found`, {
      code: 'NOT_FOUND',
      statusCode: 404,
      details: { resource },
    });
    this.name = 'NotFoundError';
  }
}

/**
 * Conflict error (409)
 */
export class ConflictError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, {
      code: 'CONFLICT',
      statusCode: 409,
      details,
    });
    this.name = 'ConflictError';
  }
}

/**
 * Rate limit error (429)
 */
export class RateLimitError extends AppError {
  public readonly retryAfter: number;

  constructor(retryAfter: number) {
    super('Too many requests', {
      code: 'RATE_LIMIT_EXCEEDED',
      statusCode: 429,
      details: { retryAfter },
    });
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
  }
}

/**
 * External service error (502)
 */
export class ExternalServiceError extends AppError {
  constructor(service: string, details?: Record<string, unknown>) {
    super(`External service error: ${service}`, {
      code: 'EXTERNAL_SERVICE_ERROR',
      statusCode: 502,
      details: { service, ...details },
    });
    this.name = 'ExternalServiceError';
  }
}

/**
 * Internal server error (500)
 */
export class InternalError extends AppError {
  constructor(message = 'Internal server error') {
    super(message, {
      code: 'INTERNAL_ERROR',
      statusCode: 500,
      isOperational: false,
    });
    this.name = 'InternalError';
  }
}

/**
 * OAuth error (400)
 */
export class OAuthError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, {
      code: 'OAUTH_ERROR',
      statusCode: 400,
      details,
    });
    this.name = 'OAuthError';
  }
}

/**
 * Invalid state error (400)
 */
export class InvalidStateError extends AppError {
  constructor(message = 'Invalid or expired state parameter') {
    super(message, {
      code: 'INVALID_STATE',
      statusCode: 400,
    });
    this.name = 'InvalidStateError';
  }
}

/**
 * OAuth token error (400/502)
 */
export class OAuthTokenError extends AppError {
  constructor(message: string, statusCode = 400, details?: Record<string, unknown>) {
    super(message, {
      code: 'OAUTH_TOKEN_ERROR',
      statusCode,
      details,
    });
    this.name = 'OAuthTokenError';
  }
}

/**
 * Check if an error is an operational error (expected, handled)
 */
export function isOperationalError(error: Error): boolean {
  if (error instanceof AppError) {
    return error.isOperational;
  }
  return false;
}

/**
 * Convert any error to AppError format
 */
export function normalizeError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error;
  }

  if (error instanceof Error) {
    return new InternalError(error.message);
  }

  return new InternalError(String(error));
}
