import { FastifyPluginAsync } from 'fastify';
import { itemWithdrawalService } from '../services/item-withdrawal.service.js';
import type { ItemWithdrawalRecord, PaginationMeta } from '@donuttrade/shared';

/**
 * User-facing item withdrawal routes — /item-withdrawals
 */
export const itemWithdrawalRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * POST /item-withdrawals
   * Request an item withdrawal.
   */
  fastify.post<{
    Body: { catalogItemId: string; quantity: number };
  }>('/', {
    schema: {
      body: {
        type: 'object',
        required: ['catalogItemId', 'quantity'],
        properties: {
          catalogItemId: { type: 'string' },
          quantity: { type: 'number', minimum: 1 },
        },
      },
    },
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
    preHandler: [fastify.authenticate],
  }, async (request) => {
    const userId = request.user!.id;
    const { catalogItemId, quantity } = request.body;

    const withdrawal = await itemWithdrawalService.requestWithdrawal(userId, catalogItemId, quantity);

    return {
      success: true,
      data: withdrawal,
    };
  });

  /**
   * GET /item-withdrawals
   * Returns the authenticated user's item withdrawals.
   */
  fastify.get<{
    Querystring: { page?: string; perPage?: string };
  }>('/', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'string' },
          perPage: { type: 'string' },
        },
      },
    },
    preHandler: [fastify.authenticate],
  }, async (request) => {
    const userId = request.user!.id;
    const page = Math.max(1, parseInt(request.query.page || '1', 10) || 1);
    const perPage = Math.min(100, Math.max(1, parseInt(request.query.perPage || '20', 10) || 20));
    const skip = (page - 1) * perPage;

    const { withdrawals, total } = await itemWithdrawalService.getUserWithdrawals(userId, { skip, take: perPage });

    const mapped: ItemWithdrawalRecord[] = withdrawals.map((w) => ({
      id: w.id,
      userId: w.userId,
      catalogItemId: w.catalogItemId,
      catalogItemDisplayName: w.catalogItem.displayName,
      quantity: w.quantity,
      status: w.status as ItemWithdrawalRecord['status'],
      failReason: w.failReason,
      code: w.code ?? null,
      codeExpiresAt: w.codeExpiresAt?.toISOString() ?? null,
      createdAt: w.createdAt.toISOString(),
      completedAt: w.completedAt?.toISOString() ?? null,
    }));

    const meta: PaginationMeta = {
      page,
      perPage,
      total,
      totalPages: Math.ceil(total / perPage),
    };

    return {
      success: true,
      data: { withdrawals: mapped, meta },
    };
  });

  /**
   * DELETE /item-withdrawals/:id
   * Cancel own pending withdrawal.
   */
  fastify.delete<{
    Params: { id: string };
  }>('/:id', {
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
    preHandler: [fastify.authenticate],
  }, async (request) => {
    const userId = request.user!.id;
    const { id } = request.params;

    await itemWithdrawalService.cancelWithdrawal(id, userId);

    return {
      success: true,
      data: { withdrawalId: id, status: 'cancelled' },
    };
  });
};
