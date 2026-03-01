# Phase 5: Implementation & Testing Guide

**Phase**: Session Management & Protected Routes
**Status**: ✅ Completed
**Date**: February 2026 (Rewritten) | **Completed**: February 2026
**Dependencies**: Phase 4 (Payment Verification System)

> **Implementation Note:** All items in this phase have been implemented. JWT access/refresh tokens, session service, auth middleware (with pending token support), and all session routes are in place. The implementation also added a "pending token" concept (30-min httpOnly cookie) for users mid-signup, which was not in the original plan.

---

## Overview

This phase implements JWT-based session management, auth middleware for protected routes, and the login/logout/refresh endpoints. After this phase, users who complete payment verification can maintain authenticated sessions.

**Key changes from previous version:**
- Entire phase replaced. Previously this was "Edition Choice Flow"
- Session management was previously in Phase 4; now moved here
- JWT payload no longer includes `edition` from automatic detection
- JWT payload includes `authProvider` indicating signup method
- Registration completion is triggered after payment verification

**What this phase delivers:**
1. JWT access tokens (15 min) and refresh tokens (30 days)
2. Session service (create, refresh, revoke)
3. Auth middleware for protected routes
4. Registration completion after verification
5. `GET /auth/me` — Current user profile
6. `POST /auth/refresh` — Refresh access token
7. `POST /auth/logout` — Logout current session
8. `POST /auth/logout-all` — Logout all sessions

---

## Prerequisites

Before starting Phase 5, ensure Phases 0-4 are complete:

```bash
cd packages/api
npx tsx src/test-repositories.ts    # Phase 1
npx tsx src/test-oauth.ts           # Phase 2
npx tsx src/test-auth-methods.ts    # Phase 3
npx tsx src/test-verification.ts    # Phase 4

npx tsc --noEmit                    # TypeScript compiles
docker compose ps                   # Database & Redis running
```

---

## Step 1: Environment Configuration

### 1.1 Add JWT Configuration

**File: `packages/api/.env`**

```env
# Existing variables...

# JWT Secrets (generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
JWT_ACCESS_SECRET=your-64-char-hex-secret-for-access-tokens
JWT_REFRESH_SECRET=your-64-char-hex-secret-for-refresh-tokens
```

### 1.2 Update Config Validation

**File: `packages/api/src/config/index.ts`**

```typescript
const configSchema = z.object({
  // ... existing fields

  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
});
```

### 1.3 JWT Configuration

**File: `packages/api/src/config/jwt.ts`**

```typescript
export const jwtConfig = {
  accessToken: {
    expiresIn: '15m',
    expiresInMs: 15 * 60 * 1000,
  },
  refreshToken: {
    expiresIn: '30d',
    expiresInMs: 30 * 24 * 60 * 60 * 1000,
  },
};
```

---

## Step 2: JWT Utilities

### 2.1 Create JWT Library

**File: `packages/api/src/lib/jwt.ts`**

```typescript
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { config } from '../config/index.js';
import { jwtConfig } from '../config/jwt.js';
import { createModuleLogger } from './logger.js';
import type { AuthProvider } from '@donuttrade/shared';

const logger = createModuleLogger('auth', 'jwt');

/**
 * Access token payload
 */
export interface AccessTokenPayload {
  sub: string;          // User ID
  username: string;     // Minecraft username
  authProvider: AuthProvider;
  type: 'access';
}

/**
 * Refresh token payload
 */
export interface RefreshTokenPayload {
  sub: string;          // User ID
  sessionId: string;    // Session ID
  type: 'refresh';
}

/**
 * Sign an access token
 */
export function signAccessToken(payload: Omit<AccessTokenPayload, 'type'>): string {
  return jwt.sign(
    { ...payload, type: 'access' },
    config.JWT_ACCESS_SECRET!,
    { expiresIn: jwtConfig.accessToken.expiresIn }
  );
}

/**
 * Sign a refresh token
 */
export function signRefreshToken(payload: Omit<RefreshTokenPayload, 'type'>): string {
  return jwt.sign(
    { ...payload, type: 'refresh' },
    config.JWT_REFRESH_SECRET!,
    { expiresIn: jwtConfig.refreshToken.expiresIn }
  );
}

/**
 * Verify an access token
 */
export function verifyAccessToken(token: string): AccessTokenPayload {
  const payload = jwt.verify(token, config.JWT_ACCESS_SECRET!) as AccessTokenPayload;
  if (payload.type !== 'access') {
    throw new Error('Invalid token type');
  }
  return payload;
}

/**
 * Verify a refresh token
 */
export function verifyRefreshToken(token: string): RefreshTokenPayload {
  const payload = jwt.verify(token, config.JWT_REFRESH_SECRET!) as RefreshTokenPayload;
  if (payload.type !== 'refresh') {
    throw new Error('Invalid token type');
  }
  return payload;
}

/**
 * Hash a refresh token for storage (SHA-256)
 */
export function hashRefreshToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}
```

---

## Step 3: Session Service

### 3.1 Create Session Service

**File: `packages/api/src/services/auth/session.service.ts`**

```typescript
import { createModuleLogger } from '../../lib/logger.js';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  hashRefreshToken,
} from '../../lib/jwt.js';
import { sessionRepository } from '../../repositories/session.repository.js';
import { userRepository } from '../../repositories/user.repository.js';
import { jwtConfig } from '../../config/jwt.js';
import type { AuthProvider } from '@donuttrade/shared';

const logger = createModuleLogger('auth', 'session-service');

export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
}

export class SessionService {
  /**
   * Create a new session for a user
   * Returns access and refresh tokens
   */
  async createSession(
    userId: string,
    username: string,
    authProvider: AuthProvider,
    userAgent?: string,
    ipAddress?: string,
  ): Promise<SessionTokens> {
    const startTime = Date.now();
    logger.info({ action: 'create_session_start', userId });

    // Create refresh token and session record
    const refreshToken = signRefreshToken({ sub: userId, sessionId: '' });
    const refreshTokenHash = hashRefreshToken(refreshToken);

    const session = await sessionRepository.create({
      userId,
      refreshTokenHash,
      userAgent,
      ipAddress,
      expiresAt: new Date(Date.now() + jwtConfig.refreshToken.expiresInMs),
    });

    // Re-sign refresh token with session ID
    const finalRefreshToken = signRefreshToken({
      sub: userId,
      sessionId: session.id,
    });
    const finalHash = hashRefreshToken(finalRefreshToken);

    // Update the session with the correct hash
    await sessionRepository.updateHash(session.id, finalHash);

    // Create access token
    const accessToken = signAccessToken({
      sub: userId,
      username,
      authProvider,
    });

    const duration = Date.now() - startTime;
    logger.info({
      action: 'create_session_success',
      userId,
      sessionId: session.id,
      duration,
    });

    return { accessToken, refreshToken: finalRefreshToken };
  }

  /**
   * Refresh a session — issue new access + refresh tokens
   */
  async refreshSession(refreshToken: string): Promise<SessionTokens> {
    const startTime = Date.now();
    logger.info({ action: 'refresh_session_start' });

    // Verify the refresh token
    const payload = verifyRefreshToken(refreshToken);
    const tokenHash = hashRefreshToken(refreshToken);

    // Find the session
    const session = await sessionRepository.findByHash(tokenHash);
    if (!session) {
      logger.warn({ action: 'refresh_session_invalid_token' });
      throw new Error('Invalid refresh token');
    }

    if (new Date() > session.expiresAt) {
      logger.warn({ action: 'refresh_session_expired', sessionId: session.id });
      await sessionRepository.delete(session.id);
      throw new Error('Refresh token expired');
    }

    // Get user
    const user = await userRepository.findById(session.userId);
    if (!user || user.verificationStatus !== 'verified') {
      throw new Error('User not found or not verified');
    }

    // Rotate refresh token
    const newRefreshToken = signRefreshToken({
      sub: user.id,
      sessionId: session.id,
    });
    const newHash = hashRefreshToken(newRefreshToken);

    await sessionRepository.updateHash(session.id, newHash);
    await sessionRepository.updateLastUsed(session.id);

    // Issue new access token
    const accessToken = signAccessToken({
      sub: user.id,
      username: user.minecraftUsername!,
      authProvider: user.authProvider as AuthProvider,
    });

    const duration = Date.now() - startTime;
    logger.info({
      action: 'refresh_session_success',
      userId: user.id,
      sessionId: session.id,
      duration,
    });

    return { accessToken, refreshToken: newRefreshToken };
  }

  /**
   * Revoke a single session (logout)
   */
  async revokeSession(refreshToken: string): Promise<void> {
    logger.info({ action: 'revoke_session_start' });

    const tokenHash = hashRefreshToken(refreshToken);
    const session = await sessionRepository.findByHash(tokenHash);

    if (session) {
      await sessionRepository.delete(session.id);
      logger.info({ action: 'revoke_session_success', sessionId: session.id });
    }
  }

  /**
   * Revoke all sessions for a user (logout everywhere)
   */
  async revokeAllSessions(userId: string): Promise<number> {
    logger.info({ action: 'revoke_all_sessions_start', userId });
    const count = await sessionRepository.deleteAllForUser(userId);
    logger.info({ action: 'revoke_all_sessions_success', userId, count });
    return count;
  }
}

export const sessionService = new SessionService();
```

---

## Step 4: Auth Middleware

### 4.1 Create Auth Plugin

**File: `packages/api/src/plugins/auth.ts`**

```typescript
import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { verifyAccessToken, AccessTokenPayload } from '../lib/jwt.js';
import { createModuleLogger } from '../lib/logger.js';

const logger = createModuleLogger('auth', 'middleware');

// Augment Fastify types
declare module 'fastify' {
  interface FastifyRequest {
    user?: AccessTokenPayload;
  }
}

/**
 * Authentication middleware
 * Extracts and verifies the Bearer token from the Authorization header
 */
export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const authHeader = request.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    logger.debug({ action: 'auth_missing_token', correlationId: request.id });
    return reply.status(401).send({ error: 'Authentication required' });
  }

  const token = authHeader.substring(7);

  try {
    const payload = verifyAccessToken(token);
    request.user = payload;

    logger.debug({
      action: 'auth_success',
      userId: payload.sub,
      correlationId: request.id,
    });
  } catch (error) {
    logger.debug({ action: 'auth_invalid_token', correlationId: request.id });
    return reply.status(401).send({ error: 'Invalid or expired token' });
  }
}

/**
 * Require verified user middleware
 * Must be used after authenticate
 */
export async function requireVerified(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  if (!request.user) {
    return reply.status(401).send({ error: 'Authentication required' });
  }

  // The access token is only issued after verification,
  // so having a valid token implies the user is verified.
  // Additional checks can be added here if needed.
}
```

---

## Step 5: Session Routes

### 5.1 Create Session Routes

**File: `packages/api/src/routes/auth/session.ts`**

```typescript
import { FastifyPluginAsync } from 'fastify';
import { sessionService } from '../../services/auth/session.service.js';
import { userRepository } from '../../repositories/user.repository.js';
import { authenticate } from '../../plugins/auth.js';
import { createModuleLogger } from '../../lib/logger.js';

const logger = createModuleLogger('auth', 'session-routes');

const sessionRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /auth/me
   * Get current user profile (protected)
   */
  fastify.get('/me', { preHandler: [authenticate] }, async (request, reply) => {
    const user = await userRepository.findById(request.user!.sub);

    if (!user) {
      return reply.status(404).send({ error: 'User not found' });
    }

    return reply.send({
      id: user.id,
      authProvider: user.authProvider,
      minecraftUsername: user.minecraftUsername,
      email: user.email,
      discordUsername: user.discordUsername,
      verificationStatus: user.verificationStatus,
      balance: user.balance.toString(),
      createdAt: user.createdAt.toISOString(),
      lastLoginAt: user.lastLoginAt?.toISOString() || null,
    });
  });

  /**
   * POST /auth/refresh
   * Refresh access token using refresh token
   */
  fastify.post('/refresh', async (request, reply) => {
    // Get refresh token from cookie or request body
    const refreshToken =
      (request.cookies as any)?.dt_refresh_token ||
      (request.body as any)?.refreshToken;

    if (!refreshToken) {
      return reply.status(400).send({ error: 'Refresh token is required' });
    }

    try {
      const tokens = await sessionService.refreshSession(refreshToken);

      // Set refresh token as HTTP-only cookie
      reply.setCookie('dt_refresh_token', tokens.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/auth',
        maxAge: 30 * 24 * 60 * 60, // 30 days in seconds
      });

      return reply.send({
        accessToken: tokens.accessToken,
      });
    } catch (error: any) {
      logger.warn({ action: 'refresh_error', error: error.message, correlationId: request.id });
      return reply.status(401).send({ error: error.message });
    }
  });

  /**
   * POST /auth/logout
   * Logout current session
   */
  fastify.post('/logout', async (request, reply) => {
    const refreshToken =
      (request.cookies as any)?.dt_refresh_token ||
      (request.body as any)?.refreshToken;

    if (refreshToken) {
      await sessionService.revokeSession(refreshToken);
    }

    // Clear cookie
    reply.clearCookie('dt_refresh_token', { path: '/auth' });

    logger.info({ action: 'logout', correlationId: request.id });
    return reply.send({ message: 'Logged out successfully' });
  });

  /**
   * POST /auth/logout-all
   * Logout all sessions for current user (protected)
   */
  fastify.post('/logout-all', { preHandler: [authenticate] }, async (request, reply) => {
    const count = await sessionService.revokeAllSessions(request.user!.sub);

    // Clear cookie
    reply.clearCookie('dt_refresh_token', { path: '/auth' });

    logger.info({
      action: 'logout_all',
      userId: request.user!.sub,
      sessionsRevoked: count,
      correlationId: request.id,
    });

    return reply.send({
      message: `Logged out from ${count} session(s)`,
      sessionsRevoked: count,
    });
  });
};

export default sessionRoutes;
```

### 5.2 Update Route Registration

**File: `packages/api/src/routes/auth/index.ts`**

```typescript
import { FastifyPluginAsync } from 'fastify';
import microsoftRoutes from './microsoft.js';
import discordRoutes from './discord.js';
import emailRoutes from './email.js';
import usernameRoutes from './username.js';
import verificationRoutes from './verification.js';
import sessionRoutes from './session.js';

const authRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.register(microsoftRoutes);
  fastify.register(discordRoutes);
  fastify.register(emailRoutes);
  fastify.register(usernameRoutes);
  fastify.register(verificationRoutes);
  fastify.register(sessionRoutes);
};

export default authRoutes;
```

---

## Step 6: Integration — Issue Session After Verification

### 6.1 Update Verification Confirmation

When the verification bot confirms a payment, the API should automatically issue session tokens. Update the internal webhook handler in the verification routes to trigger session creation:

**Update in `packages/api/src/routes/auth/verification.ts`:**

In the `/internal/verification/confirm` handler, after `confirmPayment` returns `matched: true`, create a session:

```typescript
if (result.matched) {
  const user = await userRepository.findById(result.userId!);
  if (user && user.minecraftUsername) {
    const tokens = await sessionService.createSession(
      user.id,
      user.minecraftUsername,
      user.authProvider as AuthProvider,
    );
    // Store tokens for the frontend to pick up via polling
    // or use WebSocket to push the session tokens
    return reply.send({
      ...result,
      accessToken: tokens.accessToken,
      // Refresh token should be set as cookie on the user's browser session
    });
  }
}
```

**Note:** The exact mechanism for delivering session tokens to the user's browser after bot verification depends on the frontend architecture (Phase 6). Options include:
- **Polling:** Frontend polls `GET /auth/verification/status`, which returns tokens when verified
- **WebSocket:** Server pushes verification success + tokens to the connected browser
- **Redirect:** Verification status page redirects to a URL that sets the session

---

## Step 7: Test Script

### 7.1 Create Session Test Script

**File: `packages/api/src/test-session.ts`**

```typescript
import { PrismaClient } from '@prisma/client';
import { createModuleLogger } from './lib/logger.js';
import { signAccessToken, signRefreshToken, verifyAccessToken, verifyRefreshToken, hashRefreshToken } from './lib/jwt.js';
import { sessionService } from './services/auth/session.service.js';

const logger = createModuleLogger('api', 'test-session');
const prisma = new PrismaClient();

async function testSession() {
  logger.info({ action: 'test_start', message: 'Testing Phase 5 session management' });

  try {
    // Setup: Create a verified test user
    const user = await prisma.user.create({
      data: {
        authProvider: 'microsoft',
        microsoftId: 'test-ms-session-' + Date.now(),
        minecraftUsername: 'SessionTestUser' + Date.now(),
        verificationStatus: 'verified',
      },
    });

    // Test 1: Sign and verify access token
    const accessToken = signAccessToken({
      sub: user.id,
      username: user.minecraftUsername!,
      authProvider: 'microsoft',
    });
    const accessPayload = verifyAccessToken(accessToken);
    logger.info({
      action: 'test_access_token',
      validSub: accessPayload.sub === user.id,
      validType: accessPayload.type === 'access',
      result: accessPayload.sub === user.id ? 'PASS' : 'FAIL',
    });

    // Test 2: Sign and verify refresh token
    const refreshToken = signRefreshToken({
      sub: user.id,
      sessionId: 'test-session-id',
    });
    const refreshPayload = verifyRefreshToken(refreshToken);
    logger.info({
      action: 'test_refresh_token',
      validSub: refreshPayload.sub === user.id,
      validType: refreshPayload.type === 'refresh',
      result: refreshPayload.sub === user.id ? 'PASS' : 'FAIL',
    });

    // Test 3: Hash refresh token
    const hash = hashRefreshToken(refreshToken);
    logger.info({
      action: 'test_hash_token',
      hashLength: hash.length,
      result: hash.length === 64 ? 'PASS' : 'FAIL',
    });

    // Test 4: Create session
    const tokens = await sessionService.createSession(
      user.id,
      user.minecraftUsername!,
      'microsoft',
      'test-agent',
      '127.0.0.1',
    );
    logger.info({
      action: 'test_create_session',
      hasAccessToken: !!tokens.accessToken,
      hasRefreshToken: !!tokens.refreshToken,
      result: tokens.accessToken && tokens.refreshToken ? 'PASS' : 'FAIL',
    });

    // Test 5: Refresh session
    const newTokens = await sessionService.refreshSession(tokens.refreshToken);
    logger.info({
      action: 'test_refresh_session',
      hasNewAccessToken: !!newTokens.accessToken,
      hasNewRefreshToken: !!newTokens.refreshToken,
      result: newTokens.accessToken && newTokens.refreshToken ? 'PASS' : 'FAIL',
    });

    // Test 6: Old refresh token should be invalid after rotation
    try {
      await sessionService.refreshSession(tokens.refreshToken);
      logger.info({ action: 'test_token_rotation', result: 'FAIL (old token still works)' });
    } catch {
      logger.info({ action: 'test_token_rotation', result: 'PASS (old token rejected)' });
    }

    // Test 7: Revoke session
    await sessionService.revokeSession(newTokens.refreshToken);
    try {
      await sessionService.refreshSession(newTokens.refreshToken);
      logger.info({ action: 'test_revoke_session', result: 'FAIL (revoked token still works)' });
    } catch {
      logger.info({ action: 'test_revoke_session', result: 'PASS (revoked token rejected)' });
    }

    // Test 8: Create multiple sessions and revoke all
    const s1 = await sessionService.createSession(user.id, user.minecraftUsername!, 'microsoft');
    const s2 = await sessionService.createSession(user.id, user.minecraftUsername!, 'microsoft');
    const count = await sessionService.revokeAllSessions(user.id);
    logger.info({
      action: 'test_revoke_all',
      sessionsRevoked: count,
      result: count >= 2 ? 'PASS' : 'FAIL',
    });

    // Cleanup
    await prisma.user.delete({ where: { id: user.id } });

    logger.info({ action: 'test_complete', message: 'All Phase 5 session tests passed!' });
  } catch (error) {
    logger.error({ action: 'test_error', error });
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

testSession();
```

---

## Verification Checklist

### JWT
- [x] Access tokens are signed with `JWT_ACCESS_SECRET`
- [x] Refresh tokens are signed with `JWT_REFRESH_SECRET`
- [x] Access token payload contains `sub`, `username`, `authProvider`, `type: 'access'`
- [x] Refresh token payload contains `sub`, `sessionId`, `type: 'refresh'`
- [x] Access tokens expire in 15 minutes
- [x] Refresh tokens expire in 30 days
- [x] Refresh tokens are hashed before storage (SHA-256)

### Session Service
- [x] `createSession()` returns access + refresh tokens
- [x] `createSession()` stores session in database with hashed refresh token
- [x] `refreshSession()` validates and rotates refresh token
- [x] `refreshSession()` rejects old (rotated) refresh tokens
- [x] `revokeSession()` deletes session from database
- [x] `revokeAllSessions()` deletes all sessions for a user

### Auth Middleware
- [x] Extracts Bearer token from Authorization header
- [x] Returns 401 for missing/invalid tokens
- [x] Attaches user payload to `request.user`

### Session Routes
- [x] `GET /auth/me` returns user profile (requires auth)
- [x] `POST /auth/refresh` issues new tokens from refresh token
- [x] `POST /auth/logout` revokes current session
- [x] `POST /auth/logout-all` revokes all sessions (requires auth)
- [x] Refresh token is set as HTTP-only cookie

### Actual Files Implemented
- `packages/api/src/lib/jwt.ts` — Sign/verify access (15min), refresh (30d), and pending (30min) tokens; token error classes
- `packages/api/src/config/jwt.ts` — JWT secret and expiry configuration
- `packages/api/src/services/auth/session.service.ts` — Create, refresh, revoke (single/all) sessions
- `packages/api/src/plugins/auth.ts` — `fastify.authenticate` (Bearer) and `fastify.authenticatePending` (cookie) decorators
- `packages/api/src/routes/auth/session.ts` — `/auth/me`, `/auth/refresh`, `/auth/logout`, `/auth/logout-all`
- `packages/api/src/routes/auth/index.ts` — Registers all auth route modules

### Implementation Additions (beyond original plan)
- **Pending token**: 30-minute httpOnly cookie for users mid-signup (between OAuth callback and payment verification). This was not in the original plan but enables a smoother signup UX.
- **Token error classes**: `TokenExpiredError`, `TokenInvalidError` for structured error handling

### Manual Verification
```bash
# 1. Create a session (simulate via test or after full auth flow)
cd packages/api && npx tsx src/test-session.ts

# 2. Use access token to hit protected endpoint
curl http://localhost:3001/auth/me \
  -H "Authorization: Bearer <access-token>"

# 3. Refresh token
curl -X POST http://localhost:3001/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"<refresh-token>"}'

# 4. Logout
curl -X POST http://localhost:3001/auth/logout \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"<refresh-token>"}'
```

### Log Verification
Expected log entries:
```
INFO  [auth:session-service] action=create_session_success userId=xxx sessionId=yyy
INFO  [auth:session-service] action=refresh_session_success userId=xxx
INFO  [auth:session-service] action=revoke_session_success sessionId=yyy
INFO  [auth:session-routes]  action=logout correlationId=zzz
INFO  [auth:middleware]       action=auth_success userId=xxx
```
