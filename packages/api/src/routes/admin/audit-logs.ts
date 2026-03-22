import { FastifyPluginAsync } from 'fastify';
import { prisma } from '../../services/database.js';

export const adminAuditLogRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /admin/audit-logs/export
   * Export all matching audit logs as CSV.
   */
  fastify.get<{
    Querystring: {
      action?: string;
      actorId?: string;
      targetType?: string;
      targetId?: string;
    };
  }>('/export', async (request, reply) => {
    const where: Record<string, unknown> = {};
    if (request.query.action) where.action = request.query.action;
    if (request.query.actorId) where.actorId = request.query.actorId;
    if (request.query.targetType) where.targetType = request.query.targetType;
    if (request.query.targetId) where.targetId = request.query.targetId;

    const logs = await prisma.auditLog.findMany({
      where,
      include: { actor: { select: { minecraftUsername: true } } },
      orderBy: { createdAt: 'desc' },
      take: 10000,
    });

    const headers = ['ID', 'Actor', 'Action', 'Target Type', 'Target ID', 'Details', 'Date'];
    const rows = logs.map((l) => [
      l.id,
      l.actor?.minecraftUsername || l.actorId,
      l.action,
      l.targetType || '',
      l.targetId || '',
      l.details ? JSON.stringify(l.details) : '',
      l.createdAt.toISOString(),
    ]);

    const csv = [
      headers.join(','),
      ...rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')),
    ].join('\n');

    return reply
      .header('Content-Type', 'text/csv')
      .header('Content-Disposition', 'attachment; filename=audit-log-export.csv')
      .send(csv);
  });

  /**
   * GET /admin/audit-logs
   * List audit logs with filters + pagination. Admin only.
   */
  fastify.get<{
    Querystring: {
      action?: string;
      actorId?: string;
      targetType?: string;
      targetId?: string;
      page?: string;
      perPage?: string;
    };
  }>('/', async (request) => {
    const page = Math.max(1, parseInt(request.query.page || '1', 10) || 1);
    const perPage = Math.min(100, Math.max(1, parseInt(request.query.perPage || '50', 10) || 50));
    const skip = (page - 1) * perPage;

    const where: Record<string, unknown> = {};
    if (request.query.action) where.action = request.query.action;
    if (request.query.actorId) where.actorId = request.query.actorId;
    if (request.query.targetType) where.targetType = request.query.targetType;
    if (request.query.targetId) where.targetId = request.query.targetId;

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: {
          actor: { select: { id: true, minecraftUsername: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: perPage,
      }),
      prisma.auditLog.count({ where }),
    ]);

    return {
      success: true,
      data: {
        logs: logs.map((log) => ({
          id: log.id,
          actorId: log.actorId,
          actorUsername: log.actor.minecraftUsername ?? 'Unknown',
          action: log.action,
          targetType: log.targetType,
          targetId: log.targetId,
          details: log.details,
          createdAt: log.createdAt.toISOString(),
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
};
