import { Redis, type Redis as RedisClient } from 'ioredis';
import { config } from '../config/index.js';
import { logger } from '../lib/logger.js';

const redisLogger = logger.module('redis');

/**
 * Create Redis client with logging
 */
function createRedisClient(): RedisClient {
  const client = new Redis(config.REDIS_URL, {
    maxRetriesPerRequest: 3,
    retryStrategy(times: number) {
      const delay = Math.min(times * 100, 3000);
      redisLogger.warn('connection.retry', `Retrying Redis connection in ${delay}ms`, {
        attempt: times,
        delay,
      });
      return delay;
    },
    reconnectOnError(err: Error) {
      redisLogger.error('connection.error', 'Redis connection error', err);
      return true;
    },
  });

  // Log connection events
  client.on('connect', () => {
    redisLogger.info('connect.success', 'Redis connected');
  });

  client.on('ready', () => {
    redisLogger.info('ready', 'Redis ready');
  });

  client.on('error', (error: Error) => {
    redisLogger.error('error', 'Redis error', error);
  });

  client.on('close', () => {
    redisLogger.warn('close', 'Redis connection closed');
  });

  client.on('reconnecting', () => {
    redisLogger.info('reconnecting', 'Redis reconnecting');
  });

  return client;
}

/**
 * Singleton Redis client
 */
export const redis = createRedisClient();

/**
 * Connect to Redis (ping to verify)
 */
export async function connectRedis(): Promise<void> {
  const startTime = Date.now();

  try {
    await redis.ping();
    const duration = Date.now() - startTime;

    redisLogger.info('ping.success', 'Redis ping successful', {
      duration,
    });
  } catch (error) {
    redisLogger.fatal('ping.failed', 'Failed to ping Redis', error);
    throw error;
  }
}

/**
 * Disconnect from Redis
 */
export async function disconnectRedis(): Promise<void> {
  try {
    await redis.quit();
    redisLogger.info('disconnect.success', 'Redis disconnected');
  } catch (error) {
    redisLogger.error('disconnect.failed', 'Failed to disconnect from Redis', error);
    throw error;
  }
}

/**
 * Check Redis health
 */
export async function checkRedisHealth(): Promise<{ ok: boolean; latency: number }> {
  const startTime = Date.now();

  try {
    await redis.ping();
    const latency = Date.now() - startTime;

    return { ok: true, latency };
  } catch (error) {
    redisLogger.error('health.failed', 'Redis health check failed', error);
    return { ok: false, latency: Date.now() - startTime };
  }
}

/**
 * Get a value from Redis with logging
 */
export async function get(key: string): Promise<string | null> {
  try {
    const value = await redis.get(key);
    redisLogger.trace('get', 'Redis GET', { key, found: value !== null });
    return value;
  } catch (error) {
    redisLogger.error('get.failed', 'Redis GET failed', error, { key });
    throw error;
  }
}

/**
 * Set a value in Redis with optional expiry
 */
export async function set(key: string, value: string, ttlSeconds?: number): Promise<void> {
  try {
    if (ttlSeconds) {
      await redis.setex(key, ttlSeconds, value);
    } else {
      await redis.set(key, value);
    }
    redisLogger.trace('set', 'Redis SET', { key, ttl: ttlSeconds });
  } catch (error) {
    redisLogger.error('set.failed', 'Redis SET failed', error, { key });
    throw error;
  }
}

/**
 * Delete a key from Redis
 */
export async function del(key: string): Promise<void> {
  try {
    await redis.del(key);
    redisLogger.trace('del', 'Redis DEL', { key });
  } catch (error) {
    redisLogger.error('del.failed', 'Redis DEL failed', error, { key });
    throw error;
  }
}
