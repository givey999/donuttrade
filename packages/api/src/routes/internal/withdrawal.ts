import { FastifyPluginAsync } from 'fastify';
import { withdrawalService } from '../../services/withdrawal.service.js';
import { config } from '../../config/index.js';
import { logger } from '../../lib/logger.js';
import { AppError } from '../../lib/errors.js';

const internalLogger = logger.module('internal.withdrawal');

/**
 * Internal withdrawal routes (called by the deposit bot)
 */
export const internalWithdrawalRoutes: FastifyPluginAsync = async (fastify) => {
  // Shared auth preHandler for all internal withdrawal routes
  const authenticateBot = async (request: any) => {
    const authHeader = request.headers.authorization;
    if (!authHeader) {
      throw new AppError('Authorization required', { code: 'UNAUTHORIZED', statusCode: 401 });
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer' || parts[1] !== config.BOT_WEBHOOK_SECRET) {
      internalLogger.warn('withdrawal.unauthorized', 'Invalid webhook secret');
      throw new AppError('Invalid authorization', { code: 'UNAUTHORIZED', statusCode: 401 });
    }
  };

  /**
   * GET /internal/withdrawals/pending
   * Returns list of pending withdrawals for the bot to process.
   */
  fastify.get('/withdrawals/pending', {
    preHandler: authenticateBot,
  }, async () => {
    const pending = await withdrawalService.getPendingWithdrawals();

    return {
      success: true,
      data: pending,
    };
  });

  /**
   * PATCH /internal/withdrawals/:id/claim
   * Bot claims a pending withdrawal before processing it.
   * Prevents duplicate processing after bot restart.
   */
  fastify.patch<{
    Params: { id: string };
  }>('/withdrawals/:id/claim', {
    preHandler: authenticateBot,
  }, async (request) => {
    const { id } = request.params;

    internalLogger.info('withdrawal.claim', 'Withdrawal claimed for processing', { withdrawalId: id });

    await withdrawalService.claimWithdrawal(id);

    return {
      success: true,
      data: { withdrawalId: id, status: 'processing' },
    };
  });

  /**
   * PATCH /internal/withdrawals/:id/confirm
   * Bot confirms it successfully sent /pay for this withdrawal.
   */
  fastify.patch<{
    Params: { id: string };
  }>('/withdrawals/:id/confirm', {
    preHandler: authenticateBot,
  }, async (request) => {
    const { id } = request.params;

    internalLogger.info('withdrawal.confirm', 'Withdrawal confirmation received', { withdrawalId: id });

    await withdrawalService.confirmWithdrawal(id);

    return {
      success: true,
      data: { withdrawalId: id, status: 'completed' },
    };
  });

  /**
   * PATCH /internal/withdrawals/:id/fail
   * Bot reports it could not send /pay. Triggers a balance refund.
   */
  fastify.patch<{
    Params: { id: string };
    Body: { reason: string };
  }>('/withdrawals/:id/fail', {
    schema: {
      body: {
        type: 'object',
        required: ['reason'],
        properties: {
          reason: { type: 'string' },
        },
      },
    },
    preHandler: authenticateBot,
  }, async (request) => {
    const { id } = request.params;
    const { reason } = request.body;

    internalLogger.warn('withdrawal.fail', 'Withdrawal failure reported', { withdrawalId: id, reason });

    await withdrawalService.failWithdrawal(id, reason);

    return {
      success: true,
      data: { withdrawalId: id, status: 'failed', reason },
    };
  });
};
