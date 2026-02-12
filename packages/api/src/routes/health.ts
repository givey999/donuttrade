import { FastifyPluginAsync } from 'fastify';
import { checkDatabaseHealth } from '../services/database.js';
import { checkRedisHealth } from '../services/redis.js';
import { logger } from '../lib/logger.js';
import type { HealthCheckResponse, ServiceHealth } from '@donuttrade/shared';

const healthRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * Basic health check - returns 200 if API is running
   */
  fastify.get('/health', async (_request, _reply) => {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  });

  /**
   * Detailed health check - checks all dependencies
   */
  fastify.get('/health/detailed', async (_request, reply) => {
    const startTime = Date.now();

    // Check all services in parallel
    const [dbHealth, redisHealth] = await Promise.all([
      checkDatabaseHealth(),
      checkRedisHealth(),
    ]);

    const dbStatus: ServiceHealth = {
      status: dbHealth.ok ? 'ok' : 'unhealthy',
      latency: dbHealth.latency,
    };

    const redisStatus: ServiceHealth = {
      status: redisHealth.ok ? 'ok' : 'unhealthy',
      latency: redisHealth.latency,
    };

    // Determine overall status
    const allHealthy = dbHealth.ok && redisHealth.ok;
    const anyHealthy = dbHealth.ok || redisHealth.ok;

    let overallStatus: 'ok' | 'degraded' | 'unhealthy';
    if (allHealthy) {
      overallStatus = 'ok';
    } else if (anyHealthy) {
      overallStatus = 'degraded';
    } else {
      overallStatus = 'unhealthy';
    }

    const response: HealthCheckResponse = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      services: {
        database: dbStatus,
        redis: redisStatus,
      },
    };

    // Log health check
    logger.debug(
      {
        module: 'http',
        action: 'health.check',
        duration: Date.now() - startTime,
        metadata: {
          status: overallStatus,
          database: dbStatus.status,
          redis: redisStatus.status,
        },
      },
      `Health check: ${overallStatus}`
    );

    // Return appropriate status code
    const statusCode = overallStatus === 'ok' ? 200 : overallStatus === 'degraded' ? 200 : 503;
    return reply.status(statusCode).send(response);
  });

  /**
   * Readiness check - for Kubernetes readiness probe
   */
  fastify.get('/health/ready', async (_request, reply) => {
    const [dbHealth, redisHealth] = await Promise.all([
      checkDatabaseHealth(),
      checkRedisHealth(),
    ]);

    if (dbHealth.ok && redisHealth.ok) {
      return { ready: true };
    }

    return reply.status(503).send({
      ready: false,
      reason: !dbHealth.ok ? 'database' : 'redis',
    });
  });

  /**
   * Liveness check - for Kubernetes liveness probe
   */
  fastify.get('/health/live', async (_request, _reply) => {
    return { alive: true };
  });
};

export default healthRoutes;
