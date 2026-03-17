import { FastifyPluginAsync } from 'fastify';
import { prisma } from '../../services/database.js';
import { withTransaction } from '../../services/database.js';
import { userRepository } from '../../repositories/user.repository.js';
import { transactionRepository } from '../../repositories/transaction.repository.js';
import { AppError } from '../../lib/errors.js';
import { ROLE_HIERARCHY } from '@donuttrade/shared';
import { logger } from '../../lib/logger.js';
import { auditService } from '../../services/audit.service.js';

const adminLogger = logger.module('admin.users');

function canActOn(actorRole: string, targetRole: string): boolean {
  return (ROLE_HIERARCHY[actorRole] ?? 0) > (ROLE_HIERARCHY[targetRole] ?? 0);
}

export const adminUserRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /admin/users
   * Search/filter users with pagination.
   */
  fastify.get<{
    Querystring: { search?: string; role?: string; page?: string; perPage?: string };
  }>('/', async (request) => {
    const page = Math.max(1, parseInt(request.query.page || '1', 10) || 1);
    const perPage = Math.min(100, Math.max(1, parseInt(request.query.perPage || '20', 10) || 20));
    const skip = (page - 1) * perPage;

    const where: Record<string, unknown> = {};
    if (request.query.role) {
      where.role = request.query.role;
    }
    if (request.query.search) {
      where.OR = [
        { minecraftUsername: { contains: request.query.search, mode: 'insensitive' } },
        { email: { contains: request.query.search, mode: 'insensitive' } },
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          minecraftUsername: true,
          email: true,
          authProvider: true,
          balance: true,
          role: true,
          verificationStatus: true,
          bannedAt: true,
          timedOutUntil: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: perPage,
      }),
      prisma.user.count({ where }),
    ]);

    return {
      success: true,
      data: {
        users: users.map((u) => ({
          id: u.id,
          minecraftUsername: u.minecraftUsername,
          email: u.email,
          authProvider: u.authProvider,
          balance: u.balance.toString(),
          role: u.role,
          verificationStatus: u.verificationStatus,
          isBanned: !!u.bannedAt,
          isTimedOut: u.timedOutUntil ? u.timedOutUntil > new Date() : false,
          createdAt: u.createdAt.toISOString(),
        })),
        meta: {
          page,
          perPage,
          total,
          totalPages: Math.ceil(total / perPage),
        },
      },
    };
  });

  /**
   * GET /admin/users/:id
   * User detail with recent activity.
   */
  fastify.get<{ Params: { id: string } }>('/:id', async (request) => {
    const user = await prisma.user.findUnique({
      where: { id: request.params.id },
      include: {
        transactions: { orderBy: { createdAt: 'desc' }, take: 20 },
        orders: { orderBy: { createdAt: 'desc' }, take: 10, include: { catalogItem: true } },
        itemDeposits: { orderBy: { createdAt: 'desc' }, take: 10, include: { catalogItem: true } },
        itemWithdrawals: { orderBy: { createdAt: 'desc' }, take: 10, include: { catalogItem: true } },
      },
    });

    if (!user) {
      throw new AppError('User not found', { code: 'USER_NOT_FOUND', statusCode: 404 });
    }

    return {
      success: true,
      data: {
        id: user.id,
        minecraftUsername: user.minecraftUsername,
        email: user.email,
        authProvider: user.authProvider,
        balance: user.balance.toString(),
        role: user.role,
        verificationStatus: user.verificationStatus,
        bannedAt: user.bannedAt?.toISOString() ?? null,
        banReason: user.banReason,
        timedOutUntil: user.timedOutUntil?.toISOString() ?? null,
        timeoutReason: user.timeoutReason,
        createdAt: user.createdAt.toISOString(),
        lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
        recentTransactions: user.transactions.map((tx) => ({
          id: tx.id,
          type: tx.type,
          amount: tx.amount.toString(),
          balanceBefore: tx.balanceBefore.toString(),
          balanceAfter: tx.balanceAfter.toString(),
          description: tx.description,
          createdAt: tx.createdAt.toISOString(),
        })),
        recentOrders: user.orders.map((o) => ({
          id: o.id,
          type: o.type,
          catalogItemDisplayName: o.catalogItem.displayName,
          quantity: o.quantity,
          filledQuantity: o.filledQuantity,
          pricePerUnit: o.pricePerUnit.toString(),
          status: o.status,
          createdAt: o.createdAt.toISOString(),
        })),
        recentDeposits: user.itemDeposits.map((d) => ({
          id: d.id,
          catalogItemDisplayName: d.catalogItem.displayName,
          quantity: d.quantity,
          status: d.status,
          createdAt: d.createdAt.toISOString(),
        })),
        recentWithdrawals: user.itemWithdrawals.map((w) => ({
          id: w.id,
          catalogItemDisplayName: w.catalogItem.displayName,
          quantity: w.quantity,
          status: w.status,
          createdAt: w.createdAt.toISOString(),
        })),
      },
    };
  });

  /**
   * PATCH /admin/users/:id/ban
   */
  fastify.patch<{
    Params: { id: string };
    Body: { reason: string };
  }>('/:id/ban', async (request) => {
    const actorRole = request.user!.role;
    if (actorRole !== 'admin' && actorRole !== 'manager') {
      throw new AppError('Only managers and admins can ban users', { code: 'FORBIDDEN', statusCode: 403 });
    }

    if (request.params.id === request.user!.id) {
      throw new AppError('Cannot ban yourself', { code: 'SELF_ACTION', statusCode: 400 });
    }

    const target = await prisma.user.findUnique({ where: { id: request.params.id }, select: { role: true } });
    if (!target) throw new AppError('User not found', { code: 'USER_NOT_FOUND', statusCode: 404 });

    if (!canActOn(actorRole, target.role)) {
      throw new AppError('Cannot ban a user at or above your role level', { code: 'HIERARCHY_VIOLATION', statusCode: 403 });
    }

    const reason = (request.body as { reason: string })?.reason || 'No reason provided';
    await userRepository.ban(request.params.id, reason);
    await auditService.log({ actorId: request.user!.id, action: 'user.ban', targetType: 'user', targetId: request.params.id, details: { reason } });
    adminLogger.warn('ban', 'User banned by admin', { targetId: request.params.id, adminId: request.user!.id, reason });
    return { success: true };
  });

  /**
   * PATCH /admin/users/:id/unban
   */
  fastify.patch<{ Params: { id: string } }>('/:id/unban', async (request) => {
    const actorRole = request.user!.role;
    if (actorRole !== 'admin' && actorRole !== 'manager') {
      throw new AppError('Only managers and admins can unban users', { code: 'FORBIDDEN', statusCode: 403 });
    }

    await userRepository.unban(request.params.id);
    await auditService.log({ actorId: request.user!.id, action: 'user.unban', targetType: 'user', targetId: request.params.id });
    adminLogger.info('unban', 'User unbanned by admin', { targetId: request.params.id, adminId: request.user!.id });
    return { success: true };
  });

  /**
   * PATCH /admin/users/:id/timeout
   */
  fastify.patch<{
    Params: { id: string };
    Body: { durationMs: number; reason: string };
  }>('/:id/timeout', async (request) => {
    const actorRole = request.user!.role;
    if (actorRole !== 'admin' && actorRole !== 'manager') {
      throw new AppError('Only managers and admins can timeout users', { code: 'FORBIDDEN', statusCode: 403 });
    }

    if (request.params.id === request.user!.id) {
      throw new AppError('Cannot timeout yourself', { code: 'SELF_ACTION', statusCode: 400 });
    }

    const target = await prisma.user.findUnique({ where: { id: request.params.id }, select: { role: true } });
    if (!target) throw new AppError('User not found', { code: 'USER_NOT_FOUND', statusCode: 404 });

    if (!canActOn(actorRole, target.role)) {
      throw new AppError('Cannot timeout a user at or above your role level', { code: 'HIERARCHY_VIOLATION', statusCode: 403 });
    }

    const { durationMs, reason } = request.body as { durationMs: number; reason: string };
    if (!durationMs || durationMs < 1) {
      throw new AppError('Duration is required', { code: 'VALIDATION_ERROR', statusCode: 400 });
    }

    const timedOutUntil = new Date(Date.now() + durationMs);
    await prisma.user.update({
      where: { id: request.params.id },
      data: { timedOutUntil, timeoutReason: reason || null },
    });

    await auditService.log({ actorId: request.user!.id, action: 'user.timeout', targetType: 'user', targetId: request.params.id, details: { durationMs, reason, until: timedOutUntil.toISOString() } });
    adminLogger.warn('timeout', 'User timed out by admin', {
      targetId: request.params.id,
      adminId: request.user!.id,
      durationMs,
      reason,
    });
    return { success: true, data: { timedOutUntil: timedOutUntil.toISOString() } };
  });

  /**
   * PATCH /admin/users/:id/remove-timeout
   */
  fastify.patch<{ Params: { id: string } }>('/:id/remove-timeout', async (request) => {
    const actorRole = request.user!.role;
    if (actorRole !== 'admin' && actorRole !== 'manager') {
      throw new AppError('Only managers and admins can remove timeouts', { code: 'FORBIDDEN', statusCode: 403 });
    }

    await prisma.user.update({
      where: { id: request.params.id },
      data: { timedOutUntil: null, timeoutReason: null },
    });

    await auditService.log({ actorId: request.user!.id, action: 'user.remove_timeout', targetType: 'user', targetId: request.params.id });
    adminLogger.info('removeTimeout', 'Timeout removed by admin', { targetId: request.params.id, adminId: request.user!.id });
    return { success: true };
  });

  /**
   * PATCH /admin/users/:id/balance
   * Admin only — adjust user balance.
   */
  fastify.patch<{
    Params: { id: string };
    Body: { amount: number; direction: 'add' | 'subtract'; reason: string };
  }>('/:id/balance', async (request) => {
    if (request.user!.role !== 'admin') {
      throw new AppError('Only admins can adjust balances', { code: 'FORBIDDEN', statusCode: 403 });
    }

    const { amount, direction, reason } = request.body as { amount: number; direction: 'add' | 'subtract'; reason: string };
    if (!amount || amount <= 0) {
      throw new AppError('Amount must be positive', { code: 'VALIDATION_ERROR', statusCode: 400 });
    }
    if (!direction || (direction !== 'add' && direction !== 'subtract')) {
      throw new AppError('Direction must be "add" or "subtract"', { code: 'VALIDATION_ERROR', statusCode: 400 });
    }

    const targetId = request.params.id;

    await withTransaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: targetId }, select: { balance: true } });
      if (!user) throw new AppError('User not found', { code: 'USER_NOT_FOUND', statusCode: 404 });

      const balanceBefore = user.balance.toNumber();

      if (direction === 'add') {
        await userRepository.incrementBalance(targetId, amount, tx);
      } else {
        await userRepository.decrementBalance(targetId, amount, tx);
      }

      const balanceAfter = direction === 'add' ? balanceBefore + amount : balanceBefore - amount;

      await transactionRepository.create({
        userId: targetId,
        type: 'admin_adjustment',
        amount,
        balanceBefore,
        balanceAfter,
        description: `Admin ${direction}: ${reason || 'No reason'}`,
        metadata: { adminId: request.user!.id, direction },
      }, tx);
    });

    await auditService.log({ actorId: request.user!.id, action: 'user.balance_adjust', targetType: 'user', targetId, details: { amount, direction, reason } });
    adminLogger.warn('balanceAdjust', 'Balance adjusted by admin', {
      targetId,
      adminId: request.user!.id,
      amount,
      direction,
      reason,
    });

    return { success: true };
  });

  /**
   * PATCH /admin/users/:id/role
   * Admin only — change user role.
   */
  fastify.patch<{
    Params: { id: string };
    Body: { role: string };
  }>('/:id/role', async (request) => {
    if (request.user!.role !== 'admin') {
      throw new AppError('Only admins can change roles', { code: 'FORBIDDEN', statusCode: 403 });
    }

    if (request.params.id === request.user!.id) {
      throw new AppError('Cannot change your own role', { code: 'SELF_ACTION', statusCode: 400 });
    }

    const { role: newRole } = request.body as { role: string };
    const validRoles = ['user', 'moderator', 'manager', 'admin'];
    if (!validRoles.includes(newRole)) {
      throw new AppError('Invalid role', { code: 'VALIDATION_ERROR', statusCode: 400, details: { validRoles } });
    }

    const target = await prisma.user.findUnique({ where: { id: request.params.id }, select: { role: true } });
    if (!target) throw new AppError('User not found', { code: 'USER_NOT_FOUND', statusCode: 404 });

    // Cannot demote another admin
    if (target.role === 'admin') {
      throw new AppError('Cannot change another admin\'s role', { code: 'HIERARCHY_VIOLATION', statusCode: 403 });
    }

    await prisma.user.update({
      where: { id: request.params.id },
      data: { role: newRole },
    });

    await auditService.log({ actorId: request.user!.id, action: 'user.role_change', targetType: 'user', targetId: request.params.id, details: { oldRole: target.role, newRole } });
    adminLogger.warn('roleChange', 'User role changed by admin', {
      targetId: request.params.id,
      adminId: request.user!.id,
      oldRole: target.role,
      newRole,
    });

    return { success: true };
  });
};
