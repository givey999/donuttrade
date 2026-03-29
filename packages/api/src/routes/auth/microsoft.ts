import { FastifyPluginAsync } from 'fastify';
import { authStateService } from '../../services/auth/state.service.js';
import { microsoftService, MicrosoftOAuthException } from '../../services/auth/microsoft.service.js';
import { sessionService } from '../../services/auth/session.service.js';
import { isMicrosoftOAuthConfigured } from '../../config/oauth.js';
import { logger } from '../../lib/logger.js';
import { InternalError } from '../../lib/errors.js';
import { config, isDevelopment } from '../../config/index.js';
import { signPendingToken } from '../../lib/jwt.js';
import { userRepository } from '../../repositories/user.repository.js';
import { Cookies } from '@donuttrade/shared';
import { parseLinkingState } from './link.js';

const authLogger = logger.module('auth.routes');

/**
 * Microsoft OAuth routes
 */
export const microsoftAuthRoutes: FastifyPluginAsync = async (fastify) => {
  // Check OAuth configuration on route registration
  if (!isMicrosoftOAuthConfigured()) {
    authLogger.warn('oauth.notConfigured', 'Microsoft OAuth is not configured. Auth routes will return 503.');
  }

  /**
   * GET /auth/microsoft
   * Initiates Microsoft OAuth flow
   */
  fastify.get<{
    Querystring: { redirect?: string };
  }>('/microsoft', {
    config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    // Check if OAuth is configured
    if (!isMicrosoftOAuthConfigured()) {
      throw new InternalError('OAuth is not configured');
    }

    const { redirect } = request.query;

    authLogger.info('oauth.initiate', 'Initiating Microsoft OAuth', {
      redirectUrl: redirect,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });

    // Create state parameter for CSRF protection
    const state = await authStateService.createState('microsoft', redirect);

    // Build authorization URL
    const authUrl = microsoftService.buildAuthorizationUrl(state);

    // Redirect to Microsoft
    return reply.redirect(authUrl);
  });

  /**
   * GET /auth/microsoft/callback
   * Handles OAuth callback from Microsoft
   */
  fastify.get<{
    Querystring: {
      code?: string;
      state?: string;
      error?: string;
      error_description?: string;
    };
  }>('/microsoft/callback', {
    config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    const { code, state, error, error_description } = request.query;

    const frontendUrl = config.CORS_ORIGIN;
    const callbackPath = '/auth/callback';

    // Handle OAuth error from Microsoft
    if (error) {
      authLogger.warn('oauth.callback.error', 'Microsoft returned error', {
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

    // Defense-in-depth: ensure state was created for microsoft
    if (stateResult.authMethod !== 'microsoft') {
      authLogger.warn('oauth.callback.wrongAuthMethod', 'State was not created for Microsoft', {
        authMethod: stateResult.authMethod,
      });

      return reply.redirect(`${frontendUrl}${callbackPath}?error=${encodeURIComponent('Invalid or expired state. Please try logging in again.')}`);
    }

    // ─── Account Linking Flow ───────────────────────────────
    const linkingUserId = parseLinkingState(stateResult.redirectUrl, 'microsoft');
    if (linkingUserId) {
      const dashboardUrl = `${frontendUrl}/dashboard`;
      try {
        const tokens = await microsoftService.exchangeCodeForTokens(code);
        if (!tokens.idToken) {
          return reply.redirect(`${dashboardUrl}?link_error=${encodeURIComponent('No identity token received from Microsoft')}`);
        }
        const { microsoftId } = microsoftService.decodeIdToken(tokens.idToken);

        const existing = await userRepository.findByMicrosoftId(microsoftId);
        if (existing) {
          return reply.redirect(`${dashboardUrl}?link_error=${encodeURIComponent('This Microsoft account is already linked to another DonutTrade account')}`);
        }

        await userRepository.update(linkingUserId, { microsoftId });

        authLogger.info('oauth.callback.linked', 'Microsoft account linked via OAuth callback', {
          userId: linkingUserId,
        });

        return reply.redirect(`${dashboardUrl}?linked=microsoft`);
      } catch (err) {
        authLogger.error('oauth.callback.linkError', 'Error during Microsoft account linking', err as Error);
        return reply.redirect(`${dashboardUrl}?link_error=${encodeURIComponent('Failed to link Microsoft account. Please try again.')}`);
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
      const tokens = await microsoftService.exchangeCodeForTokens(code);

      authLogger.info('oauth.callback.success', 'Microsoft token exchange completed', {
        hasIdToken: !!tokens.idToken,
        hasRefreshToken: !!tokens.refreshToken,
      });

      // Decode ID token to extract Microsoft user identity
      if (!tokens.idToken) {
        authLogger.error('oauth.callback.noIdToken', 'No ID token in response');
        return reply.redirect(`${frontendUrl}${callbackPath}?error=${encodeURIComponent('Authentication failed: no identity token received.')}`);
      }

      const { microsoftId, email } = microsoftService.decodeIdToken(tokens.idToken);

      // Look up existing user
      let user = await userRepository.findByMicrosoftId(microsoftId);

      if (user) {
        // Branch A: Returning verified user
        if (user.verificationStatus === 'verified') {
          await userRepository.updateLastLogin(user.id);

          const sessionTokens = await sessionService.createSession(
            user.id,
            request.headers['user-agent'],
            request.ip,
          );

          reply.setCookie(Cookies.REFRESH_TOKEN, sessionTokens.refreshToken, {
            ...cookieOptions,
            maxAge: 30 * 24 * 60 * 60, // 30 days
          });

          authLogger.info('oauth.callback.returningUser', 'Returning verified user logged in', {
            userId: user.id,
          });

          return reply.redirect(`${frontendUrl}${callbackPath}?success=true#token=${sessionTokens.accessToken}`);
        }

        // Branch B: Returning user in setup (not yet verified)
        const pendingToken = signPendingToken(user.id);
        reply.setCookie(Cookies.PENDING_TOKEN, pendingToken, {
          ...cookieOptions,
          maxAge: 30 * 60, // 30 minutes
        });

        if (!user.minecraftUsername) {
          authLogger.info('oauth.callback.setupUsername', 'Returning user needs username', {
            userId: user.id,
          });
          return reply.redirect(`${frontendUrl}/signup/username`);
        }

        authLogger.info('oauth.callback.setupVerify', 'Returning user needs verification', {
          userId: user.id,
        });
        return reply.redirect(`${frontendUrl}/verify`);
      }

      // Branch C: New user
      user = await userRepository.create({
        authProvider: 'microsoft',
        microsoftId,
        email,
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
      if (err instanceof MicrosoftOAuthException) {
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
