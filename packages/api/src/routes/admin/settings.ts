import { FastifyPluginAsync } from 'fastify';
import { requireRole } from '../../plugins/require-role.js';
import { platformSettingsService } from '../../services/platform-settings.service.js';
import { auditService } from '../../services/audit.service.js';

export const adminSettingsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', requireRole('admin', 'leader'));

  fastify.get('/', async () => {
    const settings = await platformSettingsService.getAll();
    return { success: true, data: settings };
  });

  fastify.put<{ Params: { key: string }; Body: { value: string } }>('/:key', async (request) => {
    const { key } = request.params;
    const { value } = request.body;
    await platformSettingsService.update(key, value, request.user!.id);
    await auditService.log({
      actorId: request.user!.id,
      action: 'setting.update',
      targetType: 'setting',
      targetId: key,
      details: { key, value },
    });
    return { success: true };
  });
};
