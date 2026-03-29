import { FastifyPluginAsync } from 'fastify';
import { internalVerificationRoutes } from './verification.js';
import { internalDepositRoutes } from './deposit.js';
import { internalWithdrawalRoutes } from './withdrawal.js';
import { internalItemDepositRoutes } from './item-deposit.js';
import { internalItemWithdrawalRoutes } from './item-withdrawal.js';
import { managementBotRoutes } from './management-bot.js';
import { discordBotRoutes } from './discord-bot.js';

/**
 * Internal routes - /internal/*
 * These routes are for server-to-server communication only.
 */
export const internalRoutes: FastifyPluginAsync = async (fastify) => {
  await fastify.register(internalVerificationRoutes);
  await fastify.register(internalDepositRoutes);
  await fastify.register(internalWithdrawalRoutes);
  await fastify.register(internalItemDepositRoutes);
  await fastify.register(internalItemWithdrawalRoutes);
  await fastify.register(managementBotRoutes);
  await fastify.register(discordBotRoutes);
};
