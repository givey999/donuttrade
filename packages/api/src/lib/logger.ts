import { pino, type LoggerOptions } from 'pino';
import { config, isDevelopment } from '../config/index.js';
import { getCorrelationId, getUserId, getElapsedTime } from './context.js';
import { Services, SensitiveFields } from '@donuttrade/shared';
import type { LogError } from '@donuttrade/shared';

/**
 * Pino logger configuration
 */
const pinoConfig: LoggerOptions = {
  level: config.LOG_LEVEL,

  // Custom timestamp format (ISO 8601)
  timestamp: () => `,"timestamp":"${new Date().toISOString()}"`,

  // Add service identifier
  base: {
    service: Services.API,
  },

  // Redact sensitive fields
  redact: {
    paths: SensitiveFields.map(field => `*.${field}`).concat(
      SensitiveFields.map(field => field),
      ['req.headers.authorization', 'req.headers.cookie']
    ),
    censor: '[REDACTED]',
  },

  // Format options
  formatters: {
    level: (label) => ({ level: label }),
    bindings: (bindings) => ({
      service: bindings.service,
      pid: bindings.pid,
      hostname: bindings.hostname,
    }),
  },

  // Pretty print in development
  transport: isDevelopment
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
          messageFormat: '{module}.{action}: {msg}',
        },
      }
    : undefined,
};

/**
 * Base pino logger instance
 */
const baseLogger = pino(pinoConfig);

/**
 * Structured log metadata
 */
interface LogMeta {
  module: string;
  action: string;
  userId?: string;
  duration?: number;
  metadata?: Record<string, unknown>;
  error?: LogError;
}

/**
 * Create a child logger with common fields
 */
function createLogEntry(meta: LogMeta) {
  return {
    correlationId: getCorrelationId(),
    module: meta.module,
    action: meta.action,
    userId: meta.userId ?? getUserId(),
    ...(meta.duration !== undefined && { duration: meta.duration }),
    ...(meta.metadata && { metadata: meta.metadata }),
    ...(meta.error && { error: meta.error }),
  };
}

/**
 * Format an error for logging
 */
function formatError(err: Error | unknown): LogError {
  if (err instanceof Error) {
    return {
      name: err.name,
      message: err.message,
      stack: isDevelopment ? err.stack : undefined,
      code: (err as Error & { code?: string }).code,
    };
  }
  return {
    name: 'UnknownError',
    message: String(err),
  };
}

/**
 * Structured logger with context awareness
 */
export const logger = {
  /**
   * Trace level - granular debugging
   */
  trace(meta: LogMeta, message: string): void {
    baseLogger.trace(createLogEntry(meta), message);
  },

  /**
   * Debug level - development debugging
   */
  debug(meta: LogMeta, message: string): void {
    baseLogger.debug(createLogEntry(meta), message);
  },

  /**
   * Info level - normal operations
   */
  info(meta: LogMeta, message: string): void {
    baseLogger.info(createLogEntry(meta), message);
  },

  /**
   * Warn level - recoverable issues
   */
  warn(meta: LogMeta, message: string): void {
    baseLogger.warn(createLogEntry(meta), message);
  },

  /**
   * Error level - failures requiring attention
   */
  error(meta: LogMeta & { error?: Error | unknown }, message: string): void {
    const logMeta = {
      ...meta,
      error: meta.error ? formatError(meta.error) : undefined,
    };
    baseLogger.error(createLogEntry(logMeta), message);
  },

  /**
   * Fatal level - system-critical failures
   */
  fatal(meta: LogMeta & { error?: Error | unknown }, message: string): void {
    const logMeta = {
      ...meta,
      error: meta.error ? formatError(meta.error) : undefined,
    };
    baseLogger.fatal(createLogEntry(logMeta), message);
  },

  /**
   * Log HTTP request completion
   */
  httpRequest(options: {
    method: string;
    path: string;
    statusCode: number;
    duration: number;
    userId?: string;
    userAgent?: string;
    ip?: string;
  }): void {
    const level: 'error' | 'warn' | 'info' = options.statusCode >= 500 ? 'error' : options.statusCode >= 400 ? 'warn' : 'info';

    const meta: LogMeta = {
      module: 'http',
      action: 'request.complete',
      duration: options.duration,
      userId: options.userId,
      metadata: {
        method: options.method,
        path: options.path,
        statusCode: options.statusCode,
        userAgent: options.userAgent,
        ip: options.ip,
      },
    };

    if (level === 'error') {
      baseLogger.error(createLogEntry(meta), `${options.method} ${options.path} - ${options.statusCode}`);
    } else if (level === 'warn') {
      baseLogger.warn(createLogEntry(meta), `${options.method} ${options.path} - ${options.statusCode}`);
    } else {
      baseLogger.info(createLogEntry(meta), `${options.method} ${options.path} - ${options.statusCode}`);
    }
  },

  /**
   * Log with elapsed time from request start
   */
  withTiming(meta: Omit<LogMeta, 'duration'>, message: string): void {
    const duration = getElapsedTime();
    this.info({ ...meta, duration }, message);
  },

  /**
   * Create a module-specific logger
   */
  module(moduleName: string) {
    return {
      trace: (action: string, message: string, metadata?: Record<string, unknown>) =>
        logger.trace({ module: moduleName, action, metadata }, message),
      debug: (action: string, message: string, metadata?: Record<string, unknown>) =>
        logger.debug({ module: moduleName, action, metadata }, message),
      info: (action: string, message: string, metadata?: Record<string, unknown>) =>
        logger.info({ module: moduleName, action, metadata }, message),
      warn: (action: string, message: string, metadata?: Record<string, unknown>) =>
        logger.warn({ module: moduleName, action, metadata }, message),
      error: (action: string, message: string, err?: Error | unknown, metadata?: Record<string, unknown>) =>
        logger.error({ module: moduleName, action, metadata, error: err } as LogMeta & { error?: Error | unknown }, message),
      fatal: (action: string, message: string, err?: Error | unknown, metadata?: Record<string, unknown>) =>
        logger.fatal({ module: moduleName, action, metadata, error: err } as LogMeta & { error?: Error | unknown }, message),
    };
  },

  /**
   * Get the underlying pino instance for advanced usage
   */
  get pino() {
    return baseLogger;
  },
};

export type Logger = typeof logger;
