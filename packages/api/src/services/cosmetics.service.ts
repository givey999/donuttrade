import { prisma } from './database.js';
import { withTransaction } from './database.js';
import { userRepository } from '../repositories/user.repository.js';
import { transactionRepository } from '../repositories/transaction.repository.js';
import { platformSettingsService } from './platform-settings.service.js';
import { logger } from '../lib/logger.js';
import { AppError, ValidationError } from '../lib/errors.js';
import { getColor, getFont, COSMETIC_COLORS, COSMETIC_FONTS } from '@donuttrade/shared';
import type { CosmeticColor, CosmeticFont } from '@donuttrade/shared';

const cosmeticsLogger = logger.module('cosmetics');

export const cosmeticsService = {
  async getUserCosmetics(userId: string) {
    const [user, userCosmetics] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { tradingVolume: true },
      }),
      prisma.userCosmetics.findUnique({ where: { userId } }),
    ]);

    const tradingVolume = user?.tradingVolume?.toNumber() ?? 0;
    const unlockedColors = userCosmetics?.unlockedColors ?? [];
    const unlockedFonts = userCosmetics?.unlockedFonts ?? [];

    const colors = COSMETIC_COLORS.map(c => ({
      ...c,
      ...this._resolveAvailability(c, unlockedColors, tradingVolume),
    }));

    const fonts = COSMETIC_FONTS.map(f => ({
      ...f,
      ...this._resolveAvailability(f, unlockedFonts, tradingVolume),
    }));

    return {
      colors,
      fonts,
      tradingVolume: tradingVolume.toString(),
      hiddenModePurchased: userCosmetics?.hiddenModePurchased ?? false,
      hiddenMode: userCosmetics?.hiddenMode ?? false,
    };
  },

  async unlockCosmetic(userId: string, type: 'color' | 'font', id: string) {
    const userCheck = await prisma.user.findUnique({ where: { id: userId }, select: { timedOutUntil: true, timeoutReason: true } });
    if (userCheck?.timedOutUntil && userCheck.timedOutUntil > new Date()) {
      throw new AppError('Account is currently timed out', {
        code: 'ACCOUNT_TIMED_OUT', statusCode: 403,
        details: { until: userCheck.timedOutUntil.toISOString(), reason: userCheck.timeoutReason },
      });
    }

    const item = type === 'color' ? getColor(id) : getFont(id);
    if (!item) throw new ValidationError(`Unknown ${type}: ${id}`);
    if (item.tier !== 'paid') throw new ValidationError(`${type} "${id}" is not purchasable`);
    const price = item.price!;

    await withTransaction(async (tx) => {
      const cosmetics = await tx.userCosmetics.upsert({
        where: { userId },
        create: { userId },
        update: {},
      });

      const unlocked = type === 'color' ? cosmetics.unlockedColors : cosmetics.unlockedFonts;
      if (unlocked.includes(id)) {
        throw new AppError('Already unlocked', { code: 'ALREADY_UNLOCKED', statusCode: 400 });
      }

      const freshUser = await tx.user.findUnique({ where: { id: userId }, select: { balance: true } });
      if (!freshUser) throw new AppError('User not found', { code: 'USER_NOT_FOUND', statusCode: 404 });
      const balanceBefore = freshUser.balance.toNumber();

      if (balanceBefore < price) {
        throw new AppError('Insufficient balance', {
          code: 'INSUFFICIENT_BALANCE', statusCode: 400,
          details: { available: balanceBefore.toString(), required: price },
        });
      }

      await userRepository.decrementBalance(userId, price, tx);
      const balanceAfter = balanceBefore - price;

      await transactionRepository.create({
        userId,
        type: 'cosmetic_purchase',
        amount: price,
        balanceBefore,
        balanceAfter,
        description: `Purchased ${type}: ${item.name}`,
        metadata: { cosmeticType: type, cosmeticId: id },
      }, tx);

      const field = type === 'color' ? 'unlockedColors' : 'unlockedFonts';
      await tx.userCosmetics.update({
        where: { userId },
        data: {
          [field]: { push: id },
        },
      });
    });

    cosmeticsLogger.info('cosmetic.unlocked', `${type} unlocked`, { userId, type, id, price });
  },

  async purchaseHiddenMode(userId: string) {
    const userCheck = await prisma.user.findUnique({ where: { id: userId }, select: { timedOutUntil: true, timeoutReason: true } });
    if (userCheck?.timedOutUntil && userCheck.timedOutUntil > new Date()) {
      throw new AppError('Account is currently timed out', {
        code: 'ACCOUNT_TIMED_OUT', statusCode: 403,
        details: { until: userCheck.timedOutUntil.toISOString(), reason: userCheck.timeoutReason },
      });
    }

    const price = await platformSettingsService.getHiddenModePrice();

    await withTransaction(async (tx) => {
      const cosmetics = await tx.userCosmetics.upsert({
        where: { userId },
        create: { userId },
        update: {},
      });

      if (cosmetics.hiddenModePurchased) {
        throw new AppError('Hidden mode already purchased', { code: 'ALREADY_PURCHASED', statusCode: 400 });
      }

      const freshUser = await tx.user.findUnique({ where: { id: userId }, select: { balance: true } });
      if (!freshUser) throw new AppError('User not found', { code: 'USER_NOT_FOUND', statusCode: 404 });
      const balanceBefore = freshUser.balance.toNumber();

      if (balanceBefore < price) {
        throw new AppError('Insufficient balance', {
          code: 'INSUFFICIENT_BALANCE', statusCode: 400,
          details: { available: balanceBefore.toString(), required: price },
        });
      }

      await userRepository.decrementBalance(userId, price, tx);
      const balanceAfter = balanceBefore - price;

      await transactionRepository.create({
        userId,
        type: 'hidden_mode_purchase',
        amount: price,
        balanceBefore,
        balanceAfter,
        description: 'Purchased hidden mode',
      }, tx);

      await tx.userCosmetics.update({
        where: { userId },
        data: { hiddenModePurchased: true },
      });
    });

    cosmeticsLogger.info('hidden.purchased', 'Hidden mode purchased', { userId, price });
  },

  async toggleHiddenMode(userId: string): Promise<boolean> {
    const cosmetics = await prisma.userCosmetics.findUnique({ where: { userId } });
    if (!cosmetics?.hiddenModePurchased) {
      throw new AppError('Hidden mode not purchased', { code: 'NOT_PURCHASED', statusCode: 400 });
    }

    const newValue = !cosmetics.hiddenMode;
    await prisma.userCosmetics.update({
      where: { userId },
      data: { hiddenMode: newValue },
    });

    cosmeticsLogger.info('hidden.toggled', 'Hidden mode toggled', { userId, hiddenMode: newValue });
    return newValue;
  },

  async isUnlocked(userId: string, type: 'color' | 'font', id: string): Promise<boolean> {
    const item = type === 'color' ? getColor(id) : getFont(id);
    if (!item) return false;
    if (item.tier === 'free') return true;

    if (item.tier === 'volume') {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { tradingVolume: true },
      });
      return (user?.tradingVolume?.toNumber() ?? 0) >= item.requiredVolume!;
    }

    const cosmetics = await prisma.userCosmetics.findUnique({ where: { userId } });
    const unlocked = type === 'color' ? cosmetics?.unlockedColors : cosmetics?.unlockedFonts;
    return unlocked?.includes(id) ?? false;
  },

  _resolveAvailability(
    item: CosmeticColor | CosmeticFont,
    unlockedIds: string[],
    tradingVolume: number,
  ): { available: boolean; reason: string } {
    if (item.tier === 'free') return { available: true, reason: 'free' };
    if (item.tier === 'paid') {
      return unlockedIds.includes(item.id)
        ? { available: true, reason: 'purchased' }
        : { available: false, reason: 'locked_paid' };
    }
    return tradingVolume >= item.requiredVolume!
      ? { available: true, reason: 'volume_unlocked' }
      : { available: false, reason: 'locked_volume' };
  },
};
