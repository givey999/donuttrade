import { FastifyPluginAsync } from 'fastify';
import { transactionRepository } from '../repositories/transaction.repository.js';
import type { TransactionType, TransactionRecord, PaginationMeta } from '@donuttrade/shared';

const VALID_TYPES: TransactionType[] = ['deposit', 'withdrawal', 'purchase', 'sale', 'escrow', 'escrow_refund', 'listing_fee', 'admin_adjustment'];

/**
 * User-facing transaction routes — /transactions
 */
export const transactionRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /transactions
   * Returns paginated transaction history for the authenticated user.
   */
  fastify.get<{
    Querystring: { page?: string; perPage?: string; type?: string };
  }>('/', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'string' },
          perPage: { type: 'string' },
          type: { type: 'string' },
        },
      },
    },
    preHandler: [fastify.authenticate],
  }, async (request) => {
    const userId = request.user!.id;

    const page = Math.max(1, parseInt(request.query.page || '1', 10) || 1);
    const perPage = Math.min(100, Math.max(1, parseInt(request.query.perPage || '20', 10) || 20));
    const typeFilter = request.query.type as TransactionType | undefined;

    if (typeFilter && !VALID_TYPES.includes(typeFilter)) {
      return {
        success: false,
        error: { code: 'INVALID_TYPE', message: `Invalid type filter. Must be one of: ${VALID_TYPES.join(', ')}` },
      };
    }

    const skip = (page - 1) * perPage;
    const { transactions, total } = await transactionRepository.findByUserId(userId, { skip, take: perPage });

    // Map Prisma Decimal fields to strings to match TransactionRecord shape
    const mapped: TransactionRecord[] = transactions.map((tx) => ({
      id: tx.id,
      userId: tx.userId,
      type: tx.type as TransactionType,
      amount: tx.amount.toString(),
      balanceBefore: tx.balanceBefore.toString(),
      balanceAfter: tx.balanceAfter.toString(),
      description: tx.description,
      createdAt: tx.createdAt.toISOString(),
    }));

    const meta: PaginationMeta = {
      page,
      perPage,
      total,
      totalPages: Math.ceil(total / perPage),
    };

    return {
      success: true,
      data: { transactions: mapped, meta },
    };
  });
};
