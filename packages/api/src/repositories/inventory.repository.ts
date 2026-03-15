import { prisma } from '../services/database.js';
import { logger } from '../lib/logger.js';
import { AppError } from '../lib/errors.js';

type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

const invLogger = logger.module('inventory.repository');

export const inventoryRepository = {
  /**
   * Get all inventory items for a user, with catalog item details.
   */
  async getByUserId(userId: string, tx?: TxClient) {
    const startTime = Date.now();
    const client = tx ?? prisma;

    try {
      const items = await client.inventoryItem.findMany({
        where: { userId },
        include: { catalogItem: true },
        orderBy: { catalogItem: { displayName: 'asc' } },
      });

      invLogger.debug('getByUserId', 'Inventory fetched', {
        userId,
        count: items.length,
        duration: Date.now() - startTime,
      });

      return items;
    } catch (error) {
      invLogger.error('getByUserId.failed', 'Failed to fetch inventory', error, { userId });
      throw error;
    }
  },

  /**
   * Get a single inventory entry for a user + catalog item.
   */
  async getByUserAndItem(userId: string, catalogItemId: string, tx?: TxClient) {
    const startTime = Date.now();
    const client = tx ?? prisma;

    try {
      const item = await client.inventoryItem.findUnique({
        where: { userId_catalogItemId: { userId, catalogItemId } },
        include: { catalogItem: true },
      });

      invLogger.debug('getByUserAndItem', 'Inventory item lookup', {
        userId,
        catalogItemId,
        found: !!item,
        duration: Date.now() - startTime,
      });

      return item;
    } catch (error) {
      invLogger.error('getByUserAndItem.failed', 'Failed to fetch inventory item', error, { userId, catalogItemId });
      throw error;
    }
  },

  /**
   * Add items to a user's inventory. Upserts the row if it doesn't exist.
   */
  async addItems(userId: string, catalogItemId: string, quantity: number, tx?: TxClient) {
    const startTime = Date.now();
    const client = tx ?? prisma;

    try {
      const item = await client.inventoryItem.upsert({
        where: { userId_catalogItemId: { userId, catalogItemId } },
        create: { userId, catalogItemId, quantity },
        update: { quantity: { increment: quantity } },
      });

      invLogger.info('addItems', 'Items added to inventory', {
        userId,
        catalogItemId,
        quantity,
        newTotal: item.quantity,
        duration: Date.now() - startTime,
      });

      return item;
    } catch (error) {
      invLogger.error('addItems.failed', 'Failed to add items', error, { userId, catalogItemId, quantity });
      throw error;
    }
  },

  /**
   * Remove items from a user's inventory.
   * Atomic: WHERE quantity - reserved_quantity >= amount.
   */
  async removeItems(userId: string, catalogItemId: string, quantity: number, tx?: TxClient) {
    const startTime = Date.now();
    const client = tx ?? prisma;

    try {
      // Atomic conditional update to prevent removing reserved items
      const result = await client.inventoryItem.updateMany({
        where: {
          userId,
          catalogItemId,
          quantity: { gte: quantity },
        },
        data: { quantity: { decrement: quantity } },
      });

      if (result.count === 0) {
        throw new AppError('Insufficient available items', {
          code: 'INSUFFICIENT_ITEMS',
          statusCode: 400,
          details: { userId, catalogItemId, requested: quantity },
        });
      }

      invLogger.info('removeItems', 'Items removed from inventory', {
        userId,
        catalogItemId,
        quantity,
        duration: Date.now() - startTime,
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      invLogger.error('removeItems.failed', 'Failed to remove items', error, { userId, catalogItemId, quantity });
      throw error;
    }
  },

  /**
   * Reserve items for a sell order.
   * Atomic: WHERE quantity - reserved_quantity >= amount.
   */
  async reserveItems(userId: string, catalogItemId: string, quantity: number, tx?: TxClient) {
    const startTime = Date.now();
    const client = tx ?? prisma;

    try {
      // Use raw SQL for the compound condition: quantity - reserved_quantity >= quantity_to_reserve
      const result = await client.$executeRaw`
        UPDATE inventory_items
        SET reserved_quantity = reserved_quantity + ${quantity}, updated_at = NOW()
        WHERE user_id = ${userId}
          AND catalog_item_id = ${catalogItemId}
          AND quantity - reserved_quantity >= ${quantity}
      `;

      if (result === 0) {
        throw new AppError('Insufficient available items to reserve', {
          code: 'INSUFFICIENT_ITEMS',
          statusCode: 400,
          details: { userId, catalogItemId, requested: quantity },
        });
      }

      invLogger.info('reserveItems', 'Items reserved', {
        userId,
        catalogItemId,
        quantity,
        duration: Date.now() - startTime,
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      invLogger.error('reserveItems.failed', 'Failed to reserve items', error, { userId, catalogItemId, quantity });
      throw error;
    }
  },

  /**
   * Release a reservation (e.g., on order cancel).
   */
  async releaseReservation(userId: string, catalogItemId: string, quantity: number, tx?: TxClient) {
    const startTime = Date.now();
    const client = tx ?? prisma;

    try {
      const result = await client.inventoryItem.updateMany({
        where: {
          userId,
          catalogItemId,
          reservedQuantity: { gte: quantity },
        },
        data: { reservedQuantity: { decrement: quantity } },
      });

      if (result.count === 0) {
        throw new AppError('Cannot release more than reserved', {
          code: 'INVALID_RELEASE',
          statusCode: 400,
          details: { userId, catalogItemId, requested: quantity },
        });
      }

      invLogger.info('releaseReservation', 'Reservation released', {
        userId,
        catalogItemId,
        quantity,
        duration: Date.now() - startTime,
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      invLogger.error('releaseReservation.failed', 'Failed to release reservation', error, { userId, catalogItemId, quantity });
      throw error;
    }
  },

  /**
   * Transfer reserved items from seller to buyer.
   * Decrements seller's quantity AND reservedQuantity, upserts buyer's inventory.
   */
  async transferReservedItems(
    fromUserId: string,
    toUserId: string,
    catalogItemId: string,
    quantity: number,
    tx?: TxClient,
  ) {
    const startTime = Date.now();
    const client = tx ?? prisma;

    try {
      // Decrement seller's quantity and reservedQuantity
      const result = await client.inventoryItem.updateMany({
        where: {
          userId: fromUserId,
          catalogItemId,
          quantity: { gte: quantity },
          reservedQuantity: { gte: quantity },
        },
        data: {
          quantity: { decrement: quantity },
          reservedQuantity: { decrement: quantity },
        },
      });

      if (result.count === 0) {
        throw new AppError('Insufficient reserved items to transfer', {
          code: 'INSUFFICIENT_ITEMS',
          statusCode: 400,
          details: { fromUserId, catalogItemId, requested: quantity },
        });
      }

      // Upsert buyer's inventory
      await client.inventoryItem.upsert({
        where: { userId_catalogItemId: { userId: toUserId, catalogItemId } },
        create: { userId: toUserId, catalogItemId, quantity },
        update: { quantity: { increment: quantity } },
      });

      invLogger.info('transferReservedItems', 'Reserved items transferred', {
        fromUserId,
        toUserId,
        catalogItemId,
        quantity,
        duration: Date.now() - startTime,
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      invLogger.error('transferReservedItems.failed', 'Failed to transfer items', error, {
        fromUserId,
        toUserId,
        catalogItemId,
        quantity,
      });
      throw error;
    }
  },
};

export type InventoryRepository = typeof inventoryRepository;
