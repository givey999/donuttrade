import type { Prisma } from '@prisma/client';
import { prisma } from '../services/database.js';
import { logger } from '../lib/logger.js';
import type { TransactionType } from '@donuttrade/shared';

const txLogger = logger.module('transaction.repository');

export const transactionRepository = {
  /**
   * Create a transaction record.
   * Accepts an optional Prisma transaction client for use within withTransaction().
   */
  async create(
    data: {
      userId: string;
      type: TransactionType;
      amount: number;
      balanceBefore: number;
      balanceAfter: number;
      description?: string;
      metadata?: Record<string, unknown>;
    },
    tx?: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  ) {
    const startTime = Date.now();
    const client = tx ?? prisma;

    try {
      const transaction = await client.transaction.create({
        data: {
          userId: data.userId,
          type: data.type,
          amount: data.amount,
          balanceBefore: data.balanceBefore,
          balanceAfter: data.balanceAfter,
          description: data.description,
          metadata: data.metadata as Prisma.InputJsonValue | undefined,
        },
      });

      txLogger.info('create', 'Transaction created', {
        transactionId: transaction.id,
        userId: data.userId,
        type: data.type,
        amount: data.amount,
        duration: Date.now() - startTime,
      });

      return transaction;
    } catch (error) {
      txLogger.error('create.failed', 'Failed to create transaction', error, {
        userId: data.userId,
        type: data.type,
      });
      throw error;
    }
  },

  /**
   * Find transactions by user ID with pagination.
   */
  async findByUserId(userId: string, options?: { skip?: number; take?: number }) {
    const startTime = Date.now();

    try {
      const [transactions, total] = await Promise.all([
        prisma.transaction.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          skip: options?.skip,
          take: options?.take,
        }),
        prisma.transaction.count({ where: { userId } }),
      ]);

      txLogger.debug('findByUserId', 'Transactions fetched', {
        userId,
        count: transactions.length,
        total,
        duration: Date.now() - startTime,
      });

      return { transactions, total };
    } catch (error) {
      txLogger.error('findByUserId.failed', 'Failed to fetch transactions', error, { userId });
      throw error;
    }
  },
};

export type TransactionRepository = typeof transactionRepository;
