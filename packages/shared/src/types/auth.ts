/**
 * Authentication provider enum
 */
export type AuthProvider = 'microsoft' | 'discord' | 'email';

/**
 * Verification status enum
 */
export type VerificationStatus = 'pending' | 'verified' | 'expired';

/**
 * Microsoft OAuth token response from token endpoint
 */
export interface MicrosoftTokenResponse {
  token_type: string;
  scope: string;
  expires_in: number;
  access_token: string;
  refresh_token?: string;
  id_token?: string;
}

/**
 * Microsoft OAuth error response
 */
export interface MicrosoftOAuthError {
  error: string;
  error_description: string;
  error_codes?: number[];
  timestamp?: string;
  trace_id?: string;
  correlation_id?: string;
}

/**
 * Microsoft user info extracted from ID token or /userinfo endpoint
 */
export interface MicrosoftUserInfo {
  sub: string;      // Microsoft user ID (oid claim)
  email?: string;
  name?: string;
}

/**
 * Discord OAuth token response
 */
export interface DiscordTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  scope: string;
}

/**
 * Discord user info from /users/@me
 */
export interface DiscordUser {
  id: string;
  username: string;
  email?: string;
  avatar?: string;
  discriminator: string;
  global_name?: string;
}

/**
 * Discord OAuth error
 */
export interface DiscordOAuthError {
  error: string;
  error_description?: string;
}

/**
 * Email verification result
 */
export interface EmailVerificationResult {
  success: boolean;
  message: string;
}

/**
 * Payment verification result
 */
export interface PaymentVerificationResult {
  status: VerificationStatus;
  amount?: number;
  expiresAt?: Date;
  canRetry: boolean;
}
