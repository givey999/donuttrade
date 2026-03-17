import { FastifyPluginAsync } from 'fastify';
import { prisma } from '../../services/database.js';
import { itemDepositService } from '../../services/item-deposit.service.js';

export const adminItemDepositRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /admin/item-deposits
   * List deposits with optional status filter + pagination.
   */
  fastify.get<{
    Querystring: { status?: string; page?: string; perPage?: string };
  }>('/', async (request) => {
    const page = Math.max(1, parseInt(request.query.page || '1', 10) || 1);
    const perPage = Math.min(100, Math.max(1, parseInt(request.query.perPage || '20', 10) || 20));
    const statusFilter = request.query.status;

    const where = statusFilter ? { status: statusFilter } : {};
    const skip = (page - 1) * perPage;

    const [deposits, total] = await Promise.all([
      prisma.itemDeposit.findMany({
        where,
        include: {
          catalogItem: true,
          user: { select: { id: true, minecraftUsername: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: perPage,
      }),
      prisma.itemDeposit.count({ where }),
    ]);

    return {
      success: true,
      data: {
        deposits: deposits.map((d) => ({
          id: d.id,
          userId: d.userId,
          username: d.user.minecraftUsername ?? 'Unknown',
          catalogItemId: d.catalogItemId,
          catalogItemDisplayName: d.catalogItem.displayName,
          quantity: d.quantity,
          status: d.status,
          adminNotes: d.adminNotes,
          createdAt: d.createdAt.toISOString(),
          completedAt: d.completedAt?.toISOString() ?? null,
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
   * PATCH /admin/item-deposits/:id/confirm
   */
  fastify.patch<{ Params: { id: string } }>('/:id/confirm', async (request) => {
    await itemDepositService.confirmDeposit(request.params.id, request.user!.id);
    return { success: true };
  });

  /**
   * PATCH /admin/item-deposits/:id/reject
   */
  fastify.patch<{
    Params: { id: string };
    Body: { notes?: string };
  }>('/:id/reject', async (request) => {
    const notes = (request.body as { notes?: string })?.notes;
    await itemDepositService.rejectDeposit(request.params.id, request.user!.id, notes);
    return { success: true };
  });
};
