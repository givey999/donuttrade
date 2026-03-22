import { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import { platformSettingsService } from '../services/platform-settings.service.js';
import { prisma } from '../services/database.js';
import { verifyAccessToken } from '../lib/jwt.js';

const EXEMPT_PREFIXES = ['/health', '/auth', '/internal', '/public', '/events'];

const maintenancePluginCallback: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('onRequest', async (request, reply) => {
    const path = request.url.split('?')[0] ?? '';
    if (EXEMPT_PREFIXES.some(prefix => path.startsWith(prefix))) {
      return;
    }

    const isEnabled = await platformSettingsService.isMaintenanceEnabled();
    if (!isEnabled) return;

    // Manually decode Bearer token to check admin role.
    // request.user is NOT populated yet (authenticate runs in preHandler, after onRequest).
    const authHeader = request.headers.authorization;
    if (authHeader) {
      const parts = authHeader.split(' ');
      if (parts.length === 2 && parts[0]?.toLowerCase() === 'bearer' && parts[1]) {
        try {
          const payload = verifyAccessToken(parts[1]);
          const user = await prisma.user.findUnique({
            where: { id: payload.sub },
            select: { role: true },
          });
          if (user?.role === 'admin') return;
        } catch {
          // Token invalid/expired — proceed to block
        }
      }
    }

    const message = await platformSettingsService.getMaintenanceMessage();
    reply.code(503).send({
      success: false,
      error: {
        code: 'MAINTENANCE',
        message: message || 'Platform is under maintenance',
      },
      maintenance: true,
    });
  });
};

export default fp(maintenancePluginCallback, {
  name: 'maintenance',
});
