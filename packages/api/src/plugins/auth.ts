import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import { verifyAccessToken, TokenExpiredError, InvalidTokenError } from '../lib/jwt.js';
import { logger } from '../lib/logger.js';
import { AppError } from '../lib/errors.js';

const authLogger = logger.module('auth.middleware');

/**
 * User context attached to authenticated requests
 */
export interface AuthUser {
  id: string;
  username: string;
  authProvider: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthUser;
  }
}

/**
 * Extract Bearer token from Authorization header
 */
function extractBearerToken(request: FastifyRequest): string | null {
  const authHeader = request.headers.authorization;
  if (!authHeader) {
    return null;
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0]?.toLowerCase() !== 'bearer') {
    return null;
  }

  return parts[1] || null;
}

/**
 * Auth plugin - adds authentication decorator
 */
const authPluginCallback: FastifyPluginAsync = async (fastify) => {
  /**
   * Decorator to require authentication on a route
   */
  fastify.decorate('authenticate', async (request: FastifyRequest, _reply: FastifyReply) => {
    const token = extractBearerToken(request);

    if (!token) {
      authLogger.debug('authenticate.noToken', 'No bearer token provided', {
        path: request.url,
        method: request.method,
      });

      throw new AppError('Authentication required', {
        code: 'UNAUTHORIZED',
        statusCode: 401,
      });
    }

    try {
      const payload = verifyAccessToken(token);

      request.user = {
        id: payload.sub,
        username: payload.username,
        authProvider: payload.authProvider,
      };

      authLogger.debug('authenticate.success', 'Request authenticated', {
        userId: payload.sub,
        username: payload.username,
        path: request.url,
      });
    } catch (error) {
      if (error instanceof TokenExpiredError) {
        authLogger.debug('authenticate.expired', 'Access token expired', {
          path: request.url,
        });

        throw new AppError('Access token has expired', {
          code: 'TOKEN_EXPIRED',
          statusCode: 401,
        });
      }

      if (error instanceof InvalidTokenError) {
        authLogger.warn('authenticate.invalid', 'Invalid access token', {
          path: request.url,
        });

        throw new AppError('Invalid access token', {
          code: 'INVALID_TOKEN',
          statusCode: 401,
        });
      }

      throw error;
    }
  });
};

export const authPlugin = fp(authPluginCallback, {
  name: 'auth',
});

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}
