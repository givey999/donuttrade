import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { authStateService } from '../../services/auth/state.service.js';
import { discordService } from '../../services/auth/discord.service.js';
import { microsoftService } from '../../services/auth/microsoft.service.js';
import { isDiscordOAuthConfigured, isMicrosoftOAuthConfigured } from '../../config/oauth.js';
import { logger } from '../../lib/logger.js';
import { AppError, InternalError } from '../../lib/errors.js';
import { verifyAccessToken, TokenExpiredError, InvalidTokenError } from '../../lib/jwt.js';
import { userRepository } from '../../repositories/user.repository.js';

const linkLogger = logger.module('auth.link');

/**
 * Custom auth for browser-redirect routes.
 * Accepts token either as Bearer header or query parameter.
 */
async function authenticateFromQueryOrHeader(request: FastifyRequest, _reply: FastifyReply) {
  // Try Authorization header first
  const authHeader = request.headers.authorization;
  let token: string | null = null;

  if (authHeader) {
    const parts = authHeader.split(' ');
    if (parts.length === 2 && parts[0]?.toLowerCase() === 'bearer') {
      token = parts[1] || null;
    }
  }

  // Fall back to query parameter (for browser redirects)
  if (!token) {
    token = (request.query as Record<string, string>).token ?? null;
  }

  if (!token) {
    throw new AppError('Authentication required', { code: 'UNAUTHORIZED', statusCode: 401 });
  }

  try {
    const payload = verifyAccessToken(token);
    request.user = {
      id: payload.sub,
      username: payload.username,
      authProvider: payload.authProvider,
      role: 'user',
      impersonatedBy: payload.impersonatedBy,
      impersonatorRole: payload.impersonatorRole,
    };
  } catch (error) {
    if (error instanceof TokenExpiredError) {
      throw new AppError('Access token has expired', { code: 'TOKEN_EXPIRED', statusCode: 401 });
    }
    if (error instanceof InvalidTokenError) {
      throw new AppError('Invalid access token', { code: 'INVALID_TOKEN', statusCode: 401 });
    }
    throw error;
  }
}

/**
 * Account linking routes — let authenticated users connect/disconnect OAuth providers.
 *
 * The initiation routes live here (/auth/link/discord, /auth/link/microsoft).
 * The callbacks reuse the existing OAuth callback routes (/auth/discord/callback,
 * /auth/microsoft/callback) — the linking context is encoded in the state's redirectUrl
 * as "link:<provider>:<userId>" and detected by the callback handler.
 *
 * Prefix: /auth/link
 */
export const linkRoutes: FastifyPluginAsync = async (fastify) => {
  // ─── Discord ───────────────────────────────────────────────

  fastify.get('/discord', {
    preHandler: [authenticateFromQueryOrHeader],
    config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    if (!isDiscordOAuthConfigured()) {
      throw new InternalError('Discord OAuth is not configured');
    }

    const userId = request.user!.id;
    const user = await userRepository.findById(userId);
    if (user?.discordId) {
      throw new AppError('Discord account is already linked', { code: 'ALREADY_LINKED', statusCode: 400 });
    }

    const state = await authStateService.createState('discord', `link:discord:${userId}`);
    const authUrl = discordService.buildAuthorizationUrl(state);

    linkLogger.info('discord.initiate', 'Initiating Discord account linking', { userId });
    return reply.redirect(authUrl);
  });

  fastify.delete('/discord', {
    preHandler: [fastify.authenticate],
  }, async (request) => {
    const userId = request.user!.id;
    const user = await userRepository.findById(userId);

    if (!user) throw new AppError('User not found', { code: 'USER_NOT_FOUND', statusCode: 404 });
    if (!user.discordId) throw new AppError('No Discord account linked', { code: 'NOT_LINKED', statusCode: 400 });
    if (user.authProvider === 'discord') {
      throw new AppError('Cannot disconnect your primary login provider', { code: 'CANNOT_UNLINK_PRIMARY', statusCode: 400 });
    }

    await userRepository.update(userId, { discordId: null, discordUsername: null });
    linkLogger.info('discord.unlinked', 'Discord account unlinked', { userId });
    return { success: true, message: 'Discord account disconnected' };
  });

  // ─── Microsoft ─────────────────────────────────────────────

  fastify.get('/microsoft', {
    preHandler: [authenticateFromQueryOrHeader],
    config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    if (!isMicrosoftOAuthConfigured()) {
      throw new InternalError('Microsoft OAuth is not configured');
    }

    const userId = request.user!.id;
    const user = await userRepository.findById(userId);
    if (user?.microsoftId) {
      throw new AppError('Microsoft account is already linked', { code: 'ALREADY_LINKED', statusCode: 400 });
    }

    const state = await authStateService.createState('microsoft', `link:microsoft:${userId}`);
    const authUrl = microsoftService.buildAuthorizationUrl(state);

    linkLogger.info('microsoft.initiate', 'Initiating Microsoft account linking', { userId });
    return reply.redirect(authUrl);
  });

  fastify.delete('/microsoft', {
    preHandler: [fastify.authenticate],
  }, async (request) => {
    const userId = request.user!.id;
    const user = await userRepository.findById(userId);

    if (!user) throw new AppError('User not found', { code: 'USER_NOT_FOUND', statusCode: 404 });
    if (!user.microsoftId) throw new AppError('No Microsoft account linked', { code: 'NOT_LINKED', statusCode: 400 });
    if (user.authProvider === 'microsoft') {
      throw new AppError('Cannot disconnect your primary login provider', { code: 'CANNOT_UNLINK_PRIMARY', statusCode: 400 });
    }

    await userRepository.update(userId, { microsoftId: null });
    linkLogger.info('microsoft.unlinked', 'Microsoft account unlinked', { userId });
    return { success: true, message: 'Microsoft account disconnected' };
  });
};

/**
 * Helper to check if a state's redirectUrl indicates a linking flow.
 * Returns the userId if linking, null otherwise.
 */
export function parseLinkingState(redirectUrl: string | undefined, provider: string): string | null {
  if (!redirectUrl) return null;
  const prefix = `link:${provider}:`;
  if (!redirectUrl.startsWith(prefix)) return null;
  return redirectUrl.slice(prefix.length);
}
