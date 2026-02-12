import { config } from './index.js';

/**
 * Microsoft OAuth 2.0 Configuration
 * Uses the /consumers tenant for personal Microsoft accounts
 * Identity-only: extracts user ID and email from ID token (no Xbox/Minecraft chain)
 */
export const microsoftOAuthConfig = {
  clientId: config.MICROSOFT_CLIENT_ID!,
  clientSecret: config.MICROSOFT_CLIENT_SECRET!,
  redirectUri: config.MICROSOFT_REDIRECT_URI!,

  authorizationEndpoint: 'https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize',
  tokenEndpoint: 'https://login.microsoftonline.com/consumers/oauth2/v2.0/token',

  // OpenID Connect scopes for identity only
  scopes: ['openid', 'email', 'profile', 'offline_access'],
};

/**
 * OAuth state configuration
 */
export const authStateConfig = {
  // State parameter expiry (10 minutes)
  stateExpiryMs: 10 * 60 * 1000,

  // State parameter length (bytes, will be hex encoded to 64 chars)
  stateLength: 32,
};

/**
 * Check if Microsoft OAuth is configured
 */
export function isMicrosoftOAuthConfigured(): boolean {
  return !!(
    config.MICROSOFT_CLIENT_ID &&
    config.MICROSOFT_CLIENT_SECRET &&
    config.MICROSOFT_REDIRECT_URI
  );
}

/**
 * Check if Discord OAuth is configured
 */
export function isDiscordOAuthConfigured(): boolean {
  return !!(
    config.DISCORD_CLIENT_ID &&
    config.DISCORD_CLIENT_SECRET &&
    config.DISCORD_REDIRECT_URI
  );
}
