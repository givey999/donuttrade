import { randomBytes } from 'crypto';
import { authStateRepository } from '../../repositories/index.js';
import { authStateConfig } from '../../config/oauth.js';
import { logger } from '../../lib/logger.js';

const stateLogger = logger.module('auth.state');

/**
 * Auth state service for OAuth CSRF protection
 */
export const authStateService = {
  /**
   * Create a new OAuth state parameter
   */
  async createState(authMethod: string, redirectUrl?: string): Promise<string> {
    const state = randomBytes(authStateConfig.stateLength).toString('hex');
    const expiresAt = new Date(Date.now() + authStateConfig.stateExpiryMs);

    await authStateRepository.create({
      state,
      authMethod,
      redirectUrl,
      expiresAt,
    });

    stateLogger.debug('createState', 'OAuth state created', {
      statePrefix: state.substring(0, 8) + '...',
      authMethod,
      redirectUrl,
      expiresAt: expiresAt.toISOString(),
    });

    return state;
  },

  /**
   * Validate and consume a state parameter
   * Returns the redirect URL and auth method if valid
   */
  async validateAndConsume(state: string): Promise<{ valid: boolean; redirectUrl?: string; authMethod?: string }> {
    const authState = await authStateRepository.consume(state);

    if (!authState) {
      stateLogger.warn('validateAndConsume.invalid', 'Invalid or expired state', {
        statePrefix: state.substring(0, 8) + '...',
      });
      return { valid: false };
    }

    stateLogger.debug('validateAndConsume', 'State validated and consumed', {
      statePrefix: state.substring(0, 8) + '...',
      authMethod: authState.authMethod,
      redirectUrl: authState.redirectUrl,
    });

    return {
      valid: true,
      redirectUrl: authState.redirectUrl ?? undefined,
      authMethod: authState.authMethod,
    };
  },

  /**
   * Clean up expired states (call periodically)
   */
  async cleanupExpired(): Promise<number> {
    return authStateRepository.deleteExpired();
  },
};

export type AuthStateService = typeof authStateService;
