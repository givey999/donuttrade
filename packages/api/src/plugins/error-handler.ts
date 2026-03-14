import { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import { normalizeError, isOperationalError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import { isDevelopment } from '../config/index.js';
import type { ApiResponse } from '@donuttrade/shared';

/**
 * Global error handler plugin
 */
const errorHandlerPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.setErrorHandler((error, request, reply) => {
    // Normalize to AppError
    const appError = normalizeError(error);

    // Log the error
    if (isOperationalError(appError)) {
      // Operational errors are expected, log at warn level
      logger.warn(
        {
          module: 'http',
          action: 'error.handled',
          metadata: {
            code: appError.code,
            statusCode: appError.statusCode,
            path: request.url,
            method: request.method,
          },
        },
        appError.message
      );
    } else {
      // Unexpected errors, log at error level with stack
      logger.error(
        {
          module: 'http',
          action: 'error.unhandled',
          error: appError,
          metadata: {
            code: appError.code,
            statusCode: appError.statusCode,
            path: request.url,
            method: request.method,
          },
        },
        appError.message
      );
    }

    // Build response
    // Always send details for operational errors (cooldowns, validation, etc.)
    // Only suppress details for unexpected errors in production (may contain internals)
    const includeDetails = appError.details && (isOperationalError(appError) || isDevelopment);
    const response: ApiResponse = {
      success: false,
      error: {
        code: appError.code,
        message: appError.message,
        ...(includeDetails && { details: appError.details }),
      },
    };

    return reply.status(appError.statusCode).send(response);
  });

  // Handle 404
  fastify.setNotFoundHandler((request, reply) => {
    const response: ApiResponse = {
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: `Route ${request.method} ${request.url} not found`,
      },
    };

    return reply.status(404).send(response);
  });
};

export default fp(errorHandlerPlugin, {
  name: 'error-handler',
});
