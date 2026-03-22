import { FastifyPluginAsync } from 'fastify';
import { prisma } from '../../services/database.js';
import { get, set } from '../../services/redis.js';
import { ValidationError } from '../../lib/errors.js';

export const publicStatsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', async (_request, reply) => {
    const cacheKey = 'cache:public_stats';
    const cached = await get(cacheKey);
    if (cached) {
      reply.header('Cache-Control', 'public, max-age=60');
      return JSON.parse(cached);
    }

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

    const response = {
      success: true,
      data: {
        totalTraders,
        itemsTraded: Number(fillAggregates[0].items_traded),
        totalVolume: fillAggregates[0].total_volume,
        activeOrders,
      },
    };

    await set(cacheKey, JSON.stringify(response), 120);

    reply.header('Cache-Control', 'public, max-age=60');
    return response;
  });

  fastify.get<{
    Params: { catalogItemId: string };
    Querystring: { period?: string; interval?: string };
  }>('/price-history/:catalogItemId', async (request) => {
    const { catalogItemId } = request.params;
    const period = request.query.period || '7d';
    const interval = request.query.interval || '1d';

    // Validate params
    const validPeriods = ['24h', '7d', '30d'];
    const validIntervals = ['1h', '6h', '1d'];
    if (!validPeriods.includes(period)) {
      throw new ValidationError('Invalid period', { valid: validPeriods });
    }
    if (!validIntervals.includes(interval)) {
      throw new ValidationError('Invalid interval', { valid: validIntervals });
    }

    // Check Redis cache
    const cacheKey = `ph:${catalogItemId}:${period}:${interval}`;
    const cached = await get(cacheKey);
    if (cached) {
      return { success: true, data: { history: JSON.parse(cached) } };
    }

    // Calculate start date
    const periodMs: Record<string, number> = {
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000,
    };
    const startDate = new Date(Date.now() - periodMs[period]!);

    // Map interval to seconds for epoch bucketing
    const intervalSeconds: Record<string, number> = {
      '1h': 3600,
      '6h': 21600,
      '1d': 86400,
    };
    const bucketSeconds = intervalSeconds[interval]!;

    // Query with epoch-based bucketing (works for all intervals)
    const history = await prisma.$queryRaw<Array<{
      bucket: Date;
      avg_price: string;
      min_price: string;
      max_price: string;
      volume: number;
      fills: number;
    }>>`
      SELECT
        to_timestamp(floor(extract(epoch from of.created_at) / ${bucketSeconds}) * ${bucketSeconds}) AS bucket,
        AVG(of.price_per_unit)::text AS avg_price,
        MIN(of.price_per_unit)::text AS min_price,
        MAX(of.price_per_unit)::text AS max_price,
        SUM(of.quantity)::int AS volume,
        COUNT(*)::int AS fills
      FROM order_fills of
      JOIN orders o ON o.id = of.order_id
      WHERE o.catalog_item_id = ${catalogItemId}
        AND of.created_at >= ${startDate}
      GROUP BY bucket
      ORDER BY bucket ASC
    `;

    const result = history.map(row => ({
      timestamp: row.bucket.toISOString(),
      avgPrice: row.avg_price,
      minPrice: row.min_price,
      maxPrice: row.max_price,
      volume: row.volume,
      fills: row.fills,
    }));

    // Cache for 5 minutes
    await set(cacheKey, JSON.stringify(result), 300);

    return { success: true, data: { history: result } };
  });

  fastify.get<{
    Params: { catalogItemId: string };
  }>('/item-summary/:catalogItemId', async (request) => {
    const { catalogItemId } = request.params;

    // Check Redis cache
    const cacheKey = `is:${catalogItemId}`;
    const cached = await get(cacheKey);
    if (cached) {
      return { success: true, data: JSON.parse(cached) };
    }

    const [lastFill, stats24h] = await Promise.all([
      prisma.$queryRaw<Array<{ price_per_unit: string }>>`
        SELECT of.price_per_unit::text
        FROM order_fills of
        JOIN orders o ON o.id = of.order_id
        WHERE o.catalog_item_id = ${catalogItemId}
        ORDER BY of.created_at DESC
        LIMIT 1
      `,
      prisma.$queryRaw<Array<{
        avg_price: string;
        total_volume: number;
        total_fills: number;
      }>>`
        SELECT
          COALESCE(AVG(of.price_per_unit), 0)::text AS avg_price,
          COALESCE(SUM(of.quantity), 0)::int AS total_volume,
          COUNT(*)::int AS total_fills
        FROM order_fills of
        JOIN orders o ON o.id = of.order_id
        WHERE o.catalog_item_id = ${catalogItemId}
          AND of.created_at >= NOW() - INTERVAL '24 hours'
      `,
    ]);

    const result = {
      lastSoldPrice: lastFill[0]?.price_per_unit || null,
      avgPrice24h: stats24h[0]?.avg_price || '0',
      totalVolume24h: stats24h[0]?.total_volume || 0,
      totalFills24h: stats24h[0]?.total_fills || 0,
    };

    // Cache for 2 minutes
    await set(cacheKey, JSON.stringify(result), 120);

    return { success: true, data: result };
  });
};
