import jwt from 'jsonwebtoken';
import { jwtConfig } from '../config/jwt.js';
import { logger } from './logger.js';

const jwtLogger = logger.module('jwt');

/**
 * Access token payload
 */
export interface AccessTokenPayload {
  sub: string;           // User ID
  username: string;      // Minecraft username
  authProvider: string;  // 'microsoft' | 'discord' | 'email'
  iat: number;
  exp: number;
}

/**
 * Refresh token payload (minimal)
 */
export interface RefreshTokenPayload {
  sub: string;           // User ID
  sessionId: string;     // Session ID for revocation
  iat: number;
  exp: number;
}

/**
 * Sign an access token
 */
export function signAccessToken(payload: Omit<AccessTokenPayload, 'iat' | 'exp'>): string {
  const token = jwt.sign(payload, jwtConfig.accessToken.secret, {
    expiresIn: jwtConfig.accessToken.expiresIn,
  } as jwt.SignOptions);

  jwtLogger.debug('signAccessToken', 'Access token signed', {
    userId: payload.sub,
    username: payload.username,
    authProvider: payload.authProvider,
  });

  return token;
}

/**
 * Sign a refresh token
 */
export function signRefreshToken(payload: Omit<RefreshTokenPayload, 'iat' | 'exp'>): string {
  const token = jwt.sign(payload, jwtConfig.refreshToken.secret, {
    expiresIn: jwtConfig.refreshToken.expiresIn,
  } as jwt.SignOptions);

  jwtLogger.debug('signRefreshToken', 'Refresh token signed', {
    userId: payload.sub,
    sessionId: payload.sessionId,
  });

  return token;
}

/**
 * Verify an access token
 */
export function verifyAccessToken(token: string): AccessTokenPayload {
  try {
    const payload = jwt.verify(token, jwtConfig.accessToken.secret) as AccessTokenPayload;

    jwtLogger.debug('verifyAccessToken', 'Access token verified', {
      userId: payload.sub,
      username: payload.username,
    });

    return payload;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      jwtLogger.debug('verifyAccessToken.expired', 'Access token expired');
      throw new TokenExpiredError('Access token has expired');
    }
    if (error instanceof jwt.JsonWebTokenError) {
      jwtLogger.warn('verifyAccessToken.invalid', 'Invalid access token', {
        error: (error as Error).message,
      });
      throw new InvalidTokenError('Invalid access token');
    }
    throw error;
  }
}

/**
 * Verify a refresh token
 */
export function verifyRefreshToken(token: string): RefreshTokenPayload {
  try {
    const payload = jwt.verify(token, jwtConfig.refreshToken.secret) as RefreshTokenPayload;

    jwtLogger.debug('verifyRefreshToken', 'Refresh token verified', {
      userId: payload.sub,
      sessionId: payload.sessionId,
    });

    return payload;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      jwtLogger.debug('verifyRefreshToken.expired', 'Refresh token expired');
      throw new TokenExpiredError('Refresh token has expired');
    }
    if (error instanceof jwt.JsonWebTokenError) {
      jwtLogger.warn('verifyRefreshToken.invalid', 'Invalid refresh token', {
        error: (error as Error).message,
      });
      throw new InvalidTokenError('Invalid refresh token');
    }
    throw error;
  }
}

/**
 * Token expired error
 */
export class TokenExpiredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TokenExpiredError';
  }
}

/**
 * Invalid token error
 */
export class InvalidTokenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidTokenError';
  }
}
