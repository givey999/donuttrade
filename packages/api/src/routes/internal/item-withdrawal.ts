import { FastifyPluginAsync } from 'fastify';
import { itemWithdrawalService } from '../../services/item-withdrawal.service.js';
import { config } from '../../config/index.js';
import { logger } from '../../lib/logger.js';
import { AppError } from '../../lib/errors.js';

const internalLogger = logger.module('internal.item-withdrawal');

/**
 * Internal item withdrawal routes (admin actions)
 */
export const internalItemWithdrawalRoutes: FastifyPluginAsync = async (fastify) => {
  const authenticateBot = async (request: any) => {
    const authHeader = request.headers.authorization;
    if (!authHeader) {
      throw new AppError('Authorization required', { code: 'UNAUTHORIZED', statusCode: 401 });
    }
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer' || parts[1] !== config.BOT_WEBHOOK_SECRET) {
      internalLogger.warn('item-withdrawal.unauthorized', 'Invalid webhook secret');
      throw new AppError('Invalid authorization', { code: 'UNAUTHORIZED', statusCode: 401 });
    }
  };

  /**
   * GET /internal/item-withdrawals/pending
   */
  fastify.get('/item-withdrawals/pending', {
    preHandler: authenticateBot,
  }, async () => {
    const pending = await itemWithdrawalService.getPendingWithdrawals();

    const mapped = pending.map((w) => ({
      id: w.id,
      userId: w.userId,
      username: w.user.minecraftUsername,
      catalogItemId: w.catalogItemId,
      catalogItemDisplayName: w.catalogItem.displayName,
      quantity: w.quantity,
      status: w.status,
      createdAt: w.createdAt.toISOString(),
    }));

    return {
      success: true,
      data: mapped,
    };
  });

  /**
   * PATCH /internal/item-withdrawals/:id/claim
   */
  fastify.patch<{
    Params: { id: string };
  }>('/item-withdrawals/:id/claim', {
    preHandler: authenticateBot,
  }, async (request) => {
    const { id } = request.params;

    const claimed = await itemWithdrawalService.claimWithdrawal(id);
    if (!claimed) {
      throw new AppError('Withdrawal already claimed or not pending', {
        code: 'ALREADY_CLAIMED',
        statusCode: 409,
      });
    }

    return {
      success: true,
      data: { withdrawalId: id, status: 'processing' },
    };
  });

  /**
   * PATCH /internal/item-withdrawals/:id/confirm
   */
  fastify.patch<{
    Params: { id: string };
    Body: { adminId: string };
  }>('/item-withdrawals/:id/confirm', {
    schema: {
      body: {
        type: 'object',
        required: ['adminId'],
        properties: {
          adminId: { type: 'string' },
        },
      },
    },
    preHandler: authenticateBot,
  }, async (request) => {
    const { id } = request.params;
    const { adminId } = request.body;

    internalLogger.info('item-withdrawal.confirm', 'Item withdrawal confirmation', { withdrawalId: id, adminId });

    await itemWithdrawalService.confirmWithdrawal(id, adminId);

    return {
      success: true,
      data: { withdrawalId: id, status: 'completed' },
    };
  });

  /**
   * PATCH /internal/item-withdrawals/:id/fail
   */
  fastify.patch<{
    Params: { id: string };
    Body: { adminId: string; reason: string };
  }>('/item-withdrawals/:id/fail', {
    schema: {
      body: {
        type: 'object',
        required: ['adminId', 'reason'],
        properties: {
          adminId: { type: 'string' },
          reason: { type: 'string' },
        },
      },
    },
    preHandler: authenticateBot,
  }, async (request) => {
    const { id } = request.params;
    const { adminId, reason } = request.body;

    internalLogger.warn('item-withdrawal.fail', 'Item withdrawal failure', { withdrawalId: id, adminId, reason });

    await itemWithdrawalService.failWithdrawal(id, adminId, reason);

    return {
      success: true,
      data: { withdrawalId: id, status: 'failed', reason },
    };
  });
};
