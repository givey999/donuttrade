import { FastifyPluginAsync } from 'fastify';
import { authStateService } from '../../services/auth/state.service.js';
import { discordService, DiscordOAuthException } from '../../services/auth/discord.service.js';
import { sessionService } from '../../services/auth/session.service.js';
import { isDiscordOAuthConfigured } from '../../config/oauth.js';
import { logger } from '../../lib/logger.js';
import { InternalError } from '../../lib/errors.js';
import { config, isDevelopment } from '../../config/index.js';
import { signPendingToken } from '../../lib/jwt.js';
import { userRepository } from '../../repositories/user.repository.js';
import { Cookies } from '@donuttrade/shared';
import { parseLinkingState } from './link.js';

const authLogger = logger.module('auth.routes');

/**
 * Discord OAuth routes
 */
export const discordAuthRoutes: FastifyPluginAsync = async (fastify) => {
  // Check OAuth configuration on route registration
  if (!isDiscordOAuthConfigured()) {
    authLogger.warn('oauth.notConfigured', 'Discord OAuth is not configured. Auth routes will return 503.');
  }

  /**
   * GET /auth/discord
   * Initiates Discord OAuth flow
   */
  fastify.get<{
    Querystring: { redirect?: string };
  }>('/discord', {
    config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    // Check if OAuth is configured
    if (!isDiscordOAuthConfigured()) {
      throw new InternalError('OAuth is not configured');
    }

    const { redirect } = request.query;

    authLogger.info('oauth.initiate', 'Initiating Discord OAuth', {
      redirectUrl: redirect,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });

    // Create state parameter for CSRF protection
    const state = await authStateService.createState('discord', redirect);

    // Build authorization URL
    const authUrl = discordService.buildAuthorizationUrl(state);

    // Redirect to Discord
    return reply.redirect(authUrl);
  });

  /**
   * GET /auth/discord/callback
   * Handles OAuth callback from Discord
   */
  fastify.get<{
    Querystring: {
      code?: string;
      state?: string;
      error?: string;
      error_description?: string;
    };
  }>('/discord/callback', {
    config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    const { code, state, error, error_description } = request.query;

    const frontendUrl = config.CORS_ORIGIN;
    const callbackPath = '/auth/callback';

    // Handle OAuth error from Discord
    if (error) {
      authLogger.warn('oauth.callback.error', 'Discord returned error', {
        error,
        errorDescription: error_description,
      });

      const errorMsg = encodeURIComponent(error_description || error);
      return reply.redirect(`${frontendUrl}${callbackPath}?error=${errorMsg}`);
    }

    // Validate required parameters
    if (!code || !state) {
      authLogger.warn('oauth.callback.missing', 'Missing code or state', {
        hasCode: !!code,
        hasState: !!state,
      });

      return reply.redirect(`${frontendUrl}${callbackPath}?error=${encodeURIComponent('Missing authorization code or state parameter')}`);
    }

    // Validate state (CSRF protection)
    const stateResult = await authStateService.validateAndConsume(state);

    if (!stateResult.valid) {
      authLogger.warn('oauth.callback.invalidState', 'Invalid or expired state', {
        statePrefix: state.substring(0, 8) + '...',
      });

      return reply.redirect(`${frontendUrl}${callbackPath}?error=${encodeURIComponent('Invalid or expired state. Please try logging in again.')}`);
    }

    // Defense-in-depth: ensure state was created for discord
    if (stateResult.authMethod !== 'discord') {
      authLogger.warn('oauth.callback.wrongAuthMethod', 'State was not created for Discord', {
        authMethod: stateResult.authMethod,
      });

      return reply.redirect(`${frontendUrl}${callbackPath}?error=${encodeURIComponent('Invalid or expired state. Please try logging in again.')}`);
    }

    // ─── Account Linking Flow ───────────────────────────────
    // If the state encodes a linking context, handle it separately.
    const linkingUserId = parseLinkingState(stateResult.redirectUrl, 'discord');
    if (linkingUserId) {
      const dashboardUrl = `${frontendUrl}/dashboard`;
      try {
        const tokens = await discordService.exchangeCodeForTokens(code);
        const discordUser = await discordService.fetchUserProfile(tokens.accessToken);

        // Ensure this Discord account isn't already on another user
        const existing = await userRepository.findByDiscordId(discordUser.id);
        if (existing) {
          return reply.redirect(`${dashboardUrl}?link_error=${encodeURIComponent('This Discord account is already linked to another DonutTrade account')}`);
        }

        await userRepository.update(linkingUserId, {
          discordId: discordUser.id,
          discordUsername: discordUser.username,
        });

        authLogger.info('oauth.callback.linked', 'Discord account linked via OAuth callback', {
          userId: linkingUserId,
          discordUsername: discordUser.username,
        });

        return reply.redirect(`${dashboardUrl}?linked=discord`);
      } catch (err) {
        authLogger.error('oauth.callback.linkError', 'Error during Discord account linking', err as Error);
        return reply.redirect(`${dashboardUrl}?link_error=${encodeURIComponent('Failed to link Discord account. Please try again.')}`);
      }
    }

    // ─── Normal Login Flow ──────────────────────────────────
    const cookieOptions = {
      httpOnly: true,
      secure: !isDevelopment,
      sameSite: 'lax' as const,
      path: '/',
    };

    try {
      // Exchange code for tokens
      const tokens = await discordService.exchangeCodeForTokens(code);

      authLogger.info('oauth.callback.success', 'Discord token exchange completed', {
        hasRefreshToken: !!tokens.refreshToken,
      });

      // Fetch user profile from Discord
      const discordUser = await discordService.fetchUserProfile(tokens.accessToken);

      // Look up existing user
      let user = await userRepository.findByDiscordId(discordUser.id);

      if (user) {
        // Update discordUsername if it has changed
        if (user.discordUsername !== discordUser.username) {
          await userRepository.update(user.id, { discordUsername: discordUser.username });
        }

        // Check if user still needs setup (username or verification)
        if (!user.minecraftUsername) {
          const pendingToken = signPendingToken(user.id);
          reply.setCookie(Cookies.PENDING_TOKEN, pendingToken, { ...cookieOptions, maxAge: 30 * 60 });
          authLogger.info('oauth.callback.setupUsername', 'Returning user needs username', { userId: user.id });
          return reply.redirect(`${frontendUrl}/signup/username`);
        }

        if (user.verificationStatus !== 'verified') {
          const pendingToken = signPendingToken(user.id);
          reply.setCookie(Cookies.PENDING_TOKEN, pendingToken, { ...cookieOptions, maxAge: 30 * 60 });
          authLogger.info('oauth.callback.setupVerify', 'Returning user needs verification', { userId: user.id });
          return reply.redirect(`${frontendUrl}/verify`);
        }

        // Fully set up user — create session
        await userRepository.updateLastLogin(user.id);

        const sessionTokens = await sessionService.createSession(
          user.id,
          request.headers['user-agent'],
          request.ip,
        );

        reply.setCookie(Cookies.REFRESH_TOKEN, sessionTokens.refreshToken, {
          ...cookieOptions,
          maxAge: 30 * 24 * 60 * 60,
        });

        authLogger.info('oauth.callback.returningUser', 'Returning verified user logged in', { userId: user.id });
        return reply.redirect(`${frontendUrl}${callbackPath}?success=true#token=${sessionTokens.accessToken}`);
      }

      // Branch C: New user
      user = await userRepository.create({
        authProvider: 'discord',
        discordId: discordUser.id,
        discordUsername: discordUser.username,
        email: discordUser.email,
      });

      const pendingToken = signPendingToken(user.id);
      reply.setCookie(Cookies.PENDING_TOKEN, pendingToken, {
        ...cookieOptions,
        maxAge: 30 * 60, // 30 minutes
      });

      authLogger.info('oauth.callback.newUser', 'New user created', {
        userId: user.id,
      });

      return reply.redirect(`${frontendUrl}/signup/username`);
    } catch (err) {
      if (err instanceof DiscordOAuthException) {
        authLogger.error('oauth.callback.tokenError', 'Token exchange failed', err, {
          errorCode: err.errorCode,
        });

        return reply.redirect(`${frontendUrl}${callbackPath}?error=${encodeURIComponent('Authentication failed. Please try again.')}`);
      }

      authLogger.error('oauth.callback.unexpected', 'Unexpected error during callback', err as Error);
      return reply.redirect(`${frontendUrl}${callbackPath}?error=${encodeURIComponent('An unexpected error occurred. Please try again.')}`);
    }
  });
};
