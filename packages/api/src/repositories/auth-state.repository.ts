import { prisma } from '../services/database.js';
import { logger } from '../lib/logger.js';
import type { CreateAuthStateInput } from '@donuttrade/shared';

const authStateLogger = logger.module('authState.repository');

/**
 * Auth state repository for OAuth state management
 */
export const authStateRepository = {
  /**
   * Find auth state by state parameter
   */
  async findByState(state: string) {
    const startTime = Date.now();

    try {
      const authState = await prisma.authState.findUnique({
        where: { state },
      });

      authStateLogger.debug('findByState', 'Auth state lookup', {
        statePrefix: state.substring(0, 8) + '...',
        found: !!authState,
        expired: authState ? authState.expiresAt < new Date() : null,
        duration: Date.now() - startTime,
      });

      return authState;
    } catch (error) {
      authStateLogger.error('findByState.failed', 'Failed to find auth state', error);
      throw error;
    }
  },

  /**
   * Create auth state for OAuth flow
   */
  async create(data: CreateAuthStateInput) {
    const startTime = Date.now();

    try {
      const authState = await prisma.authState.create({
        data: {
          state: data.state,
          authMethod: data.authMethod,
          redirectUrl: data.redirectUrl,
          expiresAt: data.expiresAt,
        },
      });

      authStateLogger.info('create', 'Auth state created', {
        statePrefix: data.state.substring(0, 8) + '...',
        hasRedirectUrl: !!data.redirectUrl,
        expiresAt: data.expiresAt.toISOString(),
        duration: Date.now() - startTime,
      });

      return authState;
    } catch (error) {
      authStateLogger.error('create.failed', 'Failed to create auth state', error);
      throw error;
    }
  },

  /**
   * Consume auth state (find and delete atomically)
   */
  async consume(state: string) {
    const startTime = Date.now();

    try {
      const authState = await prisma.authState.delete({
        where: { state },
      });

      const isExpired = authState.expiresAt < new Date();

      authStateLogger.info('consume', 'Auth state consumed', {
        statePrefix: state.substring(0, 8) + '...',
        wasExpired: isExpired,
        duration: Date.now() - startTime,
      });

      if (isExpired) {
        return null;  // Treat expired state as not found
      }

      return authState;
    } catch (error) {
      // State not found is expected in some cases
      authStateLogger.debug('consume.notFound', 'Auth state not found for consumption', {
        statePrefix: state.substring(0, 8) + '...',
      });
      return null;
    }
  },

  /**
   * Delete expired auth states (cleanup job)
   */
  async deleteExpired() {
    const startTime = Date.now();

    try {
      const result = await prisma.authState.deleteMany({
        where: {
          expiresAt: { lt: new Date() },
        },
      });

      if (result.count > 0) {
        authStateLogger.info('deleteExpired', 'Expired auth states cleaned up', {
          count: result.count,
          duration: Date.now() - startTime,
        });
      }

      return result.count;
    } catch (error) {
      authStateLogger.error('deleteExpired.failed', 'Failed to delete expired auth states', error);
      throw error;
    }
  },
};

export type AuthStateRepository = typeof authStateRepository;
