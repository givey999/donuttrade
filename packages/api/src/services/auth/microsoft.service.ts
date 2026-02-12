import { microsoftOAuthConfig } from '../../config/oauth.js';
import { logger } from '../../lib/logger.js';
import type { MicrosoftTokenResponse, MicrosoftOAuthError } from '@donuttrade/shared';

const msLogger = logger.module('auth.microsoft');

/**
 * Microsoft token result (parsed from token response)
 */
export interface MicrosoftTokens {
  accessToken: string;
  refreshToken?: string;
  idToken?: string;
  expiresAt: Date;
  scope: string;
}

/**
 * Microsoft OAuth service
 */
export const microsoftService = {
  /**
   * Build the authorization URL for Microsoft OAuth
   */
  buildAuthorizationUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: microsoftOAuthConfig.clientId,
      response_type: 'code',
      redirect_uri: microsoftOAuthConfig.redirectUri,
      scope: microsoftOAuthConfig.scopes.join(' '),
      state,
      response_mode: 'query',
    });

    const url = `${microsoftOAuthConfig.authorizationEndpoint}?${params.toString()}`;

    msLogger.debug('buildAuthorizationUrl', 'Authorization URL built', {
      statePrefix: state.substring(0, 8) + '...',
    });

    return url;
  },

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForTokens(code: string): Promise<MicrosoftTokens> {
    const startTime = Date.now();

    msLogger.info('exchangeCodeForTokens.start', 'Exchanging code for tokens');

    const body = new URLSearchParams({
      client_id: microsoftOAuthConfig.clientId,
      client_secret: microsoftOAuthConfig.clientSecret,
      grant_type: 'authorization_code',
      code,
      redirect_uri: microsoftOAuthConfig.redirectUri,
    });

    try {
      const response = await fetch(microsoftOAuthConfig.tokenEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      });

      const duration = Date.now() - startTime;

      if (!response.ok) {
        const errorData = await response.json() as MicrosoftOAuthError;

        msLogger.error('exchangeCodeForTokens.failed', 'Token exchange failed', undefined, {
          status: response.status,
          error: errorData.error,
          errorDescription: errorData.error_description,
          duration,
        });

        throw new MicrosoftOAuthException(
          errorData.error,
          errorData.error_description,
          response.status
        );
      }

      const data = await response.json() as MicrosoftTokenResponse;

      msLogger.info('exchangeCodeForTokens.success', 'Token exchange successful', {
        scope: data.scope,
        expiresIn: data.expires_in,
        hasRefreshToken: !!data.refresh_token,
        hasIdToken: !!data.id_token,
        duration,
      });

      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        idToken: data.id_token,
        expiresAt: new Date(Date.now() + data.expires_in * 1000),
        scope: data.scope,
      };
    } catch (error) {
      if (error instanceof MicrosoftOAuthException) {
        throw error;
      }

      msLogger.error('exchangeCodeForTokens.error', 'Token exchange error', error);
      throw error;
    }
  },

  /**
   * Refresh Microsoft access token
   */
  async refreshAccessToken(refreshToken: string): Promise<MicrosoftTokens> {
    const startTime = Date.now();

    msLogger.info('refreshAccessToken.start', 'Refreshing access token');

    const body = new URLSearchParams({
      client_id: microsoftOAuthConfig.clientId,
      client_secret: microsoftOAuthConfig.clientSecret,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      scope: microsoftOAuthConfig.scopes.join(' '),
    });

    try {
      const response = await fetch(microsoftOAuthConfig.tokenEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      });

      const duration = Date.now() - startTime;

      if (!response.ok) {
        const errorData = await response.json() as MicrosoftOAuthError;

        msLogger.error('refreshAccessToken.failed', 'Token refresh failed', undefined, {
          status: response.status,
          error: errorData.error,
          errorDescription: errorData.error_description,
          duration,
        });

        throw new MicrosoftOAuthException(
          errorData.error,
          errorData.error_description,
          response.status
        );
      }

      const data = await response.json() as MicrosoftTokenResponse;

      msLogger.info('refreshAccessToken.success', 'Token refresh successful', {
        scope: data.scope,
        expiresIn: data.expires_in,
        hasNewRefreshToken: !!data.refresh_token,
        duration,
      });

      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token ?? refreshToken, // Keep old if not returned
        idToken: data.id_token,
        expiresAt: new Date(Date.now() + data.expires_in * 1000),
        scope: data.scope,
      };
    } catch (error) {
      if (error instanceof MicrosoftOAuthException) {
        throw error;
      }

      msLogger.error('refreshAccessToken.error', 'Token refresh error', error);
      throw error;
    }
  },
};

/**
 * Microsoft OAuth exception
 */
export class MicrosoftOAuthException extends Error {
  constructor(
    public readonly errorCode: string,
    public readonly errorDescription: string,
    public readonly statusCode: number
  ) {
    super(`Microsoft OAuth error: ${errorCode} - ${errorDescription}`);
    this.name = 'MicrosoftOAuthException';
  }
}

export type MicrosoftService = typeof microsoftService;
