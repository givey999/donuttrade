import { FastifyPluginAsync } from 'fastify';
import { authStateService } from '../../services/auth/state.service.js';
import { microsoftService, MicrosoftOAuthException } from '../../services/auth/microsoft.service.js';
import { isMicrosoftOAuthConfigured } from '../../config/oauth.js';
import { logger } from '../../lib/logger.js';
import { OAuthError, InvalidStateError, OAuthTokenError, InternalError } from '../../lib/errors.js';

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
  }>('/microsoft/callback', async (request, _reply) => {
    const { code, state, error, error_description } = request.query;

    // Handle OAuth error from Microsoft
    if (error) {
      authLogger.warn('oauth.callback.error', 'Microsoft returned error', {
        error,
        errorDescription: error_description,
      });

      throw new OAuthError(
        `Microsoft authentication failed: ${error_description || error}`,
        { error, errorDescription: error_description }
      );
    }

    // Validate required parameters
    if (!code || !state) {
      authLogger.warn('oauth.callback.missing', 'Missing code or state', {
        hasCode: !!code,
        hasState: !!state,
      });

      throw new OAuthError('Missing authorization code or state parameter');
    }

    // Validate state (CSRF protection)
    const stateResult = await authStateService.validateAndConsume(state);

    if (!stateResult.valid) {
      authLogger.warn('oauth.callback.invalidState', 'Invalid or expired state', {
        statePrefix: state.substring(0, 8) + '...',
      });

      throw new InvalidStateError('Invalid or expired state parameter. Please try logging in again.');
    }

    try {
      // Exchange code for tokens
      const tokens = await microsoftService.exchangeCodeForTokens(code);

      authLogger.info('oauth.callback.success', 'Microsoft token exchange completed', {
        hasIdToken: !!tokens.idToken,
        hasRefreshToken: !!tokens.refreshToken,
      });

      // Phase 2 will handle: decode id_token, find/create user, create session
      // For now, return basic success
      return {
        success: true,
        message: 'Microsoft authentication successful. User registration pending Phase 2.',
        redirectUrl: stateResult.redirectUrl || '/dashboard',
      };
    } catch (error) {
      if (error instanceof MicrosoftOAuthException) {
        authLogger.error('oauth.callback.tokenError', 'Token exchange failed', error, {
          errorCode: error.errorCode,
        });

        throw new OAuthTokenError(
          `Failed to obtain tokens: ${error.errorDescription}`,
          error.statusCode === 400 ? 400 : 502,
          { errorCode: error.errorCode }
        );
      }

      throw error;
    }
  });
};
