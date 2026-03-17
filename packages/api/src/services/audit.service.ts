import { Prisma } from '@prisma/client';
import { prisma } from './database.js';

export const auditService = {
  /**
   * Record an admin action in the audit log.
   */
  async log(entry: {
    actorId: string;
    action: string;
    targetType: string;
    targetId?: string;
    details?: Record<string, unknown>;
  }) {
    await prisma.auditLog.create({
      data: {
        actorId: entry.actorId,
        action: entry.action,
        targetType: entry.targetType,
        targetId: entry.targetId ?? null,
        details: entry.details ? (entry.details as Prisma.InputJsonValue) : Prisma.JsonNull,
      },
    });
  },
};
