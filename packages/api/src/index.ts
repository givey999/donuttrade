import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import sensible from '@fastify/sensible';
import cookie from '@fastify/cookie';

import { config, getRedactedConfig, isDevelopment } from './config/index.js';
import { logger } from './lib/logger.js';
import { connectDatabase, disconnectDatabase } from './services/database.js';
import { connectRedis, disconnectRedis } from './services/redis.js';

import requestContextPlugin from './plugins/request-context.js';
import requestLoggingPlugin from './plugins/request-logging.js';
import errorHandlerPlugin from './plugins/error-handler.js';
import { authPlugin } from './plugins/auth.js';

import healthRoutes from './routes/health.js';
import { authRoutes } from './routes/auth/index.js';
import { internalRoutes } from './routes/internal/index.js';
import { withdrawalRoutes } from './routes/withdrawal.js';

const startupLogger = logger.module('startup');

/**
 * Build the Fastify application
 */
async function buildApp() {
  const app = Fastify({
    // Use our custom logger
    logger: false,
    // Trust proxy for accurate IP detection
    trustProxy: true,
    // Request ID generation
    genReqId: () => crypto.randomUUID(),
  });

  // Register core plugins
  // Only disable CSP in development; in production, use helmet defaults
  if (isDevelopment) {
    await app.register(helmet, { contentSecurityPolicy: false });
  } else {
    await app.register(helmet);
  }

  await app.register(cors, {
    origin: config.CORS_ORIGIN,
    credentials: true,
  });

  await app.register(sensible);
  await app.register(cookie);

  // Register custom plugins
  await app.register(requestContextPlugin);
  await app.register(requestLoggingPlugin);
  await app.register(errorHandlerPlugin);
  await app.register(authPlugin);

  // Register routes
  await app.register(healthRoutes);
  await app.register(authRoutes, { prefix: '/auth' });
  await app.register(internalRoutes, { prefix: '/internal' });
  await app.register(withdrawalRoutes, { prefix: '/withdrawals' });

  return app;
}

/**
 * Start the server
 */
async function start() {
  startupLogger.info('server.starting', 'Starting DonutTrade API server', {
    nodeEnv: config.NODE_ENV,
    port: config.PORT,
  });

  // Log configuration (redacted)
  startupLogger.debug('config.loaded', 'Configuration loaded', getRedactedConfig());

  try {
    // Connect to databases
    startupLogger.info('database.connecting', 'Connecting to databases...');
    await connectDatabase();
    await connectRedis();

    // Build and start the app
    const app = await buildApp();

    await app.listen({
      port: config.PORT,
      host: '0.0.0.0',
    });

    startupLogger.info('server.started', `Server listening on port ${config.PORT}`, {
      port: config.PORT,
      environment: config.NODE_ENV,
    });

    // Graceful shutdown handlers
    const shutdown = async (signal: string) => {
      startupLogger.info('server.shutdown', `Received ${signal}, shutting down gracefully...`);

      try {
        await app.close();
        startupLogger.info('server.closed', 'HTTP server closed');

        await disconnectDatabase();
        await disconnectRedis();

        startupLogger.info('server.shutdown.complete', 'Shutdown complete');
        process.exit(0);
      } catch (error) {
        startupLogger.fatal('server.shutdown.failed', 'Error during shutdown', error);
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      startupLogger.fatal('uncaughtException', 'Uncaught exception', error);
      process.exit(1);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason) => {
      startupLogger.fatal('unhandledRejection', 'Unhandled rejection', reason as Error);
      process.exit(1);
    });
  } catch (error) {
    startupLogger.fatal('server.start.failed', 'Failed to start server', error);
    process.exit(1);
  }
}

// Start the server
start();
