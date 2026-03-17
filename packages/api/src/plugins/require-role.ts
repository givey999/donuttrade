import { FastifyRequest } from 'fastify';
import { prisma } from '../services/database.js';
import { AppError } from '../lib/errors.js';

/**
 * Creates a preHandler that enforces role-based access.
 * Performs a fresh DB lookup each time (not cached from JWT) to ensure
 * role changes take effect immediately.
 */
export function requireRole(...allowedRoles: string[]) {
  return async (request: FastifyRequest) => {
    if (!request.user) {
      throw new AppError('Authentication required', {
        code: 'UNAUTHORIZED',
        statusCode: 401,
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: request.user.id },
      select: { role: true },
    });

    if (!user || !allowedRoles.includes(user.role)) {
      throw new AppError('Insufficient permissions', {
        code: 'FORBIDDEN',
        statusCode: 403,
      });
    }

    // Update request.user.role with the fresh DB value
    request.user.role = user.role;
  };
}
