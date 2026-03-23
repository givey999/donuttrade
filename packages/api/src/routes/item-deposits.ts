import { FastifyPluginAsync } from 'fastify';
import { itemDepositService } from '../services/item-deposit.service.js';
import type { ItemDepositRecord, PaginationMeta } from '@donuttrade/shared';

/**
 * User-facing item deposit routes — /item-deposits
 */
export const itemDepositRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * POST /item-deposits
   * Request an item deposit.
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
    preHandler: [fastify.authenticate],
  }, async (request) => {
    const userId = request.user!.id;
    const { catalogItemId, quantity } = request.body;

    const deposit = await itemDepositService.requestDeposit(userId, catalogItemId, quantity);

    return {
      success: true,
      data: deposit,
    };
  });

  /**
   * GET /item-deposits
   * Returns the authenticated user's item deposits.
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

    const { deposits, total } = await itemDepositService.getUserDeposits(userId, { skip, take: perPage });

    const mapped: ItemDepositRecord[] = deposits.map((d) => ({
      id: d.id,
      userId: d.userId,
      catalogItemId: d.catalogItemId,
      catalogItemDisplayName: d.catalogItem.displayName,
      quantity: d.quantity,
      status: d.status as ItemDepositRecord['status'],
      adminNotes: d.adminNotes,
      code: d.code ?? null,
      codeExpiresAt: d.codeExpiresAt?.toISOString() ?? null,
      createdAt: d.createdAt.toISOString(),
      completedAt: d.completedAt?.toISOString() ?? null,
    }));

    const meta: PaginationMeta = {
      page,
      perPage,
      total,
      totalPages: Math.ceil(total / perPage),
    };

    return {
      success: true,
      data: { deposits: mapped, meta },
    };
  });
};
