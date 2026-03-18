import { FastifyPluginAsync } from 'fastify';
import { platformSettingsService } from '../../services/platform-settings.service.js';

export const publicSettingsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/commission-rate', async () => {
    const rate = await platformSettingsService.getCommissionRate();
    return { success: true, data: { commissionRate: rate } };
  });
};
