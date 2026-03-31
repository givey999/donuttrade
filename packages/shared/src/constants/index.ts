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
  PENDING_TOKEN: 'dt_pending_token',
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
export const VERIFICATION_AMOUNT_MAX = 999;
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
 * Deposit & Withdrawal limits (Phase 7)
 */
export const DEPOSIT_MIN_AMOUNT = 1_000;
export const DEPOSIT_MAX_AMOUNT = 100_000_000_000;
export const WITHDRAWAL_MIN_AMOUNT = 1;
export const WITHDRAWAL_MAX_AMOUNT = 100_000_000_000;
export const WITHDRAWAL_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

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
 * Marketplace constants
 */
export const MARKETPLACE_COMMISSION_RATE = 0.02;
export const MARKETPLACE_PREMIUM_FEE = 10_000_000;
export const MARKETPLACE_STANDARD_DURATION_MS = 24 * 60 * 60 * 1000;
export const MARKETPLACE_PREMIUM_DURATION_MS = 48 * 60 * 60 * 1000;
export const MARKETPLACE_MIN_PRICE = 1;
export const MARKETPLACE_MAX_PRICE = 100_000_000_000;
export const MARKETPLACE_MIN_QUANTITY = 1;
export const MARKETPLACE_MAX_QUANTITY = 10_000;

/**
 * Role hierarchy — higher number = more power
 */
export const ROLE_HIERARCHY: Record<string, number> = {
  user: 0,
  moderator: 1,
  manager: 2,
  admin: 3,
  leader: 4,
};

/**
 * Timeout preset durations for the admin panel
 */
export const TIMEOUT_PRESET_DURATIONS = [
  { label: '1 Hour', ms: 60 * 60 * 1000 },
  { label: '6 Hours', ms: 6 * 60 * 60 * 1000 },
  { label: '24 Hours', ms: 24 * 60 * 60 * 1000 },
  { label: '3 Days', ms: 3 * 24 * 60 * 60 * 1000 },
  { label: '7 Days', ms: 7 * 24 * 60 * 60 * 1000 },
] as const;

/**
 * Default pagination values
 */
export const Pagination = {
  DEFAULT_PAGE: 1,
  DEFAULT_PER_PAGE: 20,
  MAX_PER_PAGE: 100,
} as const;

// Cosmetics
export * from './cosmetics.js';
