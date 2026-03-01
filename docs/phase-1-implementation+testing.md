# Phase 1: Implementation & Testing Guide

**Phase**: Database Schema & User Model
**Status**: ✅ Completed
**Date**: February 2026 (Rewritten) | **Completed**: February 2026
**Dependencies**: Phase 0 (Project Foundation & Logging Infrastructure)

> **Implementation Note:** All items in this phase have been implemented. The Prisma schema, repositories, shared types, and constants are in place. See the actual files referenced below.

---

## Overview

This phase implements the core database schema for users, sessions, and authentication state. It establishes the foundation for a multi-method authentication system (Microsoft OAuth, Discord OAuth, Email+Password) with in-game payment verification.

**Key changes from previous version:**
- Removed all Xbox/XSTS/Minecraft API fields
- Added Discord identity fields
- Added email/password authentication fields
- Added payment verification fields
- Removed dual-edition tracking (edition is derived from "." prefix on username)
- `microsoftId` is now optional (not all users sign up via Microsoft)

---

## Prerequisites

Before starting Phase 1, ensure Phase 0 is complete:

- [x] Docker Compose running (PostgreSQL + Redis)
- [x] `npm run build` succeeds in `packages/api`
- [x] `npx tsc --noEmit` passes without errors
- [x] Health endpoints responding correctly
- [x] Logging working with correlation IDs

Verify Phase 0:
```bash
# From project root
docker compose ps                    # Containers healthy
cd packages/api && npm run build     # Build succeeds
curl http://localhost:3001/health    # Returns { "status": "ok" }
```

---

## Step 1: Update Prisma Schema

### 1.1 Create the User Model

Update the Prisma schema with the new multi-auth User model.

**File: `packages/api/prisma/schema.prisma`**

```prisma
generator client {
  provider      = "prisma-client-js"
  binaryTargets = ["native", "linux-musl-openssl-3.0.x"]
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ============================================================================
// USER & AUTHENTICATION
// ============================================================================

model User {
  id                          String    @id @default(uuid())

  // Authentication provider used for signup
  authProvider                String    @map("auth_provider") // 'microsoft', 'discord', 'email'

  // Minecraft identity (manually entered by user)
  minecraftUsername            String?   @unique @map("minecraft_username")

  // Microsoft OAuth identity (optional - only for Microsoft auth users)
  microsoftId                 String?   @unique @map("microsoft_id")

  // Discord OAuth identity (optional - only for Discord auth users)
  discordId                   String?   @unique @map("discord_id")
  discordUsername              String?   @map("discord_username")

  // Email/Password identity (optional - only for email auth users)
  email                       String?   @unique
  passwordHash                String?   @map("password_hash")
  emailVerified               Boolean   @default(false) @map("email_verified")
  emailVerificationCode       String?   @map("email_verification_code")
  emailVerificationExpiresAt  DateTime? @map("email_verification_expires_at")

  // Payment verification
  verificationAmount          Int?      @map("verification_amount")       // Random 1-1000
  verificationExpiresAt       DateTime? @map("verification_expires_at")   // 15-minute deadline
  verificationStatus          String    @default("pending") @map("verification_status") // 'pending', 'verified', 'expired'

  // Account state
  balance                     Decimal   @default(0) @db.Decimal(20, 2)
  createdAt                   DateTime  @default(now()) @map("created_at")
  updatedAt                   DateTime  @updatedAt @map("updated_at")
  lastLoginAt                 DateTime? @map("last_login_at")
  bannedAt                    DateTime? @map("banned_at")
  banReason                   String?   @map("ban_reason")

  // Relations
  sessions                    Session[]

  @@index([discordId])
  @@index([email])
  @@index([verificationStatus])
  @@map("users")
}

model Session {
  id               String   @id @default(uuid())
  userId           String   @map("user_id")
  user             User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  refreshTokenHash String   @unique @map("refresh_token_hash")
  userAgent        String?  @map("user_agent")
  ipAddress        String?  @map("ip_address")
  expiresAt        DateTime @map("expires_at")
  createdAt        DateTime @default(now()) @map("created_at")
  lastUsedAt       DateTime @default(now()) @map("last_used_at")

  @@index([userId])
  @@index([expiresAt])
  @@map("sessions")
}

model AuthState {
  state       String   @id
  authMethod  String   @map("auth_method") // 'microsoft', 'discord'
  redirectUrl String?  @map("redirect_url")
  createdAt   DateTime @default(now()) @map("created_at")
  expiresAt   DateTime @map("expires_at")

  @@index([expiresAt])
  @@map("auth_states")
}

// ============================================================================
// HEALTH CHECK (from Phase 0)
// ============================================================================

model HealthCheck {
  id        String   @id @default(uuid())
  timestamp DateTime @default(now())
  status    String

  @@map("health_checks")
}
```

### 1.2 Run the Migration

```bash
cd packages/api
npx prisma migrate dev --name auth_multi_method
```

If there's existing data from the old schema, create a migration that handles the transition:

```bash
# If you need to reset the database (development only):
npx prisma migrate reset

# Or create a custom migration:
npx prisma migrate dev --create-only --name auth_multi_method
# Then edit the generated SQL to handle data migration before applying
npx prisma migrate dev
```

### 1.3 Generate Prisma Client

```bash
npx prisma generate
```

---

## Step 2: Update Shared Types

### 2.1 Update Auth Types

**File: `packages/shared/src/types/auth.ts`**

Remove all Xbox/XSTS/Minecraft types. Replace with:

```typescript
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
```

### 2.2 Update User Types

**File: `packages/shared/src/types/index.ts`**

Update the user-related types:

```typescript
import { AuthProvider, VerificationStatus } from './auth.js';

/**
 * Input for creating a new user
 */
export interface CreateUserInput {
  authProvider: AuthProvider;
  minecraftUsername?: string;

  // Microsoft auth
  microsoftId?: string;

  // Discord auth
  discordId?: string;
  discordUsername?: string;

  // Email auth
  email?: string;
  passwordHash?: string;
}

/**
 * Input for updating a user
 */
export interface UpdateUserInput {
  minecraftUsername?: string;
  discordUsername?: string;
  email?: string;
  passwordHash?: string;
  emailVerified?: boolean;
  emailVerificationCode?: string | null;
  emailVerificationExpiresAt?: Date | null;
  verificationAmount?: number | null;
  verificationExpiresAt?: Date | null;
  verificationStatus?: VerificationStatus;
  lastLoginAt?: Date;
  bannedAt?: Date | null;
  banReason?: string | null;
}

/**
 * User profile returned by API
 */
export interface UserProfile {
  id: string;
  authProvider: AuthProvider;
  minecraftUsername: string | null;
  email: string | null;
  discordUsername: string | null;
  verificationStatus: VerificationStatus;
  balance: string;  // Decimal as string
  createdAt: string;
  lastLoginAt: string | null;
}
```

### 2.3 Remove Edition Types

**Delete file:** `packages/shared/src/types/edition.ts` (if it exists)

Update `packages/shared/src/index.ts` to remove the edition export.

---

## Step 3: Create User Repository

### 3.1 Update User Repository

**File: `packages/api/src/repositories/user.repository.ts`**

```typescript
import { PrismaClient, User } from '@prisma/client';
import { CreateUserInput, UpdateUserInput } from '@donuttrade/shared';
import { createModuleLogger } from '../lib/logger.js';

const logger = createModuleLogger('database', 'user-repository');

export class UserRepository {
  constructor(private prisma: PrismaClient) {}

  async findById(id: string): Promise<User | null> {
    logger.debug({ action: 'findById', userId: id });
    return this.prisma.user.findUnique({ where: { id } });
  }

  async findByMicrosoftId(microsoftId: string): Promise<User | null> {
    logger.debug({ action: 'findByMicrosoftId', microsoftId: microsoftId.substring(0, 8) + '...' });
    return this.prisma.user.findUnique({ where: { microsoftId } });
  }

  async findByDiscordId(discordId: string): Promise<User | null> {
    logger.debug({ action: 'findByDiscordId', discordId: discordId.substring(0, 8) + '...' });
    return this.prisma.user.findUnique({ where: { discordId } });
  }

  async findByEmail(email: string): Promise<User | null> {
    logger.debug({ action: 'findByEmail', email: email.substring(0, 3) + '***' });
    return this.prisma.user.findUnique({ where: { email } });
  }

  async findByMinecraftUsername(username: string): Promise<User | null> {
    logger.debug({ action: 'findByMinecraftUsername', username });
    return this.prisma.user.findUnique({ where: { minecraftUsername: username } });
  }

  async create(input: CreateUserInput): Promise<User> {
    logger.info({ action: 'create', authProvider: input.authProvider });
    return this.prisma.user.create({
      data: {
        authProvider: input.authProvider,
        minecraftUsername: input.minecraftUsername,
        microsoftId: input.microsoftId,
        discordId: input.discordId,
        discordUsername: input.discordUsername,
        email: input.email,
        passwordHash: input.passwordHash,
      },
    });
  }

  async update(id: string, input: UpdateUserInput): Promise<User> {
    logger.info({ action: 'update', userId: id });
    return this.prisma.user.update({
      where: { id },
      data: input,
    });
  }

  async delete(id: string): Promise<void> {
    logger.warn({ action: 'delete', userId: id });
    await this.prisma.user.delete({ where: { id } });
  }

  async findPendingVerifications(): Promise<User[]> {
    return this.prisma.user.findMany({
      where: {
        verificationStatus: 'pending',
        verificationExpiresAt: { not: null },
      },
    });
  }

  async findExpiredVerifications(): Promise<User[]> {
    return this.prisma.user.findMany({
      where: {
        verificationStatus: 'pending',
        verificationExpiresAt: { lt: new Date() },
      },
    });
  }
}
```

### 3.2 Update Session Repository

**File: `packages/api/src/repositories/session.repository.ts`**

No changes needed — the Session model is unchanged.

### 3.3 Update Auth State Repository

**File: `packages/api/src/repositories/auth-state.repository.ts`**

Add support for the new `authMethod` field:

```typescript
async create(state: string, authMethod: string, redirectUrl?: string): Promise<AuthState> {
  const expiresAt = new Date(Date.now() + AUTH_STATE_EXPIRY_MS);
  return this.prisma.authState.create({
    data: { state, authMethod, redirectUrl, expiresAt },
  });
}
```

---

## Step 4: Update Shared Constants

### 4.1 Add New Constants

**File: `packages/shared/src/constants/index.ts`**

Add the following constants:

```typescript
// Authentication providers
export const AUTH_PROVIDERS = ['microsoft', 'discord', 'email'] as const;

// Verification
export const VERIFICATION_AMOUNT_MIN = 1;
export const VERIFICATION_AMOUNT_MAX = 1000;
export const VERIFICATION_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes

// Email verification
export const EMAIL_CODE_LENGTH = 6;
export const EMAIL_CODE_EXPIRY_MS = 15 * 60 * 1000; // 15 minutes
export const EMAIL_RESEND_COOLDOWN_MS = 60 * 1000; // 1 minute
export const EMAIL_MAX_RESEND_ATTEMPTS = 3;

// Modules (updated)
export const Modules = {
  HTTP: 'http',
  AUTH: 'auth',
  DATABASE: 'database',
  REDIS: 'redis',
  DISCORD: 'discord',
  EMAIL: 'email',
  VERIFICATION: 'verification',
  MARKETPLACE: 'marketplace',
  DEPOSITS: 'deposits',
  WITHDRAWALS: 'withdrawals',
  ADMIN: 'admin',
  NOTIFICATIONS: 'notifications',
} as const;
```

---

## Step 5: Test Script

### 5.1 Create Repository Test Script

**File: `packages/api/src/test-repositories.ts`**

```typescript
import { PrismaClient } from '@prisma/client';
import { createModuleLogger } from './lib/logger.js';

const logger = createModuleLogger('api', 'test-repositories');
const prisma = new PrismaClient();

async function testRepositories() {
  logger.info({ action: 'test_start', message: 'Testing Phase 1 repositories' });

  try {
    // Test 1: Create user with Microsoft auth
    const msUser = await prisma.user.create({
      data: {
        authProvider: 'microsoft',
        microsoftId: 'test-ms-id-' + Date.now(),
        minecraftUsername: 'TestJavaUser',
        verificationStatus: 'pending',
      },
    });
    logger.info({ action: 'test_create_ms_user', userId: msUser.id, result: 'PASS' });

    // Test 2: Create user with Discord auth
    const discordUser = await prisma.user.create({
      data: {
        authProvider: 'discord',
        discordId: 'test-discord-id-' + Date.now(),
        discordUsername: 'TestDiscordUser#1234',
        minecraftUsername: '.TestBedrockUser',
        verificationStatus: 'pending',
      },
    });
    logger.info({ action: 'test_create_discord_user', userId: discordUser.id, result: 'PASS' });

    // Test 3: Create user with email auth
    const emailUser = await prisma.user.create({
      data: {
        authProvider: 'email',
        email: 'test-' + Date.now() + '@example.com',
        passwordHash: '$2b$12$fakehashfortest',
        minecraftUsername: 'TestEmailUser',
        verificationStatus: 'pending',
      },
    });
    logger.info({ action: 'test_create_email_user', userId: emailUser.id, result: 'PASS' });

    // Test 4: Find by Microsoft ID
    const foundMs = await prisma.user.findUnique({ where: { microsoftId: msUser.microsoftId! } });
    logger.info({ action: 'test_find_by_ms_id', found: !!foundMs, result: foundMs ? 'PASS' : 'FAIL' });

    // Test 5: Find by Discord ID
    const foundDiscord = await prisma.user.findUnique({ where: { discordId: discordUser.discordId! } });
    logger.info({ action: 'test_find_by_discord_id', found: !!foundDiscord, result: foundDiscord ? 'PASS' : 'FAIL' });

    // Test 6: Find by email
    const foundEmail = await prisma.user.findUnique({ where: { email: emailUser.email! } });
    logger.info({ action: 'test_find_by_email', found: !!foundEmail, result: foundEmail ? 'PASS' : 'FAIL' });

    // Test 7: Find by Minecraft username
    const foundMc = await prisma.user.findUnique({ where: { minecraftUsername: 'TestJavaUser' } });
    logger.info({ action: 'test_find_by_mc_username', found: !!foundMc, result: foundMc ? 'PASS' : 'FAIL' });

    // Test 8: Update verification status
    const updated = await prisma.user.update({
      where: { id: msUser.id },
      data: {
        verificationAmount: 500,
        verificationExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
        verificationStatus: 'pending',
      },
    });
    logger.info({ action: 'test_update_verification', result: updated.verificationAmount === 500 ? 'PASS' : 'FAIL' });

    // Test 9: Create auth state with authMethod
    const authState = await prisma.authState.create({
      data: {
        state: 'test-state-' + Date.now(),
        authMethod: 'microsoft',
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    });
    logger.info({ action: 'test_create_auth_state', result: authState.authMethod === 'microsoft' ? 'PASS' : 'FAIL' });

    // Test 10: Create session
    const session = await prisma.session.create({
      data: {
        userId: msUser.id,
        refreshTokenHash: 'test-hash-' + Date.now(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });
    logger.info({ action: 'test_create_session', result: session.userId === msUser.id ? 'PASS' : 'FAIL' });

    // Cleanup
    await prisma.session.delete({ where: { id: session.id } });
    await prisma.authState.delete({ where: { state: authState.state } });
    await prisma.user.deleteMany({
      where: { id: { in: [msUser.id, discordUser.id, emailUser.id] } },
    });
    logger.info({ action: 'test_cleanup', result: 'PASS' });

    logger.info({ action: 'test_complete', message: 'All Phase 1 repository tests passed!' });
  } catch (error) {
    logger.error({ action: 'test_error', error });
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

testRepositories();
```

---

## Verification Checklist

### Unit Tests
- [x] User can be created with `authProvider: 'microsoft'` and `microsoftId`
- [x] User can be created with `authProvider: 'discord'` and `discordId`
- [x] User can be created with `authProvider: 'email'` and `email` + `passwordHash`
- [x] User can be found by `microsoftId`, `discordId`, `email`, and `minecraftUsername`
- [x] Verification fields (`verificationAmount`, `verificationExpiresAt`, `verificationStatus`) can be set and updated
- [x] AuthState can be created with `authMethod` field
- [x] Session can be created and associated with a user
- [x] Unique constraints work: duplicate `microsoftId`, `discordId`, `email`, or `minecraftUsername` throws error

### Database Verification
- [x] `users` table exists with all new columns
- [x] `sessions` table exists (unchanged)
- [x] `auth_states` table has new `auth_method` column
- [x] Indexes exist on `discord_id`, `email`, `verification_status`
- [x] Old indexes on `java_uuid` and `bedrock_xuid` are removed

### Actual Files Implemented
- `packages/api/prisma/schema.prisma` — User, Session, AuthState, HealthCheck models
- `packages/api/src/repositories/user.repository.ts` — Full CRUD + find by all identity fields + verification queries
- `packages/api/src/repositories/session.repository.ts` — Session management with hash lookup
- `packages/api/src/repositories/auth-state.repository.ts` — OAuth state with atomic consume (find+delete)
- `packages/shared/src/types/auth.ts` — AuthProvider, VerificationStatus, Microsoft/Discord/Email types
- `packages/shared/src/types/index.ts` — CreateUserInput, UpdateUserInput, UserProfile types
- `packages/shared/src/constants/index.ts` — Verification constants, auth providers, module names

### Manual Verification
```bash
# Check table structure
npx prisma studio

# Run test script
npx tsx src/test-repositories.ts

# Verify build
npm run build
npx tsc --noEmit
```

### Log Verification
Expected log entries during test:
```
INFO  [database:user-repository] action=create authProvider=microsoft
INFO  [database:user-repository] action=create authProvider=discord
INFO  [database:user-repository] action=create authProvider=email
INFO  [database:user-repository] action=findByMicrosoftId
INFO  [database:user-repository] action=findByDiscordId
INFO  [database:user-repository] action=findByEmail
```
