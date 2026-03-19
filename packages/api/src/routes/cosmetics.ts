import { FastifyPluginAsync } from 'fastify';
import { cosmeticsService } from '../services/cosmetics.service.js';
import { AppError, ValidationError } from '../lib/errors.js';

export const cosmeticsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', fastify.authenticate);

  fastify.get('/', async (request) => {
    const data = await cosmeticsService.getUserCosmetics(request.user!.id);
    return { success: true, data };
  });

  fastify.post<{ Body: { type: 'color' | 'font'; id: string } }>('/unlock', async (request) => {
    if (request.user!.impersonatedBy) {
      throw new AppError('Cannot perform financial actions while impersonating', { code: 'IMPERSONATION_BLOCKED', statusCode: 403 });
    }
    const { type, id } = request.body;
    if (type !== 'color' && type !== 'font') {
      throw new ValidationError('Type must be "color" or "font"');
    }
    await cosmeticsService.unlockCosmetic(request.user!.id, type, id);
    return { success: true };
  });

  fastify.post('/hidden/purchase', async (request) => {
    if (request.user!.impersonatedBy) {
      throw new AppError('Cannot perform financial actions while impersonating', { code: 'IMPERSONATION_BLOCKED', statusCode: 403 });
    }
    await cosmeticsService.purchaseHiddenMode(request.user!.id);
    return { success: true };
  });

  fastify.post('/hidden/toggle', async (request) => {
    const hiddenMode = await cosmeticsService.toggleHiddenMode(request.user!.id);
    return { success: true, data: { hiddenMode } };
  });
};
