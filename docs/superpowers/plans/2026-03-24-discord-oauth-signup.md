# Discord OAuth2 Sign-Up Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add "Sign in with Discord" as a second authentication method alongside Microsoft OAuth2.

**Architecture:** Mirrors the existing Microsoft OAuth2 flow exactly — same CSRF state protection, same three-branch callback (new user → username setup, returning unverified → resume setup, returning verified → dashboard), same JWT session creation. Discord provides the user's ID, username, and email via `/users/@me` (no ID token decoding needed — simpler than Microsoft).

**Tech Stack:** discord.js OAuth2 (raw HTTP, no library needed), Fastify routes, Next.js frontend

---

## What Already Exists

These are already implemented and DO NOT need to be created:

- **Shared types:** `DiscordTokenResponse`, `DiscordUser`, `DiscordOAuthError` in `packages/shared/src/types/auth.ts`
- **Config validation:** `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `DISCORD_REDIRECT_URI` in `packages/api/src/config/index.ts` (Zod schema, optional strings)
- **Config check:** `isDiscordOAuthConfigured()` in `packages/api/src/config/oauth.ts`
- **User repository:** `userRepository.findByDiscordId()` in `packages/api/src/repositories/user.repository.ts`
- **User model fields:** `discordId` (unique, nullable) and `discordUsername` on the User model in Prisma schema
- **Auth state service:** `authStateService.createState('discord', redirect)` works for any auth method
- **Login page placeholder:** Disabled "Discord (coming soon)" button in `packages/web/app/(app)/login/page.tsx`
- **Auth provider type:** `'discord'` is already a valid `AuthProvider` value in shared types

## File Structure

| Action | File | Responsibility |
|--------|------|---------------|
| Create | `packages/api/src/services/auth/discord.service.ts` | Token exchange + user profile fetch |
| Create | `packages/api/src/routes/auth/discord.ts` | OAuth initiate + callback endpoints |
| Create | `packages/web/components/icons/discord.tsx` | Discord SVG icon component |
| Modify | `packages/api/src/config/oauth.ts` | Add `discordOAuthConfig` object |
| Modify | `packages/api/src/routes/auth/index.ts` | Register discord auth routes |
| Modify | `packages/web/app/(app)/login/page.tsx` | Enable Discord login button |

---

## Task 1: Discord OAuth Config

**Files:**
- Modify: `packages/api/src/config/oauth.ts`

- [ ] **Step 1: Add Discord OAuth config object**

Add after `microsoftOAuthConfig`:

```typescript
// Note: non-null assertions are safe because the route guards on isDiscordOAuthConfigured()
// before any service method is called — same pattern as microsoftOAuthConfig.
export const discordOAuthConfig = {
  clientId: config.DISCORD_CLIENT_ID!,
  clientSecret: config.DISCORD_CLIENT_SECRET!,
  redirectUri: config.DISCORD_REDIRECT_URI!,

  authorizationEndpoint: 'https://discord.com/oauth2/authorize',
  tokenEndpoint: 'https://discord.com/api/oauth2/token',
  userInfoEndpoint: 'https://discord.com/api/users/@me',

  scopes: ['identify', 'email'],
};
```

- [ ] **Step 2: Commit**

```bash
git add packages/api/src/config/oauth.ts
git commit -m "feat: add Discord OAuth config"
```

---

## Task 2: Discord OAuth Service

**Files:**
- Create: `packages/api/src/services/auth/discord.service.ts`

- [ ] **Step 1: Create the Discord OAuth service**

This mirrors `microsoft.service.ts` but is simpler — Discord uses a standard `/users/@me` endpoint instead of ID token decoding.

```typescript
import { discordOAuthConfig } from '../../config/oauth.js';
import { logger } from '../../lib/logger.js';
import type { DiscordTokenResponse, DiscordUser, DiscordOAuthError } from '@donuttrade/shared';

const discordLogger = logger.module('auth.discord');

export class DiscordOAuthException extends Error {
  constructor(
    public readonly errorCode: string,
    public readonly errorDescription: string,
    public readonly statusCode: number,
  ) {
    super(`Discord OAuth error: ${errorCode} - ${errorDescription}`);
    this.name = 'DiscordOAuthException';
  }
}

export interface DiscordTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt: Date;
  scope: string;
}

export const discordService = {
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

    const response = await fetch(discordOAuthConfig.tokenEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
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
        errorData.error_description || 'Token exchange failed',
        response.status,
      );
    }

    const data = await response.json() as DiscordTokenResponse;

    discordLogger.info('exchangeCodeForTokens.success', 'Token exchange successful', {
      scope: data.scope,
      expiresIn: data.expires_in,
      duration,
    });

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
      scope: data.scope,
    };
  },

  async fetchUserProfile(accessToken: string): Promise<DiscordUser> {
    const startTime = Date.now();
    discordLogger.info('fetchUserProfile.start', 'Fetching Discord user profile');

    const response = await fetch(discordOAuthConfig.userInfoEndpoint, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const duration = Date.now() - startTime;

    if (!response.ok) {
      discordLogger.error('fetchUserProfile.failed', 'User profile fetch failed', undefined, {
        status: response.status,
        duration,
      });
      throw new DiscordOAuthException('profile_error', 'Failed to fetch user profile', response.status);
    }

    const user = await response.json() as DiscordUser;

    discordLogger.info('fetchUserProfile.success', 'User profile fetched', {
      discordIdPrefix: user.id.substring(0, 8) + '...',
      hasEmail: !!user.email,
      duration,
    });

    return user;
  },
};

```

- [ ] **Step 2: Commit**

```bash
git add packages/api/src/services/auth/discord.service.ts
git commit -m "feat: add Discord OAuth service"
```

---

## Task 3: Discord Auth Route

**Files:**
- Create: `packages/api/src/routes/auth/discord.ts`
- Modify: `packages/api/src/routes/auth/index.ts`

- [ ] **Step 1: Create the Discord auth route**

Mirrors `microsoft.ts` exactly. Three branches: returning verified → session, returning unverified → resume setup, new user → username setup.

```typescript
import { FastifyPluginAsync } from 'fastify';
import { authStateService } from '../../services/auth/state.service.js';
import { discordService, DiscordOAuthException } from '../../services/auth/discord.service.js';
import { sessionService } from '../../services/auth/session.service.js';
import { isDiscordOAuthConfigured } from '../../config/oauth.js';
import { logger } from '../../lib/logger.js';
import { InternalError } from '../../lib/errors.js';
import { config, isDevelopment } from '../../config/index.js';
import { signPendingToken } from '../../lib/jwt.js';
import { userRepository } from '../../repositories/user.repository.js';
import { Cookies } from '@donuttrade/shared';

const authLogger = logger.module('auth.routes');

export const discordAuthRoutes: FastifyPluginAsync = async (fastify) => {
  if (!isDiscordOAuthConfigured()) {
    authLogger.warn('oauth.notConfigured', 'Discord OAuth is not configured. Auth routes will return 503.');
  }

  // GET /auth/discord — Initiate Discord OAuth
  fastify.get<{
    Querystring: { redirect?: string };
  }>('/discord', {
    config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    if (!isDiscordOAuthConfigured()) {
      throw new InternalError('Discord OAuth is not configured');
    }

    const { redirect } = request.query;

    authLogger.info('oauth.initiate', 'Initiating Discord OAuth', {
      redirectUrl: redirect,
      ip: request.ip,
    });

    const state = await authStateService.createState('discord', redirect);
    const authUrl = discordService.buildAuthorizationUrl(state);
    return reply.redirect(authUrl);
  });

  // GET /auth/discord/callback — Handle OAuth callback
  fastify.get<{
    Querystring: {
      code?: string;
      state?: string;
      error?: string;
      error_description?: string;
    };
  }>('/discord/callback', {
    config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    const { code, state, error, error_description } = request.query;

    const frontendUrl = config.CORS_ORIGIN;
    const callbackPath = '/auth/callback';

    if (error) {
      authLogger.warn('oauth.callback.error', 'Discord returned error', { error, errorDescription: error_description });
      const errorMsg = encodeURIComponent(error_description || error);
      return reply.redirect(`${frontendUrl}${callbackPath}?error=${errorMsg}`);
    }

    if (!code || !state) {
      authLogger.warn('oauth.callback.missing', 'Missing code or state', { hasCode: !!code, hasState: !!state });
      return reply.redirect(`${frontendUrl}${callbackPath}?error=${encodeURIComponent('Missing authorization code or state parameter')}`);
    }

    const stateResult = await authStateService.validateAndConsume(state);
    if (!stateResult.valid || stateResult.authMethod !== 'discord') {
      authLogger.warn('oauth.callback.invalidState', 'Invalid or expired state');
      return reply.redirect(`${frontendUrl}${callbackPath}?error=${encodeURIComponent('Invalid or expired state. Please try logging in again.')}`);
    }

    const cookieOptions = {
      httpOnly: true,
      secure: !isDevelopment,
      sameSite: 'lax' as const,
      path: '/',
    };

    try {
      const tokens = await discordService.exchangeCodeForTokens(code);
      const discordUser = await discordService.fetchUserProfile(tokens.accessToken);

      let user = await userRepository.findByDiscordId(discordUser.id);

      if (user) {
        // Update Discord username in case it changed
        if (user.discordUsername !== discordUser.username) {
          await userRepository.update(user.id, { discordUsername: discordUser.username });
        }

        // Branch A: Returning verified user
        if (user.verificationStatus === 'verified') {
          await userRepository.updateLastLogin(user.id);

          const sessionTokens = await sessionService.createSession(
            user.id,
            request.headers['user-agent'],
            request.ip,
          );

          reply.setCookie(Cookies.REFRESH_TOKEN, sessionTokens.refreshToken, {
            ...cookieOptions,
            maxAge: 30 * 24 * 60 * 60,
          });

          authLogger.info('oauth.callback.returningUser', 'Returning verified Discord user logged in', { userId: user.id });
          return reply.redirect(`${frontendUrl}${callbackPath}?success=true#token=${sessionTokens.accessToken}`);
        }

        // Branch B: Returning user in setup
        const pendingToken = signPendingToken(user.id);
        reply.setCookie(Cookies.PENDING_TOKEN, pendingToken, { ...cookieOptions, maxAge: 30 * 60 });

        if (!user.minecraftUsername) {
          authLogger.info('oauth.callback.setupUsername', 'Returning Discord user needs username', { userId: user.id });
          return reply.redirect(`${frontendUrl}/signup/username`);
        }

        authLogger.info('oauth.callback.setupVerify', 'Returning Discord user needs verification', { userId: user.id });
        return reply.redirect(`${frontendUrl}/verify`);
      }

      // Branch C: New user
      user = await userRepository.create({
        authProvider: 'discord',
        discordId: discordUser.id,
        discordUsername: discordUser.username,
        email: discordUser.email || null,
      });

      const pendingToken = signPendingToken(user.id);
      reply.setCookie(Cookies.PENDING_TOKEN, pendingToken, { ...cookieOptions, maxAge: 30 * 60 });

      authLogger.info('oauth.callback.newUser', 'New Discord user created', { userId: user.id });
      return reply.redirect(`${frontendUrl}/signup/username`);
    } catch (err) {
      if (err instanceof DiscordOAuthException) {
        authLogger.error('oauth.callback.tokenError', 'Discord token exchange failed', err, { errorCode: err.errorCode });
        return reply.redirect(`${frontendUrl}${callbackPath}?error=${encodeURIComponent('Authentication failed. Please try again.')}`);
      }
      authLogger.error('oauth.callback.unexpected', 'Unexpected error during Discord callback', err as Error);
      return reply.redirect(`${frontendUrl}${callbackPath}?error=${encodeURIComponent('An unexpected error occurred. Please try again.')}`);
    }
  });
};
```

- [ ] **Step 2: Register the route in auth index**

In `packages/api/src/routes/auth/index.ts`, add:

```typescript
import { discordAuthRoutes } from './discord.js';
```

And inside the function:

```typescript
await fastify.register(discordAuthRoutes);
```

- [ ] **Step 3: Commit**

```bash
git add packages/api/src/routes/auth/discord.ts packages/api/src/routes/auth/index.ts
git commit -m "feat: add Discord OAuth auth route"
```

---

## Task 4: Discord Icon + Login Button

**Files:**
- Create: `packages/web/components/icons/discord.tsx`
- Modify: `packages/web/app/(app)/login/page.tsx`

- [ ] **Step 1: Create Discord icon component**

Check `packages/web/components/icons/microsoft.tsx` for the pattern, then create an equivalent Discord icon:

```tsx
export function DiscordIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z" />
    </svg>
  );
}
```

- [ ] **Step 2: Enable the Discord login button**

In `packages/web/app/(app)/login/page.tsx`:

1. Import `DiscordIcon` and `LoginButton` (LoginButton is already imported)
2. Replace the disabled Discord button with an active `LoginButton`:

```tsx
<LoginButton
  href={`${API_URL}/auth/discord?redirect=${encodeURIComponent('/auth/callback')}`}
  icon={<DiscordIcon />}
  label="Sign in with Discord"
  className="border border-[#5865F2] bg-[#5865F2] text-white font-semibold hover:bg-[#4752C4]"
/>
```

3. Update the divider text from "more coming soon" to "or" since Discord is now active. Keep the email button as disabled/coming soon.

- [ ] **Step 3: Commit**

```bash
git add packages/web/components/icons/discord.tsx "packages/web/app/(app)/login/page.tsx"
git commit -m "feat: enable Discord sign-in button on login page"
```

---

## Task 5: Set Up Discord OAuth Credentials

**Files:**
- Modify: `R:/miau/.env`

- [ ] **Step 1: Get Discord OAuth2 credentials**

In the Discord Developer Portal (same app used for the management bot):
1. Go to **OAuth2** settings
2. Copy the **Client ID** and **Client Secret**
3. Add redirect URI: `https://moldo.go.ro:9443/auth/discord/callback`

- [ ] **Step 2: Fill in env vars**

```
DISCORD_CLIENT_ID=<from developer portal>
DISCORD_CLIENT_SECRET=<from developer portal>
DISCORD_REDIRECT_URI=https://moldo.go.ro:9443/auth/discord/callback
```

Note: The `DISCORD_CLIENT_ID` may be the same as the bot's application ID since it's the same Discord application.

- [ ] **Step 3: Rebuild and test**

```bash
docker compose up -d --build api web
```

---

## Task 6: End-to-End Test

- [ ] **Step 1: Test new user sign-up via Discord**
  - Go to `https://moldo.go.ro:9443/login`
  - Click "Sign in with Discord"
  - Authorize the application on Discord
  - Should redirect to `/signup/username`
  - Enter a Minecraft username
  - Should redirect to `/verify` for payment verification

- [ ] **Step 2: Test returning verified user login**
  - After completing verification, log out
  - Click "Sign in with Discord" again
  - Should go straight to the dashboard

- [ ] **Step 3: Test error handling**
  - Click "Sign in with Discord", then deny the authorization on Discord
  - Should redirect to `/auth/callback` with an error message

- [ ] **Step 4: Verify database**
  - Check the user record has `authProvider: 'discord'`, `discordId`, and `discordUsername` populated

- [ ] **Step 5: Final commit if any fixes needed**
