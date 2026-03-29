import { prisma } from './database.js';
import { withTransaction } from './database.js';
import { userRepository } from '../repositories/user.repository.js';
import { catalogItemRepository } from '../repositories/catalog-item.repository.js';
import { inventoryRepository } from '../repositories/inventory.repository.js';
import { transactionRepository } from '../repositories/transaction.repository.js';
import { logger } from '../lib/logger.js';
import { Prisma } from '@prisma/client';
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
import { platformSettingsService } from './platform-settings.service.js';
import { eventBus } from './event-bus.service.js';
import { cosmeticsService } from './cosmetics.service.js';
import { getColor, getFont } from '@donuttrade/shared';

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
    if (user.timedOutUntil && user.timedOutUntil > new Date()) {
      throw new AppError('Account is currently timed out', {
        code: 'ACCOUNT_TIMED_OUT', statusCode: 403,
        details: { until: user.timedOutUntil.toISOString(), reason: user.timeoutReason },
      });
    }

    // Validate catalog item
    const catalogItem = await catalogItemRepository.findById(input.catalogItemId);
    if (!catalogItem) throw new AppError('Catalog item not found', { code: 'ITEM_NOT_FOUND', statusCode: 404 });
    if (!catalogItem.enabled) throw new AppError('Item is not available', { code: 'ITEM_DISABLED', statusCode: 400 });

    const commissionRate = await platformSettingsService.getCommissionRate();
    const isPremium = input.isPremium ?? false;
    const premiumFee = isPremium ? MARKETPLACE_PREMIUM_FEE : 0;
    const durationMs = isPremium ? MARKETPLACE_PREMIUM_DURATION_MS : MARKETPLACE_STANDARD_DURATION_MS;
    const expiresAt = new Date(Date.now() + durationMs);

    // Validate cosmetic selections
    if (input.borderColor) {
      if (!getColor(input.borderColor)) throw new ValidationError('Invalid border color');
      if (!(await cosmeticsService.isUnlocked(userId, 'color', input.borderColor))) {
        throw new AppError('Border color not unlocked', { code: 'COSMETIC_LOCKED', statusCode: 400 });
      }
    }
    if (input.usernameColor) {
      if (!getColor(input.usernameColor)) throw new ValidationError('Invalid username color');
      if (!(await cosmeticsService.isUnlocked(userId, 'color', input.usernameColor))) {
        throw new AppError('Username color not unlocked', { code: 'COSMETIC_LOCKED', statusCode: 400 });
      }
    }
    if (input.usernameFont) {
      if (!getFont(input.usernameFont)) throw new ValidationError('Invalid username font');
      if (!(await cosmeticsService.isUnlocked(userId, 'font', input.usernameFont))) {
        throw new AppError('Username font not unlocked', { code: 'COSMETIC_LOCKED', statusCode: 400 });
      }
    }

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
          borderColor: input.borderColor ?? null,
          usernameColor: input.usernameColor ?? null,
          usernameFont: input.usernameFont ?? null,
        },
        include: {
          catalogItem: true,
          user: { select: { minecraftUsername: true, cosmetics: { select: { hiddenMode: true } } } },
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
          borderColor: input.borderColor ?? null,
          usernameColor: input.usernameColor ?? null,
          usernameFont: input.usernameFont ?? null,
        },
        include: {
          catalogItem: true,
          user: { select: { minecraftUsername: true, cosmetics: { select: { hiddenMode: true } } } },
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
    if (filler.timedOutUntil && filler.timedOutUntil > new Date()) {
      throw new AppError('Account is currently timed out', {
        code: 'ACCOUNT_TIMED_OUT', statusCode: 403,
        details: { until: filler.timedOutUntil.toISOString(), reason: filler.timeoutReason },
      });
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
    const pricePerUnit = order.pricePerUnit as Prisma.Decimal;
    const commissionRate = order.commissionRate as Prisma.Decimal;
    const totalPrice = pricePerUnit.mul(fillQuantity);
    const commission = totalPrice.mul(commissionRate);
    const sellerReceives = totalPrice.sub(commission);

    const fill = await withTransaction(async (tx) => {
      // Atomically claim fill quantity — prevents race conditions
      const claimResult = await tx.$executeRaw`
        UPDATE orders
        SET filled_quantity = filled_quantity + ${fillQuantity}, updated_at = NOW()
        WHERE id = ${order.id} AND status = 'active'
          AND filled_quantity + ${fillQuantity} <= quantity
      `;
      if (claimResult === 0) {
        throw new AppError('Order cannot be filled — it may have been filled, expired, or cancelled', {
          code: 'FILL_FAILED', statusCode: 409,
        });
      }

      // Check if fully filled
      const updatedOrder = await tx.order.findUnique({
        where: { id: order.id },
        select: { filledQuantity: true, quantity: true },
      });
      const isCompleted = updatedOrder!.filledQuantity === updatedOrder!.quantity;

      // Seller loses items
      await inventoryRepository.removeItems(sellerUserId, order.catalogItemId, fillQuantity, tx);

      // Buyer gains items (from escrow)
      await inventoryRepository.addItems(order.userId, order.catalogItemId, fillQuantity, tx);

      // Seller gets paid (from escrowed money)
      const sellerUser = await tx.user.findUnique({ where: { id: sellerUserId }, select: { balance: true } });
      const sellerBalanceBefore = sellerUser!.balance as Prisma.Decimal;
      await userRepository.incrementBalance(sellerUserId, sellerReceives.toNumber(), tx);

      // Transaction records
      await transactionRepository.create({
        userId: sellerUserId,
        type: 'sale',
        amount: sellerReceives.toNumber(),
        balanceBefore: sellerBalanceBefore.toNumber(),
        balanceAfter: sellerBalanceBefore.add(sellerReceives).toNumber(),
        description: `Sold ${fillQuantity}x ${order.catalogItem.displayName} (${commission.toFixed(2)} commission)`,
        metadata: { orderId: order.id, commission: commission.toNumber(), fillQuantity },
      }, tx);

      await transactionRepository.create({
        userId: order.userId,
        type: 'purchase',
        amount: totalPrice.toNumber(),
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

      // Update trading volume for both parties
      const updatedSeller = await tx.user.update({
        where: { id: sellerUserId },
        data: { tradingVolume: { increment: totalPrice.toNumber() } },
        select: { tradingVolume: true },
      });
      const updatedBuyer = await tx.user.update({
        where: { id: order.userId },
        data: { tradingVolume: { increment: totalPrice.toNumber() } },
        select: { tradingVolume: true },
      });

      // Mark completed if fully filled
      if (isCompleted) {
        await tx.order.update({
          where: { id: order.id },
          data: { status: 'completed', completedAt: new Date() },
        });
      }

      return { orderFill, sellerVolume: updatedSeller.tradingVolume, buyerVolume: updatedBuyer.tradingVolume };
    });

    mktLogger.info('fillBuyOrder.success', 'Buy order filled', {
      orderId: order.id,
      sellerUserId,
      fillQuantity,
      sellerReceives: sellerReceives.toNumber(),
    });

    // Notify both parties (include tradingVolume for auto-role checks)
    void eventBus.publish(order.userId, 'order.filled', {
      orderId: order.id,
      itemName: order.catalogItem.displayName,
      quantity: fillQuantity,
      role: 'buyer',
      tradingVolume: fill.buyerVolume.toString(),
    });
    void eventBus.publish(sellerUserId, 'order.filled', {
      orderId: order.id,
      itemName: order.catalogItem.displayName,
      quantity: fillQuantity,
      role: 'seller',
      tradingVolume: fill.sellerVolume.toString(),
    });

    return fill.orderFill;
  },

  /**
   * Fill a sell order — buyer pays, seller's reserved items transfer to buyer.
   */
  async _fillSellOrder(order: any, buyerUserId: string, fillQuantity: number) {
    const pricePerUnit = order.pricePerUnit as Prisma.Decimal;
    const commissionRate = order.commissionRate as Prisma.Decimal;
    const totalPrice = pricePerUnit.mul(fillQuantity);
    const commission = totalPrice.mul(commissionRate);
    const sellerReceives = totalPrice.sub(commission);

    const fill = await withTransaction(async (tx) => {
      // Atomically claim fill quantity — prevents race conditions
      const claimResult = await tx.$executeRaw`
        UPDATE orders
        SET filled_quantity = filled_quantity + ${fillQuantity}, updated_at = NOW()
        WHERE id = ${order.id} AND status = 'active'
          AND filled_quantity + ${fillQuantity} <= quantity
      `;
      if (claimResult === 0) {
        throw new AppError('Order cannot be filled — it may have been filled, expired, or cancelled', {
          code: 'FILL_FAILED', statusCode: 409,
        });
      }

      // Check if fully filled
      const updatedOrder = await tx.order.findUnique({
        where: { id: order.id },
        select: { filledQuantity: true, quantity: true },
      });
      const isCompleted = updatedOrder!.filledQuantity === updatedOrder!.quantity;

      // Buyer pays
      const buyerUser = await tx.user.findUnique({ where: { id: buyerUserId }, select: { balance: true } });
      const buyerBalanceBefore = buyerUser!.balance as Prisma.Decimal;
      await userRepository.decrementBalance(buyerUserId, totalPrice.toNumber(), tx);

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
      const sellerBalanceBefore = sellerUser!.balance as Prisma.Decimal;
      await userRepository.incrementBalance(order.userId, sellerReceives.toNumber(), tx);

      // Transaction records
      await transactionRepository.create({
        userId: buyerUserId,
        type: 'purchase',
        amount: totalPrice.toNumber(),
        balanceBefore: buyerBalanceBefore.toNumber(),
        balanceAfter: buyerBalanceBefore.sub(totalPrice).toNumber(),
        description: `Bought ${fillQuantity}x ${order.catalogItem.displayName}`,
        metadata: { orderId: order.id, fillQuantity },
      }, tx);

      await transactionRepository.create({
        userId: order.userId,
        type: 'sale',
        amount: sellerReceives.toNumber(),
        balanceBefore: sellerBalanceBefore.toNumber(),
        balanceAfter: sellerBalanceBefore.add(sellerReceives).toNumber(),
        description: `Sold ${fillQuantity}x ${order.catalogItem.displayName} (${commission.toFixed(2)} commission)`,
        metadata: { orderId: order.id, commission: commission.toNumber(), fillQuantity },
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

      // Update trading volume for both parties
      const updatedBuyer = await tx.user.update({
        where: { id: buyerUserId },
        data: { tradingVolume: { increment: totalPrice.toNumber() } },
        select: { tradingVolume: true },
      });
      const updatedSeller = await tx.user.update({
        where: { id: order.userId },
        data: { tradingVolume: { increment: totalPrice.toNumber() } },
        select: { tradingVolume: true },
      });

      // Mark completed if fully filled
      if (isCompleted) {
        await tx.order.update({
          where: { id: order.id },
          data: { status: 'completed', completedAt: new Date() },
        });
      }

      return { orderFill, buyerVolume: updatedBuyer.tradingVolume, sellerVolume: updatedSeller.tradingVolume };
    });

    mktLogger.info('fillSellOrder.success', 'Sell order filled', {
      orderId: order.id,
      buyerUserId,
      fillQuantity,
      sellerReceives: sellerReceives.toNumber(),
    });

    // Notify both parties (include tradingVolume for auto-role checks)
    void eventBus.publish(order.userId, 'order.filled', {
      orderId: order.id,
      itemName: order.catalogItem.displayName,
      quantity: fillQuantity,
      role: 'seller',
      tradingVolume: fill.sellerVolume.toString(),
    });
    void eventBus.publish(buyerUserId, 'order.filled', {
      orderId: order.id,
      itemName: order.catalogItem.displayName,
      quantity: fillQuantity,
      role: 'buyer',
      tradingVolume: fill.buyerVolume.toString(),
    });

    return fill.orderFill;
  },

  /**
   * Cancel an active order. Refunds unfilled portion.
   */
  async cancelOrder(orderId: string, userId: string) {
    mktLogger.info('cancelOrder', 'Cancelling order', { orderId, userId });

    // Timeout check
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { timedOutUntil: true, timeoutReason: true } });
    if (user?.timedOutUntil && user.timedOutUntil > new Date()) {
      throw new AppError('Account is currently timed out', {
        code: 'ACCOUNT_TIMED_OUT', statusCode: 403,
        details: { until: user.timedOutUntil.toISOString(), reason: user.timeoutReason },
      });
    }

    // Pre-validate ownership (non-atomic, for fast feedback)
    const order = await prisma.order.findUnique({ where: { id: orderId } });
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

    await withTransaction(async (tx) => {
      // Atomically claim the order for cancellation
      const result = await tx.$executeRaw`
        UPDATE orders SET status = 'cancelled', completed_at = NOW(), updated_at = NOW()
        WHERE id = ${orderId} AND status = 'active' AND user_id = ${userId}
      `;
      if (result === 0) {
        throw new AppError('Order cannot be cancelled — it may have already been cancelled or expired', {
          code: 'CANCEL_FAILED', statusCode: 409,
        });
      }

      // Re-read for fresh filledQuantity
      const freshOrder = await tx.order.findUnique({ where: { id: orderId } });
      const unfilled = freshOrder!.quantity - freshOrder!.filledQuantity;

      if (freshOrder!.type === 'buy' && unfilled > 0) {
        const refundAmount = (freshOrder!.pricePerUnit as Prisma.Decimal).mul(unfilled);
        const user = await tx.user.findUnique({ where: { id: userId }, select: { balance: true } });
        const balanceBefore = user!.balance as Prisma.Decimal;

        await userRepository.incrementBalance(userId, refundAmount.toNumber(), tx);

        await transactionRepository.create({
          userId,
          type: 'escrow_refund',
          amount: refundAmount.toNumber(),
          balanceBefore: balanceBefore.toNumber(),
          balanceAfter: balanceBefore.add(refundAmount).toNumber(),
          description: `Escrow refund for cancelled buy order (${unfilled} unfilled)`,
          metadata: { orderId, unfilled },
        }, tx);
      } else if (freshOrder!.type === 'sell' && unfilled > 0) {
        await inventoryRepository.releaseReservation(userId, freshOrder!.catalogItemId, unfilled, tx);
      }
    });

    mktLogger.info('cancelOrder.success', 'Order cancelled', {
      orderId,
      userId,
      type: order.type,
    });

    void eventBus.publish(userId, 'order.cancelled', {
      orderId,
      type: order.type,
    });
  },

  /**
   * Update the price of an active, unfilled order.
   */
  async updateOrderPrice(orderId: string, userId: string, newPricePerUnit: number) {
    mktLogger.info('updateOrderPrice', 'Updating order price', { orderId, userId, newPricePerUnit });

    // Validate price limits
    if (newPricePerUnit < MARKETPLACE_MIN_PRICE || newPricePerUnit > MARKETPLACE_MAX_PRICE) {
      throw new ValidationError('Price out of limits', {
        min: MARKETPLACE_MIN_PRICE, max: MARKETPLACE_MAX_PRICE, requested: newPricePerUnit,
      });
    }

    // Timeout check
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { timedOutUntil: true, timeoutReason: true } });
    if (user?.timedOutUntil && user.timedOutUntil > new Date()) {
      throw new AppError('Account is currently timed out', {
        code: 'ACCOUNT_TIMED_OUT', statusCode: 403,
        details: { until: user.timedOutUntil.toISOString(), reason: user.timeoutReason },
      });
    }

    // Pre-validate
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new AppError('Order not found', { code: 'ORDER_NOT_FOUND', statusCode: 404 });
    if (order.userId !== userId) throw new AppError('Not your order', { code: 'FORBIDDEN', statusCode: 403 });
    if (order.status !== 'active') {
      throw new AppError('Only active orders can be edited', { code: 'ORDER_NOT_ACTIVE', statusCode: 400, details: { currentStatus: order.status } });
    }
    if (order.filledQuantity !== 0) {
      throw new AppError('Cannot edit price of partially filled order', { code: 'ORDER_PARTIALLY_FILLED', statusCode: 400 });
    }

    const oldPricePerUnit = (order.pricePerUnit as Prisma.Decimal).toNumber();
    if (newPricePerUnit === oldPricePerUnit) {
      throw new ValidationError('Price unchanged');
    }

    await withTransaction(async (tx) => {
      // Atomically claim the order for editing
      const result = await tx.$executeRaw`
        UPDATE orders SET price_per_unit = ${newPricePerUnit}, updated_at = NOW()
        WHERE id = ${orderId} AND status = 'active' AND filled_quantity = 0 AND user_id = ${userId}
      `;
      if (result === 0) {
        throw new AppError('Order cannot be edited — it may have been filled, cancelled, or expired', {
          code: 'EDIT_FAILED', statusCode: 409,
        });
      }

      if (order.type === 'buy') {
        // Recalculate escrow
        const oldEscrow = oldPricePerUnit * order.quantity;
        const newEscrow = newPricePerUnit * order.quantity;
        const diff = newEscrow - oldEscrow;

        // Update escrow amount
        await tx.order.update({
          where: { id: orderId },
          data: { escrowAmount: newEscrow },
        });

        if (diff > 0) {
          // Price increased — charge more from user
          const freshUser = await tx.user.findUnique({ where: { id: userId }, select: { balance: true } });
          if (!freshUser) throw new AppError('User not found', { code: 'USER_NOT_FOUND', statusCode: 404 });
          const balanceBefore = freshUser.balance.toNumber();

          if (balanceBefore < diff) {
            throw new AppError('Insufficient balance for price increase', {
              code: 'INSUFFICIENT_BALANCE', statusCode: 400,
              details: { available: balanceBefore.toString(), required: diff },
            });
          }

          await userRepository.decrementBalance(userId, diff, tx);

          await transactionRepository.create({
            userId,
            type: 'escrow',
            amount: diff,
            balanceBefore,
            balanceAfter: balanceBefore - diff,
            description: `Additional escrow for price increase on order`,
            metadata: { orderId, oldPrice: oldPricePerUnit, newPrice: newPricePerUnit },
          }, tx);
        } else if (diff < 0) {
          // Price decreased — refund difference
          const refund = Math.abs(diff);
          const freshUser = await tx.user.findUnique({ where: { id: userId }, select: { balance: true } });
          if (!freshUser) throw new AppError('User not found', { code: 'USER_NOT_FOUND', statusCode: 404 });
          const balanceBefore = freshUser.balance.toNumber();

          await userRepository.incrementBalance(userId, refund, tx);

          await transactionRepository.create({
            userId,
            type: 'escrow_refund',
            amount: refund,
            balanceBefore,
            balanceAfter: balanceBefore + refund,
            description: `Escrow refund for price decrease on order`,
            metadata: { orderId, oldPrice: oldPricePerUnit, newPrice: newPricePerUnit },
          }, tx);
        }
      }
      // For sell orders: price already updated by the raw SQL above, no balance changes needed
    });

    mktLogger.info('updateOrderPrice.success', 'Order price updated', {
      orderId, userId, oldPrice: oldPricePerUnit, newPrice: newPricePerUnit,
    });

    // Notify
    void eventBus.publish(userId, 'order.price_updated', {
      orderId, oldPrice: oldPricePerUnit, newPrice: newPricePerUnit,
    });
  },

  /**
   * Admin cancel — bypasses ownership check but reuses refund logic.
   */
  async adminCancelOrder(orderId: string, adminId: string) {
    mktLogger.info('adminCancelOrder', 'Admin cancelling order', { orderId, adminId });

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new AppError('Order not found', { code: 'ORDER_NOT_FOUND', statusCode: 404 });
    if (order.status !== 'active') {
      throw new AppError('Only active orders can be cancelled', {
        code: 'ORDER_NOT_ACTIVE',
        statusCode: 400,
        details: { currentStatus: order.status },
      });
    }

    await withTransaction(async (tx) => {
      const result = await tx.$executeRaw`
        UPDATE orders SET status = 'cancelled', completed_at = NOW(), updated_at = NOW()
        WHERE id = ${orderId} AND status = 'active'
      `;
      if (result === 0) {
        throw new AppError('Order cannot be cancelled', { code: 'CANCEL_FAILED', statusCode: 409 });
      }

      const freshOrder = await tx.order.findUnique({ where: { id: orderId } });
      const unfilled = freshOrder!.quantity - freshOrder!.filledQuantity;

      if (freshOrder!.type === 'buy' && unfilled > 0) {
        const refundAmount = (freshOrder!.pricePerUnit as Prisma.Decimal).mul(unfilled);
        const user = await tx.user.findUnique({ where: { id: freshOrder!.userId }, select: { balance: true } });
        const balanceBefore = user!.balance as Prisma.Decimal;

        await userRepository.incrementBalance(freshOrder!.userId, refundAmount.toNumber(), tx);

        await transactionRepository.create({
          userId: freshOrder!.userId,
          type: 'escrow_refund',
          amount: refundAmount.toNumber(),
          balanceBefore: balanceBefore.toNumber(),
          balanceAfter: balanceBefore.add(refundAmount).toNumber(),
          description: `Escrow refund for admin-cancelled buy order (${unfilled} unfilled)`,
          metadata: { orderId, unfilled, cancelledByAdmin: adminId },
        }, tx);
      } else if (freshOrder!.type === 'sell' && unfilled > 0) {
        await inventoryRepository.releaseReservation(freshOrder!.userId, freshOrder!.catalogItemId, unfilled, tx);
      }
    });

    mktLogger.info('adminCancelOrder.success', 'Order cancelled by admin', { orderId, adminId });

    void eventBus.publish(order.userId, 'order.cancelled', {
      orderId,
      type: order.type,
      adminCancelled: true,
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
    });

    if (expired.length === 0) return;

    mktLogger.info('processExpiredOrders', 'Processing expired orders', { count: expired.length });

    for (const order of expired) {
      try {
        await withTransaction(async (tx) => {
          // Atomically claim the order for expiry
          const result = await tx.$executeRaw`
            UPDATE orders SET status = 'expired', completed_at = NOW(), updated_at = NOW()
            WHERE id = ${order.id} AND status = 'active'
          `;
          if (result === 0) return; // Already processed by another tick or cancelled

          // Re-read for fresh filledQuantity
          const freshOrder = await tx.order.findUnique({ where: { id: order.id } });
          const unfilled = freshOrder!.quantity - freshOrder!.filledQuantity;

          if (freshOrder!.type === 'buy' && unfilled > 0) {
            const refundAmount = (freshOrder!.pricePerUnit as Prisma.Decimal).mul(unfilled);
            const user = await tx.user.findUnique({ where: { id: freshOrder!.userId }, select: { balance: true } });
            const balanceBefore = user!.balance as Prisma.Decimal;

            await userRepository.incrementBalance(freshOrder!.userId, refundAmount.toNumber(), tx);

            await transactionRepository.create({
              userId: freshOrder!.userId,
              type: 'escrow_refund',
              amount: refundAmount.toNumber(),
              balanceBefore: balanceBefore.toNumber(),
              balanceAfter: balanceBefore.add(refundAmount).toNumber(),
              description: `Escrow refund for expired buy order (${unfilled} unfilled)`,
              metadata: { orderId: order.id, unfilled },
            }, tx);
          } else if (freshOrder!.type === 'sell' && unfilled > 0) {
            await inventoryRepository.releaseReservation(freshOrder!.userId, freshOrder!.catalogItemId, unfilled, tx);
          }
        });

        mktLogger.info('processExpiredOrders.expired', 'Order expired', {
          orderId: order.id,
          type: order.type,
        });

        void eventBus.publish(order.userId, 'order.expired', {
          orderId: order.id,
          type: order.type,
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
  _mapOrder(order: any, options?: { adminView?: boolean }) {
    const isHidden = !options?.adminView && order.user?.cosmetics?.hiddenMode === true;
    const username = isHidden ? 'Hidden' : (order.user?.minecraftUsername ?? 'Unknown');

    return {
      id: order.id,
      userId: order.userId,
      username,
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
      borderColor: isHidden ? null : (order.borderColor ?? null),
      usernameColor: isHidden ? null : (order.usernameColor ?? null),
      usernameFont: isHidden ? null : (order.usernameFont ?? null),
    };
  },
};

export type MarketplaceService = typeof marketplaceService;
