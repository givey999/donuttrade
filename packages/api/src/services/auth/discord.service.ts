import { discordOAuthConfig } from '../../config/oauth.js';
import { logger } from '../../lib/logger.js';
import type { DiscordTokenResponse, DiscordUser, DiscordOAuthError } from '@donuttrade/shared';

const discordLogger = logger.module('auth.discord');

/**
 * Discord OAuth exception
 */
export class DiscordOAuthException extends Error {
  constructor(
    public readonly errorCode: string,
    public readonly errorDescription: string,
    public readonly statusCode: number
  ) {
    super(`Discord OAuth error: ${errorCode} - ${errorDescription}`);
    this.name = 'DiscordOAuthException';
  }
}

/**
 * Discord token result (parsed from token response)
 */
export interface DiscordTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt: Date;
  scope: string;
}

/**
 * Discord OAuth service
 */
export const discordService = {
  /**
   * Build the authorization URL for Discord OAuth
   */
  buildAuthorizationUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: discordOAuthConfig.clientId,
      response_type: 'code',
      redirect_uri: discordOAuthConfig.redirectUri,
      scope: discordOAuthConfig.scopes.join(' '),
      state,
      prompt: 'consent',
    });

    const url = `${discordOAuthConfig.authorizationEndpoint}?${params.toString()}`;

    discordLogger.debug('buildAuthorizationUrl', 'Authorization URL built', {
      statePrefix: state.substring(0, 8) + '...',
    });

    return url;
  },

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForTokens(code: string): Promise<DiscordTokens> {
    const startTime = Date.now();

    discordLogger.info('exchangeCodeForTokens.start', 'Exchanging code for tokens');

    const body = new URLSearchParams({
      client_id: discordOAuthConfig.clientId,
      client_secret: discordOAuthConfig.clientSecret,
      grant_type: 'authorization_code',
      code,
      redirect_uri: discordOAuthConfig.redirectUri,
    });

    try {
      const response = await fetch(discordOAuthConfig.tokenEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      });

      const duration = Date.now() - startTime;

      if (!response.ok) {
        const errorData = await response.json() as DiscordOAuthError;

        discordLogger.error('exchangeCodeForTokens.failed', 'Token exchange failed', undefined, {
          status: response.status,
          error: errorData.error,
          errorDescription: errorData.error_description,
          duration,
        });

        throw new DiscordOAuthException(
          errorData.error,
          errorData.error_description ?? '',
          response.status
        );
      }

      const data = await response.json() as DiscordTokenResponse;

      discordLogger.info('exchangeCodeForTokens.success', 'Token exchange successful', {
        scope: data.scope,
        expiresIn: data.expires_in,
        hasRefreshToken: !!data.refresh_token,
        duration,
      });

      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: new Date(Date.now() + data.expires_in * 1000),
        scope: data.scope,
      };
    } catch (error) {
      if (error instanceof DiscordOAuthException) {
        throw error;
      }

      discordLogger.error('exchangeCodeForTokens.error', 'Token exchange error', error);
      throw error;
    }
  },

  /**
   * Fetch the Discord user profile from /users/@me
   */
  async fetchUserProfile(accessToken: string): Promise<DiscordUser> {
    const startTime = Date.now();

    discordLogger.info('fetchUserProfile.start', 'Fetching user profile');

    try {
      const response = await fetch(discordOAuthConfig.userInfoEndpoint, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const duration = Date.now() - startTime;

      if (!response.ok) {
        const errorData = await response.json() as DiscordOAuthError;

        discordLogger.error('fetchUserProfile.failed', 'User profile fetch failed', undefined, {
          status: response.status,
          error: errorData.error,
          duration,
        });

        throw new DiscordOAuthException(
          errorData.error,
          errorData.error_description ?? '',
          response.status
        );
      }

      const user = await response.json() as DiscordUser;

      discordLogger.info('fetchUserProfile.success', 'User profile fetched', {
        discordIdPrefix: user.id.substring(0, 6) + '...',
        hasEmail: !!user.email,
        duration,
      });

      return user;
    } catch (error) {
      if (error instanceof DiscordOAuthException) {
        throw error;
      }

      discordLogger.error('fetchUserProfile.error', 'User profile fetch error', error);
      throw error;
    }
  },
};

export type DiscordService = typeof discordService;
