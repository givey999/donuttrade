import { userRepository } from '../repositories/user.repository.js';
import { transactionRepository } from '../repositories/transaction.repository.js';
import { withTransaction } from './database.js';
import { logger } from '../lib/logger.js';
import { AppError } from '../lib/errors.js';
import { eventBus } from './event-bus.service.js';
import * as redisCache from './redis.js';
import {
  DEPOSIT_MIN_AMOUNT,
  DEPOSIT_MAX_AMOUNT,
} from '@donuttrade/shared';

const depositLogger = logger.module('deposit.service');
const DEDUP_TTL_SECONDS = 60;

export const depositService = {
  /**
   * Process an incoming deposit from the in-game bot.
   *
   * Returns:
   * - { deposited: true, deposit } on success
   * - { deposited: false, refund: true, refundAmount } when amount is out of limits (bot refunds)
   * - { deposited: false, refund: false } for unknown/unverified users (no refund)
   */
  async processDeposit(username: string, amount: number, timestamp?: string) {
    depositLogger.info('processDeposit', 'Processing deposit', { username, amount });

    // Dedup check — prevent the same payment from being credited twice
    const dedupKey = `dedup:deposit:${username}:${amount}:${timestamp ?? 'none'}`;
    const cached = await redisCache.get(dedupKey);
    if (cached) {
      depositLogger.info('processDeposit.dedup', 'Duplicate deposit detected, returning cached result', {
        username, amount, timestamp,
      });
      return JSON.parse(cached);
    }

    // Validate amount within limits
    if (amount < DEPOSIT_MIN_AMOUNT || amount > DEPOSIT_MAX_AMOUNT) {
      depositLogger.warn('processDeposit.outOfLimits', 'Deposit amount out of limits', {
        username,
        amount,
        min: DEPOSIT_MIN_AMOUNT,
        max: DEPOSIT_MAX_AMOUNT,
      });

      // Check if user exists — only refund registered users
      const user = await userRepository.findByMinecraftUsername(username);
      if (!user || user.verificationStatus !== 'verified') {
        return { deposited: false, refund: false };
      }

      return { deposited: false, refund: true, refundAmount: amount };
    }

    // Find user by Minecraft username
    const user = await userRepository.findByMinecraftUsername(username);
    if (!user) {
      depositLogger.debug('processDeposit.noUser', 'No user found for username', { username });
      return { deposited: false, refund: false };
    }

    // Must be verified and not banned
    if (user.verificationStatus !== 'verified') {
      depositLogger.debug('processDeposit.notVerified', 'User not verified', {
        userId: user.id,
        status: user.verificationStatus,
      });
      return { deposited: false, refund: false };
    }

    if (user.bannedAt) {
      depositLogger.warn('processDeposit.banned', 'Banned user attempted deposit', {
        userId: user.id,
        username,
      });
      return { deposited: false, refund: false };
    }

    // Process deposit atomically — read fresh balance inside the transaction
    // to prevent stale balanceBefore/balanceAfter on concurrent deposits
    const result = await withTransaction(async (tx) => {
      const freshUser = await tx.user.findUnique({ where: { id: user.id }, select: { balance: true } });
      if (!freshUser) {
        throw new AppError('User not found', { code: 'USER_NOT_FOUND', statusCode: 404 });
      }
      const balanceBefore = freshUser.balance.toNumber();
      const balanceAfter = balanceBefore + amount;

      // Increment balance
      await userRepository.incrementBalance(user.id, amount, tx);

      // Create transaction record
      const transaction = await transactionRepository.create({
        userId: user.id,
        type: 'deposit',
        amount,
        balanceBefore,
        balanceAfter,
        description: `Deposit from in-game payment`,
        metadata: { fromUsername: username },
      }, tx);

      return {
        transactionId: transaction.id,
        amount: amount.toString(),
        balanceBefore: balanceBefore.toString(),
        balanceAfter: balanceAfter.toString(),
      };
    });

    depositLogger.info('processDeposit.success', 'Deposit processed', {
      userId: user.id,
      username,
      amount,
      transactionId: result.transactionId,
    });

    // Emit deposit.confirmed event for SSE notifications
    await eventBus.publish(user.id, 'deposit.confirmed', { amount: result.amount });

    const successResult = { deposited: true, deposit: result };
    await redisCache.set(dedupKey, JSON.stringify(successResult), DEDUP_TTL_SECONDS);
    return successResult;
  },
};

export type DepositService = typeof depositService;
