import { z } from 'zod';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Environment variable schema with validation
 */
const envSchema = z.object({
  // Application
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).default('3001'),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),

  // Database
  DATABASE_URL: z.string().url(),

  // Redis
  REDIS_URL: z.string().url().default('redis://localhost:6379'),

  // Microsoft OAuth (optional in Phase 1, required in Phase 2)
  MICROSOFT_CLIENT_ID: z.string().optional(),
  MICROSOFT_CLIENT_SECRET: z.string().optional(),
  MICROSOFT_REDIRECT_URI: z.string().url().optional(),

  // Discord OAuth (optional in Phase 1, required in Phase 3)
  DISCORD_CLIENT_ID: z.string().optional(),
  DISCORD_CLIENT_SECRET: z.string().optional(),
  DISCORD_REDIRECT_URI: z.string().url().optional(),

  // Email service (optional in Phase 1, required in Phase 3)
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM_ADDRESS: z.string().optional(),

  // JWT Secrets (optional in Phase 1, required later)
  JWT_ACCESS_SECRET: z.string().min(32).optional(),
  JWT_REFRESH_SECRET: z.string().min(32).optional(),

  // Bot Bridge
  BOT_WEBHOOK_SECRET: z.string().min(32),
  VERIFICATION_BOT_DISPLAY_NAME: z.string().default('DonutTradeBot'),
  DEPOSIT_BOT_DISPLAY_NAME: z.string().default('DonutTradeDeposit'),

  // Marketplace
  MARKETPLACE_COMMISSION_RATE: z.string().transform(Number).default('0.02'),

  // Code signing
  CODE_SIGNING_SECRET: z.string().min(32),

  // CORS
  CORS_ORIGIN: z.string().default('https://moldo.go.ro:9443'),
});

/**
 * Parse and validate environment variables
 */
function loadConfig() {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error('❌ Invalid environment variables:');
    console.error(result.error.format());
    process.exit(1);
  }

  return result.data;
}

/**
 * Application configuration
 */
export const config = loadConfig();

/**
 * Check if we're in development mode
 */
export const isDevelopment = config.NODE_ENV === 'development';

/**
 * Check if we're in production mode
 */
export const isProduction = config.NODE_ENV === 'production';

/**
 * Check if we're in test mode
 */
export const isTest = config.NODE_ENV === 'test';

/**
 * Redacted config for logging (hides sensitive values)
 */
export function getRedactedConfig(): Record<string, string | number | boolean | undefined> {
  return {
    NODE_ENV: config.NODE_ENV,
    PORT: config.PORT,
    LOG_LEVEL: config.LOG_LEVEL,
    DATABASE_URL: redactUrl(config.DATABASE_URL),
    REDIS_URL: redactUrl(config.REDIS_URL),
    CORS_ORIGIN: config.CORS_ORIGIN,
    MICROSOFT_CLIENT_ID: config.MICROSOFT_CLIENT_ID ? '[SET]' : '[NOT SET]',
    MICROSOFT_CLIENT_SECRET: config.MICROSOFT_CLIENT_SECRET ? '[REDACTED]' : '[NOT SET]',
    DISCORD_CLIENT_ID: config.DISCORD_CLIENT_ID ? '[SET]' : '[NOT SET]',
    DISCORD_CLIENT_SECRET: config.DISCORD_CLIENT_SECRET ? '[REDACTED]' : '[NOT SET]',
    RESEND_API_KEY: config.RESEND_API_KEY ? '[REDACTED]' : '[NOT SET]',
    JWT_ACCESS_SECRET: config.JWT_ACCESS_SECRET ? '[REDACTED]' : '[NOT SET]',
    JWT_REFRESH_SECRET: config.JWT_REFRESH_SECRET ? '[REDACTED]' : '[NOT SET]',
    BOT_WEBHOOK_SECRET: config.BOT_WEBHOOK_SECRET ? '[REDACTED]' : '[NOT SET]',
    CODE_SIGNING_SECRET: config.CODE_SIGNING_SECRET ? '[REDACTED]' : '[NOT SET]',
    VERIFICATION_BOT_DISPLAY_NAME: config.VERIFICATION_BOT_DISPLAY_NAME,
    DEPOSIT_BOT_DISPLAY_NAME: config.DEPOSIT_BOT_DISPLAY_NAME,
  };
}

/**
 * Redact sensitive parts of a URL (password, credentials)
 */
function redactUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.password) {
      parsed.password = '[REDACTED]';
    }
    return parsed.toString();
  } catch {
    return '[INVALID_URL]';
  }
}

export type Config = typeof config;
