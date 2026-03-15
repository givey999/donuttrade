import { FastifyPluginAsync } from 'fastify';
import { catalogItemRepository } from '../repositories/catalog-item.repository.js';
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
  }, async (request) => {
    const items = await catalogItemRepository.findAll({
      category: request.query.category,
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

    return {
      success: true,
      data: { items: mapped },
    };
  });
};
