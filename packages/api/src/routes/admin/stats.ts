import { FastifyPluginAsync } from 'fastify';
import { prisma } from '../../services/database.js';

export const adminStatsRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /admin/stats
   * Dashboard statistics + volume per catalog item.
   */
  fastify.get('/', async () => {
    const [
      totalUsers,
      pendingDeposits,
      pendingWithdrawals,
      pendingMoneyWithdrawals,
      activeOrders,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.itemDeposit.count({ where: { status: 'pending' } }),
      prisma.itemWithdrawal.count({ where: { status: { in: ['pending', 'processing'] } } }),
      prisma.withdrawal.count({ where: { status: 'pending' } }),
      prisma.order.count({ where: { status: 'active' } }),
    ]);

    // Volume per catalog item (from order fills)
    const volumeByItem = await prisma.$queryRaw<Array<{
      id: string;
      display_name: string;
      total_traded: bigint;
      total_volume: string;
    }>>`
      SELECT ci.id, ci.display_name,
        COALESCE(SUM(of.quantity), 0)::bigint as total_traded,
        COALESCE(SUM(of.total_price), 0)::text as total_volume
      FROM catalog_items ci
      LEFT JOIN orders o ON o.catalog_item_id = ci.id
      LEFT JOIN order_fills of ON of.order_id = o.id
      GROUP BY ci.id, ci.display_name
      ORDER BY COALESCE(SUM(of.total_price), 0) DESC
    `;

    return {
      success: true,
      data: {
        totalUsers,
        pendingDeposits,
        pendingWithdrawals,
        pendingMoneyWithdrawals,
        activeOrders,
        volumeByItem: volumeByItem.map((row) => ({
          id: row.id,
          displayName: row.display_name,
          totalTraded: Number(row.total_traded),
          totalVolume: row.total_volume,
        })),
      },
    };
  });
};
