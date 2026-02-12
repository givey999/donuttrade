import { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import { logger } from '../lib/logger.js';

/**
 * Plugin to log HTTP requests
 */
const requestLoggingPlugin: FastifyPluginAsync = async (fastify) => {
  // Log request start
  fastify.addHook('onRequest', async (request) => {
    logger.debug(
      {
        module: 'http',
        action: 'request.start',
        metadata: {
          method: request.method,
          path: request.url,
          userAgent: request.headers['user-agent'],
          ip: request.ip,
        },
      },
      `${request.method} ${request.url}`
    );
  });

  // Log request completion
  fastify.addHook('onResponse', async (request, reply) => {
    const duration = Date.now() - request.startTime;

    logger.httpRequest({
      method: request.method,
      path: request.url,
      statusCode: reply.statusCode,
      duration,
      userAgent: request.headers['user-agent'] as string,
      ip: request.ip,
    });
  });

  // Log errors
  fastify.addHook('onError', async (request, reply, error) => {
    logger.error(
      {
        module: 'http',
        action: 'request.error',
        error,
        metadata: {
          method: request.method,
          path: request.url,
          statusCode: reply.statusCode,
        },
      },
      `Request error: ${error.message}`
    );
  });
};

export default fp(requestLoggingPlugin, {
  name: 'request-logging',
  dependencies: ['request-context'],
});
