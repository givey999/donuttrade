import { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import { createContext, runWithContext } from '../lib/context.js';
import { Headers } from '@donuttrade/shared';

declare module 'fastify' {
  interface FastifyRequest {
    correlationId: string;
    startTime: number;
  }
}

/**
 * Plugin to set up request context with correlation ID
 */
const requestContextPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('onRequest', async (request, reply) => {
    // Get or generate correlation ID
    const correlationId =
      (request.headers[Headers.CORRELATION_ID] as string) ||
      (request.headers[Headers.REQUEST_ID] as string) ||
      undefined;

    // Create context
    const context = createContext({
      correlationId,
      userAgent: request.headers[Headers.USER_AGENT] as string,
      ipAddress: request.ip,
    });

    // Attach to request for easy access
    request.correlationId = context.correlationId;
    request.startTime = context.startTime;

    // Set correlation ID header on response
    reply.header(Headers.CORRELATION_ID, context.correlationId);
  });

  // Wrap route handlers with context
  fastify.addHook('preHandler', async (request, _reply) => {
    const context = createContext({
      correlationId: request.correlationId,
      userAgent: request.headers[Headers.USER_AGENT] as string,
      ipAddress: request.ip,
      startTime: request.startTime,
    });

    // Run the rest of the request in context
    return new Promise((resolve) => {
      runWithContext(context, () => {
        resolve(undefined);
      });
    });
  });
};

export default fp(requestContextPlugin, {
  name: 'request-context',
});
