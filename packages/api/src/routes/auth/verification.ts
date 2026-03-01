import { FastifyPluginAsync } from 'fastify';
import { verificationService } from '../../services/auth/verification.service.js';

/**
 * User-facing verification routes (under /auth)
 */
export const verificationRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * POST /auth/verification/start
   * Start the payment verification flow
   */
  fastify.post('/verification/start', {
    preHandler: [fastify.authenticatePending],
  }, async (request) => {
    const userId = request.pendingUser!.id;
    const result = await verificationService.startVerification(userId);

    return {
      success: true,
      data: {
        amount: result.amount,
        expiresAt: result.expiresAt.toISOString(),
        botUsername: result.botUsername,
      },
    };
  });

  /**
   * GET /auth/verification/status
   * Get the current verification status
   */
  fastify.get('/verification/status', {
    preHandler: [fastify.authenticatePending],
  }, async (request) => {
    const userId = request.pendingUser!.id;
    const result = await verificationService.getStatus(userId);

    return {
      success: true,
      data: {
        status: result.status,
        amount: result.amount,
        expiresAt: result.expiresAt?.toISOString() ?? null,
        botUsername: result.botUsername,
      },
    };
  });

  /**
   * POST /auth/verification/retry
   * Retry verification with a new amount
   */
  fastify.post('/verification/retry', {
    preHandler: [fastify.authenticatePending],
  }, async (request) => {
    const userId = request.pendingUser!.id;
    const result = await verificationService.retryVerification(userId);

    return {
      success: true,
      data: {
        amount: result.amount,
        expiresAt: result.expiresAt.toISOString(),
        botUsername: result.botUsername,
      },
    };
  });
};
