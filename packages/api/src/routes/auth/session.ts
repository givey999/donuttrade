import { FastifyPluginAsync } from 'fastify';
import { sessionService } from '../../services/auth/session.service.js';
import { userRepository } from '../../repositories/user.repository.js';
import { logger } from '../../lib/logger.js';
import { AppError } from '../../lib/errors.js';

const sessionLogger = logger.module('auth.session.routes');

export const sessionRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /auth/me
   * Get current user info
   */
  fastify.get('/me', {
    preHandler: [fastify.authenticate],
  }, async (request) => {
    const user = await userRepository.findById(request.user!.id);

    if (!user) {
      throw new AppError('User not found', { code: 'USER_NOT_FOUND', statusCode: 404 });
    }

    sessionLogger.debug('me', 'User info requested', {
      userId: user.id,
      username: user.minecraftUsername,
    });

    return {
      success: true,
      data: {
        id: user.id,
        minecraftUsername: user.minecraftUsername,
        authProvider: user.authProvider,
        verificationStatus: user.verificationStatus,
        email: user.email,
        discordUsername: user.discordUsername,
        balance: user.balance,
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt,
      },
    };
  });

  /**
   * POST /auth/refresh
   * Refresh access token using refresh token
   */
  fastify.post<{
    Body: { refreshToken?: string };
  }>('/refresh', async (request) => {
    const refreshToken =
      (request.body as { refreshToken?: string } | null)?.refreshToken
      ?? request.cookies?.['dt_refresh_token'];

    if (!refreshToken) {
      throw new AppError('Refresh token required', {
        code: 'MISSING_REFRESH_TOKEN',
        statusCode: 400,
      });
    }

    const tokens = await sessionService.refreshSession(refreshToken);

    sessionLogger.info('refresh', 'Session refreshed');

    return {
      success: true,
      data: tokens,
    };
  });

  /**
   * POST /auth/logout
   * Logout and revoke current session
   */
  fastify.post<{
    Body: { refreshToken?: string };
  }>('/logout', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const refreshToken =
      (request.body as { refreshToken?: string } | null)?.refreshToken
      ?? request.cookies?.['dt_refresh_token'];

    if (refreshToken) {
      await sessionService.revokeByRefreshToken(refreshToken);
    }

    reply.clearCookie('dt_refresh_token', { path: '/', httpOnly: true, secure: true, sameSite: 'lax' });

    sessionLogger.info('logout', 'User logged out', {
      userId: request.user!.id,
    });

    return {
      success: true,
      message: 'Logged out successfully',
    };
  });

  /**
   * POST /auth/logout-all
   * Logout from all sessions
   */
  fastify.post('/logout-all', {
    preHandler: [fastify.authenticate],
  }, async (request) => {
    const count = await sessionService.revokeAllUserSessions(request.user!.id);

    sessionLogger.info('logoutAll', 'All sessions revoked', {
      userId: request.user!.id,
      count,
    });

    return {
      success: true,
      message: `Logged out from ${count} session(s)`,
      count,
    };
  });
};
