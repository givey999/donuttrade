import { userRepository } from '../repositories/user.repository.js';
import { transactionRepository } from '../repositories/transaction.repository.js';
import { withdrawalRepository } from '../repositories/withdrawal.repository.js';
import { withTransaction } from './database.js';
import { logger } from '../lib/logger.js';
import { AppError, ValidationError } from '../lib/errors.js';
import { eventBus } from './event-bus.service.js';
import {
  WITHDRAWAL_MIN_AMOUNT,
  WITHDRAWAL_MAX_AMOUNT,
  WITHDRAWAL_COOLDOWN_MS,
} from '@donuttrade/shared';

const wdLogger = logger.module('withdrawal.service');

export const withdrawalService = {
  /**
   * Request a withdrawal from the user's balance.
   * Validates cooldown, amount limits, and sufficient balance.
   * Creates a pending withdrawal + deducts balance atomically.
   */
  async requestWithdrawal(userId: string, amount: number) {
    wdLogger.info('requestWithdrawal', 'Withdrawal requested', { userId, amount });

    // Validate amount limits
    if (amount < WITHDRAWAL_MIN_AMOUNT || amount > WITHDRAWAL_MAX_AMOUNT) {
      throw new ValidationError('Amount out of limits', {
        min: WITHDRAWAL_MIN_AMOUNT,
        max: WITHDRAWAL_MAX_AMOUNT,
        requested: amount,
      });
    }

    // Check user exists, is verified, and not banned
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new AppError('User not found', { code: 'USER_NOT_FOUND', statusCode: 404 });
    }

    if (user.verificationStatus !== 'verified') {
      throw new AppError('Account must be verified to withdraw', { code: 'NOT_VERIFIED', statusCode: 403 });
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

    if (!user.minecraftUsername) {
      throw new AppError('Minecraft username must be set', { code: 'USERNAME_NOT_SET', statusCode: 400 });
    }

    // Atomically: check cooldown + decrement balance + create transaction + create withdrawal
    // All inside one transaction to prevent cooldown bypass and balance races
    const result = await withTransaction(async (tx) => {
      // Block if there's already a pending or processing withdrawal
      const activeWithdrawal = await tx.withdrawal.findFirst({
        where: { userId, status: { in: ['pending', 'approved', 'processing'] } },
      });
      if (activeWithdrawal) {
        throw new AppError('You already have a withdrawal in progress', {
          code: 'WITHDRAWAL_ACTIVE',
          statusCode: 409,
        });
      }

      // Cooldown check inside transaction
      const lastWithdrawal = await tx.withdrawal.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      });
      if (lastWithdrawal) {
        const elapsed = Date.now() - lastWithdrawal.createdAt.getTime();
        if (elapsed < WITHDRAWAL_COOLDOWN_MS) {
          const remainingMs = WITHDRAWAL_COOLDOWN_MS - elapsed;
          throw new AppError('Withdrawal cooldown active', {
            code: 'WITHDRAWAL_COOLDOWN',
            statusCode: 429,
            details: { remainingMs, retryAfter: Math.ceil(remainingMs / 1000) },
          });
        }
      }

      // Read fresh balance inside transaction
      const freshUser = await tx.user.findUnique({ where: { id: userId }, select: { balance: true } });
      if (!freshUser) {
        throw new AppError('User not found', { code: 'USER_NOT_FOUND', statusCode: 404 });
      }
      const balanceBefore = freshUser.balance.toNumber();

      if (balanceBefore < amount) {
        throw new AppError('Insufficient balance', {
          code: 'INSUFFICIENT_BALANCE',
          statusCode: 400,
          details: { available: balanceBefore.toString(), requested: amount },
        });
      }

      const balanceAfter = balanceBefore - amount;

      await userRepository.decrementBalance(userId, amount, tx);

      const transaction = await transactionRepository.create({
        userId,
        type: 'withdrawal',
        amount,
        balanceBefore,
        balanceAfter,
        description: 'Withdrawal to in-game',
      }, tx);

      const withdrawal = await withdrawalRepository.create({
        userId,
        amount,
        transactionId: transaction.id,
      }, tx);

      return {
        id: withdrawal.id,
        userId,
        amount: amount.toString(),
        status: withdrawal.status as 'pending',
        createdAt: withdrawal.createdAt.toISOString(),
        completedAt: null,
      };
    });

    wdLogger.info('requestWithdrawal.success', 'Withdrawal created', {
      userId,
      withdrawalId: result.id,
      amount,
    });

    return result;
  },

  /**
   * Confirm a withdrawal after the bot has sent the /pay command.
   */
  async confirmWithdrawal(withdrawalId: string) {
    wdLogger.info('confirmWithdrawal', 'Confirming withdrawal', { withdrawalId });

    const withdrawal = await withdrawalRepository.findById(withdrawalId);
    if (!withdrawal) {
      throw new AppError('Withdrawal not found', { code: 'WITHDRAWAL_NOT_FOUND', statusCode: 404 });
    }

    if (withdrawal.status !== 'approved' && withdrawal.status !== 'processing') {
      throw new AppError('Withdrawal is not in a confirmable state', {
        code: 'INVALID_WITHDRAWAL_STATE',
        statusCode: 400,
        details: { currentStatus: withdrawal.status },
      });
    }

    await withdrawalRepository.markCompleted(withdrawalId);

    wdLogger.info('confirmWithdrawal.success', 'Withdrawal confirmed', {
      withdrawalId,
      userId: withdrawal.userId,
      amount: withdrawal.amount.toString(),
    });

    void eventBus.publish(withdrawal.userId, 'withdrawal.completed', {
      withdrawalId,
      amount: withdrawal.amount.toString(),
    });
  },

  /**
   * Fail a withdrawal and refund the user's balance.
   */
  async failWithdrawal(withdrawalId: string, reason: string) {
    wdLogger.warn('failWithdrawal', 'Failing withdrawal', { withdrawalId, reason });

    const withdrawal = await withdrawalRepository.findById(withdrawalId);
    if (!withdrawal) {
      throw new AppError('Withdrawal not found', { code: 'WITHDRAWAL_NOT_FOUND', statusCode: 404 });
    }

    if (withdrawal.status === 'completed' || withdrawal.status === 'failed') {
      throw new AppError('Withdrawal is already finalized', {
        code: 'INVALID_WITHDRAWAL_STATE',
        statusCode: 400,
        details: { currentStatus: withdrawal.status },
      });
    }

    const amount = withdrawal.amount.toNumber();

    // Refund: re-increment balance + create reversal transaction + mark failed — ALL atomic
    await withTransaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: withdrawal.userId }, select: { balance: true } });
      if (!user) {
        throw new AppError('User not found', { code: 'USER_NOT_FOUND', statusCode: 404 });
      }
      const balanceBefore = user.balance.toNumber();
      const balanceAfter = balanceBefore + amount;

      await userRepository.incrementBalance(withdrawal.userId, amount, tx);

      await transactionRepository.create({
        userId: withdrawal.userId,
        type: 'deposit',
        amount,
        balanceBefore,
        balanceAfter,
        description: `Withdrawal refund: ${reason}`,
        metadata: { withdrawalId, refund: true } as Record<string, unknown>,
      }, tx);

      // Mark failed inside the same transaction to prevent double-payout on crash
      await tx.withdrawal.update({
        where: { id: withdrawalId },
        data: {
          status: 'failed',
          failReason: reason,
          completedAt: new Date(),
        },
      });
    });

    wdLogger.info('failWithdrawal.refunded', 'Withdrawal failed and refunded', {
      withdrawalId,
      userId: withdrawal.userId,
      amount,
      reason,
    });
  },

  /**
   * Atomically claim a pending withdrawal for processing.
   * Returns true if claimed, false if already claimed by another instance.
   */
  async claimWithdrawal(withdrawalId: string): Promise<boolean> {
    const claimed = await withdrawalRepository.markProcessing(withdrawalId);

    if (claimed) {
      wdLogger.info('claimWithdrawal', 'Withdrawal claimed for processing', { withdrawalId });
    }

    return claimed;
  },

  async approveWithdrawal(withdrawalId: string) {
    wdLogger.info('approveWithdrawal', 'Approving withdrawal', { withdrawalId });

    const approved = await withdrawalRepository.markApproved(withdrawalId);

    if (!approved) {
      throw new AppError('Withdrawal is not in pending state', {
        code: 'INVALID_WITHDRAWAL_STATE',
        statusCode: 400,
      });
    }

    wdLogger.info('approveWithdrawal.success', 'Withdrawal approved', { withdrawalId });
  },

  async denyWithdrawal(withdrawalId: string, reason: string) {
    wdLogger.info('denyWithdrawal', 'Denying withdrawal', { withdrawalId, reason });

    const withdrawal = await withdrawalRepository.findById(withdrawalId);
    if (!withdrawal) {
      throw new AppError('Withdrawal not found', { code: 'WITHDRAWAL_NOT_FOUND', statusCode: 404 });
    }

    if (withdrawal.status !== 'pending') {
      throw new AppError('Withdrawal is not in pending state', {
        code: 'INVALID_WITHDRAWAL_STATE',
        statusCode: 400,
        details: { currentStatus: withdrawal.status },
      });
    }

    const amount = withdrawal.amount.toNumber();

    // Refund: re-increment balance + create reversal transaction + mark denied — ALL atomic
    await withTransaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: withdrawal.userId }, select: { balance: true } });
      if (!user) {
        throw new AppError('User not found', { code: 'USER_NOT_FOUND', statusCode: 404 });
      }
      const balanceBefore = user.balance.toNumber();
      const balanceAfter = balanceBefore + amount;

      await userRepository.incrementBalance(withdrawal.userId, amount, tx);

      await transactionRepository.create({
        userId: withdrawal.userId,
        type: 'deposit',
        amount,
        balanceBefore,
        balanceAfter,
        description: `Withdrawal denied: ${reason}`,
        metadata: { withdrawalId, denied: true } as Record<string, unknown>,
      }, tx);

      await tx.withdrawal.update({
        where: { id: withdrawalId },
        data: {
          status: 'denied',
          failReason: reason,
          completedAt: new Date(),
        },
      });
    });

    wdLogger.info('denyWithdrawal.refunded', 'Withdrawal denied and refunded', {
      withdrawalId,
      userId: withdrawal.userId,
      amount,
      reason,
    });

    void eventBus.publish(withdrawal.userId, 'withdrawal.denied', {
      withdrawalId,
      amount: amount.toString(),
      reason,
    });
  },

  /**
   * Get pending withdrawals with usernames (for bot polling).
   */
  async getPendingWithdrawals() {
    const withdrawals = await withdrawalRepository.findApproved();

    return withdrawals
      .filter((w) => w.user.minecraftUsername)
      .map((w) => ({
        id: w.id,
        username: w.user.minecraftUsername!,
        amount: w.amount.toString(),
      }));
  },
};

export type WithdrawalService = typeof withdrawalService;
