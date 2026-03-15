import { prisma } from './database.js';
import { withTransaction } from './database.js';
import { inventoryRepository } from '../repositories/inventory.repository.js';
import { catalogItemRepository } from '../repositories/catalog-item.repository.js';
import { userRepository } from '../repositories/user.repository.js';
import { logger } from '../lib/logger.js';
import { AppError, ValidationError } from '../lib/errors.js';

const wdLogger = logger.module('item-withdrawal.service');

export const itemWithdrawalService = {
  /**
   * Request an item withdrawal (user action).
   * Reserves items atomically — they can't be traded while withdrawal is pending.
   */
  async requestWithdrawal(userId: string, catalogItemId: string, quantity: number) {
    wdLogger.info('requestWithdrawal', 'Item withdrawal requested', { userId, catalogItemId, quantity });

    if (quantity < 1) {
      throw new ValidationError('Quantity must be at least 1', { quantity });
    }

    const user = await userRepository.findById(userId);
    if (!user) throw new AppError('User not found', { code: 'USER_NOT_FOUND', statusCode: 404 });
    if (user.verificationStatus !== 'verified') {
      throw new AppError('Account must be verified', { code: 'NOT_VERIFIED', statusCode: 403 });
    }
    if (user.bannedAt) {
      throw new AppError('Account is banned', { code: 'ACCOUNT_BANNED', statusCode: 403 });
    }

    const catalogItem = await catalogItemRepository.findById(catalogItemId);
    if (!catalogItem) throw new AppError('Catalog item not found', { code: 'ITEM_NOT_FOUND', statusCode: 404 });
    if (!catalogItem.enabled) throw new AppError('Item is not available', { code: 'ITEM_DISABLED', statusCode: 400 });

    const result = await withTransaction(async (tx) => {
      // Reserve items — fails if insufficient available quantity
      await inventoryRepository.reserveItems(userId, catalogItemId, quantity, tx);

      const withdrawal = await tx.itemWithdrawal.create({
        data: {
          userId,
          catalogItemId,
          quantity,
          status: 'pending',
        },
        include: { catalogItem: true },
      });

      return withdrawal;
    });

    wdLogger.info('requestWithdrawal.success', 'Item withdrawal created', {
      withdrawalId: result.id,
      userId,
      catalogItemId,
      quantity,
    });

    return {
      id: result.id,
      userId: result.userId,
      catalogItemId: result.catalogItemId,
      catalogItemDisplayName: result.catalogItem.displayName,
      quantity: result.quantity,
      status: result.status,
      failReason: null,
      createdAt: result.createdAt.toISOString(),
      completedAt: null,
    };
  },

  /**
   * Admin confirms withdrawal — removes reserved items from inventory.
   */
  async confirmWithdrawal(withdrawalId: string, adminId: string) {
    wdLogger.info('confirmWithdrawal', 'Confirming item withdrawal', { withdrawalId, adminId });

    const withdrawal = await prisma.itemWithdrawal.findUnique({ where: { id: withdrawalId } });
    if (!withdrawal) throw new AppError('Withdrawal not found', { code: 'WITHDRAWAL_NOT_FOUND', statusCode: 404 });
    if (withdrawal.status !== 'pending' && withdrawal.status !== 'processing') {
      throw new AppError('Withdrawal is not in a confirmable state', {
        code: 'INVALID_WITHDRAWAL_STATE',
        statusCode: 400,
        details: { currentStatus: withdrawal.status },
      });
    }

    await withTransaction(async (tx) => {
      // Decrement both quantity and reservedQuantity
      await tx.inventoryItem.updateMany({
        where: {
          userId: withdrawal.userId,
          catalogItemId: withdrawal.catalogItemId,
          quantity: { gte: withdrawal.quantity },
          reservedQuantity: { gte: withdrawal.quantity },
        },
        data: {
          quantity: { decrement: withdrawal.quantity },
          reservedQuantity: { decrement: withdrawal.quantity },
        },
      });

      await tx.itemWithdrawal.update({
        where: { id: withdrawalId },
        data: {
          status: 'completed',
          adminId,
          completedAt: new Date(),
        },
      });
    });

    wdLogger.info('confirmWithdrawal.success', 'Item withdrawal confirmed', {
      withdrawalId,
      userId: withdrawal.userId,
      quantity: withdrawal.quantity,
    });
  },

  /**
   * Admin fails a withdrawal — releases reservation.
   */
  async failWithdrawal(withdrawalId: string, adminId: string, reason: string) {
    wdLogger.warn('failWithdrawal', 'Failing item withdrawal', { withdrawalId, adminId, reason });

    const withdrawal = await prisma.itemWithdrawal.findUnique({ where: { id: withdrawalId } });
    if (!withdrawal) throw new AppError('Withdrawal not found', { code: 'WITHDRAWAL_NOT_FOUND', statusCode: 404 });
    if (withdrawal.status === 'completed' || withdrawal.status === 'failed' || withdrawal.status === 'cancelled') {
      throw new AppError('Withdrawal is already finalized', {
        code: 'INVALID_WITHDRAWAL_STATE',
        statusCode: 400,
        details: { currentStatus: withdrawal.status },
      });
    }

    await withTransaction(async (tx) => {
      await inventoryRepository.releaseReservation(
        withdrawal.userId,
        withdrawal.catalogItemId,
        withdrawal.quantity,
        tx,
      );

      await tx.itemWithdrawal.update({
        where: { id: withdrawalId },
        data: {
          status: 'failed',
          adminId,
          failReason: reason,
          completedAt: new Date(),
        },
      });
    });

    wdLogger.info('failWithdrawal.success', 'Item withdrawal failed and reservation released', {
      withdrawalId,
      userId: withdrawal.userId,
      reason,
    });
  },

  /**
   * User cancels their own pending withdrawal.
   */
  async cancelWithdrawal(withdrawalId: string, userId: string) {
    wdLogger.info('cancelWithdrawal', 'User cancelling item withdrawal', { withdrawalId, userId });

    const withdrawal = await prisma.itemWithdrawal.findUnique({ where: { id: withdrawalId } });
    if (!withdrawal) throw new AppError('Withdrawal not found', { code: 'WITHDRAWAL_NOT_FOUND', statusCode: 404 });
    if (withdrawal.userId !== userId) {
      throw new AppError('Not your withdrawal', { code: 'FORBIDDEN', statusCode: 403 });
    }
    if (withdrawal.status !== 'pending') {
      throw new AppError('Only pending withdrawals can be cancelled', {
        code: 'INVALID_WITHDRAWAL_STATE',
        statusCode: 400,
        details: { currentStatus: withdrawal.status },
      });
    }

    await withTransaction(async (tx) => {
      await inventoryRepository.releaseReservation(
        withdrawal.userId,
        withdrawal.catalogItemId,
        withdrawal.quantity,
        tx,
      );

      await tx.itemWithdrawal.update({
        where: { id: withdrawalId },
        data: {
          status: 'cancelled',
          completedAt: new Date(),
        },
      });
    });

    wdLogger.info('cancelWithdrawal.success', 'Item withdrawal cancelled', { withdrawalId, userId });
  },

  /**
   * Get user's own withdrawals with pagination.
   */
  async getUserWithdrawals(userId: string, options: { skip: number; take: number }) {
    const [withdrawals, total] = await Promise.all([
      prisma.itemWithdrawal.findMany({
        where: { userId },
        include: { catalogItem: true },
        orderBy: { createdAt: 'desc' },
        skip: options.skip,
        take: options.take,
      }),
      prisma.itemWithdrawal.count({ where: { userId } }),
    ]);

    return { withdrawals, total };
  },

  /**
   * Get all pending withdrawals (for admin panel).
   */
  async getPendingWithdrawals() {
    return prisma.itemWithdrawal.findMany({
      where: { status: { in: ['pending', 'processing'] } },
      include: {
        catalogItem: true,
        user: { select: { id: true, minecraftUsername: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  },

  /**
   * Claim a withdrawal for processing (admin).
   */
  async claimWithdrawal(withdrawalId: string): Promise<boolean> {
    const result = await prisma.itemWithdrawal.updateMany({
      where: { id: withdrawalId, status: 'pending' },
      data: { status: 'processing' },
    });

    return result.count > 0;
  },
};

export type ItemWithdrawalService = typeof itemWithdrawalService;
