import { FastifyPluginAsync } from 'fastify';
import { requireRole } from '../../plugins/require-role.js';
import { prisma } from '../../services/database.js';

export const adminRevenueRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', requireRole('admin', 'leader'));

  fastify.get('/', async () => {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setUTCDate(now.getUTCDate() - now.getUTCDay());
    startOfWeek.setUTCHours(0, 0, 0, 0);
    const startOfMonth = new Date(now.getUTCFullYear(), now.getUTCMonth(), 1);

    const [totalResult, weekResult, monthResult, byItemResult] = await Promise.all([
      prisma.orderFill.aggregate({ _sum: { commissionAmount: true } }),
      prisma.orderFill.aggregate({
        _sum: { commissionAmount: true },
        where: { createdAt: { gte: startOfWeek } },
      }),
      prisma.orderFill.aggregate({
        _sum: { commissionAmount: true },
        where: { createdAt: { gte: startOfMonth } },
      }),
      prisma.$queryRaw`
        SELECT ci.display_name AS "itemName", ci.id AS "catalogItemId",
               SUM(of.commission_amount)::text AS "totalCommission",
               COUNT(of.id)::int AS "fillCount"
        FROM order_fills of
        JOIN orders o ON of.order_id = o.id
        JOIN catalog_items ci ON o.catalog_item_id = ci.id
        GROUP BY ci.id, ci.display_name
        ORDER BY SUM(of.commission_amount) DESC
        LIMIT 10
      `,
    ]);

    return {
      success: true,
      data: {
        totalCommission: totalResult._sum.commissionAmount?.toString() ?? '0',
        weekCommission: weekResult._sum.commissionAmount?.toString() ?? '0',
        monthCommission: monthResult._sum.commissionAmount?.toString() ?? '0',
        byItem: byItemResult,
      },
    };
  });
};
