import { FastifyPluginAsync } from 'fastify';
import { prisma } from '../../services/database.js';
import { signAccessToken } from '../../lib/jwt.js';
import { AppError } from '../../lib/errors.js';
import { logger } from '../../lib/logger.js';
import { auditService } from '../../services/audit.service.js';

const impersonateLogger = logger.module('admin.impersonate');

export const adminImpersonateRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * POST /admin/impersonate/:userId
   * Admin-only: generate an access token to view the platform as another user.
   */
  fastify.post<{ Params: { userId: string } }>('/:userId', async (request) => {
    if (request.user!.role !== 'admin') {
      throw new AppError('Only admins can impersonate users', { code: 'FORBIDDEN', statusCode: 403 });
    }

    const targetId = request.params.userId;

    if (targetId === request.user!.id) {
      throw new AppError('Cannot impersonate yourself', { code: 'SELF_ACTION', statusCode: 400 });
    }

    const target = await prisma.user.findUnique({
      where: { id: targetId },
      select: { id: true, minecraftUsername: true, authProvider: true, role: true },
    });

    if (!target) {
      throw new AppError('User not found', { code: 'USER_NOT_FOUND', statusCode: 404 });
    }

    if (target.role === 'admin') {
      throw new AppError('Cannot impersonate another admin', { code: 'HIERARCHY_VIOLATION', statusCode: 403 });
    }

    const accessToken = signAccessToken({
      sub: target.id,
      username: target.minecraftUsername || 'unknown',
      authProvider: target.authProvider,
      impersonatedBy: request.user!.id,
    });

    await auditService.log({
      actorId: request.user!.id,
      action: 'user.impersonate',
      targetType: 'user',
      targetId: target.id,
      details: { targetUsername: target.minecraftUsername },
    });

    impersonateLogger.warn('impersonate', 'Admin started impersonation', {
      adminId: request.user!.id,
      targetId: target.id,
      targetUsername: target.minecraftUsername,
    });

    return {
      success: true,
      data: {
        accessToken,
        user: {
          id: target.id,
          username: target.minecraftUsername,
          role: target.role,
        },
      },
    };
  });
};
