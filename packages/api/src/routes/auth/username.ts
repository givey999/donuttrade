import { FastifyPluginAsync } from 'fastify';
import { userRepository } from '../../repositories/user.repository.js';
import { logger } from '../../lib/logger.js';
import { AppError } from '../../lib/errors.js';

const usernameLogger = logger.module('auth.username');

/**
 * Valid Minecraft username pattern:
 * - Optional leading dot (Bedrock Edition)
 * - 3-16 alphanumeric characters, underscores, or spaces (Bedrock allows spaces)
 */
const USERNAME_REGEX = /^\.?[a-zA-Z0-9_ ]{3,16}$/;

/**
 * Username entry routes
 */
export const usernameRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * POST /auth/set-username
   * Set the Minecraft username for a user in pending setup
   */
  fastify.post<{
    Body: { username: string };
  }>('/set-username', {
    preHandler: [fastify.authenticatePending],
    schema: {
      body: {
        type: 'object',
        required: ['username'],
        properties: {
          username: { type: 'string' },
        },
      },
    },
  }, async (request) => {
    const userId = request.pendingUser!.id;
    const rawUsername = request.body.username;
    const username = rawUsername.trim();

    // Validate format
    if (!USERNAME_REGEX.test(username)) {
      throw new AppError('Invalid Minecraft username. Must be 3-16 characters (letters, numbers, underscores, spaces). Bedrock users: add a dot (.) prefix.', {
        code: 'INVALID_USERNAME',
        statusCode: 400,
      });
    }

    // Check user exists and is not already verified
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new AppError('User not found', { code: 'USER_NOT_FOUND', statusCode: 404 });
    }

    if (user.verificationStatus === 'verified') {
      throw new AppError('User is already verified', { code: 'ALREADY_VERIFIED', statusCode: 400 });
    }

    // Check uniqueness
    const existing = await userRepository.findByMinecraftUsername(username);
    if (existing && existing.id !== userId) {
      throw new AppError('This Minecraft username is already taken', {
        code: 'USERNAME_TAKEN',
        statusCode: 409,
      });
    }

    // Update user
    await userRepository.update(userId, { minecraftUsername: username });

    usernameLogger.info('setUsername', 'Minecraft username set', {
      userId,
      username,
    });

    return { success: true, data: { username } };
  });
};
