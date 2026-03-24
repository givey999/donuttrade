import { FastifyPluginAsync } from 'fastify';
import { microsoftAuthRoutes } from './microsoft.js';
import { discordAuthRoutes } from './discord.js';
import { sessionRoutes } from './session.js';
import { usernameRoutes } from './username.js';
import { verificationRoutes } from './verification.js';

/**
 * Auth routes - /auth/*
 */
export const authRoutes: FastifyPluginAsync = async (fastify) => {
  // Microsoft OAuth routes
  await fastify.register(microsoftAuthRoutes);

  // Discord OAuth routes
  await fastify.register(discordAuthRoutes);

  // Session routes (me, refresh, logout)
  await fastify.register(sessionRoutes);

  // Username entry route
  await fastify.register(usernameRoutes);

  // Verification routes (start, status, retry)
  await fastify.register(verificationRoutes);
};
