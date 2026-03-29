import { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { config } from '../../config/index.js';
import { logger } from '../../lib/logger.js';
import { AppError } from '../../lib/errors.js';
import { prisma } from '../../services/database.js';
import { get, set } from '../../services/redis.js';

const botLogger = logger.module('internal.discord-bot');

export const discordBotRoutes: FastifyPluginAsync = async (fastify) => {
  const authenticateBot = async (request: FastifyRequest) => {
    const authHeader = request.headers.authorization;
    if (!authHeader) {
      throw new AppError('Authorization required', { code: 'UNAUTHORIZED', statusCode: 401 });
    }
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer' || parts[1] !== config.BOT_WEBHOOK_SECRET) {
      botLogger.warn('unauthorized', 'Invalid webhook secret');
      throw new AppError('Invalid authorization', { code: 'UNAUTHORIZED', statusCode: 401 });
    }
  };

  /**
   * GET /internal/discord-bot/user/:discordId
   * Look up a DonutTrade user by their linked Discord ID.
   */
  fastify.get<{ Params: { discordId: string } }>('/discord-bot/user/:discordId', {
    preHandler: authenticateBot,
  }, async (request) => {
    const { discordId } = request.params;

    const user = await prisma.user.findUnique({
      where: { discordId },
      select: {
        id: true,
        minecraftUsername: true,
        balance: true,
        tradingVolume: true,
        verificationStatus: true,
        role: true,
        inventoryItems: {
          include: { catalogItem: true },
          where: { quantity: { gt: 0 } },
        },
      },
    });

    if (!user) {
      throw new AppError('User not found', { code: 'USER_NOT_FOUND', statusCode: 404 });
    }

    return {
      success: true,
      data: {
        id: user.id,
        minecraftUsername: user.minecraftUsername,
        balance: user.balance.toString(),
        tradingVolume: user.tradingVolume.toString(),
        verificationStatus: user.verificationStatus,
        role: user.role,
        inventory: user.inventoryItems.map(i => ({
          item: i.catalogItem.displayName,
          quantity: i.quantity,
          reserved: i.reservedQuantity,
        })),
      },
    };
  });

  /**
   * GET /internal/discord-bot/user/:discordId/orders
   * Get active orders for a user by Discord ID.
   */
  fastify.get<{ Params: { discordId: string } }>('/discord-bot/user/:discordId/orders', {
    preHandler: authenticateBot,
  }, async (request) => {
    const { discordId } = request.params;

    const user = await prisma.user.findUnique({
      where: { discordId },
      select: { id: true },
    });

    if (!user) {
      throw new AppError('User not found', { code: 'USER_NOT_FOUND', statusCode: 404 });
    }

    const orders = await prisma.order.findMany({
      where: { userId: user.id, status: 'active' },
      include: { catalogItem: true },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    return {
      success: true,
      data: orders.map(o => ({
        id: o.id,
        type: o.type,
        item: o.catalogItem.displayName,
        quantity: o.quantity,
        filled: o.filledQuantity,
        pricePerUnit: o.pricePerUnit.toString(),
        expiresAt: o.expiresAt.toISOString(),
      })),
    };
  });

  /**
   * GET /internal/discord-bot/stats
   * Platform statistics for the /stats command.
   * Cached for 2 minutes.
   */
  fastify.get('/discord-bot/stats', {
    preHandler: authenticateBot,
  }, async () => {
    const cacheKey = 'cache:discord_bot_stats';
    const cached = await get(cacheKey);
    if (cached) return JSON.parse(cached);

    const [totalTraders, activeOrders, volume24h, totalVolume] = await Promise.all([
      prisma.user.count({ where: { verificationStatus: 'verified' } }),
      prisma.order.count({ where: { status: 'active' } }),
      prisma.$queryRaw<[{ vol: string }]>`
        SELECT COALESCE(SUM(total_price), 0)::text AS vol
        FROM order_fills
        WHERE created_at >= NOW() - INTERVAL '24 hours'
      `.then(r => r[0].vol),
      prisma.$queryRaw<[{ vol: string }]>`
        SELECT COALESCE(SUM(total_price), 0)::text AS vol
        FROM order_fills
      `.then(r => r[0].vol),
    ]);

    const response = {
      success: true,
      data: { totalTraders, activeOrders, volume24h, totalVolume },
    };

    await set(cacheKey, JSON.stringify(response), 120);
    return response;
  });

  /**
   * GET /internal/discord-bot/leaderboard
   * Top 10 traders by trading volume.
   * Cached for 5 minutes.
   */
  fastify.get('/discord-bot/leaderboard', {
    preHandler: authenticateBot,
  }, async () => {
    const cacheKey = 'cache:discord_bot_leaderboard';
    const cached = await get(cacheKey);
    if (cached) return JSON.parse(cached);

    const top = await prisma.user.findMany({
      where: {
        verificationStatus: 'verified',
        tradingVolume: { gt: 0 },
      },
      select: {
        minecraftUsername: true,
        tradingVolume: true,
      },
      orderBy: { tradingVolume: 'desc' },
      take: 10,
    });

    const response = {
      success: true,
      data: top.map((u, i) => ({
        rank: i + 1,
        username: u.minecraftUsername ?? 'Unknown',
        volume: u.tradingVolume.toString(),
      })),
    };

    await set(cacheKey, JSON.stringify(response), 300);
    return response;
  });

  /**
   * GET /internal/discord-bot/discord-id/:userId
   * Reverse lookup: userId → discordId. Used by DM notifications.
   */
  fastify.get<{ Params: { userId: string } }>('/discord-bot/discord-id/:userId', {
    preHandler: authenticateBot,
  }, async (request) => {
    const { userId } = request.params;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { discordId: true },
    });

    if (!user || !user.discordId) {
      throw new AppError('No Discord ID for this user', { code: 'NOT_FOUND', statusCode: 404 });
    }

    return { success: true, data: { discordId: user.discordId } };
  });
};
