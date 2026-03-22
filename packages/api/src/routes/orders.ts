import { FastifyPluginAsync } from 'fastify';
import { marketplaceService } from '../services/marketplace.service.js';
import { prisma } from '../services/database.js';
import { AppError } from '../lib/errors.js';
import type { CreateOrderInput, PaginationMeta } from '@donuttrade/shared';

/**
 * Authenticated order routes — /orders
 */
export const orderRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * POST /orders
   * Create a buy or sell order.
   */
  fastify.post<{
    Body: CreateOrderInput;
  }>('/', {
    schema: {
      body: {
        type: 'object',
        required: ['type', 'catalogItemId', 'quantity', 'pricePerUnit'],
        properties: {
          type: { type: 'string', enum: ['buy', 'sell'] },
          catalogItemId: { type: 'string' },
          quantity: { type: 'number', minimum: 1 },
          pricePerUnit: { type: 'number', minimum: 1 },
          isPremium: { type: 'boolean' },
          borderColor: { type: 'string' },
          usernameColor: { type: 'string' },
          usernameFont: { type: 'string' },
        },
      },
    },
    config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
    preHandler: [fastify.authenticate],
  }, async (request) => {
    if (request.user!.impersonatedBy) {
      throw new AppError('Cannot perform financial actions while impersonating', { code: 'IMPERSONATION_BLOCKED', statusCode: 403 });
    }
    const userId = request.user!.id;
    const order = await marketplaceService.createOrder(userId, request.body);

    return {
      success: true,
      data: order,
    };
  });

  /**
   * POST /orders/:id/fill
   * Fill an order (partial or full).
   */
  fastify.post<{
    Params: { id: string };
    Body: { quantity: number };
  }>('/:id/fill', {
    schema: {
      body: {
        type: 'object',
        required: ['quantity'],
        properties: {
          quantity: { type: 'number', minimum: 1 },
        },
      },
    },
    config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
    preHandler: [fastify.authenticate],
  }, async (request) => {
    if (request.user!.impersonatedBy) {
      throw new AppError('Cannot perform financial actions while impersonating', { code: 'IMPERSONATION_BLOCKED', statusCode: 403 });
    }
    const fillerUserId = request.user!.id;
    const { id } = request.params;
    const { quantity } = request.body;

    const fill = await marketplaceService.fillOrder(id, fillerUserId, quantity);

    return {
      success: true,
      data: {
        fillId: fill.id,
        orderId: fill.orderId,
        quantity: fill.quantity,
        totalPrice: fill.totalPrice.toString(),
        commissionAmount: fill.commissionAmount.toString(),
        netAmount: fill.netAmount.toString(),
      },
    };
  });

  /**
   * DELETE /orders/:id
   * Cancel own active order.
   */
  fastify.delete<{
    Params: { id: string };
  }>('/:id', {
    config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
    preHandler: [fastify.authenticate],
  }, async (request) => {
    if (request.user!.impersonatedBy) {
      throw new AppError('Cannot perform financial actions while impersonating', { code: 'IMPERSONATION_BLOCKED', statusCode: 403 });
    }
    const userId = request.user!.id;
    const { id } = request.params;

    await marketplaceService.cancelOrder(id, userId);

    return {
      success: true,
      data: { orderId: id, status: 'cancelled' },
    };
  });

  /**
   * PATCH /orders/:id/price
   * Update the price of an active, unfilled order.
   */
  fastify.patch<{
    Params: { id: string };
    Body: { pricePerUnit: number };
  }>('/:id/price', {
    schema: {
      body: {
        type: 'object',
        required: ['pricePerUnit'],
        properties: {
          pricePerUnit: { type: 'number', minimum: 1 },
        },
      },
    },
    config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
    preHandler: [fastify.authenticate],
  }, async (request) => {
    if (request.user!.impersonatedBy) {
      throw new AppError('Cannot perform financial actions while impersonating', {
        code: 'IMPERSONATION_BLOCKED', statusCode: 403,
      });
    }
    await marketplaceService.updateOrderPrice(request.params.id, request.user!.id, request.body.pricePerUnit);
    return { success: true, data: { message: 'Order price updated' } };
  });

  /**
   * GET /orders/my
   * User's own orders.
   */
  fastify.get<{
    Querystring: { status?: string; page?: string; perPage?: string };
  }>('/my', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          status: { type: 'string' },
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

    const where: any = { userId };
    const validStatuses = ['active', 'completed', 'cancelled', 'expired'];
    if (request.query.status && validStatuses.includes(request.query.status)) {
      where.status = request.query.status;
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          catalogItem: true,
          user: {
            select: {
              minecraftUsername: true,
              cosmetics: { select: { hiddenMode: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: perPage,
      }),
      prisma.order.count({ where }),
    ]);

    const mapped = orders.map((o) => marketplaceService._mapOrder(o));

    const meta: PaginationMeta = {
      page,
      perPage,
      total,
      totalPages: Math.ceil(total / perPage),
    };

    return {
      success: true,
      data: { orders: mapped, meta },
    };
  });
};
