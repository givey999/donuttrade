import { FastifyPluginAsync } from 'fastify';
import { catalogItemRepository } from '../repositories/catalog-item.repository.js';
import { get, set } from '../services/redis.js';
import type { CatalogItemRecord } from '@donuttrade/shared';

/**
 * Public catalog routes — /catalog
 */
export const catalogRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /catalog/items
   * Returns all enabled catalog items. Optional ?category=spawner filter.
   */
  fastify.get<{
    Querystring: { category?: string };
  }>('/items', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          category: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const cacheKey = 'cache:catalog:items';
    const cached = await get(cacheKey);
    if (cached) {
      const allItems: CatalogItemRecord[] = JSON.parse(cached);
      const category = request.query.category;
      const filtered = category
        ? allItems.filter((item) => item.category === category)
        : allItems;

      reply.header('Cache-Control', 'public, max-age=60');
      return {
        success: true,
        data: { items: filtered },
      };
    }

    const items = await catalogItemRepository.findAll({
      enabled: true,
    });

    const mapped: CatalogItemRecord[] = items.map((item) => ({
      id: item.id,
      name: item.name,
      displayName: item.displayName,
      category: item.category,
      description: item.description,
      iconUrl: item.iconUrl,
      enabled: item.enabled,
    }));

    await set(cacheKey, JSON.stringify(mapped), 300);

    const category = request.query.category;
    const filtered = category
      ? mapped.filter((item) => item.category === category)
      : mapped;

    reply.header('Cache-Control', 'public, max-age=60');
    return {
      success: true,
      data: { items: filtered },
    };
  });
};
