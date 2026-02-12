# DonutTrade - Authentication Migration Changelog

**Date:** February 2026
**Reason:** The original authentication system relied on the Microsoft OAuth -> Xbox Live -> XSTS -> Minecraft Services API chain to automatically retrieve verified Minecraft usernames and UUIDs. Access to the Xbox/Minecraft APIs requires acceptance into a developer program that was not obtained. The authentication system is being redesigned to use 3 simpler methods with manual username entry and in-game payment verification.

**Scope of Impact:** Phases 1-5 are all affected. Phase 0 (Project Foundation & Logging) is unaffected.

---

## Table of Contents

1. [What Is Being Dropped](#1-what-is-being-dropped)
2. [What Is Being Changed](#2-what-is-being-changed)
3. [What Is Being Added](#3-what-is-being-added)
4. [Database Schema Changes](#4-database-schema-changes)
5. [Migration Steps](#5-migration-steps)

---

## 1. What Is Being Dropped

### 1.1 Xbox Live Authentication Chain

The entire Xbox Live -> XSTS -> Minecraft token chain is being removed. This includes:

| File | Action | Reason |
|------|--------|--------|
| `packages/api/src/services/auth/xbox.service.ts` | **DELETE** | Xbox Live auth no longer needed |
| `packages/api/src/services/auth/minecraft.service.ts` | **DELETE** | Minecraft API auth no longer needed |
| `packages/api/src/services/auth/auth-chain.service.ts` | **DELETE** | Chain orchestrator no longer needed |
| `packages/api/src/services/auth/auth-errors.ts` | **REWRITE** | Remove Xbox/MC error codes, add Discord/email error codes |

### 1.2 XboxLive.signin OAuth Scope

The Microsoft OAuth scopes are changing:

- **Old:** `XboxLive.signin`, `XboxLive.offline_access`, `offline_access`
- **New:** `openid`, `email`, `profile`, `offline_access`

The `XboxLive.signin` scope required Xbox API program access. The new scopes use standard Microsoft identity (OpenID Connect) only.

**File affected:** `packages/api/src/config/oauth.ts`

### 1.3 Automatic Minecraft Username/UUID Retrieval

- **Old:** The API chain called `api.minecraftservices.com/minecraft/profile` to automatically fetch the user's verified Minecraft username and UUID.
- **New:** Users manually enter their Minecraft username on a form. No UUID is retrieved. Username ownership is verified via in-game payment.

### 1.4 Automatic Edition Detection

- **Old:** The Entitlements API (`api.minecraftservices.com/entitlements/mcstore`) detected Java/Bedrock ownership automatically.
- **New:** Users self-indicate their edition by prefixing Bedrock usernames with "." (e.g., `.givey` for Bedrock, `givey` for Java).

### 1.5 Dual-Edition Choice Flow

The entire dual-edition detection and forced choice flow is removed:

| File | Action | Reason |
|------|--------|--------|
| `packages/api/src/services/auth/edition.service.ts` | **DELETE** | No automatic edition detection |
| `packages/api/src/routes/auth/edition.ts` | **DELETE** | Edition choice endpoints removed |

### 1.6 Shared Types to Remove

From `packages/shared/src/types/auth.ts`, the following types are being **removed**:

- `XboxLiveAuthResponse`
- `XboxLiveTokens`
- `XstsAuthResponse`
- `XstsErrorResponse`
- `XstsTokens`
- `MinecraftAuthResponse`
- `MinecraftTokens`
- `MinecraftProfile`
- `MinecraftProfileError`
- `MinecraftEntitlements`
- `EntitlementNames` (constant)
- `XboxProfileResponse`
- `XstsErrorCodes` (constant)
- `XstsErrorCode` (type)
- `AuthChainResult`
- `AuthChainStep` (enum)

From `packages/shared/src/types/edition.ts`:

- All edition-related types (no more dual-edition flow)

### 1.7 Database Fields to Remove

From the `User` model in `packages/api/prisma/schema.prisma`:

- `minecraftUuid` - No API to retrieve UUID
- `javaUsername` - No separate Java identity tracking
- `javaUuid` - No API to retrieve Java UUID
- `bedrockUsername` - No separate Bedrock identity tracking
- `bedrockXuid` - No API to retrieve Bedrock XUID
- `ownsJava` - No automatic edition detection
- `ownsBedrock` - No automatic edition detection
- `microsoftRefreshToken` - Not used without Xbox/MC chain
- `xboxUserHash` - Xbox auth removed
- `xboxGamertag` - Xbox auth removed
- `editionSetAt` - Edition choice flow removed
- `editionSetBy` - Edition choice flow removed

Relations to remove:
- `editionSetByAdmin` (self-relation)
- `editionChanges` (self-relation)

Indexes to remove:
- `@@index([javaUuid])`
- `@@index([bedrockXuid])`

---

## 2. What Is Being Changed

### 2.1 Microsoft OAuth Service

**File:** `packages/api/src/services/auth/microsoft.service.ts`

| Aspect | Old | New |
|--------|-----|-----|
| Purpose | Exchange code -> get MS token -> feed into Xbox/MC chain | Exchange code -> get MS token -> extract user identity (ID + email) |
| Scopes | `XboxLive.signin XboxLive.offline_access offline_access` | `openid email profile offline_access` |
| Output | `MicrosoftTokens` (fed into auth chain) | Microsoft user ID (`oid` claim) + email |
| After auth | Calls Xbox Live, XSTS, Minecraft APIs | Redirects to username entry if new user, or logs in if existing |

The service is simplified significantly. It no longer needs to call any APIs after receiving the Microsoft token.

### 2.2 OAuth Configuration

**File:** `packages/api/src/config/oauth.ts`

- Microsoft scopes change from `['XboxLive.signin', 'XboxLive.offline_access', 'offline_access']` to `['openid', 'email', 'profile', 'offline_access']`
- Add Discord OAuth configuration block
- Add email service configuration
- Comment on `/consumers` tenant updated (no longer about XboxLive.signin)

### 2.3 Database Schema (Prisma)

**File:** `packages/api/prisma/schema.prisma`

The `User` model is restructured. See [Section 4](#4-database-schema-changes) for the full field-by-field comparison.

Key changes:
- `microsoftId` changes from required `String` to optional `String?` (not all users sign up via Microsoft)
- `email` stays but becomes the primary field for email/password auth
- New fields for Discord identity, password hash, email verification, and payment verification

### 2.4 User Repository

**File:** `packages/api/src/repositories/user.repository.ts`

| Method | Action |
|--------|--------|
| `findByMicrosoftId` | **KEEP** |
| `findByJavaUuid` | **REMOVE** |
| `findByBedrockXuid` | **REMOVE** |
| `setActiveEdition` | **REMOVE** |
| `findByDiscordId` | **ADD** |
| `findByEmail` | **ADD** |
| `create` | **CHANGE** - Remove Xbox/MC fields from input, add Discord/email/verification fields |
| `update` | **CHANGE** - Remove Xbox/MC fields from input, add Discord/email/verification fields |

### 2.5 Registration Service

**File:** `packages/api/src/services/auth/registration.service.ts`

- **Old:** Receives an `AuthChainResult` containing Xbox/MC chain data and creates a user
- **New:** Three registration paths (Microsoft, Discord, Email), each collecting different identity data but all converging to username entry -> payment verification -> session creation

### 2.6 Session Service

**File:** `packages/api/src/services/auth/session.service.ts`

- JWT payload changes: no longer includes `edition` from automatic detection
- JWT payload adds: `authProvider` field indicating which method was used
- `username` in JWT comes from manually-entered username instead of API-verified username

### 2.7 Auth Routes

**File:** `packages/api/src/routes/auth/index.ts`

- Microsoft routes simplified (callback no longer triggers auth chain)
- Edition routes removed
- Discord OAuth routes added
- Email auth routes added
- Verification routes added

### 2.8 Shared Types

**File:** `packages/shared/src/types/index.ts`

- `CreateUserInput` - Remove Xbox/MC fields, add `authProvider`, Discord fields, email/password fields
- `UpdateUserInput` - Same changes
- `UserProfile` - Simplify, remove dual-edition fields
- `SetEditionInput` - **REMOVE entirely**

### 2.9 Shared Constants

**File:** `packages/shared/src/constants/index.ts`

- Update module list (add `'discord'`, `'email'`, `'verification'`)
- Update external API references (remove Xbox/Minecraft, add Discord)
- Add email verification constants (code length, expiry)
- Add payment verification constants (amount range, timeout)

---

## 3. What Is Being Added

### 3.1 Discord OAuth Service

**New file:** `packages/api/src/services/auth/discord.service.ts`

Functions:
- `buildAuthorizationUrl(state: string)` - Builds Discord OAuth URL
- `exchangeCodeForTokens(code: string)` - Exchanges auth code for access token
- `getUserInfo(accessToken: string)` - Fetches Discord user profile from `/users/@me`

Discord API endpoints:
- Authorization: `https://discord.com/oauth2/authorize`
- Token: `https://discord.com/api/oauth2/token`
- User info: `https://discord.com/api/users/@me`

### 3.2 Email/Password Auth Service

**New file:** `packages/api/src/services/auth/email.service.ts`

Functions:
- `register(email, password, minecraftUsername)` - Create pending user with hashed password
- `verifyEmail(email, code)` - Verify the 6-digit email code
- `login(email, password)` - Authenticate with credentials
- `forgotPassword(email)` - Send password reset email
- `resetPassword(token, newPassword)` - Reset password with token

### 3.3 Email Sending Service

**New file:** `packages/api/src/services/email/email.service.ts`

Integration with **Resend** (recommended email service):
- Modern API, developer-friendly
- Generous free tier (3,000 emails/month)
- Templates: verification code email, password reset email
- Rate limiting on sends

### 3.4 Payment Verification Service

**New file:** `packages/api/src/services/verification/payment-verification.service.ts`

Functions:
- `createVerification(userId)` - Generate random amount (1-1000), set 15-minute expiry
- `checkVerification(userId)` - Check if payment has been received
- `expireVerification(userId)` - Mark as expired (soft delete)
- `retryVerification(userId)` - Generate new amount, reset timer, keep user data
- `confirmPayment(username, amount)` - Called by verification bot when payment detected

### 3.5 Verification Bot

A **new separate Minecraft bot** (not the legacy `src/bot.js`) dedicated to verifying user signups:

- Connects to DonutSMP as a separate bot account
- Listens for incoming `/pay` payments matching pending verifications
- Reports successful verifications to the API (via HTTP webhook or internal communication)
- Uses Mineflayer, similar architecture to existing bot

**Potential location:** `packages/verification-bot/` (new workspace package) or `packages/bot-bridge/` (existing placeholder)

### 3.6 New API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `GET /auth/discord` | GET | Initiate Discord OAuth flow |
| `GET /auth/discord/callback` | GET | Handle Discord OAuth callback |
| `POST /auth/email/register` | POST | Email + password registration |
| `POST /auth/email/verify` | POST | Verify email with 6-digit code |
| `POST /auth/email/login` | POST | Email + password login |
| `POST /auth/email/forgot-password` | POST | Request password reset email |
| `POST /auth/email/reset-password` | POST | Reset password with token |
| `POST /auth/set-username` | POST | Set Minecraft username (shared step) |
| `GET /auth/verification/status` | GET | Check payment verification status |
| `POST /auth/verification/retry` | POST | Retry expired verification |
| `POST /internal/verification/confirm` | POST | Bot reports successful payment (internal) |

### 3.7 New Shared Types

**New file:** `packages/shared/src/types/discord-auth.ts`

- `DiscordTokenResponse` - Discord OAuth token response
- `DiscordUser` - Discord user profile (`id`, `username`, `email`, `avatar`)

**Updated file:** `packages/shared/src/types/auth.ts`

- `AuthProvider` type (`'microsoft' | 'discord' | 'email'`)
- `VerificationStatus` type (`'pending' | 'verified' | 'expired'`)
- `EmailVerificationResult`
- `PaymentVerificationResult`

### 3.8 New Environment Variables

| Variable | Purpose |
|----------|---------|
| `DISCORD_CLIENT_ID` | Discord OAuth application client ID |
| `DISCORD_CLIENT_SECRET` | Discord OAuth application client secret |
| `DISCORD_REDIRECT_URI` | Discord OAuth callback URL |
| `DISCORD_BOT_TOKEN` | Token for the DonutTrade Discord bot |
| `RESEND_API_KEY` | Resend email service API key |
| `EMAIL_FROM_ADDRESS` | Sender email address (e.g., `noreply@donuttrade.com`) |
| `VERIFICATION_BOT_USERNAME` | Minecraft username of the verification bot |
| `VERIFICATION_BOT_SERVER` | Server address for the verification bot |

---

## 4. Database Schema Changes

### Old User Model vs New User Model

| Field | Old Schema | New Schema | Notes |
|-------|-----------|------------|-------|
| `id` | `String @id @default(uuid())` | `String @id @default(uuid())` | No change |
| `authProvider` | - | `String @map("auth_provider")` | **NEW**: `'microsoft'`, `'discord'`, or `'email'` |
| `minecraftUsername` | `String? @unique` | `String? @unique` | Now manually entered instead of API-fetched |
| `minecraftUuid` | `String? @unique` | **REMOVED** | No API to retrieve UUID |
| `activeEdition` | `String?` | **REMOVED** | Derived from "." prefix on username |
| `javaUsername` | `String?` | **REMOVED** | No separate edition tracking |
| `javaUuid` | `String?` | **REMOVED** | No API to retrieve |
| `bedrockUsername` | `String?` | **REMOVED** | No separate edition tracking |
| `bedrockXuid` | `String?` | **REMOVED** | No API to retrieve |
| `ownsJava` | `Boolean @default(false)` | **REMOVED** | No auto-detection |
| `ownsBedrock` | `Boolean @default(false)` | **REMOVED** | No auto-detection |
| `microsoftId` | `String @unique` (required) | `String? @unique` (optional) | Now optional (not all users use Microsoft) |
| `email` | `String?` | `String? @unique` | Now unique (used for email auth login) |
| `microsoftRefreshToken` | `String?` | **REMOVED** | Not needed without Xbox/MC chain |
| `xboxUserHash` | `String?` | **REMOVED** | Xbox auth removed |
| `xboxGamertag` | `String?` | **REMOVED** | Xbox auth removed |
| `discordId` | - | `String? @unique @map("discord_id")` | **NEW**: Discord user ID |
| `discordUsername` | - | `String? @map("discord_username")` | **NEW**: Discord username |
| `passwordHash` | - | `String? @map("password_hash")` | **NEW**: Bcrypt hash for email auth |
| `emailVerified` | - | `Boolean @default(false) @map("email_verified")` | **NEW**: Email verification status |
| `emailVerificationCode` | - | `String? @map("email_verification_code")` | **NEW**: 6-digit code |
| `emailVerificationExpiresAt` | - | `DateTime? @map("email_verification_expires_at")` | **NEW**: Code expiry |
| `verificationAmount` | - | `Int? @map("verification_amount")` | **NEW**: Random 1-1000 for payment |
| `verificationExpiresAt` | - | `DateTime? @map("verification_expires_at")` | **NEW**: Payment deadline |
| `verificationStatus` | - | `String @default("pending") @map("verification_status")` | **NEW**: `pending`/`verified`/`expired` |
| `balance` | `Decimal @default(0)` | `Decimal @default(0)` | No change |
| `createdAt` | `DateTime @default(now())` | `DateTime @default(now())` | No change |
| `updatedAt` | `DateTime @updatedAt` | `DateTime @updatedAt` | No change |
| `lastLoginAt` | `DateTime?` | `DateTime?` | No change |
| `bannedAt` | `DateTime?` | `DateTime?` | No change |
| `banReason` | `String?` | `String?` | No change |
| `editionSetAt` | `DateTime?` | **REMOVED** | Edition choice flow removed |
| `editionSetBy` | `String?` | **REMOVED** | Edition choice flow removed |

### New Indexes

- `@@index([discordId])` - Discord user lookups
- `@@index([email])` - Email auth lookups
- `@@index([verificationStatus])` - Pending verification queries

### Removed Indexes

- `@@index([javaUuid])`
- `@@index([bedrockXuid])`

### Session and AuthState Models

- **Session:** No changes needed
- **AuthState:** Add `authMethod String @map("auth_method")` field to track which auth method initiated the OAuth flow

---

## 5. Migration Steps

The following is the recommended order of code changes:

1. **Create new Prisma migration** - Alter the `User` model (remove old fields, add new fields). Handle existing data if any exists.
2. **Update shared types** (`packages/shared/src/types/`) - Remove Xbox/MC types, add Discord/email/verification types.
3. **Update shared constants** (`packages/shared/src/constants/`) - Add new modules, verification constants.
4. **Simplify Microsoft OAuth** - Change scopes, remove auth chain trigger from callback.
5. **Implement Discord OAuth service** - New service with OAuth flow.
6. **Implement email auth service** - New service with registration, verification, login.
7. **Implement email sending service** - Resend integration.
8. **Implement payment verification service** - Verification logic with soft delete.
9. **Rewrite registration service** - Three registration paths instead of `AuthChainResult`.
10. **Update user repository** - New lookup methods, updated create/update inputs.
11. **Create new API routes** - Discord, email, verification endpoints.
12. **Update existing API routes** - Simplify Microsoft callback, remove edition routes.
13. **Update session service** - JWT payload changes.
14. **Delete removed services** - `xbox.service.ts`, `minecraft.service.ts`, `auth-chain.service.ts`, `edition.service.ts`.
15. **Delete removed routes** - `edition.ts`.
16. **Implement verification bot** - New Mineflayer bot for payment verification.
17. **Update environment variables** - Add Discord, Resend, verification bot config.
18. **Update tests** - Rewrite all auth-related tests for new flows.
