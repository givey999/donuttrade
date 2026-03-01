import { randomInt } from 'node:crypto';
import { userRepository } from '../../repositories/user.repository.js';
import { logger } from '../../lib/logger.js';
import { AppError } from '../../lib/errors.js';
import { config } from '../../config/index.js';
import {
  VERIFICATION_AMOUNT_MIN,
  VERIFICATION_AMOUNT_MAX,
  VERIFICATION_TIMEOUT_MS,
} from '@donuttrade/shared';

const verifyLogger = logger.module('auth.verification');

/**
 * Verification service for in-game payment verification
 */
export const verificationService = {
  /**
   * Start a new verification for a user.
   * Generates a random amount and sets a 15-minute expiry.
   */
  async startVerification(userId: string) {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new AppError('User not found', { code: 'USER_NOT_FOUND', statusCode: 404 });
    }

    if (user.verificationStatus === 'verified') {
      throw new AppError('User is already verified', { code: 'ALREADY_VERIFIED', statusCode: 400 });
    }

    if (!user.minecraftUsername) {
      throw new AppError('Minecraft username must be set before verification', {
        code: 'USERNAME_NOT_SET',
        statusCode: 400,
      });
    }

    const amount = randomInt(VERIFICATION_AMOUNT_MIN, VERIFICATION_AMOUNT_MAX + 1);
    const expiresAt = new Date(Date.now() + VERIFICATION_TIMEOUT_MS);

    await userRepository.update(userId, {
      verificationAmount: amount,
      verificationExpiresAt: expiresAt,
      verificationStatus: 'pending',
    });

    verifyLogger.info('startVerification', 'Verification started', {
      userId,
      amount,
      expiresAt: expiresAt.toISOString(),
    });

    return {
      amount,
      expiresAt,
      botUsername: config.VERIFICATION_BOT_DISPLAY_NAME,
    };
  },

  /**
   * Get the current verification status for a user.
   * Auto-expires if past due.
   */
  async getStatus(userId: string) {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new AppError('User not found', { code: 'USER_NOT_FOUND', statusCode: 404 });
    }

    // Auto-expire if past due
    if (
      user.verificationStatus === 'pending' &&
      user.verificationExpiresAt &&
      user.verificationExpiresAt < new Date()
    ) {
      await userRepository.update(userId, { verificationStatus: 'expired' });

      return {
        status: 'expired' as const,
        amount: user.verificationAmount,
        expiresAt: user.verificationExpiresAt,
        botUsername: config.VERIFICATION_BOT_DISPLAY_NAME,
      };
    }

    return {
      status: user.verificationStatus as 'pending' | 'verified' | 'expired',
      amount: user.verificationAmount,
      expiresAt: user.verificationExpiresAt,
      botUsername: config.VERIFICATION_BOT_DISPLAY_NAME,
    };
  },

  /**
   * Retry verification — generates a new amount and resets the timer.
   */
  async retryVerification(userId: string) {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new AppError('User not found', { code: 'USER_NOT_FOUND', statusCode: 404 });
    }

    if (user.verificationStatus === 'verified') {
      throw new AppError('User is already verified', { code: 'ALREADY_VERIFIED', statusCode: 400 });
    }

    if (!user.minecraftUsername) {
      throw new AppError('Minecraft username must be set before verification', {
        code: 'USERNAME_NOT_SET',
        statusCode: 400,
      });
    }

    const amount = randomInt(VERIFICATION_AMOUNT_MIN, VERIFICATION_AMOUNT_MAX + 1);
    const expiresAt = new Date(Date.now() + VERIFICATION_TIMEOUT_MS);

    await userRepository.update(userId, {
      verificationAmount: amount,
      verificationExpiresAt: expiresAt,
      verificationStatus: 'pending',
    });

    verifyLogger.info('retryVerification', 'Verification retried', {
      userId,
      amount,
      expiresAt: expiresAt.toISOString(),
    });

    return {
      amount,
      expiresAt,
      botUsername: config.VERIFICATION_BOT_DISPLAY_NAME,
    };
  },

  /**
   * Confirm a payment from the in-game bot.
   * Matches username + exact amount against pending verifications.
   */
  async confirmPayment(username: string, amount: number) {
    const user = await userRepository.findByMinecraftUsername(username);
    if (!user) {
      verifyLogger.debug('confirmPayment.noUser', 'No user found for username', { username });
      return { matched: false };
    }

    if (user.verificationStatus !== 'pending') {
      verifyLogger.debug('confirmPayment.notPending', 'User not in pending verification', {
        userId: user.id,
        status: user.verificationStatus,
      });
      return { matched: false };
    }

    // Check expiry
    if (user.verificationExpiresAt && user.verificationExpiresAt < new Date()) {
      verifyLogger.debug('confirmPayment.expired', 'Verification expired', {
        userId: user.id,
      });
      await userRepository.update(user.id, { verificationStatus: 'expired' });
      return { matched: false };
    }

    // Check exact amount match
    if (user.verificationAmount !== amount) {
      verifyLogger.debug('confirmPayment.amountMismatch', 'Amount does not match', {
        userId: user.id,
        expected: user.verificationAmount,
        received: amount,
      });
      return { matched: false };
    }

    // Match! Mark as verified
    await userRepository.update(user.id, {
      verificationStatus: 'verified',
      verificationAmount: null,
      verificationExpiresAt: null,
    });

    verifyLogger.info('confirmPayment.verified', 'User verified via payment', {
      userId: user.id,
      username,
      amount,
    });

    return { matched: true, userId: user.id };
  },
};

export type VerificationService = typeof verificationService;
