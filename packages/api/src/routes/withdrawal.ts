import { FastifyPluginAsync } from 'fastify';
import { withdrawalService } from '../services/withdrawal.service.js';
import { logger } from '../lib/logger.js';

const wdLogger = logger.module('routes.withdrawal');

/**
 * User-facing withdrawal routes — /withdrawals
 */
export const withdrawalRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * POST /withdrawals
   * Authenticated user requests a withdrawal.
   */
  fastify.post<{
    Body: { amount: number };
  }>('/', {
    schema: {
      body: {
        type: 'object',
        required: ['amount'],
        properties: {
          amount: { type: 'number', minimum: 1 },
        },
      },
    },
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
    preHandler: [fastify.authenticate],
  }, async (request) => {
    const userId = request.user!.id;
    const { amount } = request.body;

    wdLogger.info('request', 'Withdrawal requested by user', { userId, amount });

    const withdrawal = await withdrawalService.requestWithdrawal(userId, amount);

    return {
      success: true,
      data: withdrawal,
    };
  });
};
