import { FastifyPluginAsync } from 'fastify';
import { microsoftAuthRoutes } from './microsoft.js';
import { sessionRoutes } from './session.js';

/**
 * Auth routes - /auth/*
 */
export const authRoutes: FastifyPluginAsync = async (fastify) => {
  // Microsoft OAuth routes
  await fastify.register(microsoftAuthRoutes);

  // Session routes (me, refresh, logout)
  await fastify.register(sessionRoutes);
};
