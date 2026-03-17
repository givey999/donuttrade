import { FastifyPluginAsync } from 'fastify';
import { requireRole } from '../../plugins/require-role.js';
import { adminStatsRoutes } from './stats.js';
import { adminItemDepositRoutes } from './item-deposits.js';
import { adminItemWithdrawalRoutes } from './item-withdrawals.js';
import { adminOrderRoutes } from './orders.js';
import { adminUserRoutes } from './users.js';
import { adminCatalogRoutes } from './catalog.js';
import { adminAuditLogRoutes } from './audit-logs.js';

/**
 * Admin routes — /admin/*
 * All routes require authentication + moderator/manager/admin role.
 */
export const adminRoutes: FastifyPluginAsync = async (fastify) => {
  // Apply auth + role check to all routes in this scope
  fastify.addHook('preHandler', fastify.authenticate);
  fastify.addHook('preHandler', requireRole('moderator', 'manager', 'admin'));

  await fastify.register(adminStatsRoutes, { prefix: '/stats' });
  await fastify.register(adminItemDepositRoutes, { prefix: '/item-deposits' });
  await fastify.register(adminItemWithdrawalRoutes, { prefix: '/item-withdrawals' });
  await fastify.register(adminOrderRoutes, { prefix: '/orders' });
  await fastify.register(adminUserRoutes, { prefix: '/users' });
  await fastify.register(adminCatalogRoutes, { prefix: '/catalog' });
  await fastify.register(adminAuditLogRoutes, { prefix: '/audit-logs' });
};
