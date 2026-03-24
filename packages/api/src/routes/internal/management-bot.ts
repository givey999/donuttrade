import { FastifyPluginAsync } from 'fastify';
import { config } from '../../config/index.js';
import { logger } from '../../lib/logger.js';
import { AppError } from '../../lib/errors.js';
import { verifyCode } from '../../lib/deposit-code.js';
import { itemDepositService } from '../../services/item-deposit.service.js';
import { itemWithdrawalService } from '../../services/item-withdrawal.service.js';
import { platformSettingsService } from '../../services/platform-settings.service.js';
import { prisma } from '../../services/database.js';

const botLogger = logger.module('internal.management-bot');

export const managementBotRoutes: FastifyPluginAsync = async (fastify) => {
  // Shared auth for all management bot routes — match existing internal route pattern
  const authenticateBot = async (request: any) => {
    const authHeader = request.headers.authorization;
    if (!authHeader) {
      throw new AppError('Authorization required', { code: 'UNAUTHORIZED', statusCode: 401 });
    }
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer' || parts[1] !== config.BOT_WEBHOOK_SECRET) {
      botLogger.warn('unauthorized', 'Invalid webhook secret for management bot');
      throw new AppError('Invalid authorization', { code: 'UNAUTHORIZED', statusCode: 401 });
    }
  };

  // POST /internal/management-bot/verify-code
  fastify.post<{ Body: { code: string } }>('/management-bot/verify-code', {
    schema: {
      body: {
        type: 'object',
        required: ['code'],
        properties: { code: { type: 'string' } },
      },
    },
    preHandler: authenticateBot,
  }, async (request) => {
    const { code } = request.body;

    const payload = verifyCode(code);
    if (!payload) {
      throw new AppError('Invalid or expired code', { code: 'INVALID_CODE', statusCode: 400 });
    }

    if (payload.type === 'deposit') {
      // Check idempotent retry
      if (await itemDepositService.isRecentlyVerified(payload.id)) {
        const deposit = await prisma.itemDeposit.findUnique({
          where: { id: payload.id },
          include: { catalogItem: true, user: true },
        });
        return {
          success: true,
          data: {
            type: 'deposit',
            recordId: payload.id,
            userId: payload.userId,
            username: deposit?.user?.minecraftUsername || 'Unknown',
            catalogItemDisplayName: deposit?.catalogItem?.displayName || 'Unknown',
            quantity: payload.quantity,
          },
        };
      }

      const claimed = await itemDepositService.verifyAndClaimDeposit(payload.id);
      if (!claimed) {
        throw new AppError('This code has already been used', { code: 'CODE_ALREADY_USED', statusCode: 409 });
      }

      const deposit = await prisma.itemDeposit.findUnique({
        where: { id: payload.id },
        include: { catalogItem: true, user: true },
      });

      botLogger.info('verify-code.deposit', 'Deposit code verified', {
        depositId: payload.id, userId: payload.userId,
      });

      return {
        success: true,
        data: {
          type: 'deposit',
          recordId: payload.id,
          userId: payload.userId,
          username: deposit?.user?.minecraftUsername || 'Unknown',
          catalogItemDisplayName: deposit?.catalogItem?.displayName || 'Unknown',
          quantity: payload.quantity,
        },
      };
    }

    if (payload.type === 'withdrawal') {
      if (await itemWithdrawalService.isRecentlyVerified(payload.id)) {
        const withdrawal = await prisma.itemWithdrawal.findUnique({
          where: { id: payload.id },
          include: { catalogItem: true, user: true },
        });
        return {
          success: true,
          data: {
            type: 'withdrawal',
            recordId: payload.id,
            userId: payload.userId,
            username: withdrawal?.user?.minecraftUsername || 'Unknown',
            catalogItemDisplayName: withdrawal?.catalogItem?.displayName || 'Unknown',
            quantity: payload.quantity,
          },
        };
      }

      const claimed = await itemWithdrawalService.verifyAndClaimWithdrawal(payload.id);
      if (!claimed) {
        throw new AppError('This code has already been used', { code: 'CODE_ALREADY_USED', statusCode: 409 });
      }

      const withdrawal = await prisma.itemWithdrawal.findUnique({
        where: { id: payload.id },
        include: { catalogItem: true, user: true },
      });

      botLogger.info('verify-code.withdrawal', 'Withdrawal code verified', {
        withdrawalId: payload.id, userId: payload.userId,
      });

      return {
        success: true,
        data: {
          type: 'withdrawal',
          recordId: payload.id,
          userId: payload.userId,
          username: withdrawal?.user?.minecraftUsername || 'Unknown',
          catalogItemDisplayName: withdrawal?.catalogItem?.displayName || 'Unknown',
          quantity: payload.quantity,
        },
      };
    }

    throw new AppError('Invalid code type', { code: 'INVALID_CODE', statusCode: 400 });
  });

  // POST /internal/management-bot/confirm-deposit/:id
  fastify.post<{
    Params: { id: string };
    Body: { closedBy: string };
  }>('/management-bot/confirm-deposit/:id', {
    schema: {
      body: {
        type: 'object',
        required: ['closedBy'],
        properties: { closedBy: { type: 'string' } },
      },
    },
    preHandler: authenticateBot,
  }, async (request) => {
    await itemDepositService.confirmVerifiedDeposit(request.params.id, request.body.closedBy);
    return { success: true };
  });

  // POST /internal/management-bot/confirm-withdrawal/:id
  fastify.post<{
    Params: { id: string };
    Body: { closedBy: string };
  }>('/management-bot/confirm-withdrawal/:id', {
    schema: {
      body: {
        type: 'object',
        required: ['closedBy'],
        properties: { closedBy: { type: 'string' } },
      },
    },
    preHandler: authenticateBot,
  }, async (request) => {
    await itemWithdrawalService.confirmVerifiedWithdrawal(request.params.id, request.body.closedBy);
    return { success: true };
  });

  // POST /internal/management-bot/reject-deposit/:id
  fastify.post<{
    Params: { id: string };
    Body: { closedBy: string; reason: string };
  }>('/management-bot/reject-deposit/:id', {
    schema: {
      body: {
        type: 'object',
        required: ['closedBy', 'reason'],
        properties: {
          closedBy: { type: 'string' },
          reason: { type: 'string' },
        },
      },
    },
    preHandler: authenticateBot,
  }, async (request) => {
    await itemDepositService.rejectVerifiedDeposit(
      request.params.id, request.body.closedBy, request.body.reason
    );
    return { success: true };
  });

  // POST /internal/management-bot/reject-withdrawal/:id
  fastify.post<{
    Params: { id: string };
    Body: { closedBy: string; reason: string };
  }>('/management-bot/reject-withdrawal/:id', {
    schema: {
      body: {
        type: 'object',
        required: ['closedBy', 'reason'],
        properties: {
          closedBy: { type: 'string' },
          reason: { type: 'string' },
        },
      },
    },
    preHandler: authenticateBot,
  }, async (request) => {
    await itemWithdrawalService.rejectVerifiedWithdrawal(
      request.params.id, request.body.closedBy, request.body.reason
    );
    return { success: true };
  });

  // POST /internal/management-bot/ticket-counter
  fastify.post('/management-bot/ticket-counter', {
    preHandler: authenticateBot,
  }, async () => {
    const number = await platformSettingsService.incrementTicketCounter();
    return { success: true, data: { number } };
  });

  // PATCH /internal/management-bot/ticket-channel
  fastify.patch<{
    Body: { type: 'deposit' | 'withdrawal'; recordId: string; channelId: string; ticketLabel?: string };
  }>('/management-bot/ticket-channel', {
    schema: {
      body: {
        type: 'object',
        required: ['type', 'recordId', 'channelId'],
        properties: {
          type: { type: 'string', enum: ['deposit', 'withdrawal'] },
          recordId: { type: 'string' },
          channelId: { type: 'string' },
          ticketLabel: { type: 'string' },
        },
      },
    },
    preHandler: authenticateBot,
  }, async (request) => {
    const { type, recordId, channelId, ticketLabel } = request.body;
    if (type === 'deposit') {
      await itemDepositService.setTicketChannel(recordId, channelId, ticketLabel);
    } else {
      await itemWithdrawalService.setTicketChannel(recordId, channelId, ticketLabel);
    }
    return { success: true };
  });
};
