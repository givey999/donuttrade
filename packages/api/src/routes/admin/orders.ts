import { FastifyPluginAsync } from 'fastify';
import { prisma } from '../../services/database.js';
import { marketplaceService } from '../../services/marketplace.service.js';
import { AppError } from '../../lib/errors.js';
import { auditService } from '../../services/audit.service.js';

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

    return {
      success: true,
      data: {
        orders: orders.map((o) => marketplaceService._mapOrder(o, { adminView: true })),
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
   * GET /admin/orders/export
   * Export all matching orders as CSV.
   */
  fastify.get<{
    Querystring: {
      status?: string;
      type?: string;
      catalogItemId?: string;
      userId?: string;
    };
  }>('/export', async (request, reply) => {
    const where: Record<string, unknown> = {};
    if (request.query.status) where.status = request.query.status;
    if (request.query.type) where.type = request.query.type;
    if (request.query.catalogItemId) where.catalogItemId = request.query.catalogItemId;
    if (request.query.userId) where.userId = request.query.userId;

    const orders = await prisma.order.findMany({
      where,
      include: {
        catalogItem: { select: { displayName: true } },
        user: { select: { minecraftUsername: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 10000,
    });

    const headers = ['ID', 'Username', 'Type', 'Item', 'Quantity', 'Filled', 'Price/ea', 'Status', 'Premium', 'Created', 'Expires', 'Completed'];
    const rows = orders.map((o) => [
      o.id,
      o.user?.minecraftUsername || '',
      o.type,
      o.catalogItem?.displayName || '',
      o.quantity,
      o.filledQuantity,
      o.pricePerUnit.toString(),
      o.status,
      o.isPremium ? 'Yes' : 'No',
      o.createdAt.toISOString(),
      o.expiresAt.toISOString(),
      o.completedAt?.toISOString() || '',
    ]);

    const csv = [
      headers.join(','),
      ...rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')),
    ].join('\n');

    return reply
      .header('Content-Type', 'text/csv')
      .header('Content-Disposition', 'attachment; filename=orders-export.csv')
      .send(csv);
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
    await auditService.log({ actorId: request.user!.id, action: 'order.admin_cancel', targetType: 'order', targetId: request.params.id });
    return { success: true };
  });
};
