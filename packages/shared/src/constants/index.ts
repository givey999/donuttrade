/**
 * Service identifiers for logging
 */
export const Services = {
  API: 'api',
  WEB: 'web',
  BOT_BRIDGE: 'bot-bridge',
  WORKER: 'worker',
} as const;

/**
 * Module identifiers for logging
 */
export const Modules = {
  HTTP: 'http',
  AUTH: 'auth',
  DATABASE: 'database',
  REDIS: 'redis',
  DISCORD: 'discord',
  EMAIL: 'email',
  VERIFICATION: 'verification',
  MARKETPLACE: 'marketplace',
  DEPOSITS: 'deposits',
  WITHDRAWALS: 'withdrawals',
  INVENTORY: 'inventory',
  NOTIFICATIONS: 'notifications',
  ADMIN: 'admin',
  BOT: 'bot',
} as const;

/**
 * HTTP Headers used across the platform
 */
export const Headers = {
  CORRELATION_ID: 'x-correlation-id',
  REQUEST_ID: 'x-request-id',
  USER_AGENT: 'user-agent',
  AUTHORIZATION: 'authorization',
  CONTENT_TYPE: 'content-type',
} as const;

/**
 * Cookie names
 */
export const Cookies = {
  REFRESH_TOKEN: 'dt_refresh_token',
  CSRF_TOKEN: 'dt_csrf_token',
} as const;

/**
 * Token expiration times in seconds
 */
export const TokenExpiry = {
  ACCESS_TOKEN: 15 * 60, // 15 minutes
  REFRESH_TOKEN: 30 * 24 * 60 * 60, // 30 days
  AUTH_STATE: 15 * 60, // 15 minutes
} as const;

/**
 * Authentication providers
 */
export const AUTH_PROVIDERS = ['microsoft', 'discord', 'email'] as const;

/**
 * Payment verification constants
 */
export const VERIFICATION_AMOUNT_MIN = 1;
export const VERIFICATION_AMOUNT_MAX = 1000;
export const VERIFICATION_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Email verification constants
 */
export const EMAIL_CODE_LENGTH = 6;
export const EMAIL_CODE_EXPIRY_MS = 15 * 60 * 1000; // 15 minutes
export const EMAIL_RESEND_COOLDOWN_MS = 60 * 1000; // 1 minute
export const EMAIL_MAX_RESEND_ATTEMPTS = 3;

/**
 * Rate limit configurations
 */
export const RateLimits = {
  AUTH: { window: 15 * 60 * 1000, max: 10 }, // 10 per 15 min
  MARKETPLACE: { window: 60 * 1000, max: 60 }, // 60 per minute
  PURCHASES: { window: 60 * 1000, max: 10 }, // 10 per minute
  WITHDRAWALS: { window: 60 * 60 * 1000, max: 5 }, // 5 per hour
  DEFAULT: { window: 60 * 1000, max: 100 }, // 100 per minute
} as const;

/**
 * Sensitive fields that should be redacted in logs
 */
export const SensitiveFields = [
  'password',
  'passwordHash',
  'token',
  'accessToken',
  'refreshToken',
  'access_token',
  'refresh_token',
  'secret',
  'apiKey',
  'api_key',
  'authorization',
  'cookie',
] as const;

/**
 * Default pagination values
 */
export const Pagination = {
  DEFAULT_PAGE: 1,
  DEFAULT_PER_PAGE: 20,
  MAX_PER_PAGE: 100,
} as const;
