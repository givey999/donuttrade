import { FastifyPluginAsync } from 'fastify';
import { itemDepositService } from '../../services/item-deposit.service.js';
import { config } from '../../config/index.js';
import { logger } from '../../lib/logger.js';
import { AppError } from '../../lib/errors.js';

const internalLogger = logger.module('internal.item-deposit');

/**
 * Internal item deposit routes (admin actions)
 */
export const internalItemDepositRoutes: FastifyPluginAsync = async (fastify) => {
  const authenticateBot = async (request: any) => {
    const authHeader = request.headers.authorization;
    if (!authHeader) {
      throw new AppError('Authorization required', { code: 'UNAUTHORIZED', statusCode: 401 });
    }
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer' || parts[1] !== config.BOT_WEBHOOK_SECRET) {
      internalLogger.warn('item-deposit.unauthorized', 'Invalid webhook secret');
      throw new AppError('Invalid authorization', { code: 'UNAUTHORIZED', statusCode: 401 });
    }
  };

  /**
   * GET /internal/item-deposits/pending
   */
  fastify.get('/item-deposits/pending', {
    preHandler: authenticateBot,
  }, async () => {
    const pending = await itemDepositService.getPendingDeposits();

    const mapped = pending.map((d) => ({
      id: d.id,
      userId: d.userId,
      username: d.user.minecraftUsername,
      catalogItemId: d.catalogItemId,
      catalogItemDisplayName: d.catalogItem.displayName,
      quantity: d.quantity,
      createdAt: d.createdAt.toISOString(),
    }));

    return {
      success: true,
      data: mapped,
    };
  });

  /**
   * PATCH /internal/item-deposits/:id/confirm
   */
  fastify.patch<{
    Params: { id: string };
    Body: { adminId: string };
  }>('/item-deposits/:id/confirm', {
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

    internalLogger.info('item-deposit.confirm', 'Item deposit confirmation', { depositId: id, adminId });

    await itemDepositService.confirmDeposit(id, adminId);

    return {
      success: true,
      data: { depositId: id, status: 'confirmed' },
    };
  });

  /**
   * PATCH /internal/item-deposits/:id/reject
   */
  fastify.patch<{
    Params: { id: string };
    Body: { adminId: string; notes?: string };
  }>('/item-deposits/:id/reject', {
    schema: {
      body: {
        type: 'object',
        required: ['adminId'],
        properties: {
          adminId: { type: 'string' },
          notes: { type: 'string' },
        },
      },
    },
    preHandler: authenticateBot,
  }, async (request) => {
    const { id } = request.params;
    const { adminId, notes } = request.body;

    internalLogger.info('item-deposit.reject', 'Item deposit rejection', { depositId: id, adminId });

    await itemDepositService.rejectDeposit(id, adminId, notes);

    return {
      success: true,
      data: { depositId: id, status: 'rejected' },
    };
  });
};
