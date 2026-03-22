import { FastifyPluginAsync } from 'fastify';
import { verifyAccessToken, TokenExpiredError } from '../lib/jwt.js';
import { eventBus, type UserEvent } from '../services/event-bus.service.js';
import { logger } from '../lib/logger.js';

const sseLogger = logger.module('sse');

export const eventsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/stream', {
    config: { rateLimit: false },
  }, async (request, reply) => {
    // Auth via query param (EventSource doesn't support headers)
    const token = (request.query as { token?: string }).token;
    if (!token) {
      return reply.code(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Token required' },
      });
    }

    let userId: string;
    try {
      const payload = verifyAccessToken(token);
      userId = payload.sub;
    } catch (err) {
      const code = err instanceof TokenExpiredError ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN';
      return reply.code(401).send({
        success: false,
        error: { code, message: 'Invalid or expired token' },
      });
    }

    // Hijack the response for SSE streaming
    reply.hijack();

    const raw = reply.raw;
    raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    // Send initial connection confirmation
    raw.write(':ok\n\n');

    sseLogger.info('connect', 'SSE client connected', { userId });

    // Event callback — writes SSE formatted data
    const onEvent = (event: UserEvent) => {
      try {
        raw.write(`id: ${event.id}\n`);
        raw.write(`event: ${event.type}\n`);
        raw.write(`data: ${JSON.stringify(event)}\n\n`);
      } catch (err) {
        sseLogger.error('write.error', 'Failed to write SSE event', err);
      }
    };

    // Subscribe to user events
    await eventBus.subscribe(userId, onEvent);

    // Cleanup guard — prevents double-unsubscribe from heartbeat failure + socket close
    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      clearInterval(heartbeat);
      eventBus.unsubscribe(userId, onEvent);
      sseLogger.info('disconnect', 'SSE client disconnected', { userId });
    };

    // Heartbeat every 30 seconds
    const heartbeat = setInterval(() => {
      try {
        raw.write(': heartbeat\n\n');
      } catch {
        cleanup();
      }
    }, 30_000);

    request.raw.on('close', cleanup);
  });
};
