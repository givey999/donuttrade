import { createHmac, timingSafeEqual } from 'crypto';
import { config } from '../config/index.js';

export interface CodePayload {
  type: 'deposit' | 'withdrawal';
  id: string;
  userId: string;
  itemId: string;
  quantity: number;
  exp: number;
}

const PREFIXES = {
  deposit: 'DT-DEP-',
  withdrawal: 'DT-WTH-',
} as const;

const CODE_TTL_MS = 3 * 60 * 60 * 1000; // 3 hours

/**
 * Generate an HMAC-signed deposit/withdrawal code.
 * Format: <prefix><base64url(JSON payload)>.<hmac-sha256 signature>
 */
export function generateCode(payload: Omit<CodePayload, 'exp'>): { code: string; expiresAt: Date } {
  const expiresAt = new Date(Date.now() + CODE_TTL_MS);
  const fullPayload: CodePayload = { ...payload, exp: expiresAt.getTime() };

  const prefix = PREFIXES[payload.type];
  const payloadStr = Buffer.from(JSON.stringify(fullPayload)).toString('base64url');
  const signature = createHmac('sha256', config.CODE_SIGNING_SECRET)
    .update(payloadStr)
    .digest('base64url');

  return {
    code: `${prefix}${payloadStr}.${signature}`,
    expiresAt,
  };
}

/**
 * Parse and verify an HMAC-signed code.
 * Returns the payload if valid, null if invalid/expired/tampered.
 */
export function verifyCode(code: string): CodePayload | null {
  // Determine type from prefix
  let type: 'deposit' | 'withdrawal';
  let body: string;

  if (code.startsWith(PREFIXES.deposit)) {
    type = 'deposit';
    body = code.slice(PREFIXES.deposit.length);
  } else if (code.startsWith(PREFIXES.withdrawal)) {
    type = 'withdrawal';
    body = code.slice(PREFIXES.withdrawal.length);
  } else {
    return null;
  }

  // Split payload and signature
  const dotIndex = body.lastIndexOf('.');
  if (dotIndex === -1) return null;

  const payloadStr = body.slice(0, dotIndex);
  const signature = body.slice(dotIndex + 1);

  // Verify HMAC
  const expectedSignature = createHmac('sha256', config.CODE_SIGNING_SECRET)
    .update(payloadStr)
    .digest('base64url');

  // Timing-safe comparison to prevent side-channel attacks
  const sigBuf = Buffer.from(signature, 'base64url');
  const expectedBuf = Buffer.from(expectedSignature, 'base64url');
  if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) return null;

  // Decode payload
  try {
    const payload: CodePayload = JSON.parse(
      Buffer.from(payloadStr, 'base64url').toString('utf-8')
    );

    // Verify type matches prefix
    if (payload.type !== type) return null;

    // Check expiry
    if (Date.now() > payload.exp) return null;

    return payload;
  } catch {
    return null;
  }
}
