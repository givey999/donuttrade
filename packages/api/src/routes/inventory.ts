import { FastifyPluginAsync } from 'fastify';
import { inventoryRepository } from '../repositories/inventory.repository.js';
import type { InventoryItemRecord } from '@donuttrade/shared';

/**
 * User inventory routes — /inventory
 */
export const inventoryRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /inventory
   * Returns the authenticated user's inventory (filters out quantity=0).
   */
  fastify.get('/', {
    preHandler: [fastify.authenticate],
  }, async (request) => {
    const userId = request.user!.id;

    const items = await inventoryRepository.getByUserId(userId);

    const mapped: InventoryItemRecord[] = items
      .filter((item) => item.quantity > 0)
      .map((item) => ({
        id: item.id,
        catalogItemId: item.catalogItemId,
        catalogItemName: item.catalogItem.name,
        catalogItemDisplayName: item.catalogItem.displayName,
        category: item.catalogItem.category,
        quantity: item.quantity,
        reservedQuantity: item.reservedQuantity,
        availableQuantity: item.quantity - item.reservedQuantity,
      }));

    return {
      success: true,
      data: { items: mapped },
    };
  });
};
