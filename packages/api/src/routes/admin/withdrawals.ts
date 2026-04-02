import { FastifyPluginAsync } from 'fastify';
import { withdrawalRepository } from '../../repositories/withdrawal.repository.js';
import { withdrawalService } from '../../services/withdrawal.service.js';
import { auditService } from '../../services/audit.service.js';

export const adminWithdrawalRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /admin/withdrawals
   * List money withdrawals with optional status filter + pagination.
   */
  fastify.get<{
    Querystring: { status?: string; page?: string; perPage?: string };
  }>('/', async (request) => {
    const page = Math.max(1, parseInt(request.query.page || '1', 10) || 1);
    const perPage = Math.min(100, Math.max(1, parseInt(request.query.perPage || '20', 10) || 20));
    const statusFilter = request.query.status;

    const filter = statusFilter ? { status: statusFilter } : {};
    const { withdrawals, total } = await withdrawalRepository.findAllWithUser(filter, { page, perPage });

    return {
      success: true,
      data: {
        withdrawals: withdrawals.map((w) => ({
          id: w.id,
          userId: w.userId,
          username: w.user.minecraftUsername ?? 'Unknown',
          amount: w.amount.toString(),
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
   * PATCH /admin/withdrawals/:id/approve
   */
  fastify.patch<{ Params: { id: string } }>('/:id/approve', async (request) => {
    await withdrawalService.approveWithdrawal(request.params.id);
    await auditService.log({
      actorId: request.user!.id,
      action: 'money_withdrawal.approve',
      targetType: 'withdrawal',
      targetId: request.params.id,
    });
    return { success: true };
  });

  /**
   * PATCH /admin/withdrawals/:id/deny
   */
  fastify.patch<{
    Params: { id: string };
    Body: { reason: string };
  }>('/:id/deny', {
    schema: {
      body: {
        type: 'object',
        required: ['reason'],
        properties: {
          reason: { type: 'string', minLength: 1 },
        },
      },
    },
  }, async (request) => {
    const reason = request.body.reason;
    await withdrawalService.denyWithdrawal(request.params.id, reason);
    await auditService.log({
      actorId: request.user!.id,
      action: 'money_withdrawal.deny',
      targetType: 'withdrawal',
      targetId: request.params.id,
      details: { reason },
    });
    return { success: true };
  });
};
