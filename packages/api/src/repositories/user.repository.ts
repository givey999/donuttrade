import { Prisma } from '@prisma/client';
import { prisma } from '../services/database.js';
import { logger } from '../lib/logger.js';
import type {
  CreateUserInput,
  UpdateUserInput,
} from '@donuttrade/shared';

const userLogger = logger.module('user.repository');

/**
 * User repository for database operations
 */
export const userRepository = {
  /**
   * Find user by ID
   */
  async findById(id: string) {
    const startTime = Date.now();

    try {
      const user = await prisma.user.findUnique({
        where: { id },
      });

      userLogger.debug('findById', 'User lookup by ID', {
        id,
        found: !!user,
        duration: Date.now() - startTime,
      });

      return user;
    } catch (error) {
      userLogger.error('findById.failed', 'Failed to find user by ID', error, { id });
      throw error;
    }
  },

  /**
   * Find user by Microsoft ID
   */
  async findByMicrosoftId(microsoftId: string) {
    const startTime = Date.now();

    try {
      const user = await prisma.user.findUnique({
        where: { microsoftId },
      });

      userLogger.debug('findByMicrosoftId', 'User lookup by Microsoft ID', {
        microsoftIdPrefix: microsoftId.substring(0, 8) + '...',
        found: !!user,
        duration: Date.now() - startTime,
      });

      return user;
    } catch (error) {
      userLogger.error('findByMicrosoftId.failed', 'Failed to find user by Microsoft ID', error);
      throw error;
    }
  },

  /**
   * Find user by Discord ID
   */
  async findByDiscordId(discordId: string) {
    const startTime = Date.now();

    try {
      const user = await prisma.user.findUnique({
        where: { discordId },
      });

      userLogger.debug('findByDiscordId', 'User lookup by Discord ID', {
        discordIdPrefix: discordId.substring(0, 8) + '...',
        found: !!user,
        duration: Date.now() - startTime,
      });

      return user;
    } catch (error) {
      userLogger.error('findByDiscordId.failed', 'Failed to find user by Discord ID', error);
      throw error;
    }
  },

  /**
   * Find user by email
   */
  async findByEmail(email: string) {
    const startTime = Date.now();

    try {
      const user = await prisma.user.findUnique({
        where: { email },
      });

      userLogger.debug('findByEmail', 'User lookup by email', {
        email: email.substring(0, 3) + '***',
        found: !!user,
        duration: Date.now() - startTime,
      });

      return user;
    } catch (error) {
      userLogger.error('findByEmail.failed', 'Failed to find user by email', error);
      throw error;
    }
  },

  /**
   * Find user by Minecraft username (active identity)
   */
  async findByMinecraftUsername(username: string) {
    const startTime = Date.now();

    try {
      const user = await prisma.user.findUnique({
        where: { minecraftUsername: username },
      });

      userLogger.debug('findByMinecraftUsername', 'User lookup by Minecraft username', {
        username,
        found: !!user,
        duration: Date.now() - startTime,
      });

      return user;
    } catch (error) {
      userLogger.error('findByMinecraftUsername.failed', 'Failed to find user by username', error, { username });
      throw error;
    }
  },

  /**
   * Create a new user
   */
  async create(data: CreateUserInput) {
    const startTime = Date.now();

    try {
      const user = await prisma.user.create({
        data: {
          authProvider: data.authProvider,
          minecraftUsername: data.minecraftUsername,
          microsoftId: data.microsoftId,
          discordId: data.discordId,
          discordUsername: data.discordUsername,
          email: data.email,
          passwordHash: data.passwordHash,
        },
      });

      userLogger.info('create', 'User created', {
        userId: user.id,
        authProvider: data.authProvider,
        duration: Date.now() - startTime,
      });

      return user;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          userLogger.warn('create.duplicate', 'User creation failed - duplicate key', {
            authProvider: data.authProvider,
            constraint: error.meta?.target,
          });
        }
      }
      userLogger.error('create.failed', 'Failed to create user', error);
      throw error;
    }
  },

  /**
   * Update user
   */
  async update(id: string, data: UpdateUserInput) {
    const startTime = Date.now();

    try {
      const user = await prisma.user.update({
        where: { id },
        data,
      });

      userLogger.info('update', 'User updated', {
        userId: id,
        fields: Object.keys(data),
        duration: Date.now() - startTime,
      });

      return user;
    } catch (error) {
      userLogger.error('update.failed', 'Failed to update user', error, { userId: id });
      throw error;
    }
  },

  /**
   * Delete a user
   */
  async delete(id: string) {
    const startTime = Date.now();

    try {
      await prisma.user.delete({ where: { id } });

      userLogger.warn('delete', 'User deleted', {
        userId: id,
        duration: Date.now() - startTime,
      });
    } catch (error) {
      userLogger.error('delete.failed', 'Failed to delete user', error, { userId: id });
      throw error;
    }
  },

  /**
   * Update user's last login timestamp
   */
  async updateLastLogin(id: string) {
    return this.update(id, { lastLoginAt: new Date() });
  },

  /**
   * Ban a user
   */
  async ban(id: string, reason: string) {
    const startTime = Date.now();

    try {
      const user = await prisma.user.update({
        where: { id },
        data: {
          bannedAt: new Date(),
          banReason: reason,
        },
      });

      userLogger.warn('ban', 'User banned', {
        userId: id,
        reason,
        duration: Date.now() - startTime,
      });

      return user;
    } catch (error) {
      userLogger.error('ban.failed', 'Failed to ban user', error, { userId: id });
      throw error;
    }
  },

  /**
   * Unban a user
   */
  async unban(id: string) {
    const startTime = Date.now();

    try {
      const user = await prisma.user.update({
        where: { id },
        data: {
          bannedAt: null,
          banReason: null,
        },
      });

      userLogger.info('unban', 'User unbanned', {
        userId: id,
        duration: Date.now() - startTime,
      });

      return user;
    } catch (error) {
      userLogger.error('unban.failed', 'Failed to unban user', error, { userId: id });
      throw error;
    }
  },

  /**
   * Check if user is banned
   */
  async isBanned(id: string): Promise<boolean> {
    const user = await this.findById(id);
    return user?.bannedAt !== null;
  },

  /**
   * Find users with pending verification that have an expiry set
   */
  async findPendingVerifications() {
    return prisma.user.findMany({
      where: {
        verificationStatus: 'pending',
        verificationExpiresAt: { not: null },
      },
    });
  },

  /**
   * Find users whose verification has expired
   */
  async findExpiredVerifications() {
    return prisma.user.findMany({
      where: {
        verificationStatus: 'pending',
        verificationExpiresAt: { lt: new Date() },
      },
    });
  },

  /**
   * Get user count
   */
  async count(where?: Prisma.UserWhereInput): Promise<number> {
    return prisma.user.count({ where });
  },

  /**
   * List users with pagination
   */
  async list(options: {
    skip?: number;
    take?: number;
    where?: Prisma.UserWhereInput;
    orderBy?: Prisma.UserOrderByWithRelationInput;
  }) {
    const startTime = Date.now();

    try {
      const [users, total] = await Promise.all([
        prisma.user.findMany({
          skip: options.skip,
          take: options.take,
          where: options.where,
          orderBy: options.orderBy || { createdAt: 'desc' },
        }),
        prisma.user.count({ where: options.where }),
      ]);

      userLogger.debug('list', 'Users listed', {
        count: users.length,
        total,
        duration: Date.now() - startTime,
      });

      return { users, total };
    } catch (error) {
      userLogger.error('list.failed', 'Failed to list users', error);
      throw error;
    }
  },
};

export type UserRepository = typeof userRepository;
