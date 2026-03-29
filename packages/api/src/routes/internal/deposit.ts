import { FastifyPluginAsync } from 'fastify';
import { depositService } from '../../services/deposit.service.js';
import { config } from '../../config/index.js';
import { logger } from '../../lib/logger.js';
import { AppError } from '../../lib/errors.js';

const internalLogger = logger.module('internal.deposit');

/**
 * Internal deposit routes (called by the deposit bot)
 */
export const internalDepositRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * POST /internal/deposit/confirm
   * Called by the deposit bot when an incoming payment is detected.
   *
   * Returns:
   * - { deposited: true, deposit } — success
   * - { deposited: false, refund: true, refundAmount } — bot should refund
   * - { deposited: false, refund: false } — ignore (unknown user)
   */
  fastify.post<{
    Body: { username: string; amount: number; timestamp: string };
  }>('/deposit/confirm', {
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
      const authHeader = request.headers.authorization;
      if (!authHeader) {
        throw new AppError('Authorization required', { code: 'UNAUTHORIZED', statusCode: 401 });
      }

      const parts = authHeader.split(' ');
      if (parts.length !== 2 || parts[0] !== 'Bearer' || parts[1] !== config.BOT_WEBHOOK_SECRET) {
        internalLogger.warn('deposit.unauthorized', 'Invalid webhook secret');
        throw new AppError('Invalid authorization', { code: 'UNAUTHORIZED', statusCode: 401 });
      }
    },
  }, async (request) => {
    const { username, amount, timestamp } = request.body;

    internalLogger.info('deposit.received', 'Deposit confirmation received', {
      username,
      amount,
      timestamp,
    });

    const result = await depositService.processDeposit(username, amount, timestamp);

    return {
      success: true,
      data: result,
    };
  });
};
