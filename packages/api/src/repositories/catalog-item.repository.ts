import { prisma } from '../services/database.js';
import { logger } from '../lib/logger.js';

const catLogger = logger.module('catalog-item.repository');

export const catalogItemRepository = {
  async findAll(options?: { category?: string; enabled?: boolean }) {
    const startTime = Date.now();

    try {
      const items = await prisma.catalogItem.findMany({
        where: {
          ...(options?.category ? { category: options.category } : {}),
          ...(options?.enabled !== undefined ? { enabled: options.enabled } : {}),
        },
        orderBy: { displayName: 'asc' },
      });

      catLogger.debug('findAll', 'Catalog items fetched', {
        count: items.length,
        filters: options,
        duration: Date.now() - startTime,
      });

      return items;
    } catch (error) {
      catLogger.error('findAll.failed', 'Failed to fetch catalog items', error);
      throw error;
    }
  },

  async findById(id: string) {
    const startTime = Date.now();

    try {
      const item = await prisma.catalogItem.findUnique({ where: { id } });

      catLogger.debug('findById', 'Catalog item lookup', {
        id,
        found: !!item,
        duration: Date.now() - startTime,
      });

      return item;
    } catch (error) {
      catLogger.error('findById.failed', 'Failed to find catalog item', error, { id });
      throw error;
    }
  },

  async findByName(name: string) {
    const startTime = Date.now();

    try {
      const item = await prisma.catalogItem.findUnique({ where: { name } });

      catLogger.debug('findByName', 'Catalog item lookup by name', {
        name,
        found: !!item,
        duration: Date.now() - startTime,
      });

      return item;
    } catch (error) {
      catLogger.error('findByName.failed', 'Failed to find catalog item by name', error, { name });
      throw error;
    }
  },

  async create(data: { name: string; displayName: string; category?: string; description?: string; iconUrl?: string }) {
    const startTime = Date.now();

    try {
      const item = await prisma.catalogItem.create({ data });

      catLogger.info('create', 'Catalog item created', {
        itemId: item.id,
        name: data.name,
        duration: Date.now() - startTime,
      });

      return item;
    } catch (error) {
      catLogger.error('create.failed', 'Failed to create catalog item', error, { name: data.name });
      throw error;
    }
  },

  async update(id: string, data: { displayName?: string; description?: string; iconUrl?: string; enabled?: boolean }) {
    const startTime = Date.now();

    try {
      const item = await prisma.catalogItem.update({ where: { id }, data });

      catLogger.info('update', 'Catalog item updated', {
        itemId: id,
        fields: Object.keys(data),
        duration: Date.now() - startTime,
      });

      return item;
    } catch (error) {
      catLogger.error('update.failed', 'Failed to update catalog item', error, { id });
      throw error;
    }
  },

  async setEnabled(id: string, enabled: boolean) {
    return this.update(id, { enabled });
  },
};

export type CatalogItemRepository = typeof catalogItemRepository;
