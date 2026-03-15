import { prisma } from './database.js';
import { withTransaction } from './database.js';
import { inventoryRepository } from '../repositories/inventory.repository.js';
import { catalogItemRepository } from '../repositories/catalog-item.repository.js';
import { userRepository } from '../repositories/user.repository.js';
import { logger } from '../lib/logger.js';
import { AppError, ValidationError } from '../lib/errors.js';

const depLogger = logger.module('item-deposit.service');

export const itemDepositService = {
  /**
   * Request an item deposit (user action).
   */
  async requestDeposit(userId: string, catalogItemId: string, quantity: number) {
    depLogger.info('requestDeposit', 'Item deposit requested', { userId, catalogItemId, quantity });

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

    const deposit = await prisma.itemDeposit.create({
      data: {
        userId,
        catalogItemId,
        quantity,
        status: 'pending',
      },
      include: { catalogItem: true },
    });

    depLogger.info('requestDeposit.success', 'Item deposit created', {
      depositId: deposit.id,
      userId,
      catalogItemId,
      quantity,
    });

    return {
      id: deposit.id,
      userId: deposit.userId,
      catalogItemId: deposit.catalogItemId,
      catalogItemDisplayName: deposit.catalogItem.displayName,
      quantity: deposit.quantity,
      status: deposit.status,
      adminNotes: null,
      createdAt: deposit.createdAt.toISOString(),
      completedAt: null,
    };
  },

  /**
   * Admin confirms a deposit — adds items to user's inventory.
   */
  async confirmDeposit(depositId: string, adminId: string) {
    depLogger.info('confirmDeposit', 'Confirming item deposit', { depositId, adminId });

    const deposit = await prisma.itemDeposit.findUnique({ where: { id: depositId } });
    if (!deposit) throw new AppError('Deposit not found', { code: 'DEPOSIT_NOT_FOUND', statusCode: 404 });
    if (deposit.status !== 'pending') {
      throw new AppError('Deposit is not in pending state', {
        code: 'INVALID_DEPOSIT_STATE',
        statusCode: 400,
        details: { currentStatus: deposit.status },
      });
    }

    await withTransaction(async (tx) => {
      await inventoryRepository.addItems(deposit.userId, deposit.catalogItemId, deposit.quantity, tx);

      await tx.itemDeposit.update({
        where: { id: depositId },
        data: {
          status: 'confirmed',
          adminId,
          completedAt: new Date(),
        },
      });
    });

    depLogger.info('confirmDeposit.success', 'Item deposit confirmed', {
      depositId,
      adminId,
      userId: deposit.userId,
      quantity: deposit.quantity,
    });
  },

  /**
   * Admin rejects a deposit — no inventory change.
   */
  async rejectDeposit(depositId: string, adminId: string, notes?: string) {
    depLogger.info('rejectDeposit', 'Rejecting item deposit', { depositId, adminId });

    const deposit = await prisma.itemDeposit.findUnique({ where: { id: depositId } });
    if (!deposit) throw new AppError('Deposit not found', { code: 'DEPOSIT_NOT_FOUND', statusCode: 404 });
    if (deposit.status !== 'pending') {
      throw new AppError('Deposit is not in pending state', {
        code: 'INVALID_DEPOSIT_STATE',
        statusCode: 400,
        details: { currentStatus: deposit.status },
      });
    }

    await prisma.itemDeposit.update({
      where: { id: depositId },
      data: {
        status: 'rejected',
        adminId,
        adminNotes: notes ?? null,
        completedAt: new Date(),
      },
    });

    depLogger.info('rejectDeposit.success', 'Item deposit rejected', { depositId, adminId });
  },

  /**
   * Get user's own deposits with pagination.
   */
  async getUserDeposits(userId: string, options: { skip: number; take: number }) {
    const [deposits, total] = await Promise.all([
      prisma.itemDeposit.findMany({
        where: { userId },
        include: { catalogItem: true },
        orderBy: { createdAt: 'desc' },
        skip: options.skip,
        take: options.take,
      }),
      prisma.itemDeposit.count({ where: { userId } }),
    ]);

    return { deposits, total };
  },

  /**
   * Get all pending deposits (for admin panel).
   */
  async getPendingDeposits() {
    return prisma.itemDeposit.findMany({
      where: { status: 'pending' },
      include: {
        catalogItem: true,
        user: { select: { id: true, minecraftUsername: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  },
};

export type ItemDepositService = typeof itemDepositService;
