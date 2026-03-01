import { FastifyPluginAsync } from 'fastify';
import { internalVerificationRoutes } from './verification.js';

/**
 * Internal routes - /internal/*
 * These routes are for server-to-server communication only.
 */
export const internalRoutes: FastifyPluginAsync = async (fastify) => {
  await fastify.register(internalVerificationRoutes);
};
