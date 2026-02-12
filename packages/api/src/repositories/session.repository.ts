import { prisma } from '../services/database.js';
import { logger } from '../lib/logger.js';
import type { CreateSessionInput } from '@donuttrade/shared';

const sessionLogger = logger.module('session.repository');

/**
 * Session repository for database operations
 */
export const sessionRepository = {
  /**
   * Find session by ID
   */
  async findById(id: string) {
    const startTime = Date.now();

    try {
      const session = await prisma.session.findUnique({
        where: { id },
        include: { user: true },
      });

      sessionLogger.debug('findById', 'Session lookup by ID', {
        id,
        found: !!session,
        duration: Date.now() - startTime,
      });

      return session;
    } catch (error) {
      sessionLogger.error('findById.failed', 'Failed to find session', error, { id });
      throw error;
    }
  },

  /**
   * Find session by refresh token hash
   */
  async findByRefreshTokenHash(refreshTokenHash: string) {
    const startTime = Date.now();

    try {
      const session = await prisma.session.findUnique({
        where: { refreshTokenHash },
        include: { user: true },
      });

      sessionLogger.debug('findByRefreshTokenHash', 'Session lookup by token hash', {
        found: !!session,
        expired: session ? session.expiresAt < new Date() : null,
        duration: Date.now() - startTime,
      });

      return session;
    } catch (error) {
      sessionLogger.error('findByRefreshTokenHash.failed', 'Failed to find session by token', error);
      throw error;
    }
  },

  /**
   * Create a new session
   */
  async create(data: CreateSessionInput) {
    const startTime = Date.now();

    try {
      const session = await prisma.session.create({
        data: {
          userId: data.userId,
          refreshTokenHash: data.refreshTokenHash,
          userAgent: data.userAgent,
          ipAddress: data.ipAddress,
          expiresAt: data.expiresAt,
        },
      });

      sessionLogger.info('create', 'Session created', {
        sessionId: session.id,
        userId: data.userId,
        expiresAt: data.expiresAt.toISOString(),
        duration: Date.now() - startTime,
      });

      return session;
    } catch (error) {
      sessionLogger.error('create.failed', 'Failed to create session', error, {
        userId: data.userId,
      });
      throw error;
    }
  },

  /**
   * Update session last used timestamp
   */
  async updateLastUsed(id: string) {
    const startTime = Date.now();

    try {
      const session = await prisma.session.update({
        where: { id },
        data: { lastUsedAt: new Date() },
      });

      sessionLogger.debug('updateLastUsed', 'Session last used updated', {
        sessionId: id,
        duration: Date.now() - startTime,
      });

      return session;
    } catch (error) {
      sessionLogger.error('updateLastUsed.failed', 'Failed to update session', error, { id });
      throw error;
    }
  },

  /**
   * Delete session (logout)
   */
  async delete(id: string) {
    const startTime = Date.now();

    try {
      await prisma.session.delete({
        where: { id },
      });

      sessionLogger.info('delete', 'Session deleted', {
        sessionId: id,
        duration: Date.now() - startTime,
      });
    } catch (error) {
      sessionLogger.error('delete.failed', 'Failed to delete session', error, { id });
      throw error;
    }
  },

  /**
   * Delete all sessions for a user
   */
  async deleteAllForUser(userId: string) {
    const startTime = Date.now();

    try {
      const result = await prisma.session.deleteMany({
        where: { userId },
      });

      sessionLogger.info('deleteAllForUser', 'All user sessions deleted', {
        userId,
        count: result.count,
        duration: Date.now() - startTime,
      });

      return result.count;
    } catch (error) {
      sessionLogger.error('deleteAllForUser.failed', 'Failed to delete user sessions', error, { userId });
      throw error;
    }
  },

  /**
   * Delete expired sessions (cleanup job)
   */
  async deleteExpired() {
    const startTime = Date.now();

    try {
      const result = await prisma.session.deleteMany({
        where: {
          expiresAt: { lt: new Date() },
        },
      });

      if (result.count > 0) {
        sessionLogger.info('deleteExpired', 'Expired sessions cleaned up', {
          count: result.count,
          duration: Date.now() - startTime,
        });
      }

      return result.count;
    } catch (error) {
      sessionLogger.error('deleteExpired.failed', 'Failed to delete expired sessions', error);
      throw error;
    }
  },

  /**
   * Count active sessions for a user
   */
  async countForUser(userId: string) {
    return prisma.session.count({
      where: {
        userId,
        expiresAt: { gt: new Date() },
      },
    });
  },
};

export type SessionRepository = typeof sessionRepository;
