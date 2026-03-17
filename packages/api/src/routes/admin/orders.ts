import { FastifyPluginAsync } from 'fastify';
import { prisma } from '../../services/database.js';
import { marketplaceService } from '../../services/marketplace.service.js';
import { AppError } from '../../lib/errors.js';

export const adminOrderRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /admin/orders
   * List all orders with filters + pagination.
   */
  fastify.get<{
    Querystring: {
      status?: string;
      type?: string;
      catalogItemId?: string;
      userId?: string;
      page?: string;
      perPage?: string;
    };
  }>('/', async (request) => {
    const page = Math.max(1, parseInt(request.query.page || '1', 10) || 1);
    const perPage = Math.min(100, Math.max(1, parseInt(request.query.perPage || '20', 10) || 20));
    const skip = (page - 1) * perPage;

    const where: Record<string, unknown> = {};
    if (request.query.status) where.status = request.query.status;
    if (request.query.type) where.type = request.query.type;
    if (request.query.catalogItemId) where.catalogItemId = request.query.catalogItemId;
    if (request.query.userId) where.userId = request.query.userId;

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          catalogItem: true,
          user: { select: { minecraftUsername: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: perPage,
      }),
      prisma.order.count({ where }),
    ]);

    return {
      success: true,
      data: {
        orders: orders.map((o) => ({
          id: o.id,
          userId: o.userId,
          username: o.user.minecraftUsername ?? 'Unknown',
          type: o.type,
          catalogItemId: o.catalogItemId,
          catalogItemDisplayName: o.catalogItem.displayName,
          category: o.catalogItem.category,
          quantity: o.quantity,
          filledQuantity: o.filledQuantity,
          remainingQuantity: o.quantity - o.filledQuantity,
          pricePerUnit: o.pricePerUnit.toString(),
          escrowAmount: o.escrowAmount.toString(),
          isPremium: o.isPremium,
          status: o.status,
          expiresAt: o.expiresAt.toISOString(),
          createdAt: o.createdAt.toISOString(),
          completedAt: o.completedAt?.toISOString() ?? null,
        })),
        meta: {
          page,
          perPage,
          total,
          totalPages: Math.ceil(total / perPage),
        },
      },
    };
  });

  /**
   * DELETE /admin/orders/:id
   * Admin/Manager cancel any order (bypasses ownership check).
   */
  fastify.delete<{ Params: { id: string } }>('/:id', async (request) => {
    const role = request.user!.role;
    if (role !== 'admin' && role !== 'manager') {
      throw new AppError('Only managers and admins can cancel orders', {
        code: 'FORBIDDEN',
        statusCode: 403,
      });
    }

    await marketplaceService.adminCancelOrder(request.params.id, request.user!.id);
    return { success: true };
  });
};
