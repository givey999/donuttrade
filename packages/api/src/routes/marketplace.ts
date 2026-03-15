import { FastifyPluginAsync } from 'fastify';
import { prisma } from '../services/database.js';
import type { OrderRecord, OrderFillRecord, OrderDetailRecord, PaginationMeta, OrderType, OrderStatus } from '@donuttrade/shared';

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
          user: { select: { minecraftUsername: true } },
        },
        orderBy,
        skip,
        take: perPage,
      }),
      prisma.order.count({ where }),
    ]);

    const mapped: OrderRecord[] = orders.map((o) => ({
      id: o.id,
      userId: o.userId,
      username: o.user.minecraftUsername ?? 'Unknown',
      type: o.type as OrderType,
      catalogItemId: o.catalogItemId,
      catalogItemDisplayName: o.catalogItem.displayName,
      category: o.catalogItem.category,
      quantity: o.quantity,
      filledQuantity: o.filledQuantity,
      remainingQuantity: o.quantity - o.filledQuantity,
      pricePerUnit: o.pricePerUnit.toString(),
      commissionRate: o.commissionRate.toString(),
      escrowAmount: o.escrowAmount.toString(),
      isPremium: o.isPremium,
      status: o.status as OrderStatus,
      expiresAt: o.expiresAt.toISOString(),
      createdAt: o.createdAt.toISOString(),
      completedAt: o.completedAt?.toISOString() ?? null,
    }));

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
        user: { select: { minecraftUsername: true } },
        fills: {
          include: {
            filledByUser: { select: { minecraftUsername: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!order) {
      return { success: false, error: { code: 'ORDER_NOT_FOUND', message: 'Order not found' } };
    }

    const fills: OrderFillRecord[] = order.fills.map((f) => ({
      id: f.id,
      orderId: f.orderId,
      filledByUserId: f.filledByUserId,
      filledByUsername: f.filledByUser.minecraftUsername ?? 'Unknown',
      quantity: f.quantity,
      pricePerUnit: f.pricePerUnit.toString(),
      totalPrice: f.totalPrice.toString(),
      commissionAmount: f.commissionAmount.toString(),
      netAmount: f.netAmount.toString(),
      createdAt: f.createdAt.toISOString(),
    }));

    const detail: OrderDetailRecord = {
      id: order.id,
      userId: order.userId,
      username: order.user.minecraftUsername ?? 'Unknown',
      type: order.type as OrderType,
      catalogItemId: order.catalogItemId,
      catalogItemDisplayName: order.catalogItem.displayName,
      category: order.catalogItem.category,
      quantity: order.quantity,
      filledQuantity: order.filledQuantity,
      remainingQuantity: order.quantity - order.filledQuantity,
      pricePerUnit: order.pricePerUnit.toString(),
      commissionRate: order.commissionRate.toString(),
      escrowAmount: order.escrowAmount.toString(),
      isPremium: order.isPremium,
      status: order.status as OrderStatus,
      expiresAt: order.expiresAt.toISOString(),
      createdAt: order.createdAt.toISOString(),
      completedAt: order.completedAt?.toISOString() ?? null,
      fills,
    };

    return {
      success: true,
      data: detail,
    };
  });
};
