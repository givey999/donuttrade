import { config } from './index.js';

/**
 * JWT Configuration
 */
export const jwtConfig = {
  accessToken: {
    secret: config.JWT_ACCESS_SECRET || 'dev-access-secret-min-32-characters-long',
    expiresIn: '15m',
  },
  refreshToken: {
    secret: config.JWT_REFRESH_SECRET || 'dev-refresh-secret-min-32-characters-long',
    expiresIn: '30d',
  },
};

/**
 * Check if JWT is properly configured
 */
export function isJwtConfigured(): boolean {
  return !!(config.JWT_ACCESS_SECRET && config.JWT_REFRESH_SECRET);
}

/**
 * Parse duration string to milliseconds
 */
export function parseDuration(duration: string): number {
  const match = duration.match(/^(\d+)([smhd])$/);
  if (!match) {
    throw new Error(`Invalid duration format: ${duration}`);
  }

  const value = parseInt(match[1]!, 10);
  const unit = match[2];

  switch (unit) {
    case 's':
      return value * 1000;
    case 'm':
      return value * 60 * 1000;
    case 'h':
      return value * 60 * 60 * 1000;
    case 'd':
      return value * 24 * 60 * 60 * 1000;
    default:
      throw new Error(`Unknown duration unit: ${unit}`);
  }
}

/**
 * Get refresh token expiry in milliseconds
 */
export function getRefreshTokenExpiryMs(): number {
  return parseDuration(jwtConfig.refreshToken.expiresIn);
}

/**
 * Get access token expiry in seconds
 */
export function getAccessTokenExpirySeconds(): number {
  return parseDuration(jwtConfig.accessToken.expiresIn) / 1000;
}
