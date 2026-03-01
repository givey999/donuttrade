# DonutTrade Platform - Implementation Plan

**Version:** 2.1
**Date:** February 2026 (Updated for multi-method authentication)
**Last Updated:** March 2026 (Status audit — docs aligned with actual implementation)
**Based on:** DonutTrade-Platform-Specification.md v1.2, Authentication-Methods-Guide.md

---

## Current Status (as of March 2026)

| Phase | Name | Status | Notes |
|-------|------|--------|-------|
| **0** | Project Foundation & Logging | ✅ Completed | Monorepo, logging, Docker, health checks |
| **1** | Database Schema & User Model | ✅ Completed | Prisma schema, repositories, shared types, migrations |
| **2** | Simplified Microsoft OAuth | ✅ Completed | OAuth flow, CSRF, ID token decoding, username entry |
| **3** | Discord OAuth + Email/Password | ⏳ Partial | Username entry done (moved to Phase 2); Discord & Email **not started** |
| **4** | Payment Verification | ✅ Completed | Verification service, bot-bridge, webhook, routes |
| **5** | Session Management | ✅ Completed | JWT tokens, session service, auth middleware, all routes |
| **6** | Frontend Foundation | ⏳ Scaffolded | Next.js 15 project exists; pages are stubs, no auth integration |
| 7–16 | Remaining phases | ❌ Not Started | Bot bridge deposits, marketplace, admin, etc. |

**Summary:** The core auth backend (Phases 0-2, 4-5) is fully implemented. **Phase 3 (Discord + Email auth) is the only remaining auth-related phase.** The web frontend is scaffolded but needs real UI and auth integration. No automated tests exist yet (vitest is configured but no test files).

**Key gaps:**
- Phase 3: Discord OAuth and Email/Password auth not implemented (missing `bcrypt`, `resend` deps)
- Frontend: Next.js scaffold only — login, callback, verify pages are stubs
- Testing: No test files exist (`*.test.ts` / `*.spec.ts`)
- Background expiry job for verifications not wired into server startup

---

## Overview

This document outlines a phased implementation approach for the DonutTrade platform. Each phase is designed to be:

- **Isolated**: Can be developed and tested independently
- **Incremental**: Builds upon previous phases
- **Testable**: Has clear verification criteria
- **Observable**: Rich logging and debugging from the start

---

## Core Principles

### Logging & Observability (Built Into Every Phase)

Every phase MUST implement these logging standards:

```typescript
// Log levels used consistently across the platform
enum LogLevel {
  TRACE = 'trace',  // Granular debugging (request/response bodies, state changes)
  DEBUG = 'debug',  // Development debugging (function entry/exit, variable values)
  INFO = 'info',    // Normal operations (user actions, successful operations)
  WARN = 'warn',    // Recoverable issues (rate limits, retries, deprecations)
  ERROR = 'error',  // Failures requiring attention (exceptions, failed operations)
  FATAL = 'fatal'   // System-critical failures (startup failures, data corruption)
}

// Every log entry MUST include:
interface LogEntry {
  timestamp: string;       // ISO 8601 format
  level: LogLevel;
  correlationId: string;   // Request-scoped unique ID for tracing
  service: string;         // 'api', 'web', 'bot-bridge', 'worker'
  module: string;          // e.g., 'auth', 'marketplace', 'deposits'
  action: string;          // e.g., 'login', 'createListing', 'processPayment'
  userId?: string;         // When authenticated
  duration?: number;       // For timed operations (ms)
  metadata?: object;       // Action-specific data
  error?: {
    name: string;
    message: string;
    stack?: string;
    code?: string;
  };
}
```

### Request Tracing

Every HTTP request generates a `correlationId` that flows through:
- API handlers
- Service layer
- Database queries
- External API calls (Microsoft, Discord)
- WebSocket events
- Background jobs

### Verification Criteria Template

Each phase includes:
1. **Unit Tests**: Core logic functions
2. **Integration Tests**: API endpoints with real/mock dependencies
3. **Manual Verification**: Step-by-step checklist
4. **Log Verification**: Expected log entries for key flows

---

## Phase 0: Project Foundation & Logging Infrastructure ✅

**Status**: Completed
**Dependencies**: None
**Deliverables**: Monorepo structure, logging system, development environment

### 0.1 Monorepo Setup

```
miau/
├── packages/
│   ├── api/                    # Fastify backend
│   │   ├── src/
│   │   │   ├── index.ts        # Entry point
│   │   │   ├── config/         # Configuration loading
│   │   │   ├── lib/            # Shared utilities
│   │   │   │   ├── logger.ts   # Logging implementation
│   │   │   │   ├── errors.ts   # Custom error classes
│   │   │   │   └── context.ts  # Request context (correlationId)
│   │   │   ├── plugins/        # Fastify plugins
│   │   │   ├── routes/         # Route handlers
│   │   │   └── services/       # Business logic
│   │   ├── tests/
│   │   └── package.json
│   │
│   ├── web/                    # Next.js frontend
│   │   ├── app/                # App router pages
│   │   ├── components/         # React components
│   │   ├── lib/                # Client utilities
│   │   └── package.json
│   │
│   ├── shared/                 # Shared types & utilities
│   │   ├── src/
│   │   │   ├── types/          # TypeScript interfaces
│   │   │   ├── constants/      # Shared constants
│   │   │   └── validation/     # Zod schemas
│   │   └── package.json
│   │
│   └── bot-bridge/             # Bot integration (Phase 7)
│
├── prisma/
│   └── schema.prisma           # Database schema
│
├── docker-compose.yml          # PostgreSQL, Redis for dev
├── package.json                # Workspace root
├── turbo.json                  # Turborepo config
└── .env.example
```

### 0.2 Logging Implementation

**File: `packages/api/src/lib/logger.ts`**

Features:
- Structured JSON logging (pino)
- Log level configuration via environment
- Request context injection
- Sensitive data redaction (tokens, passwords)
- Pretty printing for development
- Log rotation for production

```typescript
// Usage example:
logger.info({
  action: 'user.login',
  userId: user.id,
  metadata: { edition: user.activeEdition, method: 'microsoft' }
}, 'User logged in successfully');

logger.error({
  action: 'auth.tokenExchange',
  error: { name: err.name, message: err.message, code: 'OAUTH_ERROR' },
  metadata: { provider: 'discord' }
}, 'Discord token exchange failed');
```

### 0.3 Request Context & Correlation

**File: `packages/api/src/lib/context.ts`**

- Generate UUID for each request
- Store in AsyncLocalStorage
- Inject into all log calls automatically
- Pass to external services via headers

### 0.4 Configuration Management

**File: `packages/api/src/config/index.ts`**

- Environment variable loading with validation
- Type-safe configuration object
- Fail-fast on missing required config
- Log configuration on startup (redacted secrets)

### 0.5 Development Environment

**File: `docker-compose.yml`**

```yaml
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_DB: donuttrade
      POSTGRES_USER: dev
      POSTGRES_PASSWORD: dev
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7
    ports:
      - "6379:6379"
```

### Verification Checklist

- [x] `npm install` completes without errors
- [x] `npm run dev` starts API server
- [x] API responds to `GET /health` with `{ status: 'ok', timestamp: '...' }`
- [x] Logs output in structured JSON format
- [x] Log entries include correlationId
- [x] Environment variables loaded and validated
- [x] PostgreSQL connection established
- [x] Redis connection established
- [x] TypeScript compilation succeeds
- [x] ESLint passes

### Expected Log Output (Health Check)

```json
{
  "timestamp": "2026-01-24T12:00:00.000Z",
  "level": "info",
  "correlationId": "abc-123-def",
  "service": "api",
  "module": "http",
  "action": "request.complete",
  "duration": 5,
  "metadata": {
    "method": "GET",
    "path": "/health",
    "statusCode": 200
  }
}
```

---

## Phase 1: Database Schema & User Model ✅

**Status**: Completed
**Dependencies**: Phase 0
**Deliverables**: Database migrations, multi-auth User model, repositories

### 1.1 Prisma Schema - Users Table

**File: `packages/api/prisma/schema.prisma`**

Multi-auth User model supporting Microsoft OAuth, Discord OAuth, and email/password signup with in-game payment verification.

Key fields:
- `authProvider` — `'microsoft'`, `'discord'`, or `'email'`
- `microsoftId`, `discordId`, `email` — All optional/unique, depending on auth method
- `passwordHash` — For email/password auth (bcrypt)
- `minecraftUsername` — Manually entered by user (with "." prefix for Bedrock)
- `verificationAmount`, `verificationExpiresAt`, `verificationStatus` — Payment verification tracking
- `emailVerified`, `emailVerificationCode` — Email verification for classic auth

### 1.2 User Repository

**File: `packages/api/src/repositories/user.repository.ts`**

```typescript
class UserRepository {
  async findById(id: string): Promise<User | null>
  async findByMicrosoftId(microsoftId: string): Promise<User | null>
  async findByDiscordId(discordId: string): Promise<User | null>
  async findByEmail(email: string): Promise<User | null>
  async findByMinecraftUsername(username: string): Promise<User | null>
  async create(data: CreateUserInput): Promise<User>
  async update(id: string, data: UpdateUserInput): Promise<User>
  async findExpiredVerifications(): Promise<User[]>
}
```

### 1.3 Shared Types

Updated types in `packages/shared/src/types/auth.ts`:
- `AuthProvider` type, `VerificationStatus` type
- `MicrosoftUserInfo`, `DiscordTokenResponse`, `DiscordUser`
- `EmailVerificationResult`, `PaymentVerificationResult`

### Verification Checklist

- [x] `npx prisma migrate dev` creates tables with new schema
- [x] Users can be created with each auth provider (microsoft, discord, email)
- [x] Unique constraints enforced (`microsoftId`, `discordId`, `email`, `minecraftUsername`)
- [x] Verification fields work correctly
- [x] All repository methods produce log entries

See `docs/phase-1-implementation+testing.md` for full implementation details.

---

## Phase 2: Simplified Microsoft OAuth ✅

**Status**: Completed
**Dependencies**: Phase 1
**Deliverables**: Simplified Microsoft OAuth (identity only), deletion of Xbox/Minecraft services

### 2.1 OAuth Configuration

**File: `packages/api/src/config/oauth.ts`**

Microsoft OAuth uses OpenID Connect scopes for identity only — **no Xbox Live or Minecraft API access**.

```typescript
scopes: ['openid', 'email', 'profile', 'offline_access']
// NOT XboxLive.signin — Microsoft is an identity provider only
```

### 2.2 Microsoft Service (Simplified)

**File: `packages/api/src/services/auth/microsoft.service.ts`**

- `buildAuthorizationUrl(state)` — Redirect to Microsoft login
- `exchangeCodeForTokens(code)` — Get tokens (including ID token)
- `extractUserInfo(idToken)` — Decode JWT to get Microsoft user ID + email

No Xbox Live, XSTS, or Minecraft API calls.

### 2.3 OAuth Routes

- `GET /auth/microsoft` — Initiate OAuth, redirect to Microsoft
- `GET /auth/microsoft/callback` — Handle callback, extract identity
  - Existing user → log in
  - New user → create pending user, redirect to username entry

### 2.4 Delete Removed Services

- **DELETE**: `xbox.service.ts`, `minecraft.service.ts`, `auth-chain.service.ts`, `edition.service.ts`
- **DELETE**: `routes/auth/edition.ts`

### Verification Checklist

- [x] Microsoft OAuth uses `openid email profile` scopes (not XboxLive.signin)
- [x] OAuth callback extracts user identity from ID token
- [x] New users redirected to username entry page
- [x] Returning users logged in directly
- [x] Xbox/Minecraft services deleted

See `docs/phase-2-implementation+testing.md` for full implementation details.

---

## Phase 3: Discord OAuth + Classic Email/Password Authentication ⏳

**Status**: Partially Complete (username entry done; Discord & Email not started)
**Dependencies**: Phase 2
**Deliverables**: Discord OAuth, email/password auth, email verification, shared username entry

### 3.1 Discord OAuth Service

**File: `packages/api/src/services/auth/discord.service.ts`**

```typescript
class DiscordService {
  buildAuthorizationUrl(state: string): string
  async exchangeCodeForTokens(code: string): Promise<DiscordTokenResponse>
  async getUserInfo(accessToken: string): Promise<DiscordUser>
}
```

Discord OAuth routes: `GET /auth/discord`, `GET /auth/discord/callback`
Scopes: `identify`, `email`

### 3.2 Email/Password Auth Service

**File: `packages/api/src/services/auth/email.service.ts`**

```typescript
class EmailAuthService {
  async register(email, password, retypePassword): Promise<User>
  async verifyEmail(email, code): Promise<User>
  async login(email, password): Promise<User>
}
```

- Password: bcrypt (12 rounds), 8+ chars, mixed case + number
- Email: 6-digit code via Resend, 15-minute expiry

Email auth routes: `POST /auth/email/register`, `POST /auth/email/verify`, `POST /auth/email/login`

### 3.3 Shared Username Entry

**File: `packages/api/src/routes/auth/username.ts`**

- `POST /auth/set-username` — All 3 methods redirect here after identity verification
- Validates Minecraft username format (Java vs Bedrock with "." prefix)
- Checks uniqueness
- Displays Bedrock edition disclaimer

### Verification Checklist

- [ ] Discord OAuth flow works end-to-end — **not started**
- [ ] Email registration sends verification code — **not started**
- [ ] Email verification accepts correct code — **not started**
- [ ] Password validation enforces requirements — **not started**
- [x] Username entry validates format and uniqueness — **done (during Phase 2)**
- [x] Bedrock "." prefix handled correctly — **done (during Phase 2)**

See `docs/phase-3-implementation+testing.md` for full implementation details.

---

## Phase 4: Payment Verification System ✅

**Status**: Completed (built before Phase 3, using Microsoft OAuth for testing)
**Dependencies**: Phase 3
**Deliverables**: Payment verification service, verification bot, verification API

### 4.1 Payment Verification Service

**File: `packages/api/src/services/verification/payment-verification.service.ts`**

```typescript
class PaymentVerificationService {
  async createVerification(userId: string): Promise<VerificationInfo>
  async checkVerification(userId: string): Promise<VerificationStatus>
  async confirmPayment(username: string, amount: number): Promise<ConfirmResult>
  async retryVerification(userId: string): Promise<VerificationInfo>
  async expireStaleVerifications(): Promise<number>
}
```

- Random amount 1-1000
- 15-minute timeout
- Soft delete on expiry (user data preserved, can retry)
- Background job to expire stale verifications

### 4.2 Verification Bot

**Package: `packages/verification-bot/`**

- New separate Mineflayer bot (NOT the legacy `src/bot.js`)
- Connects to DonutSMP server
- Listens for incoming `/pay` payments
- Reports matches to API via internal webhook

### 4.3 Verification Routes

- `POST /auth/verification/start` — Start verification after username entry
- `GET /auth/verification/status` — Check verification status (for polling)
- `POST /auth/verification/retry` — Retry expired verification
- `POST /internal/verification/confirm` — Bot reports payment (webhook-secret protected)

### Verification Checklist

- [x] Random amount generated 1-1000
- [x] Correct payment marks user as verified
- [x] Wrong amount rejected
- [x] Expired verifications soft-deleted (data preserved)
- [x] Retry generates new amount and resets timer
- [x] Verification bot detects and reports payments (via `packages/bot-bridge/`)

See `docs/phase-4-implementation+testing.md` for full implementation details.

---

## Phase 5: Session Management & Protected Routes ✅

**Status**: Completed
**Dependencies**: Phase 4
**Deliverables**: JWT sessions, auth middleware, login/logout/refresh endpoints

### 5.1 JWT Implementation

**File: `packages/api/src/lib/jwt.ts`**

```typescript
interface AccessTokenPayload {
  sub: string;            // User ID
  username: string;       // Minecraft username
  authProvider: string;   // 'microsoft' | 'discord' | 'email'
  type: 'access';
}
```

- Access token: 15 minutes
- Refresh token: 30 days, stored as SHA-256 hash

### 5.2 Session Service

**File: `packages/api/src/services/auth/session.service.ts`**

```typescript
class SessionService {
  async createSession(userId, username, authProvider, userAgent?, ip?): Promise<SessionTokens>
  async refreshSession(refreshToken: string): Promise<SessionTokens>
  async revokeSession(refreshToken: string): Promise<void>
  async revokeAllSessions(userId: string): Promise<number>
}
```

### 5.3 Auth Middleware & Routes

- Auth middleware extracts Bearer token, verifies JWT, attaches user context
- `GET /auth/me` — Current user profile (protected)
- `POST /auth/refresh` — Refresh access token
- `POST /auth/logout` — Revoke current session
- `POST /auth/logout-all` — Revoke all sessions (protected)

### Verification Checklist

- [x] Access tokens signed and verified correctly
- [x] Refresh tokens hashed before storage
- [x] Token rotation on refresh (old token invalidated)
- [x] Logout revokes session
- [x] Protected routes return 401 without valid token

See `docs/phase-5-implementation+testing.md` for full implementation details.

---

## Phase 6: Frontend Foundation & Protected Routes ⏳

**Status**: Scaffolded (Next.js 15 project exists, pages are stubs with no auth integration)
**Dependencies**: Phase 5
**Deliverables**: Next.js app shell, auth context, protected layout

### 6.1 Auth Context

**File: `packages/web/lib/auth/auth-context.tsx`**

```typescript
interface AuthContext {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (method: 'microsoft' | 'discord') => void;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}
```

### 6.2 API Client

**File: `packages/web/lib/api/client.ts`**

- Axios/fetch wrapper
- Automatic token attachment
- 401 handling with refresh
- Request/response logging (development)
- Error normalization

### 6.3 Protected Layout

**File: `packages/web/app/(protected)/layout.tsx`**

- Auth check on mount
- Loading state
- Redirect to login if unauthenticated
- Header with navigation
- User profile dropdown

### 6.4 Basic Pages (Shell Only)

```
packages/web/app/
├── page.tsx                      # Landing page
├── auth/
│   ├── login/page.tsx            # Login page (3 methods: Microsoft, Discord, Email)
│   ├── register/page.tsx         # Email registration form
│   ├── verify-email/page.tsx     # Email verification code entry
│   ├── callback/page.tsx         # OAuth callback handler
│   ├── set-username/page.tsx     # Minecraft username entry (with Bedrock disclaimer)
│   └── verify-payment/page.tsx   # Payment verification page (amount + countdown)
└── (protected)/
    ├── layout.tsx                # Protected layout
    ├── dashboard/page.tsx        # Dashboard (placeholder)
    ├── marketplace/page.tsx      # Marketplace (placeholder)
    ├── deposit/page.tsx          # Deposit (placeholder)
    ├── withdraw/page.tsx         # Withdraw (placeholder)
    └── settings/page.tsx         # Settings (placeholder)
```

### Verification Checklist

- [ ] Landing page loads for unauthenticated users
- [ ] Login page shows all 3 auth methods
- [ ] Microsoft and Discord OAuth flows redirect correctly
- [ ] Email registration form validates inputs
- [ ] Username entry page shows Bedrock disclaimer
- [ ] Payment verification page shows amount and countdown timer
- [ ] Protected pages redirect to login if unauthenticated
- [ ] User info displayed in header
- [ ] Logout clears session and redirects

---

## Phase 7: Bot Bridge & Money Deposits

**Dependencies**: Phase 6
**Deliverables**: Bot bridge service, deposit detection, balance crediting

### 7.1 Bot Bridge Service

**File: `packages/bot-bridge/src/index.ts`**

Components:
- Log file watcher (`payments-in.log`)
- API client for platform
- Command queue consumer (for withdrawals later)

### 7.2 Deposit Processing

**File: `packages/api/src/services/deposits/deposit.service.ts`**

```typescript
class DepositService {
  async processIncomingPayment(payment: IncomingPayment): Promise<DepositResult> {
    // 1. Parse username from payment
    // 2. Match to registered user
    // 3. Credit balance (transaction)
    // 4. Create deposit record
    // 5. Send notification (Phase 12)
    // 6. Log all steps
  }
}
```

### 7.3 Database Schema Addition

```prisma
model Deposit {
  id               String    @id @default(uuid())
  userId           String?   @map("user_id")
  user             User?     @relation(fields: [userId], references: [id])
  amount           Decimal   @db.Decimal(20, 2)
  amountRaw        String?   @map("amount_raw")
  status           String    @default("pending")
  botLogTimestamp  DateTime? @map("bot_log_timestamp")
  detectedUsername String    @map("detected_username")
  creditedAt       DateTime? @map("credited_at")
  createdAt        DateTime  @default(now()) @map("created_at")
  notes            String?

  @@index([userId])
  @@index([status])
  @@index([detectedUsername])
  @@map("deposits")
}
```

### 7.4 Deposit API

```typescript
// GET /deposits
// - List user's deposits
// - Paginated, filterable by status

// GET /deposits/:id
// - Single deposit details
```

### 7.5 Deposit Page UI

**File: `packages/web/app/(protected)/deposit/page.tsx`**

- Display bot username
- Instructions for in-game payment
- Recent deposits list
- Real-time updates (Phase 12)

### Verification Checklist

- [ ] Bot bridge watches log file
- [ ] New payment entries detected
- [ ] Username matched to user
- [ ] Balance credited atomically
- [ ] Deposit record created
- [ ] Unmatched payments logged for admin
- [ ] Deposit history displayed on UI
- [ ] All operations logged with correlationId

### Expected Log Output (Deposit Credited)

```json
{
  "level": "info",
  "module": "deposits",
  "action": "deposit.credited",
  "userId": "uuid-here",
  "metadata": {
    "depositId": "deposit-uuid",
    "amount": 50000,
    "amountRaw": "50K.",
    "detectedUsername": "PlayerName",
    "newBalance": 150000
  }
}
```

---

## Phase 8: Item Catalog & Item Deposits

**Dependencies**: Phase 7
**Deliverables**: Item catalog, item deposit requests

### 8.1 Database Schema

```prisma
model ItemCatalog {
  id          String   @id @default(uuid())
  name        String
  minecraftId String   @map("minecraft_id")
  displayName String   @map("display_name")
  description String?
  category    String?
  iconUrl     String?  @map("icon_url")
  minPrice    Decimal? @map("min_price") @db.Decimal(20, 2)
  maxPrice    Decimal? @map("max_price") @db.Decimal(20, 2)
  enabled     Boolean  @default(true)
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  @@map("item_catalog")
}

model ItemDeposit {
  id            String    @id @default(uuid())
  userId        String    @map("user_id")
  user          User      @relation(fields: [userId], references: [id])
  catalogItemId String    @map("catalog_item_id")
  catalogItem   ItemCatalog @relation(fields: [catalogItemId], references: [id])
  quantity      Int       @default(1)
  status        String    @default("pending")
  fulfilledBy   String?   @map("fulfilled_by")
  fulfilledAt   DateTime? @map("fulfilled_at")
  createdAt     DateTime  @default(now()) @map("created_at")
  notes         String?

  @@index([userId])
  @@index([status])
  @@map("item_deposits")
}
```

### 8.2 Catalog API

```typescript
// GET /catalog/items
// - List enabled items
// - Grouped by category

// GET /catalog/categories
// - List categories
```

### 8.3 Item Deposit API

```typescript
// POST /item-deposits
// - Create item deposit request
// - Validate item exists and enabled

// GET /item-deposits
// - User's item deposit requests

// DELETE /item-deposits/:id
// - Cancel pending request
```

### Verification Checklist

- [ ] Catalog items displayed
- [ ] Item deposit request created
- [ ] Pending deposits shown to user
- [ ] Admin can see pending deposits
- [ ] Cancellation works for pending only
- [ ] All operations logged

---

## Phase 9: User Inventory

**Dependencies**: Phase 8
**Deliverables**: Inventory management, balance display

### 9.1 Database Schema

```prisma
model UserInventory {
  id            String      @id @default(uuid())
  userId        String      @map("user_id")
  user          User        @relation(fields: [userId], references: [id])
  catalogItemId String      @map("catalog_item_id")
  catalogItem   ItemCatalog @relation(fields: [catalogItemId], references: [id])
  quantity      Int         @default(0)
  createdAt     DateTime    @default(now()) @map("created_at")
  updatedAt     DateTime    @updatedAt @map("updated_at")

  @@unique([userId, catalogItemId])
  @@index([userId])
  @@map("user_inventory")
}
```

### 9.2 Inventory Service

```typescript
class InventoryService {
  async getInventory(userId: string): Promise<InventoryItem[]>
  async addItems(userId: string, itemId: string, quantity: number): Promise<void>
  async removeItems(userId: string, itemId: string, quantity: number): Promise<void>
  async reserveItems(userId: string, itemId: string, quantity: number): Promise<void>
  async releaseReservation(userId: string, itemId: string, quantity: number): Promise<void>
}
```

### 9.3 Inventory API

```typescript
// GET /users/me/inventory
// - List user's inventory items with quantities
```

### Verification Checklist

- [ ] Inventory displayed on dashboard
- [ ] Items credited when deposit fulfilled
- [ ] Quantities accurate
- [ ] Empty inventory handled gracefully

---

## Phase 10: Marketplace Listings

**Dependencies**: Phase 9
**Deliverables**: Create listings, browse marketplace, purchase flow

### 10.1 Database Schema

```prisma
model Listing {
  id              String      @id @default(uuid())
  sellerId        String      @map("seller_id")
  seller          User        @relation("Seller", fields: [sellerId], references: [id])
  catalogItemId   String      @map("catalog_item_id")
  catalogItem     ItemCatalog @relation(fields: [catalogItemId], references: [id])
  quantity        Int
  pricePerUnit    Decimal     @map("price_per_unit") @db.Decimal(20, 2)
  totalPrice      Decimal     @map("total_price") @db.Decimal(20, 2)
  commissionRate  Decimal     @map("commission_rate") @db.Decimal(5, 4)
  isPremium       Boolean     @default(false) @map("is_premium")
  expiresAt       DateTime    @map("expires_at")
  status          String      @default("active")
  soldAt          DateTime?   @map("sold_at")
  buyerId         String?     @map("buyer_id")
  buyer           User?       @relation("Buyer", fields: [buyerId], references: [id])
  createdAt       DateTime    @default(now()) @map("created_at")

  @@index([status, expiresAt])
  @@index([sellerId])
  @@index([catalogItemId])
  @@map("listings")
}
```

### 10.2 Listing Service

```typescript
class ListingService {
  async createListing(input: CreateListingInput): Promise<Listing>
  async purchaseListing(listingId: string, buyerId: string): Promise<PurchaseResult>
  async cancelListing(listingId: string, userId: string): Promise<void>
  async expireListings(): Promise<number>  // Background job
}
```

### 10.3 Transaction Handling

All purchases execute atomically:
1. Verify listing still active
2. Verify buyer has balance
3. Verify buyer is not seller
4. Deduct from buyer balance
5. Credit to seller balance (minus commission)
6. Transfer items to buyer inventory
7. Update listing status
8. Create transaction records
9. Log everything

### 10.4 Listing API

```typescript
// GET /marketplace
// - Browse active listings
// - Filter by category, item, price
// - Sort by price, date, quantity
// - Pagination

// GET /marketplace/:id
// - Listing details

// POST /listings
// - Create new listing

// DELETE /listings/:id
// - Cancel own listing

// GET /listings/my
// - User's listings

// POST /purchases
// - Purchase a listing
```

### 10.5 Background Job: Expiration

```typescript
// Runs every minute
// Finds expired active listings
// Returns items to seller inventory
// Updates status to 'expired'
// Creates notifications
```

### Verification Checklist

- [ ] Listing created with correct prices
- [ ] Items reserved from seller inventory
- [ ] Marketplace displays listings
- [ ] Filters and sorting work
- [ ] Purchase flow completes atomically
- [ ] Commission calculated correctly
- [ ] Items transferred to buyer
- [ ] Seller balance credited
- [ ] Listing cancellation returns items
- [ ] Expired listings handled by job
- [ ] All transactions logged

### Expected Log Output (Purchase)

```json
{
  "level": "info",
  "module": "marketplace",
  "action": "purchase.complete",
  "userId": "buyer-uuid",
  "metadata": {
    "listingId": "listing-uuid",
    "sellerId": "seller-uuid",
    "itemId": "item-uuid",
    "quantity": 3,
    "totalPrice": 1500000,
    "commission": 75000,
    "sellerReceived": 1425000
  }
}
```

---

## Phase 11: Withdrawals

**Dependencies**: Phase 10
**Deliverables**: Money and item withdrawal requests

### 11.1 Database Schema

```prisma
model Withdrawal {
  id            String    @id @default(uuid())
  userId        String    @map("user_id")
  user          User      @relation(fields: [userId], references: [id])
  amount        Decimal   @db.Decimal(20, 2)
  status        String    @default("pending")
  fulfilledBy   String?   @map("fulfilled_by")
  fulfilledAt   DateTime? @map("fulfilled_at")
  transactionId String?   @map("transaction_id")
  createdAt     DateTime  @default(now()) @map("created_at")
  notes         String?

  @@index([userId])
  @@index([status])
  @@map("withdrawals")
}

model ItemWithdrawal {
  id            String      @id @default(uuid())
  userId        String      @map("user_id")
  user          User        @relation(fields: [userId], references: [id])
  catalogItemId String      @map("catalog_item_id")
  catalogItem   ItemCatalog @relation(fields: [catalogItemId], references: [id])
  quantity      Int
  status        String      @default("pending")
  fulfilledBy   String?     @map("fulfilled_by")
  fulfilledAt   DateTime?   @map("fulfilled_at")
  createdAt     DateTime    @default(now()) @map("created_at")
  notes         String?

  @@index([userId])
  @@index([status])
  @@map("item_withdrawals")
}
```

### 11.2 Withdrawal API

```typescript
// POST /withdrawals/balance
// - Request money withdrawal
// - Validate amount and limits
// - Reserve funds

// POST /withdrawals/items
// - Request item withdrawal
// - Reserve items

// GET /withdrawals
// - User's withdrawal history

// DELETE /withdrawals/:id
// - Cancel pending withdrawal
```

### Verification Checklist

- [ ] Money withdrawal reserves balance
- [ ] Item withdrawal reserves inventory
- [ ] Cancellation restores funds/items
- [ ] Cannot cancel processing/completed
- [ ] Withdrawal limits enforced
- [ ] All operations logged

---

## Phase 12: Admin Panel Foundation

**Dependencies**: Phase 11
**Deliverables**: Admin authentication, dashboard, user management

### 12.1 Database Schema

```prisma
model Role {
  id          String           @id @default(uuid())
  name        String           @unique
  description String?
  createdAt   DateTime         @default(now()) @map("created_at")
  permissions RolePermission[]
  users       UserRole[]

  @@map("roles")
}

model Permission {
  id          String           @id @default(uuid())
  name        String           @unique
  description String?
  roles       RolePermission[]

  @@map("permissions")
}

model RolePermission {
  roleId       String     @map("role_id")
  role         Role       @relation(fields: [roleId], references: [id], onDelete: Cascade)
  permissionId String     @map("permission_id")
  permission   Permission @relation(fields: [permissionId], references: [id], onDelete: Cascade)

  @@id([roleId, permissionId])
  @@map("role_permissions")
}

model UserRole {
  userId    String   @map("user_id")
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  roleId    String   @map("role_id")
  role      Role     @relation(fields: [roleId], references: [id], onDelete: Cascade)
  grantedBy String?  @map("granted_by")
  grantedAt DateTime @default(now()) @map("granted_at")

  @@id([userId, roleId])
  @@map("user_roles")
}
```

### 12.2 Permission Middleware

```typescript
function requirePermission(permission: string) {
  return async (request, reply) => {
    const user = request.user;
    const hasPermission = await permissionService.userHasPermission(user.id, permission);
    if (!hasPermission) {
      throw new ForbiddenError(`Missing permission: ${permission}`);
    }
  };
}
```

### 12.3 Admin Routes

```typescript
// GET /admin/dashboard
// - Statistics and pending counts

// GET /admin/users
// - List users with filters

// GET /admin/users/:id
// - User details

// PATCH /admin/users/:id
// - Update user (balance adjustment, ban, etc.)

// POST /admin/users/:id/reset-verification
// - Reset verification status (allow user to re-verify)
```

### 12.4 Audit Logging

```prisma
model AdminLog {
  id         String   @id @default(uuid())
  adminId    String   @map("admin_id")
  admin      User     @relation(fields: [adminId], references: [id])
  action     String
  targetType String?  @map("target_type")
  targetId   String?  @map("target_id")
  details    Json?
  ipAddress  String?  @map("ip_address")
  createdAt  DateTime @default(now()) @map("created_at")

  @@index([createdAt])
  @@map("admin_logs")
}
```

### Verification Checklist

- [ ] Admin routes require authentication
- [ ] Permission checks enforced
- [ ] Admin dashboard shows statistics
- [ ] User list searchable/filterable
- [ ] User details editable
- [ ] Balance adjustments require reason
- [ ] Edition changes logged
- [ ] All admin actions logged

---

## Phase 13: Admin Fulfillment Workflows

**Dependencies**: Phase 12
**Deliverables**: Deposit/withdrawal fulfillment flows

### 13.1 Fulfillment API

```typescript
// GET /admin/fulfillment/item-deposits
// - Pending item deposits

// PATCH /admin/fulfillment/item-deposits/:id
// - Fulfill or cancel

// GET /admin/fulfillment/withdrawals
// - Pending money withdrawals

// PATCH /admin/fulfillment/withdrawals/:id
// - Process, complete, or fail

// GET /admin/fulfillment/item-withdrawals
// - Pending item withdrawals

// PATCH /admin/fulfillment/item-withdrawals/:id
// - Process, complete, or fail
```

### 13.2 Fulfillment Service

```typescript
class FulfillmentService {
  async fulfillItemDeposit(id: string, adminId: string): Promise<void>
  async processMoneyWithdrawal(id: string, adminId: string): Promise<void>
  async completeMoneyWithdrawal(id: string, adminId: string): Promise<void>
  async failWithdrawal(id: string, adminId: string, reason: string): Promise<void>
}
```

### 13.3 Bot Command Queue

For money withdrawals:
1. Admin clicks "Process"
2. System queues command: `/pay Username amount`
3. Bot bridge consumes queue
4. Bot executes command
5. Bridge reports result
6. Admin confirms completion

### Verification Checklist

- [ ] Item deposits can be fulfilled
- [ ] Fulfilled deposits credit inventory
- [ ] Money withdrawals queue bot commands
- [ ] Completed withdrawals finalize deduction
- [ ] Failed withdrawals refund balance
- [ ] All fulfillment actions logged

---

## Phase 14: Notifications & Real-Time Updates

**Dependencies**: Phase 13
**Deliverables**: Notification system, WebSocket events

### 14.1 Database Schema

```prisma
model Notification {
  id        String    @id @default(uuid())
  userId    String    @map("user_id")
  user      User      @relation(fields: [userId], references: [id])
  type      String
  title     String
  message   String
  data      Json?
  readAt    DateTime? @map("read_at")
  createdAt DateTime  @default(now()) @map("created_at")

  @@index([userId, createdAt])
  @@map("notifications")
}
```

### 14.2 Notification Service

```typescript
class NotificationService {
  async create(userId: string, notification: CreateNotificationInput): Promise<Notification>
  async markAsRead(notificationId: string): Promise<void>
  async markAllAsRead(userId: string): Promise<void>
  async getUnreadCount(userId: string): Promise<number>
  async list(userId: string, options: PaginationOptions): Promise<Notification[]>
}
```

### 14.3 WebSocket Server

```typescript
// Socket.io integration with Fastify
// Authentication via JWT
// Room per user: `user:${userId}`

// Events emitted:
// - notification:new
// - balance:updated
// - listing:sold
// - deposit:credited
// - withdrawal:completed
```

### 14.4 Notification API

```typescript
// GET /notifications
// - List user's notifications

// PATCH /notifications/:id/read
// - Mark as read

// POST /notifications/read-all
// - Mark all as read
```

### Verification Checklist

- [ ] Notifications created for key events
- [ ] WebSocket connection authenticates
- [ ] Real-time events received by client
- [ ] Notification badge updates
- [ ] Mark as read works
- [ ] Notification list paginated

---

## Phase 15: Transactions & Audit Trail

**Dependencies**: Phase 14
**Deliverables**: Complete transaction history

### 15.1 Database Schema

```prisma
model Transaction {
  id            String   @id @default(uuid())
  userId        String   @map("user_id")
  user          User     @relation(fields: [userId], references: [id])
  type          String
  amount        Decimal? @db.Decimal(20, 2)
  balanceAfter  Decimal? @map("balance_after") @db.Decimal(20, 2)
  referenceType String?  @map("reference_type")
  referenceId   String?  @map("reference_id")
  description   String?
  createdAt     DateTime @default(now()) @map("created_at")

  @@index([userId, createdAt])
  @@map("transactions")
}
```

### 15.2 Transaction Types

- `deposit` - Money deposited
- `item_deposit` - Items deposited
- `purchase` - Bought items
- `sale` - Sold items
- `commission` - Commission deducted
- `listing_fee` - Premium listing fee
- `withdrawal` - Money withdrawn
- `item_withdrawal` - Items withdrawn
- `refund` - Refund for failed operation
- `adjustment` - Admin adjustment

### 15.3 Transaction API

```typescript
// GET /users/me/transactions
// - User's transaction history
// - Filterable by type
// - Paginated
```

### Verification Checklist

- [ ] All balance changes create transactions
- [ ] Transaction history accurate
- [ ] Balance after matches actual balance
- [ ] Reference links to source record
- [ ] History displayed on dashboard

---

## Phase 16: Security Hardening & Production Prep

**Dependencies**: All previous phases
**Deliverables**: Security review, rate limiting, production configuration

### 16.1 Rate Limiting

```typescript
// Per-endpoint rate limits
const rateLimits = {
  'auth/*': { window: '15m', max: 10 },
  'marketplace': { window: '1m', max: 60 },
  'purchases': { window: '1m', max: 10 },
  'withdrawals/*': { window: '1h', max: 5 },
  default: { window: '1m', max: 100 }
};
```

### 16.2 Security Headers

- CORS restricted to known origins
- Helmet.js for security headers
- CSRF protection for state-changing requests

### 16.3 Input Validation

- All inputs validated with Zod schemas
- SQL injection prevented by Prisma
- XSS prevented by React
- Sensitive data redacted in logs

### 16.4 Token Security

- Refresh tokens stored as SHA-256 hashes
- Microsoft tokens encrypted with AES-256-GCM
- JWTs signed with strong secrets
- Token rotation on security events

### 16.5 Production Configuration

- Environment-specific configs
- Database connection pooling
- Redis for sessions/caching
- PM2 process management
- Health check endpoints
- Graceful shutdown

### Verification Checklist

- [ ] Rate limits enforced
- [ ] Security headers present
- [ ] CORS blocks unauthorized origins
- [ ] Input validation catches invalid data
- [ ] Tokens properly secured
- [ ] Production build works
- [ ] Health checks respond correctly
- [ ] Graceful shutdown works

---

## Appendix A: Environment Variables

```env
# Application
NODE_ENV=development
PORT=3001
LOG_LEVEL=debug

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/donuttrade

# Redis
REDIS_URL=redis://localhost:6379

# Microsoft OAuth (identity only — no XboxLive scopes)
MICROSOFT_CLIENT_ID=xxx
MICROSOFT_CLIENT_SECRET=xxx
MICROSOFT_REDIRECT_URI=http://localhost:3001/auth/microsoft/callback

# Discord OAuth
DISCORD_CLIENT_ID=xxx
DISCORD_CLIENT_SECRET=xxx
DISCORD_REDIRECT_URI=http://localhost:3001/auth/discord/callback
DISCORD_BOT_TOKEN=xxx

# Email Service (Resend)
RESEND_API_KEY=xxx
EMAIL_FROM_ADDRESS=noreply@donuttrade.com

# JWT Secrets
JWT_ACCESS_SECRET=xxx
JWT_REFRESH_SECRET=xxx

# Verification Bot
VERIFICATION_BOT_USERNAME=DonutTradeVerify
VERIFICATION_BOT_SERVER=donutsmp.net
VERIFICATION_WEBHOOK_SECRET=xxx

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:3001
```

---

## Appendix B: Testing Strategy

### Unit Tests

- Services: Business logic
- Utilities: Helper functions
- Validation: Schema validation

### Integration Tests

- API endpoints with test database
- Authentication flows
- Transaction atomicity

### E2E Tests

- Critical user journeys
- Admin workflows
- Error scenarios

### Load Tests

- Marketplace browsing
- Concurrent purchases
- WebSocket connections

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-24 | Claude | Initial implementation plan |
| 2.0 | 2026-02-12 | Claude | Rewrote Phases 1-5 for multi-method auth (Microsoft, Discord, Email). Removed Xbox/XSTS/Minecraft chain. Added payment verification, Discord OAuth, email/password auth. See Auth-Migration-Changelog.md for details. |
| 2.1 | 2026-03-01 | Claude | Status audit — updated all phase statuses to match actual implementation. Phases 0-2, 4-5 marked complete. Phase 3 marked partial (username entry done, Discord/Email not started). Phase 6 marked as scaffolded. Added Current Status summary table. |
