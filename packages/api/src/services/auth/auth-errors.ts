import { AppError } from '../../lib/errors.js';

/**
 * Authentication error codes
 */
export enum AuthErrorCode {
  // Microsoft errors
  MS_CODE_EXPIRED = 'MS_CODE_EXPIRED',
  MS_INVALID_GRANT = 'MS_INVALID_GRANT',
  MS_INVALID_CLIENT = 'MS_INVALID_CLIENT',

  // General auth errors
  AUTH_FAILED = 'AUTH_FAILED',
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  ACCOUNT_BANNED = 'ACCOUNT_BANNED',
  EMAIL_NOT_VERIFIED = 'EMAIL_NOT_VERIFIED',
  VERIFICATION_EXPIRED = 'VERIFICATION_EXPIRED',
  VERIFICATION_FAILED = 'VERIFICATION_FAILED',
}

/**
 * Get user-friendly error message for auth error code
 */
export function getAuthErrorMessage(code: AuthErrorCode): string {
  const messages: Record<AuthErrorCode, string> = {
    [AuthErrorCode.MS_CODE_EXPIRED]: 'Authorization code has expired. Please try logging in again.',
    [AuthErrorCode.MS_INVALID_GRANT]: 'Invalid authorization code. Please try logging in again.',
    [AuthErrorCode.MS_INVALID_CLIENT]: 'OAuth configuration error. Please contact support.',
    [AuthErrorCode.AUTH_FAILED]: 'Authentication failed. Please try again.',
    [AuthErrorCode.INVALID_CREDENTIALS]: 'Invalid email or password.',
    [AuthErrorCode.ACCOUNT_BANNED]: 'This account has been banned.',
    [AuthErrorCode.EMAIL_NOT_VERIFIED]: 'Please verify your email address before logging in.',
    [AuthErrorCode.VERIFICATION_EXPIRED]: 'Payment verification has expired. Please try again.',
    [AuthErrorCode.VERIFICATION_FAILED]: 'Payment verification failed. Please check the amount and try again.',
  };

  return messages[code] || 'An authentication error occurred. Please try again.';
}

/**
 * Authentication error
 */
export class AuthError extends AppError {
  public readonly authErrorCode: AuthErrorCode;

  constructor(
    code: AuthErrorCode,
    options?: {
      details?: Record<string, unknown>;
      statusCode?: number;
    }
  ) {
    super(getAuthErrorMessage(code), {
      code: code,
      statusCode: options?.statusCode ?? 400,
      details: {
        authErrorCode: code,
        ...options?.details,
      },
    });
    this.name = 'AuthError';
    this.authErrorCode = code;
  }
}
