import { prisma } from '../services/database.js';
import { logger } from '../lib/logger.js';

const wdLogger = logger.module('withdrawal.repository');

export const withdrawalRepository = {
  /**
   * Create a pending withdrawal.
   * Accepts an optional Prisma transaction client for use within withTransaction().
   */
  async create(
    data: { userId: string; amount: number; transactionId: string },
    tx?: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  ) {
    const startTime = Date.now();
    const client = tx ?? prisma;

    try {
      const withdrawal = await client.withdrawal.create({
        data: {
          userId: data.userId,
          amount: data.amount,
          transactionId: data.transactionId,
          status: 'pending',
        },
      });

      wdLogger.info('create', 'Withdrawal created', {
        withdrawalId: withdrawal.id,
        userId: data.userId,
        amount: data.amount,
        duration: Date.now() - startTime,
      });

      return withdrawal;
    } catch (error) {
      wdLogger.error('create.failed', 'Failed to create withdrawal', error, { userId: data.userId });
      throw error;
    }
  },

  /**
   * Find all pending withdrawals (for bot polling).
   * Joins with User to get the Minecraft username.
   */
  async findPending() {
    const startTime = Date.now();

    try {
      const withdrawals = await prisma.withdrawal.findMany({
        where: { status: 'pending' },
        include: { user: { select: { minecraftUsername: true } } },
        orderBy: { createdAt: 'asc' },
      });

      wdLogger.debug('findPending', 'Pending withdrawals fetched', {
        count: withdrawals.length,
        duration: Date.now() - startTime,
      });

      return withdrawals;
    } catch (error) {
      wdLogger.error('findPending.failed', 'Failed to fetch pending withdrawals', error);
      throw error;
    }
  },

  /**
   * Atomically claim a withdrawal for processing.
   * Uses conditional UPDATE (WHERE status = 'pending') to prevent two bot
   * instances from claiming the same withdrawal (TOCTOU prevention).
   * Returns true if successfully claimed, false if already claimed by another.
   */
  async markProcessing(id: string): Promise<boolean> {
    const startTime = Date.now();

    try {
      const result = await prisma.withdrawal.updateMany({
        where: { id, status: 'pending' },
        data: { status: 'processing' },
      });

      if (result.count === 0) {
        wdLogger.warn('markProcessing.alreadyClaimed', 'Withdrawal already claimed or not pending', {
          withdrawalId: id,
          duration: Date.now() - startTime,
        });
        return false;
      }

      wdLogger.info('markProcessing', 'Withdrawal claimed for processing', {
        withdrawalId: id,
        duration: Date.now() - startTime,
      });

      return true;
    } catch (error) {
      wdLogger.error('markProcessing.failed', 'Failed to mark withdrawal as processing', error, { id });
      throw error;
    }
  },

  /**
   * Mark a withdrawal as completed after bot confirms payment.
   */
  async markCompleted(id: string) {
    const startTime = Date.now();

    try {
      const withdrawal = await prisma.withdrawal.update({
        where: { id },
        data: {
          status: 'completed',
          completedAt: new Date(),
        },
      });

      wdLogger.info('markCompleted', 'Withdrawal completed', {
        withdrawalId: id,
        duration: Date.now() - startTime,
      });

      return withdrawal;
    } catch (error) {
      wdLogger.error('markCompleted.failed', 'Failed to mark withdrawal as completed', error, { id });
      throw error;
    }
  },

  /**
   * Mark a withdrawal as failed and record the reason.
   */
  async markFailed(id: string, reason: string) {
    const startTime = Date.now();

    try {
      const withdrawal = await prisma.withdrawal.update({
        where: { id },
        data: {
          status: 'failed',
          failReason: reason,
          completedAt: new Date(),
        },
      });

      wdLogger.warn('markFailed', 'Withdrawal failed', {
        withdrawalId: id,
        reason,
        duration: Date.now() - startTime,
      });

      return withdrawal;
    } catch (error) {
      wdLogger.error('markFailed.failed', 'Failed to mark withdrawal as failed', error, { id });
      throw error;
    }
  },

  /**
   * Find the most recent withdrawal by a user (for cooldown check).
   */
  async findLastByUserId(userId: string) {
    const startTime = Date.now();

    try {
      const withdrawal = await prisma.withdrawal.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      });

      wdLogger.debug('findLastByUserId', 'Last withdrawal lookup', {
        userId,
        found: !!withdrawal,
        duration: Date.now() - startTime,
      });

      return withdrawal;
    } catch (error) {
      wdLogger.error('findLastByUserId.failed', 'Failed to find last withdrawal', error, { userId });
      throw error;
    }
  },

  /**
   * Find a withdrawal by ID.
   */
  async findById(id: string) {
    return prisma.withdrawal.findUnique({ where: { id } });
  },
};

export type WithdrawalRepository = typeof withdrawalRepository;
