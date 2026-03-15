import { prisma } from './database.js';
import { withTransaction } from './database.js';
import { userRepository } from '../repositories/user.repository.js';
import { catalogItemRepository } from '../repositories/catalog-item.repository.js';
import { inventoryRepository } from '../repositories/inventory.repository.js';
import { transactionRepository } from '../repositories/transaction.repository.js';
import { config } from '../config/index.js';
import { logger } from '../lib/logger.js';
import { AppError, ValidationError } from '../lib/errors.js';
import {
  MARKETPLACE_PREMIUM_FEE,
  MARKETPLACE_STANDARD_DURATION_MS,
  MARKETPLACE_PREMIUM_DURATION_MS,
  MARKETPLACE_MIN_PRICE,
  MARKETPLACE_MAX_PRICE,
  MARKETPLACE_MIN_QUANTITY,
  MARKETPLACE_MAX_QUANTITY,
} from '@donuttrade/shared';
import type { CreateOrderInput, OrderType } from '@donuttrade/shared';

const mktLogger = logger.module('marketplace.service');

export const marketplaceService = {
  /**
   * Create a new buy or sell order.
   */
  async createOrder(userId: string, input: CreateOrderInput) {
    mktLogger.info('createOrder', 'Creating order', { userId, ...input });

    // Validate input
    if (input.quantity < MARKETPLACE_MIN_QUANTITY || input.quantity > MARKETPLACE_MAX_QUANTITY) {
      throw new ValidationError('Quantity out of limits', {
        min: MARKETPLACE_MIN_QUANTITY,
        max: MARKETPLACE_MAX_QUANTITY,
        requested: input.quantity,
      });
    }
    if (input.pricePerUnit < MARKETPLACE_MIN_PRICE || input.pricePerUnit > MARKETPLACE_MAX_PRICE) {
      throw new ValidationError('Price out of limits', {
        min: MARKETPLACE_MIN_PRICE,
        max: MARKETPLACE_MAX_PRICE,
        requested: input.pricePerUnit,
      });
    }

    // Validate user
    const user = await userRepository.findById(userId);
    if (!user) throw new AppError('User not found', { code: 'USER_NOT_FOUND', statusCode: 404 });
    if (user.verificationStatus !== 'verified') {
      throw new AppError('Account must be verified', { code: 'NOT_VERIFIED', statusCode: 403 });
    }
    if (user.bannedAt) {
      throw new AppError('Account is banned', { code: 'ACCOUNT_BANNED', statusCode: 403 });
    }

    // Validate catalog item
    const catalogItem = await catalogItemRepository.findById(input.catalogItemId);
    if (!catalogItem) throw new AppError('Catalog item not found', { code: 'ITEM_NOT_FOUND', statusCode: 404 });
    if (!catalogItem.enabled) throw new AppError('Item is not available', { code: 'ITEM_DISABLED', statusCode: 400 });

    const commissionRate = config.MARKETPLACE_COMMISSION_RATE;
    const isPremium = input.isPremium ?? false;
    const premiumFee = isPremium ? MARKETPLACE_PREMIUM_FEE : 0;
    const durationMs = isPremium ? MARKETPLACE_PREMIUM_DURATION_MS : MARKETPLACE_STANDARD_DURATION_MS;
    const expiresAt = new Date(Date.now() + durationMs);

    if (input.type === 'buy') {
      return this._createBuyOrder(userId, input, commissionRate, premiumFee, expiresAt);
    } else {
      return this._createSellOrder(userId, input, commissionRate, premiumFee, expiresAt);
    }
  },

  async _createBuyOrder(
    userId: string,
    input: CreateOrderInput,
    commissionRate: number,
    premiumFee: number,
    expiresAt: Date,
  ) {
    const escrowAmount = input.quantity * input.pricePerUnit;
    const totalCost = escrowAmount + premiumFee;

    const order = await withTransaction(async (tx) => {
      // Read fresh balance
      const freshUser = await tx.user.findUnique({ where: { id: userId }, select: { balance: true } });
      if (!freshUser) throw new AppError('User not found', { code: 'USER_NOT_FOUND', statusCode: 404 });
      const balanceBefore = freshUser.balance.toNumber();

      if (balanceBefore < totalCost) {
        throw new AppError('Insufficient balance', {
          code: 'INSUFFICIENT_BALANCE',
          statusCode: 400,
          details: { available: balanceBefore.toString(), required: totalCost },
        });
      }

      // Lock the money
      await userRepository.decrementBalance(userId, totalCost, tx);

      const balanceAfter = balanceBefore - totalCost;

      // Record escrow transaction
      await transactionRepository.create({
        userId,
        type: 'escrow',
        amount: escrowAmount,
        balanceBefore,
        balanceAfter: premiumFee > 0 ? balanceBefore - escrowAmount : balanceAfter,
        description: `Escrow for buy order`,
      }, tx);

      // Record listing fee transaction if premium
      if (premiumFee > 0) {
        await transactionRepository.create({
          userId,
          type: 'listing_fee',
          amount: premiumFee,
          balanceBefore: balanceBefore - escrowAmount,
          balanceAfter,
          description: `Premium listing fee (48h)`,
        }, tx);
      }

      // Create the order
      const newOrder = await tx.order.create({
        data: {
          userId,
          type: 'buy',
          catalogItemId: input.catalogItemId,
          quantity: input.quantity,
          pricePerUnit: input.pricePerUnit,
          commissionRate,
          escrowAmount,
          premiumFee,
          isPremium: premiumFee > 0,
          expiresAt,
          status: 'active',
        },
        include: {
          catalogItem: true,
          user: { select: { minecraftUsername: true } },
        },
      });

      return newOrder;
    });

    mktLogger.info('createOrder.buy.success', 'Buy order created', {
      orderId: order.id,
      userId,
      escrowAmount,
    });

    return this._mapOrder(order);
  },

  async _createSellOrder(
    userId: string,
    input: CreateOrderInput,
    commissionRate: number,
    premiumFee: number,
    expiresAt: Date,
  ) {
    const order = await withTransaction(async (tx) => {
      // Reserve the items
      await inventoryRepository.reserveItems(userId, input.catalogItemId, input.quantity, tx);

      // Charge premium fee if applicable
      if (premiumFee > 0) {
        const freshUser = await tx.user.findUnique({ where: { id: userId }, select: { balance: true } });
        if (!freshUser) throw new AppError('User not found', { code: 'USER_NOT_FOUND', statusCode: 404 });
        const balanceBefore = freshUser.balance.toNumber();

        await userRepository.decrementBalance(userId, premiumFee, tx);

        await transactionRepository.create({
          userId,
          type: 'listing_fee',
          amount: premiumFee,
          balanceBefore,
          balanceAfter: balanceBefore - premiumFee,
          description: `Premium listing fee (48h)`,
        }, tx);
      }

      const newOrder = await tx.order.create({
        data: {
          userId,
          type: 'sell',
          catalogItemId: input.catalogItemId,
          quantity: input.quantity,
          pricePerUnit: input.pricePerUnit,
          commissionRate,
          escrowAmount: 0,
          premiumFee,
          isPremium: premiumFee > 0,
          expiresAt,
          status: 'active',
        },
        include: {
          catalogItem: true,
          user: { select: { minecraftUsername: true } },
        },
      });

      return newOrder;
    });

    mktLogger.info('createOrder.sell.success', 'Sell order created', {
      orderId: order.id,
      userId,
      quantity: input.quantity,
    });

    return this._mapOrder(order);
  },

  /**
   * Fill an order (partial or full).
   */
  async fillOrder(orderId: string, fillerUserId: string, quantity: number) {
    mktLogger.info('fillOrder', 'Filling order', { orderId, fillerUserId, quantity });

    if (quantity < 1) {
      throw new ValidationError('Fill quantity must be at least 1', { quantity });
    }

    // Validate filler user
    const filler = await userRepository.findById(fillerUserId);
    if (!filler) throw new AppError('User not found', { code: 'USER_NOT_FOUND', statusCode: 404 });
    if (filler.verificationStatus !== 'verified') {
      throw new AppError('Account must be verified', { code: 'NOT_VERIFIED', statusCode: 403 });
    }
    if (filler.bannedAt) {
      throw new AppError('Account is banned', { code: 'ACCOUNT_BANNED', statusCode: 403 });
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { catalogItem: true },
    });
    if (!order) throw new AppError('Order not found', { code: 'ORDER_NOT_FOUND', statusCode: 404 });
    if (order.status !== 'active') {
      throw new AppError('Order is not active', {
        code: 'ORDER_NOT_ACTIVE',
        statusCode: 400,
        details: { currentStatus: order.status },
      });
    }
    if (order.userId === fillerUserId) {
      throw new AppError('Cannot fill your own order', { code: 'SELF_FILL', statusCode: 400 });
    }

    const remaining = order.quantity - order.filledQuantity;
    if (quantity > remaining) {
      throw new ValidationError('Fill quantity exceeds remaining', {
        remaining,
        requested: quantity,
      });
    }

    if (order.type === 'buy') {
      return this._fillBuyOrder(order, fillerUserId, quantity);
    } else {
      return this._fillSellOrder(order, fillerUserId, quantity);
    }
  },

  /**
   * Fill a buy order — seller provides items, buyer's escrow pays seller.
   */
  async _fillBuyOrder(order: any, sellerUserId: string, fillQuantity: number) {
    const pricePerUnit = order.pricePerUnit.toNumber();
    const commissionRate = order.commissionRate.toNumber();
    const totalPrice = fillQuantity * pricePerUnit;
    const commission = totalPrice * commissionRate;
    const sellerReceives = totalPrice - commission;

    const fill = await withTransaction(async (tx) => {
      // Re-check order state inside transaction
      const freshOrder = await tx.order.findUnique({ where: { id: order.id } });
      if (!freshOrder || freshOrder.status !== 'active') {
        throw new AppError('Order is no longer active', { code: 'ORDER_NOT_ACTIVE', statusCode: 400 });
      }
      const newFilled = freshOrder.filledQuantity + fillQuantity;
      if (newFilled > freshOrder.quantity) {
        throw new AppError('Fill exceeds remaining quantity', { code: 'FILL_EXCEEDED', statusCode: 400 });
      }

      // Seller loses items
      await inventoryRepository.removeItems(sellerUserId, order.catalogItemId, fillQuantity, tx);

      // Buyer gains items (from escrow)
      await inventoryRepository.addItems(order.userId, order.catalogItemId, fillQuantity, tx);

      // Seller gets paid (from escrowed money)
      const sellerUser = await tx.user.findUnique({ where: { id: sellerUserId }, select: { balance: true } });
      const sellerBalanceBefore = sellerUser!.balance.toNumber();
      await userRepository.incrementBalance(sellerUserId, sellerReceives, tx);

      // Transaction records
      await transactionRepository.create({
        userId: sellerUserId,
        type: 'sale',
        amount: sellerReceives,
        balanceBefore: sellerBalanceBefore,
        balanceAfter: sellerBalanceBefore + sellerReceives,
        description: `Sold ${fillQuantity}x ${order.catalogItem.displayName} (${commission.toFixed(2)} commission)`,
        metadata: { orderId: order.id, commission, fillQuantity },
      }, tx);

      await transactionRepository.create({
        userId: order.userId,
        type: 'purchase',
        amount: totalPrice,
        balanceBefore: 0, // Escrow — balance already deducted
        balanceAfter: 0,
        description: `Bought ${fillQuantity}x ${order.catalogItem.displayName}`,
        metadata: { orderId: order.id, fillQuantity, fromEscrow: true },
      }, tx);

      // Create fill record
      const orderFill = await tx.orderFill.create({
        data: {
          orderId: order.id,
          filledByUserId: sellerUserId,
          quantity: fillQuantity,
          pricePerUnit,
          totalPrice,
          commissionAmount: commission,
          netAmount: sellerReceives,
        },
      });

      // Update order
      const isCompleted = newFilled === freshOrder.quantity;
      await tx.order.update({
        where: { id: order.id },
        data: {
          filledQuantity: newFilled,
          status: isCompleted ? 'completed' : 'active',
          completedAt: isCompleted ? new Date() : null,
        },
      });

      return orderFill;
    });

    mktLogger.info('fillBuyOrder.success', 'Buy order filled', {
      orderId: order.id,
      sellerUserId,
      fillQuantity,
      sellerReceives,
    });

    return fill;
  },

  /**
   * Fill a sell order — buyer pays, seller's reserved items transfer to buyer.
   */
  async _fillSellOrder(order: any, buyerUserId: string, fillQuantity: number) {
    const pricePerUnit = order.pricePerUnit.toNumber();
    const commissionRate = order.commissionRate.toNumber();
    const totalPrice = fillQuantity * pricePerUnit;
    const commission = totalPrice * commissionRate;
    const sellerReceives = totalPrice - commission;

    const fill = await withTransaction(async (tx) => {
      // Re-check order state inside transaction
      const freshOrder = await tx.order.findUnique({ where: { id: order.id } });
      if (!freshOrder || freshOrder.status !== 'active') {
        throw new AppError('Order is no longer active', { code: 'ORDER_NOT_ACTIVE', statusCode: 400 });
      }
      const newFilled = freshOrder.filledQuantity + fillQuantity;
      if (newFilled > freshOrder.quantity) {
        throw new AppError('Fill exceeds remaining quantity', { code: 'FILL_EXCEEDED', statusCode: 400 });
      }

      // Buyer pays
      const buyerUser = await tx.user.findUnique({ where: { id: buyerUserId }, select: { balance: true } });
      const buyerBalanceBefore = buyerUser!.balance.toNumber();
      await userRepository.decrementBalance(buyerUserId, totalPrice, tx);

      // Transfer reserved items from seller to buyer
      await inventoryRepository.transferReservedItems(
        order.userId,
        buyerUserId,
        order.catalogItemId,
        fillQuantity,
        tx,
      );

      // Seller gets paid
      const sellerUser = await tx.user.findUnique({ where: { id: order.userId }, select: { balance: true } });
      const sellerBalanceBefore = sellerUser!.balance.toNumber();
      await userRepository.incrementBalance(order.userId, sellerReceives, tx);

      // Transaction records
      await transactionRepository.create({
        userId: buyerUserId,
        type: 'purchase',
        amount: totalPrice,
        balanceBefore: buyerBalanceBefore,
        balanceAfter: buyerBalanceBefore - totalPrice,
        description: `Bought ${fillQuantity}x ${order.catalogItem.displayName}`,
        metadata: { orderId: order.id, fillQuantity },
      }, tx);

      await transactionRepository.create({
        userId: order.userId,
        type: 'sale',
        amount: sellerReceives,
        balanceBefore: sellerBalanceBefore,
        balanceAfter: sellerBalanceBefore + sellerReceives,
        description: `Sold ${fillQuantity}x ${order.catalogItem.displayName} (${commission.toFixed(2)} commission)`,
        metadata: { orderId: order.id, commission, fillQuantity },
      }, tx);

      // Create fill record
      const orderFill = await tx.orderFill.create({
        data: {
          orderId: order.id,
          filledByUserId: buyerUserId,
          quantity: fillQuantity,
          pricePerUnit,
          totalPrice,
          commissionAmount: commission,
          netAmount: sellerReceives,
        },
      });

      // Update order
      const isCompleted = newFilled === freshOrder.quantity;
      await tx.order.update({
        where: { id: order.id },
        data: {
          filledQuantity: newFilled,
          status: isCompleted ? 'completed' : 'active',
          completedAt: isCompleted ? new Date() : null,
        },
      });

      return orderFill;
    });

    mktLogger.info('fillSellOrder.success', 'Sell order filled', {
      orderId: order.id,
      buyerUserId,
      fillQuantity,
      sellerReceives,
    });

    return fill;
  },

  /**
   * Cancel an active order. Refunds unfilled portion.
   */
  async cancelOrder(orderId: string, userId: string) {
    mktLogger.info('cancelOrder', 'Cancelling order', { orderId, userId });

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { catalogItem: true },
    });
    if (!order) throw new AppError('Order not found', { code: 'ORDER_NOT_FOUND', statusCode: 404 });
    if (order.userId !== userId) {
      throw new AppError('Not your order', { code: 'FORBIDDEN', statusCode: 403 });
    }
    if (order.status !== 'active') {
      throw new AppError('Only active orders can be cancelled', {
        code: 'ORDER_NOT_ACTIVE',
        statusCode: 400,
        details: { currentStatus: order.status },
      });
    }

    const unfilled = order.quantity - order.filledQuantity;

    await withTransaction(async (tx) => {
      if (order.type === 'buy' && unfilled > 0) {
        // Refund escrowed money for unfilled portion
        const refundAmount = unfilled * order.pricePerUnit.toNumber();
        const user = await tx.user.findUnique({ where: { id: userId }, select: { balance: true } });
        const balanceBefore = user!.balance.toNumber();

        await userRepository.incrementBalance(userId, refundAmount, tx);

        await transactionRepository.create({
          userId,
          type: 'escrow_refund',
          amount: refundAmount,
          balanceBefore,
          balanceAfter: balanceBefore + refundAmount,
          description: `Escrow refund for cancelled buy order (${unfilled} unfilled)`,
          metadata: { orderId: order.id, unfilled },
        }, tx);
      } else if (order.type === 'sell' && unfilled > 0) {
        // Release reserved items for unfilled portion
        await inventoryRepository.releaseReservation(userId, order.catalogItemId, unfilled, tx);
      }

      await tx.order.update({
        where: { id: orderId },
        data: {
          status: 'cancelled',
          completedAt: new Date(),
        },
      });
    });

    mktLogger.info('cancelOrder.success', 'Order cancelled', {
      orderId,
      userId,
      unfilled,
      type: order.type,
    });
  },

  /**
   * Process all expired orders. Called periodically.
   */
  async processExpiredOrders() {
    const expired = await prisma.order.findMany({
      where: {
        status: 'active',
        expiresAt: { lt: new Date() },
      },
      include: { catalogItem: true },
    });

    if (expired.length === 0) return;

    mktLogger.info('processExpiredOrders', 'Processing expired orders', { count: expired.length });

    for (const order of expired) {
      try {
        const unfilled = order.quantity - order.filledQuantity;

        await withTransaction(async (tx) => {
          if (order.type === 'buy' && unfilled > 0) {
            const refundAmount = unfilled * order.pricePerUnit.toNumber();
            const user = await tx.user.findUnique({ where: { id: order.userId }, select: { balance: true } });
            const balanceBefore = user!.balance.toNumber();

            await userRepository.incrementBalance(order.userId, refundAmount, tx);

            await transactionRepository.create({
              userId: order.userId,
              type: 'escrow_refund',
              amount: refundAmount,
              balanceBefore,
              balanceAfter: balanceBefore + refundAmount,
              description: `Escrow refund for expired buy order (${unfilled} unfilled)`,
              metadata: { orderId: order.id, unfilled },
            }, tx);
          } else if (order.type === 'sell' && unfilled > 0) {
            await inventoryRepository.releaseReservation(order.userId, order.catalogItemId, unfilled, tx);
          }

          await tx.order.update({
            where: { id: order.id },
            data: {
              status: 'expired',
              completedAt: new Date(),
            },
          });
        });

        mktLogger.info('processExpiredOrders.expired', 'Order expired', {
          orderId: order.id,
          type: order.type,
          unfilled,
        });
      } catch (error) {
        mktLogger.error('processExpiredOrders.error', 'Failed to expire order', error, {
          orderId: order.id,
        });
        // Continue processing other orders
      }
    }
  },

  /**
   * Map a Prisma order to the API response shape.
   */
  _mapOrder(order: any) {
    return {
      id: order.id,
      userId: order.userId,
      username: order.user?.minecraftUsername ?? 'Unknown',
      type: order.type as OrderType,
      catalogItemId: order.catalogItemId,
      catalogItemDisplayName: order.catalogItem?.displayName ?? '',
      category: order.catalogItem?.category ?? '',
      quantity: order.quantity,
      filledQuantity: order.filledQuantity,
      remainingQuantity: order.quantity - order.filledQuantity,
      pricePerUnit: order.pricePerUnit.toString(),
      commissionRate: order.commissionRate.toString(),
      escrowAmount: order.escrowAmount.toString(),
      isPremium: order.isPremium,
      status: order.status,
      expiresAt: order.expiresAt.toISOString(),
      createdAt: order.createdAt.toISOString(),
      completedAt: order.completedAt?.toISOString() ?? null,
    };
  },
};

export type MarketplaceService = typeof marketplaceService;
