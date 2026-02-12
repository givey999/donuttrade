import { PrismaClient } from '@prisma/client';
import { config, isDevelopment } from '../config/index.js';
import { logger } from '../lib/logger.js';

const dbLogger = logger.module('database');

/**
 * Extended Prisma client with logging
 */
function createPrismaClient(): PrismaClient {
  const client = new PrismaClient({
    log: isDevelopment
      ? [
          { emit: 'event', level: 'query' },
          { emit: 'event', level: 'error' },
          { emit: 'event', level: 'warn' },
        ]
      : [{ emit: 'event', level: 'error' }],
    datasourceUrl: config.DATABASE_URL,
  });

  // Log queries in development
  if (isDevelopment) {
    client.$on('query', (e) => {
      dbLogger.trace('query.execute', 'Database query executed', {
        query: e.query,
        params: e.params,
        duration: e.duration,
      });
    });
  }

  // Always log errors
  client.$on('error', (e) => {
    dbLogger.error('query.error', 'Database error', new Error(e.message), {
      target: e.target,
    });
  });

  // Log warnings
  client.$on('warn', (e) => {
    dbLogger.warn('query.warn', 'Database warning', {
      message: e.message,
    });
  });

  return client;
}

/**
 * Singleton Prisma client
 */
export const prisma = createPrismaClient();

/**
 * Connect to the database
 */
export async function connectDatabase(): Promise<void> {
  const startTime = Date.now();

  try {
    await prisma.$connect();
    const duration = Date.now() - startTime;

    dbLogger.info('connect.success', 'Database connected', {
      duration,
    });
  } catch (error) {
    dbLogger.fatal('connect.failed', 'Failed to connect to database', error);
    throw error;
  }
}

/**
 * Disconnect from the database
 */
export async function disconnectDatabase(): Promise<void> {
  try {
    await prisma.$disconnect();
    dbLogger.info('disconnect.success', 'Database disconnected');
  } catch (error) {
    dbLogger.error('disconnect.failed', 'Failed to disconnect from database', error);
    throw error;
  }
}

/**
 * Check database health
 */
export async function checkDatabaseHealth(): Promise<{ ok: boolean; latency: number }> {
  const startTime = Date.now();

  try {
    await prisma.$queryRaw`SELECT 1`;
    const latency = Date.now() - startTime;

    return { ok: true, latency };
  } catch (error) {
    dbLogger.error('health.failed', 'Database health check failed', error);
    return { ok: false, latency: Date.now() - startTime };
  }
}

/**
 * Execute a function within a transaction
 */
export async function withTransaction<T>(
  fn: (tx: Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>) => Promise<T>
): Promise<T> {
  const startTime = Date.now();

  try {
    const result = await prisma.$transaction(fn);
    const duration = Date.now() - startTime;

    dbLogger.debug('transaction.complete', 'Transaction completed', {
      duration,
    });

    return result;
  } catch (error) {
    const duration = Date.now() - startTime;

    dbLogger.error('transaction.failed', 'Transaction failed', error, {
      duration,
    });

    throw error;
  }
}
