import { FastifyPluginAsync } from 'fastify';
import { authStateService } from '../../services/auth/state.service.js';
import { microsoftService, MicrosoftOAuthException } from '../../services/auth/microsoft.service.js';
import { isMicrosoftOAuthConfigured } from '../../config/oauth.js';
import { logger } from '../../lib/logger.js';
import { InternalError } from '../../lib/errors.js';
import { config } from '../../config/index.js';

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
  }>('/microsoft', async (request, reply) => {
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
  }>('/microsoft/callback', async (request, reply) => {
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

    try {
      // Exchange code for tokens
      const tokens = await microsoftService.exchangeCodeForTokens(code);

      authLogger.info('oauth.callback.success', 'Microsoft token exchange completed', {
        hasIdToken: !!tokens.idToken,
        hasRefreshToken: !!tokens.refreshToken,
      });

      // Phase 2 will handle: decode id_token, find/create user, create session
      // Redirect back to frontend callback page
      const redirectPath = stateResult.redirectUrl || callbackPath;
      return reply.redirect(`${frontendUrl}${redirectPath}?success=true`);
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
