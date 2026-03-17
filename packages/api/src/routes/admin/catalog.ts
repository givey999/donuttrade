import { FastifyPluginAsync } from 'fastify';
import { prisma } from '../../services/database.js';
import { AppError } from '../../lib/errors.js';

export const adminCatalogRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /admin/catalog
   * All catalog items (including disabled). Admin only.
   */
  fastify.get('/', async (request) => {
    if (request.user!.role !== 'admin') {
      throw new AppError('Only admins can manage catalog', { code: 'FORBIDDEN', statusCode: 403 });
    }

    const items = await prisma.catalogItem.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return {
      success: true,
      data: {
        items: items.map((item) => ({
          id: item.id,
          name: item.name,
          displayName: item.displayName,
          category: item.category,
          description: item.description,
          iconUrl: item.iconUrl,
          enabled: item.enabled,
          createdAt: item.createdAt.toISOString(),
        })),
      },
    };
  });

  /**
   * POST /admin/catalog
   * Add a new catalog item. Admin only.
   */
  fastify.post<{
    Body: { name: string; displayName: string; category: string; description?: string; iconUrl?: string };
  }>('/', async (request) => {
    if (request.user!.role !== 'admin') {
      throw new AppError('Only admins can manage catalog', { code: 'FORBIDDEN', statusCode: 403 });
    }

    const { name, displayName, category, description, iconUrl } = request.body as {
      name: string; displayName: string; category: string; description?: string; iconUrl?: string;
    };

    if (!name || !displayName || !category) {
      throw new AppError('Name, displayName, and category are required', { code: 'VALIDATION_ERROR', statusCode: 400 });
    }

    const item = await prisma.catalogItem.create({
      data: { name, displayName, category, description: description ?? null, iconUrl: iconUrl ?? null },
    });

    return {
      success: true,
      data: {
        id: item.id,
        name: item.name,
        displayName: item.displayName,
        category: item.category,
        description: item.description,
        iconUrl: item.iconUrl,
        enabled: item.enabled,
        createdAt: item.createdAt.toISOString(),
      },
    };
  });

  /**
   * PATCH /admin/catalog/:id
   * Update a catalog item. Admin only.
   */
  fastify.patch<{
    Params: { id: string };
    Body: { displayName?: string; description?: string; iconUrl?: string; enabled?: boolean };
  }>('/:id', async (request) => {
    if (request.user!.role !== 'admin') {
      throw new AppError('Only admins can manage catalog', { code: 'FORBIDDEN', statusCode: 403 });
    }

    const existing = await prisma.catalogItem.findUnique({ where: { id: request.params.id } });
    if (!existing) throw new AppError('Catalog item not found', { code: 'ITEM_NOT_FOUND', statusCode: 404 });

    const body = request.body as { displayName?: string; description?: string; iconUrl?: string; enabled?: boolean };
    const data: Record<string, unknown> = {};
    if (body.displayName !== undefined) data.displayName = body.displayName;
    if (body.description !== undefined) data.description = body.description;
    if (body.iconUrl !== undefined) data.iconUrl = body.iconUrl;
    if (body.enabled !== undefined) data.enabled = body.enabled;

    const item = await prisma.catalogItem.update({ where: { id: request.params.id }, data });

    return {
      success: true,
      data: {
        id: item.id,
        name: item.name,
        displayName: item.displayName,
        category: item.category,
        description: item.description,
        iconUrl: item.iconUrl,
        enabled: item.enabled,
        createdAt: item.createdAt.toISOString(),
      },
    };
  });
};
