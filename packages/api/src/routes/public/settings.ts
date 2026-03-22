import { FastifyPluginAsync } from 'fastify';
import { platformSettingsService } from '../../services/platform-settings.service.js';
import { get, set } from '../../services/redis.js';

export const publicSettingsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/commission-rate', async (_request, reply) => {
    const cacheKey = 'cache:commission_rate';
    const cached = await get(cacheKey);
    if (cached) {
      reply.header('Cache-Control', 'public, max-age=300');
      return JSON.parse(cached);
    }

    const rate = await platformSettingsService.getCommissionRate();
    const response = { success: true, data: { commissionRate: rate } };

    await set(cacheKey, JSON.stringify(response), 600);

    reply.header('Cache-Control', 'public, max-age=300');
    return response;
  });

  fastify.get('/maintenance', async () => {
    const enabled = await platformSettingsService.isMaintenanceEnabled();
    const message = enabled ? await platformSettingsService.getMaintenanceMessage() : '';
    return { success: true, data: { enabled, message } };
  });
};
