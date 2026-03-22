import { FastifyPluginAsync } from 'fastify';
import { prisma } from '../services/database.js';
import { marketplaceService } from '../services/marketplace.service.js';
import type { OrderFillRecord, OrderDetailRecord, PaginationMeta } from '@donuttrade/shared';

/**
 * Public marketplace routes — /marketplace
 */
export const marketplaceRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /marketplace
   * Browse active orders with filters.
   */
  fastify.get<{
    Querystring: {
      type?: string;
      catalogItemId?: string;
      category?: string;
      minPrice?: string;
      maxPrice?: string;
      sort?: string;
      page?: string;
      perPage?: string;
    };
  }>('/', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          type: { type: 'string' },
          catalogItemId: { type: 'string' },
          category: { type: 'string' },
          minPrice: { type: 'string' },
          maxPrice: { type: 'string' },
          sort: { type: 'string' },
          page: { type: 'string' },
          perPage: { type: 'string' },
        },
      },
    },
  }, async (request) => {
    const page = Math.max(1, parseInt(request.query.page || '1', 10) || 1);
    const perPage = Math.min(100, Math.max(1, parseInt(request.query.perPage || '20', 10) || 20));
    const skip = (page - 1) * perPage;

    // Build where clause
    const where: any = { status: 'active' };

    if (request.query.type && (request.query.type === 'buy' || request.query.type === 'sell')) {
      where.type = request.query.type;
    }
    if (request.query.catalogItemId) {
      where.catalogItemId = request.query.catalogItemId;
    }
    if (request.query.category) {
      where.catalogItem = { category: request.query.category };
    }
    if (request.query.minPrice || request.query.maxPrice) {
      where.pricePerUnit = {};
      if (request.query.minPrice) where.pricePerUnit.gte = parseFloat(request.query.minPrice);
      if (request.query.maxPrice) where.pricePerUnit.lte = parseFloat(request.query.maxPrice);
    }

    // Sort
    let orderBy: any = { createdAt: 'desc' };
    const sort = request.query.sort;
    if (sort === 'price_asc') orderBy = { pricePerUnit: 'asc' };
    else if (sort === 'price_desc') orderBy = { pricePerUnit: 'desc' };
    else if (sort === 'expiring_soon') orderBy = { expiresAt: 'asc' };

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
        orderBy,
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
      nextCursor: orders.length > 0 ? orders[orders.length - 1]!.id : null,
      prevCursor: orders.length > 0 ? orders[0]!.id : null,
    };

    return {
      success: true,
      data: { orders: mapped, meta },
    };
  });

  /**
   * GET /marketplace/:id
   * Order detail with fills.
   */
  fastify.get<{
    Params: { id: string };
  }>('/:id', async (request) => {
    const { id } = request.params;

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        catalogItem: true,
        user: {
          select: {
            minecraftUsername: true,
            cosmetics: { select: { hiddenMode: true } },
          },
        },
        fills: {
          include: {
            filledByUser: {
              select: {
                minecraftUsername: true,
                cosmetics: { select: { hiddenMode: true } },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!order) {
      return { success: false, error: { code: 'ORDER_NOT_FOUND', message: 'Order not found' } };
    }

    const fills: OrderFillRecord[] = order.fills.map((fill: any) => ({
      id: fill.id,
      orderId: fill.orderId,
      filledByUserId: fill.filledByUserId,
      filledByUsername: fill.filledByUser?.cosmetics?.hiddenMode
        ? 'Hidden'
        : (fill.filledByUser?.minecraftUsername ?? 'Unknown'),
      quantity: fill.quantity,
      pricePerUnit: fill.pricePerUnit.toString(),
      totalPrice: fill.totalPrice.toString(),
      commissionAmount: fill.commissionAmount.toString(),
      netAmount: fill.netAmount.toString(),
      createdAt: fill.createdAt.toISOString(),
    }));

    const detail: OrderDetailRecord = {
      ...marketplaceService._mapOrder(order),
      fills,
    };

    return {
      success: true,
      data: detail,
    };
  });
};
