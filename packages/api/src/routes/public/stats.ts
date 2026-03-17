import { FastifyPluginAsync } from 'fastify';
import { prisma } from '../../services/database.js';

export const publicStatsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', async () => {
    const [totalTraders, activeOrders] = await Promise.all([
      prisma.user.count({ where: { verificationStatus: 'verified' } }),
      prisma.order.count({ where: { status: 'active' } }),
    ]);

    const fillAggregates = await prisma.$queryRaw<[{
      items_traded: bigint;
      total_volume: string;
    }]>`
      SELECT
        COALESCE(SUM(quantity), 0)::bigint AS items_traded,
        COALESCE(SUM(total_price), 0)::text AS total_volume
      FROM order_fills
    `;

    return {
      success: true,
      data: {
        totalTraders,
        itemsTraded: Number(fillAggregates[0].items_traded),
        totalVolume: fillAggregates[0].total_volume,
        activeOrders,
      },
    };
  });
};
