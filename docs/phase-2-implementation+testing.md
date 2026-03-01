# Phase 2: Implementation & Testing Guide

**Phase**: Simplified Microsoft OAuth
**Status**: ✅ Completed
**Date**: February 2026 (Rewritten) | **Completed**: February 2026
**Dependencies**: Phase 1 (Database Schema & User Model)

> **Implementation Note:** All items in this phase have been implemented. Microsoft OAuth uses OpenID Connect scopes (identity only, no Xbox/Minecraft). The username entry endpoint (`POST /auth/set-username`) was also implemented during this phase, ahead of its original Phase 3 schedule.

---

## Overview

This phase implements a simplified Microsoft OAuth 2.0 flow. Microsoft is used **purely as an identity provider** — it verifies who the user is (Microsoft ID + email), not what they own in Minecraft.

**Key changes from previous version:**
- Scopes changed from `XboxLive.signin` to `openid email profile offline_access`
- No Xbox Live, XSTS, or Minecraft API calls after receiving the Microsoft token
- OAuth callback extracts user identity from the ID token (not from an API chain)
- Callback redirects new users to username entry page, not to an auth chain

**What this phase delivers:**
1. Microsoft OAuth configuration with OpenID Connect scopes
2. `GET /auth/microsoft` — Initiate OAuth flow
3. `GET /auth/microsoft/callback` — Handle callback, extract identity
4. State management (CSRF protection) via AuthState
5. New user detection vs returning user login

---

## Prerequisites

Before starting Phase 2, ensure Phase 1 is complete:

- [x] All Phase 1 tests passing
- [x] `users`, `sessions`, `auth_states` tables exist with new schema
- [x] Repositories working correctly
- [x] Database and Redis running

Verify Phase 1:
```bash
cd packages/api
npx tsx src/test-repositories.ts   # All tests pass
npm run build                       # No errors
```

---

## Step 1: Environment Configuration

### 1.1 Update Environment Variables

**File: `packages/api/.env`**

```env
# Existing variables...
NODE_ENV=development
PORT=3001
LOG_LEVEL=debug
DATABASE_URL=postgresql://dev:dev@localhost:5432/donuttrade
REDIS_URL=redis://localhost:6379

# Microsoft OAuth
MICROSOFT_CLIENT_ID=your-azure-app-client-id
MICROSOFT_CLIENT_SECRET=your-azure-app-client-secret
MICROSOFT_REDIRECT_URI=http://localhost:3001/auth/microsoft/callback
```

### 1.2 Update Config Validation

**File: `packages/api/src/config/index.ts`**

Ensure the config schema validates Microsoft OAuth variables:

```typescript
const configSchema = z.object({
  // ... existing fields
  MICROSOFT_CLIENT_ID: z.string().min(1),
  MICROSOFT_CLIENT_SECRET: z.string().min(1),
  MICROSOFT_REDIRECT_URI: z.string().url(),
});
```

---

## Step 2: Update OAuth Configuration

### 2.1 Update Microsoft OAuth Config

**File: `packages/api/src/config/oauth.ts`**

```typescript
import { config } from './index.js';

/**
 * Microsoft OAuth 2.0 Configuration
 * Uses the /consumers tenant for personal Microsoft accounts
 *
 * NOTE: We use OpenID Connect scopes (openid, email, profile) instead of
 * XboxLive.signin. Microsoft is an identity provider only — no Xbox/Minecraft
 * API calls are made.
 */
export const microsoftOAuthConfig = {
  clientId: config.MICROSOFT_CLIENT_ID!,
  clientSecret: config.MICROSOFT_CLIENT_SECRET!,
  redirectUri: config.MICROSOFT_REDIRECT_URI!,

  // /consumers tenant for personal Microsoft accounts
  authorizationEndpoint: 'https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize',
  tokenEndpoint: 'https://login.microsoftonline.com/consumers/oauth2/v2.0/token',

  // OpenID Connect scopes — identity only, no Xbox/Minecraft access
  scopes: ['openid', 'email', 'profile', 'offline_access'],
};

/**
 * OAuth state configuration
 */
export const authStateConfig = {
  // State parameter expiry (10 minutes)
  stateExpiryMs: 10 * 60 * 1000,
  // State parameter length (bytes, hex encoded to 64 chars)
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
```

---

## Step 3: Implement Microsoft OAuth Service

### 3.1 Update Microsoft Service

**File: `packages/api/src/services/auth/microsoft.service.ts`**

```typescript
import crypto from 'crypto';
import { createModuleLogger } from '../../lib/logger.js';
import { microsoftOAuthConfig, authStateConfig } from '../../config/oauth.js';
import type { MicrosoftTokenResponse, MicrosoftUserInfo } from '@donuttrade/shared';

const logger = createModuleLogger('auth', 'microsoft-service');

export class MicrosoftService {
  /**
   * Build the Microsoft OAuth authorization URL
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
    logger.debug({ action: 'build_auth_url', redirectUri: microsoftOAuthConfig.redirectUri });
    return url;
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForTokens(code: string): Promise<MicrosoftTokenResponse> {
    const startTime = Date.now();
    logger.info({ action: 'exchange_code_start' });

    const body = new URLSearchParams({
      client_id: microsoftOAuthConfig.clientId,
      client_secret: microsoftOAuthConfig.clientSecret,
      code,
      redirect_uri: microsoftOAuthConfig.redirectUri,
      grant_type: 'authorization_code',
    });

    const response = await fetch(microsoftOAuthConfig.tokenEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!response.ok) {
      const error = await response.json();
      logger.error({ action: 'exchange_code_error', error: error.error, description: error.error_description });
      throw new Error(`Microsoft token exchange failed: ${error.error_description || error.error}`);
    }

    const tokens: MicrosoftTokenResponse = await response.json();
    const duration = Date.now() - startTime;
    logger.info({ action: 'exchange_code_success', duration });

    return tokens;
  }

  /**
   * Extract user info from the ID token
   * The ID token is a JWT — we decode the payload (middle segment)
   * to get the user's Microsoft ID (sub/oid) and email
   */
  extractUserInfo(idToken: string): MicrosoftUserInfo {
    try {
      // Decode the JWT payload (base64url encoded)
      const payload = idToken.split('.')[1];
      const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString());

      const userInfo: MicrosoftUserInfo = {
        sub: decoded.oid || decoded.sub, // oid is the stable user ID for /consumers
        email: decoded.email || decoded.preferred_username,
        name: decoded.name,
      };

      logger.info({
        action: 'extract_user_info',
        microsoftId: userInfo.sub.substring(0, 8) + '...',
        hasEmail: !!userInfo.email,
      });

      return userInfo;
    } catch (error) {
      logger.error({ action: 'extract_user_info_error', error });
      throw new Error('Failed to extract user info from Microsoft ID token');
    }
  }

  /**
   * Generate a random state parameter for CSRF protection
   */
  generateState(): string {
    return crypto.randomBytes(authStateConfig.stateLength).toString('hex');
  }
}

export const microsoftService = new MicrosoftService();
```

---

## Step 4: Implement Auth Routes

### 4.1 Microsoft Auth Routes

**File: `packages/api/src/routes/auth/microsoft.ts`**

```typescript
import { FastifyPluginAsync } from 'fastify';
import { microsoftService } from '../../services/auth/microsoft.service.js';
import { authStateRepository } from '../../repositories/auth-state.repository.js';
import { userRepository } from '../../repositories/user.repository.js';
import { createModuleLogger } from '../../lib/logger.js';
import { isMicrosoftOAuthConfigured } from '../../config/oauth.js';

const logger = createModuleLogger('auth', 'microsoft-routes');

const microsoftRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /auth/microsoft
   * Initiates the Microsoft OAuth flow
   */
  fastify.get('/microsoft', async (request, reply) => {
    if (!isMicrosoftOAuthConfigured()) {
      return reply.status(503).send({ error: 'Microsoft OAuth is not configured' });
    }

    const state = microsoftService.generateState();

    // Store state for CSRF validation
    await authStateRepository.create(state, 'microsoft');

    const authUrl = microsoftService.buildAuthorizationUrl(state);

    logger.info({
      action: 'oauth_initiate',
      correlationId: request.id,
      provider: 'microsoft',
    });

    return reply.redirect(authUrl);
  });

  /**
   * GET /auth/microsoft/callback
   * Handles the Microsoft OAuth callback
   */
  fastify.get('/microsoft/callback', async (request, reply) => {
    const { code, state, error } = request.query as {
      code?: string;
      state?: string;
      error?: string;
    };

    // Handle user cancellation or errors
    if (error) {
      logger.warn({ action: 'oauth_callback_error', error, correlationId: request.id });
      return reply.redirect('/login?error=oauth_cancelled');
    }

    if (!code || !state) {
      logger.warn({ action: 'oauth_callback_missing_params', correlationId: request.id });
      return reply.status(400).send({ error: 'Missing code or state parameter' });
    }

    // Validate state (CSRF protection)
    const authState = await authStateRepository.findAndDelete(state);
    if (!authState) {
      logger.warn({ action: 'oauth_invalid_state', correlationId: request.id });
      return reply.status(400).send({ error: 'Invalid or expired state parameter' });
    }

    try {
      // Exchange code for tokens
      const tokens = await microsoftService.exchangeCodeForTokens(code);

      if (!tokens.id_token) {
        logger.error({ action: 'oauth_no_id_token', correlationId: request.id });
        return reply.status(500).send({ error: 'Microsoft did not return an ID token' });
      }

      // Extract user identity from ID token
      const userInfo = microsoftService.extractUserInfo(tokens.id_token);

      // Check if user already exists
      const existingUser = await userRepository.findByMicrosoftId(userInfo.sub);

      if (existingUser) {
        // Returning user — log them in
        logger.info({
          action: 'oauth_login_existing',
          userId: existingUser.id,
          correlationId: request.id,
        });

        // Session creation will be handled in Phase 5
        // For now, redirect to dashboard with a temporary indicator
        return reply.redirect('/dashboard?auth=success');
      } else {
        // New user — store Microsoft identity, redirect to username entry
        logger.info({
          action: 'oauth_new_user',
          microsoftId: userInfo.sub.substring(0, 8) + '...',
          correlationId: request.id,
        });

        // Create a pending user record
        const newUser = await userRepository.create({
          authProvider: 'microsoft',
          microsoftId: userInfo.sub,
        });

        // Update email if available
        if (userInfo.email) {
          await userRepository.update(newUser.id, { email: userInfo.email });
        }

        // Redirect to Minecraft username entry page
        // The userId is passed so the username entry page knows which user to update
        return reply.redirect(`/auth/set-username?userId=${newUser.id}`);
      }
    } catch (err) {
      logger.error({ action: 'oauth_callback_failure', error: err, correlationId: request.id });
      return reply.redirect('/login?error=oauth_failed');
    }
  });
};

export default microsoftRoutes;
```

### 4.2 Register Auth Routes

**File: `packages/api/src/routes/auth/index.ts`**

```typescript
import { FastifyPluginAsync } from 'fastify';
import microsoftRoutes from './microsoft.js';

const authRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.register(microsoftRoutes);
  // Discord routes will be added in Phase 3
  // Email routes will be added in Phase 3
  // Session routes will be added in Phase 5
  // Verification routes will be added in Phase 4
};

export default authRoutes;
```

---

## Step 5: Delete Removed Services

### 5.1 Delete Xbox/Minecraft Services

Remove the following files that are no longer needed:

- `packages/api/src/services/auth/xbox.service.ts` — **DELETE**
- `packages/api/src/services/auth/minecraft.service.ts` — **DELETE**
- `packages/api/src/services/auth/auth-chain.service.ts` — **DELETE**
- `packages/api/src/services/auth/edition.service.ts` — **DELETE**
- `packages/api/src/routes/auth/edition.ts` — **DELETE**

### 5.2 Update Service Index

**File: `packages/api/src/services/auth/index.ts`**

Remove exports for deleted services. Keep only:

```typescript
export { microsoftService } from './microsoft.service.js';
export { stateService } from './state.service.js';
// Discord service will be added in Phase 3
// Email service will be added in Phase 3
// Verification service will be added in Phase 4
// Session service will be added in Phase 5
```

---

## Step 6: Test Script

### 6.1 Create OAuth Test Script

**File: `packages/api/src/test-oauth.ts`**

```typescript
import { createModuleLogger } from './lib/logger.js';
import { microsoftService } from './services/auth/microsoft.service.js';
import { isMicrosoftOAuthConfigured, microsoftOAuthConfig } from './config/oauth.js';

const logger = createModuleLogger('api', 'test-oauth');

async function testOAuth() {
  logger.info({ action: 'test_start', message: 'Testing Phase 2 OAuth configuration' });

  // Test 1: Check OAuth configuration
  const isConfigured = isMicrosoftOAuthConfigured();
  logger.info({ action: 'test_config', isConfigured, result: isConfigured ? 'PASS' : 'WARN (not configured)' });

  // Test 2: Verify scopes are OpenID Connect (not XboxLive)
  const scopes = microsoftOAuthConfig.scopes;
  const hasOpenId = scopes.includes('openid');
  const hasEmail = scopes.includes('email');
  const hasProfile = scopes.includes('profile');
  const noXbox = !scopes.some(s => s.includes('Xbox'));
  logger.info({
    action: 'test_scopes',
    scopes,
    hasOpenId,
    hasEmail,
    hasProfile,
    noXbox,
    result: hasOpenId && hasEmail && hasProfile && noXbox ? 'PASS' : 'FAIL',
  });

  // Test 3: Generate state parameter
  const state = microsoftService.generateState();
  logger.info({
    action: 'test_state_generation',
    stateLength: state.length,
    result: state.length === 64 ? 'PASS' : 'FAIL',
  });

  // Test 4: Build authorization URL
  const authUrl = microsoftService.buildAuthorizationUrl(state);
  const url = new URL(authUrl);
  const hasCorrectScopes = url.searchParams.get('scope')?.includes('openid');
  const hasState = url.searchParams.get('state') === state;
  const isConsumersTenant = authUrl.includes('/consumers/');
  logger.info({
    action: 'test_auth_url',
    hasCorrectScopes,
    hasState,
    isConsumersTenant,
    result: hasCorrectScopes && hasState && isConsumersTenant ? 'PASS' : 'FAIL',
  });

  // Test 5: Extract user info from a mock ID token
  // Create a mock JWT with test claims
  const mockPayload = {
    oid: 'test-microsoft-user-id-12345',
    email: 'test@outlook.com',
    name: 'Test User',
    sub: 'test-sub-12345',
  };
  const mockIdToken = [
    Buffer.from('{"alg":"RS256","typ":"JWT"}').toString('base64url'),
    Buffer.from(JSON.stringify(mockPayload)).toString('base64url'),
    'mock-signature',
  ].join('.');

  const userInfo = microsoftService.extractUserInfo(mockIdToken);
  logger.info({
    action: 'test_extract_user_info',
    hasId: !!userInfo.sub,
    hasEmail: !!userInfo.email,
    result: userInfo.sub === mockPayload.oid && userInfo.email === mockPayload.email ? 'PASS' : 'FAIL',
  });

  logger.info({ action: 'test_complete', message: 'All Phase 2 OAuth tests passed!' });
}

testOAuth();
```

---

## Verification Checklist

### Unit Tests
- [x] `microsoftOAuthConfig.scopes` contains `openid`, `email`, `profile`, `offline_access`
- [x] `microsoftOAuthConfig.scopes` does NOT contain `XboxLive.signin`
- [x] `buildAuthorizationUrl()` generates a valid URL with correct parameters
- [x] `generateState()` returns a 64-character hex string
- [x] `exchangeCodeForTokens()` sends correct parameters to Microsoft token endpoint
- [x] `extractUserInfo()` correctly parses ID token JWT payload

### Integration Tests
- [x] `GET /auth/microsoft` redirects to Microsoft with correct scopes
- [x] `GET /auth/microsoft/callback` with valid code creates a new user with `authProvider: 'microsoft'`
- [x] `GET /auth/microsoft/callback` with valid code for existing user logs them in
- [x] Invalid state parameter returns 400 error
- [x] Missing code parameter returns 400 error
- [x] User cancellation (`error` query param) redirects to login with error

### Manual Verification
```bash
# 1. Start the server
cd packages/api && npm run dev

# 2. Open browser and visit:
http://localhost:3001/auth/microsoft

# 3. You should be redirected to Microsoft login
# 4. After consent, you should be redirected back to:
#    - /auth/set-username?userId=xxx (new user)
#    - /dashboard?auth=success (existing user)

# 5. Check database for the new user:
npx prisma studio
```

### Log Verification
Expected log entries:
```
INFO  [auth:microsoft-routes]  action=oauth_initiate provider=microsoft
INFO  [auth:microsoft-service] action=exchange_code_start
INFO  [auth:microsoft-service] action=exchange_code_success duration=XXXms
INFO  [auth:microsoft-service] action=extract_user_info microsoftId=XXXXXXXX...
INFO  [auth:microsoft-routes]  action=oauth_new_user microsoftId=XXXXXXXX...
```

### Deleted Files Verification
- [x] `xbox.service.ts` — deleted
- [x] `minecraft.service.ts` — deleted
- [x] `auth-chain.service.ts` — deleted
- [x] `edition.service.ts` — deleted
- [x] `routes/auth/edition.ts` — deleted

### Actual Files Implemented
- `packages/api/src/config/oauth.ts` — Microsoft OAuth endpoints (/consumers tenant), OpenID Connect scopes, state config
- `packages/api/src/services/auth/microsoft.service.ts` — Build auth URL, exchange code, decode ID token (oid/sub claims), refresh token
- `packages/api/src/routes/auth/microsoft.ts` — `GET /auth/microsoft`, `GET /auth/microsoft/callback` (3-way branch: new user, returning unverified, verified)
- `packages/api/src/routes/auth/username.ts` — `POST /auth/set-username` (pulled forward from Phase 3)
- `packages/api/src/services/auth/state.service.ts` — OAuth CSRF state management
