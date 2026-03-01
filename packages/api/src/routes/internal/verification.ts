import { FastifyPluginAsync } from 'fastify';
import { verificationService } from '../../services/auth/verification.service.js';
import { config } from '../../config/index.js';
import { logger } from '../../lib/logger.js';
import { AppError } from '../../lib/errors.js';

const internalLogger = logger.module('internal.verification');

/**
 * Internal verification webhook routes (called by the bot-bridge)
 */
export const internalVerificationRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * POST /internal/verification/confirm
   * Called by the verification bot when a payment is detected
   */
  fastify.post<{
    Body: { username: string; amount: number; timestamp: string };
  }>('/verification/confirm', {
    schema: {
      body: {
        type: 'object',
        required: ['username', 'amount', 'timestamp'],
        properties: {
          username: { type: 'string' },
          amount: { type: 'number' },
          timestamp: { type: 'string' },
        },
      },
    },
    preHandler: async (request) => {
      // Validate Bearer token matches BOT_WEBHOOK_SECRET
      const authHeader = request.headers.authorization;
      if (!authHeader) {
        throw new AppError('Authorization required', { code: 'UNAUTHORIZED', statusCode: 401 });
      }

      const parts = authHeader.split(' ');
      if (parts.length !== 2 || parts[0] !== 'Bearer' || parts[1] !== config.BOT_WEBHOOK_SECRET) {
        internalLogger.warn('confirm.unauthorized', 'Invalid webhook secret');
        throw new AppError('Invalid authorization', { code: 'UNAUTHORIZED', statusCode: 401 });
      }
    },
  }, async (request) => {
    const { username, amount, timestamp } = request.body;

    internalLogger.info('confirm.received', 'Payment confirmation received', {
      username,
      amount,
      timestamp,
    });

    const result = await verificationService.confirmPayment(username, amount);

    return {
      success: true,
      data: {
        userId: result.matched ? result.userId : null,
        verified: result.matched,
      },
    };
  });
};
