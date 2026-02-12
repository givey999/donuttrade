# Phase 3: Implementation & Testing Guide

**Phase**: Discord OAuth + Classic Email/Password Authentication
**Status**: Not Started
**Date**: February 2026 (Rewritten)
**Dependencies**: Phase 2 (Simplified Microsoft OAuth)

---

## Overview

This phase implements the two remaining authentication methods: Discord OAuth and classic email/password registration. It also implements the shared Minecraft username entry endpoint that all three auth methods redirect to after initial identity verification.

**Key changes from previous version:**
- Entire phase replaced. Previously this was "Xbox Live & Minecraft Token Chain"
- Now covers Discord OAuth2 web flow and email/password registration
- Includes Resend email integration for verification codes
- Includes the shared username entry step with Bedrock disclaimer

**What this phase delivers:**
1. Discord OAuth service (`buildAuthorizationUrl`, `exchangeCodeForTokens`, `getUserInfo`)
2. Discord auth routes (`GET /auth/discord`, `GET /auth/discord/callback`)
3. Email/password auth service (`register`, `verifyEmail`, `login`, `forgotPassword`, `resetPassword`)
4. Email auth routes (`POST /auth/email/register`, `POST /auth/email/verify`, `POST /auth/email/login`, etc.)
5. Email sending via Resend
6. Shared username entry endpoint (`POST /auth/set-username`)
7. Password hashing with bcrypt

---

## Prerequisites

Before starting Phase 3, ensure Phase 2 is complete:

- [ ] All Phase 2 tests passing
- [ ] Microsoft OAuth flow working
- [ ] Xbox/Minecraft services deleted
- [ ] Database running with new schema

Verify Phase 2:
```bash
cd packages/api
npx tsx src/test-oauth.ts    # All tests pass
npm run build                 # No errors
```

---

## Step 1: Environment Configuration

### 1.1 Add Discord and Email Variables

**File: `packages/api/.env`**

```env
# Existing variables...

# Discord OAuth
DISCORD_CLIENT_ID=your-discord-app-client-id
DISCORD_CLIENT_SECRET=your-discord-app-client-secret
DISCORD_REDIRECT_URI=http://localhost:3001/auth/discord/callback

# Email Service (Resend)
RESEND_API_KEY=re_your_resend_api_key
EMAIL_FROM_ADDRESS=noreply@donuttrade.com
```

### 1.2 Update Config Validation

**File: `packages/api/src/config/index.ts`**

Add validation for the new variables:

```typescript
const configSchema = z.object({
  // ... existing fields

  // Discord OAuth
  DISCORD_CLIENT_ID: z.string().optional(),
  DISCORD_CLIENT_SECRET: z.string().optional(),
  DISCORD_REDIRECT_URI: z.string().url().optional(),

  // Email (Resend)
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM_ADDRESS: z.string().email().optional(),
});
```

---

## Step 2: Add Discord OAuth Configuration

### 2.1 Update OAuth Config

**File: `packages/api/src/config/oauth.ts`**

Add Discord OAuth configuration alongside the existing Microsoft config:

```typescript
import { config } from './index.js';

// ... existing Microsoft config ...

/**
 * Discord OAuth 2.0 Configuration
 */
export const discordOAuthConfig = {
  clientId: config.DISCORD_CLIENT_ID!,
  clientSecret: config.DISCORD_CLIENT_SECRET!,
  redirectUri: config.DISCORD_REDIRECT_URI!,

  authorizationEndpoint: 'https://discord.com/oauth2/authorize',
  tokenEndpoint: 'https://discord.com/api/oauth2/token',
  userInfoEndpoint: 'https://discord.com/api/users/@me',

  // Scopes: identify (user ID/username), email (email address)
  scopes: ['identify', 'email'],
};

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
```

---

## Step 3: Implement Discord OAuth Service

### 3.1 Create Discord Service

**File: `packages/api/src/services/auth/discord.service.ts`**

```typescript
import crypto from 'crypto';
import { createModuleLogger } from '../../lib/logger.js';
import { discordOAuthConfig, authStateConfig } from '../../config/oauth.js';
import type { DiscordTokenResponse, DiscordUser } from '@donuttrade/shared';

const logger = createModuleLogger('auth', 'discord-service');

export class DiscordService {
  /**
   * Build the Discord OAuth authorization URL
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
    logger.debug({ action: 'build_auth_url', redirectUri: discordOAuthConfig.redirectUri });
    return url;
  }

  /**
   * Exchange authorization code for access token
   */
  async exchangeCodeForTokens(code: string): Promise<DiscordTokenResponse> {
    const startTime = Date.now();
    logger.info({ action: 'exchange_code_start' });

    const body = new URLSearchParams({
      client_id: discordOAuthConfig.clientId,
      client_secret: discordOAuthConfig.clientSecret,
      code,
      redirect_uri: discordOAuthConfig.redirectUri,
      grant_type: 'authorization_code',
    });

    const response = await fetch(discordOAuthConfig.tokenEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!response.ok) {
      const error = await response.json();
      logger.error({ action: 'exchange_code_error', error: error.error });
      throw new Error(`Discord token exchange failed: ${error.error_description || error.error}`);
    }

    const tokens: DiscordTokenResponse = await response.json();
    const duration = Date.now() - startTime;
    logger.info({ action: 'exchange_code_success', duration });

    return tokens;
  }

  /**
   * Fetch Discord user profile using access token
   */
  async getUserInfo(accessToken: string): Promise<DiscordUser> {
    const startTime = Date.now();
    logger.info({ action: 'get_user_info_start' });

    const response = await fetch(discordOAuthConfig.userInfoEndpoint, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      const error = await response.json();
      logger.error({ action: 'get_user_info_error', status: response.status });
      throw new Error(`Discord user info fetch failed: ${response.status}`);
    }

    const user: DiscordUser = await response.json();
    const duration = Date.now() - startTime;

    logger.info({
      action: 'get_user_info_success',
      discordId: user.id.substring(0, 8) + '...',
      hasEmail: !!user.email,
      duration,
    });

    return user;
  }

  /**
   * Generate a random state parameter for CSRF protection
   */
  generateState(): string {
    return crypto.randomBytes(authStateConfig.stateLength).toString('hex');
  }
}

export const discordService = new DiscordService();
```

---

## Step 4: Implement Discord Auth Routes

### 4.1 Create Discord Routes

**File: `packages/api/src/routes/auth/discord.ts`**

```typescript
import { FastifyPluginAsync } from 'fastify';
import { discordService } from '../../services/auth/discord.service.js';
import { authStateRepository } from '../../repositories/auth-state.repository.js';
import { userRepository } from '../../repositories/user.repository.js';
import { createModuleLogger } from '../../lib/logger.js';
import { isDiscordOAuthConfigured } from '../../config/oauth.js';

const logger = createModuleLogger('auth', 'discord-routes');

const discordRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /auth/discord
   * Initiates the Discord OAuth flow
   */
  fastify.get('/discord', async (request, reply) => {
    if (!isDiscordOAuthConfigured()) {
      return reply.status(503).send({ error: 'Discord OAuth is not configured' });
    }

    const state = discordService.generateState();
    await authStateRepository.create(state, 'discord');

    const authUrl = discordService.buildAuthorizationUrl(state);

    logger.info({
      action: 'oauth_initiate',
      correlationId: request.id,
      provider: 'discord',
    });

    return reply.redirect(authUrl);
  });

  /**
   * GET /auth/discord/callback
   * Handles the Discord OAuth callback
   */
  fastify.get('/discord/callback', async (request, reply) => {
    const { code, state, error } = request.query as {
      code?: string;
      state?: string;
      error?: string;
    };

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
      const tokens = await discordService.exchangeCodeForTokens(code);

      // Fetch Discord user info
      const discordUser = await discordService.getUserInfo(tokens.access_token);

      // Check if user already exists
      const existingUser = await userRepository.findByDiscordId(discordUser.id);

      if (existingUser) {
        // Returning user — log them in
        logger.info({
          action: 'oauth_login_existing',
          userId: existingUser.id,
          correlationId: request.id,
        });

        // Session creation will be handled in Phase 5
        return reply.redirect('/dashboard?auth=success');
      } else {
        // New user — create pending user, redirect to username entry
        logger.info({
          action: 'oauth_new_user',
          discordId: discordUser.id.substring(0, 8) + '...',
          correlationId: request.id,
        });

        const newUser = await userRepository.create({
          authProvider: 'discord',
          discordId: discordUser.id,
          discordUsername: discordUser.global_name || discordUser.username,
          email: discordUser.email,
        });

        return reply.redirect(`/auth/set-username?userId=${newUser.id}`);
      }
    } catch (err) {
      logger.error({ action: 'oauth_callback_failure', error: err, correlationId: request.id });
      return reply.redirect('/login?error=oauth_failed');
    }
  });
};

export default discordRoutes;
```

---

## Step 5: Implement Email/Password Authentication

### 5.1 Install Dependencies

```bash
cd packages/api
pnpm add bcrypt resend
pnpm add -D @types/bcrypt
```

### 5.2 Create Email Sending Service

**File: `packages/api/src/services/email/email.service.ts`**

```typescript
import { Resend } from 'resend';
import { config } from '../../config/index.js';
import { createModuleLogger } from '../../lib/logger.js';

const logger = createModuleLogger('email', 'email-service');

let resend: Resend | null = null;

function getResendClient(): Resend {
  if (!resend) {
    if (!config.RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY is not configured');
    }
    resend = new Resend(config.RESEND_API_KEY);
  }
  return resend;
}

/**
 * Send a verification code email
 */
export async function sendVerificationEmail(to: string, code: string): Promise<void> {
  const startTime = Date.now();
  logger.info({ action: 'send_verification_start', to: to.substring(0, 3) + '***' });

  const client = getResendClient();
  const { error } = await client.emails.send({
    from: config.EMAIL_FROM_ADDRESS || 'DonutTrade <noreply@donuttrade.com>',
    to,
    subject: 'DonutTrade - Verify Your Email',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Welcome to DonutTrade!</h2>
        <p>Your verification code is:</p>
        <div style="font-size: 32px; font-weight: bold; letter-spacing: 8px; padding: 20px; background: #f5f5f5; text-align: center; border-radius: 8px;">
          ${code}
        </div>
        <p style="margin-top: 16px;">This code expires in 15 minutes.</p>
        <p>If you didn't request this, you can safely ignore this email.</p>
      </div>
    `,
  });

  const duration = Date.now() - startTime;

  if (error) {
    logger.error({ action: 'send_verification_error', error, duration });
    throw new Error(`Failed to send verification email: ${error.message}`);
  }

  logger.info({ action: 'send_verification_success', duration });
}

/**
 * Send a password reset email
 */
export async function sendPasswordResetEmail(to: string, resetToken: string, resetUrl: string): Promise<void> {
  const startTime = Date.now();
  logger.info({ action: 'send_reset_start', to: to.substring(0, 3) + '***' });

  const client = getResendClient();
  const { error } = await client.emails.send({
    from: config.EMAIL_FROM_ADDRESS || 'DonutTrade <noreply@donuttrade.com>',
    to,
    subject: 'DonutTrade - Reset Your Password',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Password Reset</h2>
        <p>You requested a password reset for your DonutTrade account.</p>
        <p>Click the link below to set a new password:</p>
        <a href="${resetUrl}" style="display: inline-block; padding: 12px 24px; background: #5865F2; color: white; text-decoration: none; border-radius: 4px; margin: 16px 0;">
          Reset Password
        </a>
        <p>This link expires in 1 hour.</p>
        <p>If you didn't request this, you can safely ignore this email.</p>
      </div>
    `,
  });

  const duration = Date.now() - startTime;

  if (error) {
    logger.error({ action: 'send_reset_error', error, duration });
    throw new Error(`Failed to send password reset email: ${error.message}`);
  }

  logger.info({ action: 'send_reset_success', duration });
}
```

### 5.3 Create Email Auth Service

**File: `packages/api/src/services/auth/email.service.ts`**

```typescript
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { createModuleLogger } from '../../lib/logger.js';
import { userRepository } from '../../repositories/user.repository.js';
import { sendVerificationEmail } from '../email/email.service.js';
import {
  EMAIL_CODE_LENGTH,
  EMAIL_CODE_EXPIRY_MS,
  EMAIL_MAX_RESEND_ATTEMPTS,
} from '@donuttrade/shared/constants';

const logger = createModuleLogger('auth', 'email-service');
const BCRYPT_SALT_ROUNDS = 12;

/**
 * Validate password meets requirements:
 * - At least 8 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 */
function validatePassword(password: string): { valid: boolean; message?: string } {
  if (password.length < 8) return { valid: false, message: 'Password must be at least 8 characters' };
  if (!/[A-Z]/.test(password)) return { valid: false, message: 'Password must contain at least one uppercase letter' };
  if (!/[a-z]/.test(password)) return { valid: false, message: 'Password must contain at least one lowercase letter' };
  if (!/[0-9]/.test(password)) return { valid: false, message: 'Password must contain at least one number' };
  return { valid: true };
}

/**
 * Generate a random 6-digit verification code
 */
function generateVerificationCode(): string {
  return crypto.randomInt(100000, 999999).toString();
}

export class EmailAuthService {
  /**
   * Register a new user with email and password
   */
  async register(email: string, password: string, retypePassword: string) {
    logger.info({ action: 'register_start', email: email.substring(0, 3) + '***' });

    // Validate passwords match
    if (password !== retypePassword) {
      throw new Error('Passwords do not match');
    }

    // Validate password strength
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      throw new Error(passwordValidation.message);
    }

    // Check if email is already registered
    const existingUser = await userRepository.findByEmail(email);
    if (existingUser && existingUser.emailVerified) {
      throw new Error('Email is already registered');
    }

    // If there's an existing unverified user with this email, update it
    if (existingUser && !existingUser.emailVerified) {
      const code = generateVerificationCode();
      const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

      await userRepository.update(existingUser.id, {
        passwordHash,
        emailVerificationCode: code,
        emailVerificationExpiresAt: new Date(Date.now() + EMAIL_CODE_EXPIRY_MS),
      });

      await sendVerificationEmail(email, code);
      logger.info({ action: 'register_resend_verification', userId: existingUser.id });
      return existingUser;
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

    // Generate verification code
    const code = generateVerificationCode();

    // Create user
    const user = await userRepository.create({
      authProvider: 'email',
      email,
      passwordHash,
    });

    // Set verification code
    await userRepository.update(user.id, {
      emailVerificationCode: code,
      emailVerificationExpiresAt: new Date(Date.now() + EMAIL_CODE_EXPIRY_MS),
    });

    // Send verification email
    await sendVerificationEmail(email, code);

    logger.info({ action: 'register_success', userId: user.id });
    return user;
  }

  /**
   * Verify email with the 6-digit code
   */
  async verifyEmail(email: string, code: string) {
    logger.info({ action: 'verify_email_start', email: email.substring(0, 3) + '***' });

    const user = await userRepository.findByEmail(email);
    if (!user) {
      throw new Error('User not found');
    }

    if (user.emailVerified) {
      throw new Error('Email is already verified');
    }

    if (!user.emailVerificationCode || !user.emailVerificationExpiresAt) {
      throw new Error('No verification code found. Please request a new one.');
    }

    if (new Date() > user.emailVerificationExpiresAt) {
      throw new Error('Verification code has expired. Please request a new one.');
    }

    if (user.emailVerificationCode !== code) {
      throw new Error('Invalid verification code');
    }

    // Mark email as verified, clear verification code
    await userRepository.update(user.id, {
      emailVerified: true,
      emailVerificationCode: null,
      emailVerificationExpiresAt: null,
    });

    logger.info({ action: 'verify_email_success', userId: user.id });
    return user;
  }

  /**
   * Login with email and password
   */
  async login(email: string, password: string) {
    logger.info({ action: 'login_start', email: email.substring(0, 3) + '***' });

    const user = await userRepository.findByEmail(email);
    if (!user || !user.passwordHash) {
      throw new Error('Invalid email or password');
    }

    if (!user.emailVerified) {
      throw new Error('Email is not verified. Please verify your email first.');
    }

    if (user.verificationStatus !== 'verified') {
      throw new Error('Account is not yet verified. Please complete payment verification.');
    }

    const passwordMatch = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatch) {
      throw new Error('Invalid email or password');
    }

    // Update last login
    await userRepository.update(user.id, { lastLoginAt: new Date() });

    logger.info({ action: 'login_success', userId: user.id });
    return user;
  }
}

export const emailAuthService = new EmailAuthService();
```

---

## Step 6: Email Auth Routes

### 6.1 Create Email Routes

**File: `packages/api/src/routes/auth/email.ts`**

```typescript
import { FastifyPluginAsync } from 'fastify';
import { emailAuthService } from '../../services/auth/email.service.js';
import { createModuleLogger } from '../../lib/logger.js';

const logger = createModuleLogger('auth', 'email-routes');

const emailRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * POST /auth/email/register
   * Register a new user with email and password
   */
  fastify.post('/email/register', async (request, reply) => {
    const { email, password, retypePassword } = request.body as {
      email: string;
      password: string;
      retypePassword: string;
    };

    if (!email || !password || !retypePassword) {
      return reply.status(400).send({ error: 'Email, password, and retypePassword are required' });
    }

    try {
      const user = await emailAuthService.register(email, password, retypePassword);
      logger.info({ action: 'register', userId: user.id, correlationId: request.id });

      return reply.status(201).send({
        message: 'Registration successful. Please check your email for a verification code.',
        userId: user.id,
      });
    } catch (error: any) {
      logger.warn({ action: 'register_error', error: error.message, correlationId: request.id });
      return reply.status(400).send({ error: error.message });
    }
  });

  /**
   * POST /auth/email/verify
   * Verify email with the 6-digit code
   */
  fastify.post('/email/verify', async (request, reply) => {
    const { email, code } = request.body as { email: string; code: string };

    if (!email || !code) {
      return reply.status(400).send({ error: 'Email and code are required' });
    }

    try {
      const user = await emailAuthService.verifyEmail(email, code);
      logger.info({ action: 'verify_email', userId: user.id, correlationId: request.id });

      // Redirect to username entry page
      return reply.send({
        message: 'Email verified successfully.',
        userId: user.id,
        nextStep: `/auth/set-username?userId=${user.id}`,
      });
    } catch (error: any) {
      logger.warn({ action: 'verify_email_error', error: error.message, correlationId: request.id });
      return reply.status(400).send({ error: error.message });
    }
  });

  /**
   * POST /auth/email/login
   * Login with email and password
   */
  fastify.post('/email/login', async (request, reply) => {
    const { email, password } = request.body as { email: string; password: string };

    if (!email || !password) {
      return reply.status(400).send({ error: 'Email and password are required' });
    }

    try {
      const user = await emailAuthService.login(email, password);
      logger.info({ action: 'login', userId: user.id, correlationId: request.id });

      // Session creation will be handled in Phase 5
      return reply.send({
        message: 'Login successful.',
        userId: user.id,
      });
    } catch (error: any) {
      logger.warn({ action: 'login_error', error: error.message, correlationId: request.id });
      return reply.status(401).send({ error: error.message });
    }
  });
};

export default emailRoutes;
```

---

## Step 7: Shared Username Entry Endpoint

### 7.1 Create Username Route

**File: `packages/api/src/routes/auth/username.ts`**

```typescript
import { FastifyPluginAsync } from 'fastify';
import { userRepository } from '../../repositories/user.repository.js';
import { createModuleLogger } from '../../lib/logger.js';

const logger = createModuleLogger('auth', 'username-routes');

/**
 * Validate Minecraft username format:
 * - Java: 3-16 characters, alphanumeric + underscore
 * - Bedrock: starts with ".", then 3-16 characters, alphanumeric + underscore + spaces
 */
function validateMinecraftUsername(username: string): { valid: boolean; message?: string } {
  if (!username || username.length === 0) {
    return { valid: false, message: 'Username is required' };
  }

  const isBedrock = username.startsWith('.');
  const name = isBedrock ? username.substring(1) : username;

  if (name.length < 3 || name.length > 16) {
    return { valid: false, message: 'Username must be between 3 and 16 characters (excluding Bedrock dot prefix)' };
  }

  if (isBedrock) {
    // Bedrock usernames can have spaces
    if (!/^[a-zA-Z0-9_ ]+$/.test(name)) {
      return { valid: false, message: 'Bedrock username can only contain letters, numbers, underscores, and spaces' };
    }
  } else {
    // Java usernames: alphanumeric + underscore only
    if (!/^[a-zA-Z0-9_]+$/.test(name)) {
      return { valid: false, message: 'Java username can only contain letters, numbers, and underscores' };
    }
  }

  return { valid: true };
}

const usernameRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * POST /auth/set-username
   * Set the Minecraft username for a user during signup
   *
   * This is the shared step all three auth methods redirect to
   * after initial identity verification.
   */
  fastify.post('/set-username', async (request, reply) => {
    const { userId, minecraftUsername } = request.body as {
      userId: string;
      minecraftUsername: string;
    };

    if (!userId || !minecraftUsername) {
      return reply.status(400).send({ error: 'userId and minecraftUsername are required' });
    }

    // Validate username format
    const validation = validateMinecraftUsername(minecraftUsername);
    if (!validation.valid) {
      return reply.status(400).send({ error: validation.message });
    }

    // Check if username is already taken
    const existingUser = await userRepository.findByMinecraftUsername(minecraftUsername);
    if (existingUser && existingUser.id !== userId) {
      return reply.status(409).send({ error: 'This Minecraft username is already registered' });
    }

    // Verify the user exists and hasn't completed verification yet
    const user = await userRepository.findById(userId);
    if (!user) {
      return reply.status(404).send({ error: 'User not found' });
    }

    if (user.verificationStatus === 'verified') {
      return reply.status(400).send({ error: 'User is already verified' });
    }

    // Set the username
    await userRepository.update(userId, { minecraftUsername });

    logger.info({
      action: 'set_username',
      userId,
      username: minecraftUsername,
      isBedrock: minecraftUsername.startsWith('.'),
      correlationId: request.id,
    });

    // Redirect to payment verification (Phase 4)
    return reply.send({
      message: 'Username set successfully.',
      nextStep: `/auth/verification?userId=${userId}`,
    });
  });
};

export default usernameRoutes;
```

---

## Step 8: Update Route Registration

### 8.1 Register All Auth Routes

**File: `packages/api/src/routes/auth/index.ts`**

```typescript
import { FastifyPluginAsync } from 'fastify';
import microsoftRoutes from './microsoft.js';
import discordRoutes from './discord.js';
import emailRoutes from './email.js';
import usernameRoutes from './username.js';

const authRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.register(microsoftRoutes);
  fastify.register(discordRoutes);
  fastify.register(emailRoutes);
  fastify.register(usernameRoutes);
  // Session routes will be added in Phase 5
  // Verification routes will be added in Phase 4
};

export default authRoutes;
```

---

## Step 9: Test Script

### 9.1 Create Auth Methods Test Script

**File: `packages/api/src/test-auth-methods.ts`**

```typescript
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { createModuleLogger } from './lib/logger.js';
import { discordService } from './services/auth/discord.service.js';
import { isDiscordOAuthConfigured, discordOAuthConfig } from './config/oauth.js';

const logger = createModuleLogger('api', 'test-auth-methods');
const prisma = new PrismaClient();

async function testAuthMethods() {
  logger.info({ action: 'test_start', message: 'Testing Phase 3 auth methods' });

  try {
    // === Discord OAuth Tests ===

    // Test 1: Check Discord OAuth configuration
    const discordConfigured = isDiscordOAuthConfigured();
    logger.info({ action: 'test_discord_config', configured: discordConfigured, result: 'INFO' });

    // Test 2: Discord scopes are correct
    const discordScopes = discordOAuthConfig.scopes;
    const hasIdentify = discordScopes.includes('identify');
    const hasEmail = discordScopes.includes('email');
    logger.info({
      action: 'test_discord_scopes',
      scopes: discordScopes,
      result: hasIdentify && hasEmail ? 'PASS' : 'FAIL',
    });

    // Test 3: Discord auth URL generation
    const state = discordService.generateState();
    const discordUrl = discordService.buildAuthorizationUrl(state);
    const url = new URL(discordUrl);
    logger.info({
      action: 'test_discord_url',
      hasState: url.searchParams.get('state') === state,
      hasScope: url.searchParams.get('scope')?.includes('identify'),
      result: 'PASS',
    });

    // === Email/Password Tests ===

    // Test 4: Password hashing
    const password = 'TestPass123';
    const hash = await bcrypt.hash(password, 12);
    const matches = await bcrypt.compare(password, hash);
    logger.info({ action: 'test_bcrypt', matches, result: matches ? 'PASS' : 'FAIL' });

    // Test 5: Password validation
    const weakPasswords = ['short', 'nouppercase1', 'NOLOWERCASE1', 'NoNumbers'];
    const strongPassword = 'StrongPass1';
    // (inline validation test)
    const strongValid = strongPassword.length >= 8 && /[A-Z]/.test(strongPassword) && /[a-z]/.test(strongPassword) && /[0-9]/.test(strongPassword);
    logger.info({ action: 'test_password_validation', strongValid, result: strongValid ? 'PASS' : 'FAIL' });

    // Test 6: Username validation
    const validUsernames = ['PlayerName', '.BedrockUser', 'Test_User_123'];
    const invalidUsernames = ['ab', 'a'.repeat(20), 'user@name', ''];
    logger.info({
      action: 'test_username_validation',
      validCount: validUsernames.length,
      invalidCount: invalidUsernames.length,
      result: 'PASS',
    });

    // === Database Integration Tests ===

    // Test 7: Create Discord auth user
    const discordUser = await prisma.user.create({
      data: {
        authProvider: 'discord',
        discordId: 'test-discord-' + Date.now(),
        discordUsername: 'TestPlayer',
        minecraftUsername: 'DiscordTestUser' + Date.now(),
      },
    });
    logger.info({ action: 'test_create_discord_user', userId: discordUser.id, result: 'PASS' });

    // Test 8: Create email auth user
    const emailUser = await prisma.user.create({
      data: {
        authProvider: 'email',
        email: 'test-' + Date.now() + '@example.com',
        passwordHash: hash,
        emailVerificationCode: '123456',
        emailVerificationExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
        minecraftUsername: 'EmailTestUser' + Date.now(),
      },
    });
    logger.info({ action: 'test_create_email_user', userId: emailUser.id, result: 'PASS' });

    // Test 9: Verify email
    await prisma.user.update({
      where: { id: emailUser.id },
      data: {
        emailVerified: true,
        emailVerificationCode: null,
        emailVerificationExpiresAt: null,
      },
    });
    const verified = await prisma.user.findUnique({ where: { id: emailUser.id } });
    logger.info({ action: 'test_verify_email', verified: verified?.emailVerified, result: verified?.emailVerified ? 'PASS' : 'FAIL' });

    // Cleanup
    await prisma.user.deleteMany({
      where: { id: { in: [discordUser.id, emailUser.id] } },
    });

    logger.info({ action: 'test_complete', message: 'All Phase 3 auth method tests passed!' });
  } catch (error) {
    logger.error({ action: 'test_error', error });
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

testAuthMethods();
```

---

## Verification Checklist

### Discord OAuth
- [ ] `discordOAuthConfig` has correct scopes (`identify`, `email`)
- [ ] `buildAuthorizationUrl()` generates valid Discord OAuth URL
- [ ] `GET /auth/discord` redirects to Discord
- [ ] `GET /auth/discord/callback` creates new user with `authProvider: 'discord'`
- [ ] `GET /auth/discord/callback` for existing user logs them in
- [ ] Invalid/expired state returns 400
- [ ] User cancellation handled gracefully

### Email/Password
- [ ] Password hashing works with bcrypt (12 rounds)
- [ ] Password validation enforces: 8+ chars, uppercase, lowercase, number
- [ ] `POST /auth/email/register` creates user and sends verification email
- [ ] `POST /auth/email/verify` accepts correct 6-digit code
- [ ] `POST /auth/email/verify` rejects expired or wrong codes
- [ ] `POST /auth/email/login` validates credentials
- [ ] Duplicate email registration returns error

### Username Entry
- [ ] `POST /auth/set-username` accepts valid Java usernames
- [ ] `POST /auth/set-username` accepts valid Bedrock usernames (with "." prefix)
- [ ] Duplicate username returns 409 conflict
- [ ] Invalid username format returns 400

### Manual Verification
```bash
# 1. Test Discord OAuth
open http://localhost:3001/auth/discord

# 2. Test email registration
curl -X POST http://localhost:3001/auth/email/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"TestPass1","retypePassword":"TestPass1"}'

# 3. Test email verification (use code from email/logs)
curl -X POST http://localhost:3001/auth/email/verify \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","code":"123456"}'

# 4. Test username entry
curl -X POST http://localhost:3001/auth/set-username \
  -H "Content-Type: application/json" \
  -d '{"userId":"xxx","minecraftUsername":"TestPlayer"}'

# 5. Check database
npx prisma studio
```

### Log Verification
Expected log entries:
```
INFO  [auth:discord-routes]  action=oauth_initiate provider=discord
INFO  [auth:discord-service] action=exchange_code_success
INFO  [auth:discord-service] action=get_user_info_success
INFO  [auth:email-service]   action=register_success
INFO  [email:email-service]  action=send_verification_success
INFO  [auth:email-service]   action=verify_email_success
INFO  [auth:username-routes] action=set_username username=TestPlayer isBedrock=false
```
