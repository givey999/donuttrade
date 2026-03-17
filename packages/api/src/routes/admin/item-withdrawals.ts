import { FastifyPluginAsync } from 'fastify';
import { prisma } from '../../services/database.js';
import { itemWithdrawalService } from '../../services/item-withdrawal.service.js';

export const adminItemWithdrawalRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /admin/item-withdrawals
   * List withdrawals with optional status filter + pagination.
   */
  fastify.get<{
    Querystring: { status?: string; page?: string; perPage?: string };
  }>('/', async (request) => {
    const page = Math.max(1, parseInt(request.query.page || '1', 10) || 1);
    const perPage = Math.min(100, Math.max(1, parseInt(request.query.perPage || '20', 10) || 20));
    const statusFilter = request.query.status;

    const where = statusFilter ? { status: statusFilter } : {};
    const skip = (page - 1) * perPage;

    const [withdrawals, total] = await Promise.all([
      prisma.itemWithdrawal.findMany({
        where,
        include: {
          catalogItem: true,
          user: { select: { id: true, minecraftUsername: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: perPage,
      }),
      prisma.itemWithdrawal.count({ where }),
    ]);

    return {
      success: true,
      data: {
        withdrawals: withdrawals.map((w) => ({
          id: w.id,
          userId: w.userId,
          username: w.user.minecraftUsername ?? 'Unknown',
          catalogItemId: w.catalogItemId,
          catalogItemDisplayName: w.catalogItem.displayName,
          quantity: w.quantity,
          status: w.status,
          failReason: w.failReason,
          createdAt: w.createdAt.toISOString(),
          completedAt: w.completedAt?.toISOString() ?? null,
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
   * PATCH /admin/item-withdrawals/:id/claim
   */
  fastify.patch<{ Params: { id: string } }>('/:id/claim', async (request) => {
    const claimed = await itemWithdrawalService.claimWithdrawal(request.params.id);
    if (!claimed) {
      return { success: false, error: { code: 'ALREADY_CLAIMED', message: 'Withdrawal is not in pending state' } };
    }
    return { success: true };
  });

  /**
   * PATCH /admin/item-withdrawals/:id/confirm
   */
  fastify.patch<{ Params: { id: string } }>('/:id/confirm', async (request) => {
    await itemWithdrawalService.confirmWithdrawal(request.params.id, request.user!.id);
    return { success: true };
  });

  /**
   * PATCH /admin/item-withdrawals/:id/fail
   */
  fastify.patch<{
    Params: { id: string };
    Body: { reason: string };
  }>('/:id/fail', async (request) => {
    const reason = (request.body as { reason: string })?.reason || 'No reason provided';
    await itemWithdrawalService.failWithdrawal(request.params.id, request.user!.id, reason);
    return { success: true };
  });
};
