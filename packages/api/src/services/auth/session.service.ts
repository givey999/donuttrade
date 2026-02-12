import { sessionRepository } from '../../repositories/session.repository.js';
import { userRepository } from '../../repositories/user.repository.js';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  TokenExpiredError,
} from '../../lib/jwt.js';
import { hashToken } from '../../lib/encryption.js';
import { getRefreshTokenExpiryMs, getAccessTokenExpirySeconds } from '../../config/jwt.js';
import { logger } from '../../lib/logger.js';
import { AppError } from '../../lib/errors.js';
import { prisma } from '../database.js';

const sessionLogger = logger.module('auth.session');

/**
 * Session tokens returned to client
 */
export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;  // Access token expiry in seconds
}

/**
 * Session service for managing user sessions
 */
export const sessionService = {
  /**
   * Create a new session for a user
   */
  async createSession(
    userId: string,
    userAgent?: string,
    ipAddress?: string
  ): Promise<SessionTokens> {
    const startTime = Date.now();

    // Get user for token payload
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new AppError('User not found', { code: 'USER_NOT_FOUND', statusCode: 404 });
    }

    if (!user.minecraftUsername) {
      throw new AppError('User has not set a Minecraft username', {
        code: 'USERNAME_NOT_SET',
        statusCode: 400,
      });
    }

    // Generate refresh token expiry
    const refreshTokenExpiryMs = getRefreshTokenExpiryMs();
    const expiresAt = new Date(Date.now() + refreshTokenExpiryMs);

    // Create a temporary placeholder hash to create the session and get an ID
    const tempHash = hashToken(`temp-${userId}-${Date.now()}-${Math.random()}`);

    const session = await sessionRepository.create({
      userId,
      refreshTokenHash: tempHash,
      userAgent,
      ipAddress,
      expiresAt,
    });

    // Sign the refresh token with the session ID
    const refreshToken = signRefreshToken({
      sub: userId,
      sessionId: session.id,
    });

    // Update session with the actual refresh token hash
    const actualHash = hashToken(refreshToken);
    await prisma.session.update({
      where: { id: session.id },
      data: { refreshTokenHash: actualHash },
    });

    // Sign access token
    const accessToken = signAccessToken({
      sub: userId,
      username: user.minecraftUsername,
      authProvider: user.authProvider,
    });

    sessionLogger.info('createSession', 'Session created', {
      userId,
      sessionId: session.id,
      username: user.minecraftUsername,
      authProvider: user.authProvider,
      duration: Date.now() - startTime,
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: getAccessTokenExpirySeconds(),
    };
  },

  /**
   * Refresh a session using refresh token
   */
  async refreshSession(refreshToken: string): Promise<SessionTokens> {
    const startTime = Date.now();

    // Verify refresh token
    let payload;
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch (error) {
      if (error instanceof TokenExpiredError) {
        sessionLogger.info('refreshSession.expired', 'Refresh token expired');
        throw new AppError('Refresh token has expired', {
          code: 'REFRESH_TOKEN_EXPIRED',
          statusCode: 401,
        });
      }
      throw new AppError('Invalid refresh token', {
        code: 'INVALID_REFRESH_TOKEN',
        statusCode: 401,
      });
    }

    // Find session by token hash
    const tokenHash = hashToken(refreshToken);
    const session = await sessionRepository.findByRefreshTokenHash(tokenHash);

    if (!session) {
      sessionLogger.warn('refreshSession.notFound', 'Session not found', {
        sessionId: payload.sessionId,
      });
      throw new AppError('Session not found or revoked', {
        code: 'SESSION_NOT_FOUND',
        statusCode: 401,
      });
    }

    // Check if session is expired
    if (session.expiresAt < new Date()) {
      sessionLogger.info('refreshSession.sessionExpired', 'Session expired', {
        sessionId: session.id,
      });
      await sessionRepository.delete(session.id);
      throw new AppError('Session has expired', {
        code: 'SESSION_EXPIRED',
        statusCode: 401,
      });
    }

    const user = session.user;
    if (!user.minecraftUsername) {
      throw new AppError('User has not set a Minecraft username', {
        code: 'USERNAME_NOT_SET',
        statusCode: 400,
      });
    }

    // Update session last used
    await sessionRepository.updateLastUsed(session.id);

    // Sign new access token
    const accessToken = signAccessToken({
      sub: user.id,
      username: user.minecraftUsername,
      authProvider: user.authProvider,
    });

    sessionLogger.info('refreshSession', 'Session refreshed', {
      userId: user.id,
      sessionId: session.id,
      duration: Date.now() - startTime,
    });

    // Return same refresh token (we don't rotate on every refresh)
    return {
      accessToken,
      refreshToken,
      expiresIn: getAccessTokenExpirySeconds(),
    };
  },

  /**
   * Revoke a session by ID
   */
  async revokeSession(sessionId: string): Promise<boolean> {
    sessionLogger.info('revokeSession', 'Revoking session', { sessionId });
    try {
      await sessionRepository.delete(sessionId);
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Revoke all sessions for a user
   */
  async revokeAllUserSessions(userId: string): Promise<number> {
    sessionLogger.info('revokeAllUserSessions', 'Revoking all user sessions', { userId });
    return sessionRepository.deleteAllForUser(userId);
  },

  /**
   * Revoke session by refresh token
   */
  async revokeByRefreshToken(refreshToken: string): Promise<boolean> {
    const tokenHash = hashToken(refreshToken);
    const session = await sessionRepository.findByRefreshTokenHash(tokenHash);

    if (!session) {
      return false;
    }

    try {
      await sessionRepository.delete(session.id);
      return true;
    } catch {
      return false;
    }
  },
};

export type SessionService = typeof sessionService;
