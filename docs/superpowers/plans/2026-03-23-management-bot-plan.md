# Management Bot & Discord Item Flow — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Discord management bot that handles item deposit/withdrawal tickets via HMAC-signed codes, plus tabbed web modals for code generation.

**Architecture:** Three components change in parallel-safe order: (1) API gets HMAC code generation, new internal endpoints, and schema migration, (2) a new `packages/management-bot/` Discord bot handles ticket creation/verification/closing, (3) the web frontend gets tabbed deposit/withdraw modals with code display. Components communicate via internal HTTP APIs authenticated with `BOT_WEBHOOK_SECRET`.

**Tech Stack:** discord.js v14, TypeScript, Fastify, Prisma, Node.js crypto (HMAC-SHA256), Next.js React

**Spec:** `docs/superpowers/specs/2026-03-23-management-bot-design.md`

---

## File Map

### API Changes (packages/api/)

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `prisma/schema.prisma` | Add code, codeExpiresAt, codeVerifiedAt, ticketChannelId, closedBy, closeReason fields to ItemDeposit and ItemWithdrawal |
| Modify | `src/config/index.ts` | Add `CODE_SIGNING_SECRET` env var |
| Create | `src/lib/deposit-code.ts` | HMAC code generation and verification utility |
| Modify | `src/services/item-deposit.service.ts` | Add `verifyAndClaimDeposit()`, `confirmVerifiedDeposit()`, `rejectVerifiedDeposit()` methods; modify `requestDeposit()` to return code |
| Modify | `src/services/item-withdrawal.service.ts` | Add `verifyAndClaimWithdrawal()`, `confirmVerifiedWithdrawal()`, `rejectVerifiedWithdrawal()` methods; modify `requestWithdrawal()` to return code |
| Modify | `src/services/platform-settings.service.ts` | Add `incrementTicketCounter()` method |
| Create | `src/routes/internal/management-bot.ts` | All management bot internal endpoints |
| Modify | `src/routes/internal/index.ts` | Register management bot routes |
| Modify | `src/routes/item-deposits.ts` | Return code + codeExpiresAt in POST response |
| Modify | `src/routes/item-withdrawals.ts` | Return code + codeExpiresAt in POST response |

### Shared Types (packages/shared/)

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `src/types/index.ts` | Add `'verified'` to ItemDepositStatus and ItemWithdrawalStatus; add code fields to record interfaces |

### Management Bot (packages/management-bot/) — All new

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `package.json` | Package config with discord.js, zod dependencies |
| Create | `tsconfig.json` | TypeScript config extending base |
| Create | `Dockerfile` | Multi-stage Docker build |
| Create | `src/index.ts` | Client setup, login, graceful shutdown |
| Create | `src/config.ts` | Env var validation with zod |
| Create | `src/api-client.ts` | HTTP client for DonutTrade internal API |
| Create | `src/events/ready.ts` | Startup: verify panel, register /close command |
| Create | `src/events/interactionCreate.ts` | Route buttons, modals, slash commands |
| Create | `src/interactions/ticket-panel.ts` | Persistent embed with deposit/withdraw buttons |
| Create | `src/interactions/ticket-modal.ts` | Modal submit: verify code, create channel |
| Create | `src/interactions/ticket-close.ts` | /close: confirm/reject via API, transcript, delete |
| Create | `src/services/transcript.ts` | Fetch messages, format as .txt |
| Create | `src/services/ticket.ts` | Channel creation, permissions, numbering |
| Create | `src/utils/embeds.ts` | Reusable embed builders |

### Web Frontend (packages/web/)

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `app/(app)/dashboard/page.tsx` | Replace DepositModal and WithdrawModal with tabbed versions |

### Infrastructure

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `docker-compose.yml` | Add management-bot service |
| Modify | `.env.example` (if exists) | Add new env vars |

---

## Task 1: Prisma Schema Migration

**Files:**
- Modify: `packages/api/prisma/schema.prisma:197-231`
- Modify: `packages/shared/src/types/index.ts:268-294`

- [ ] **Step 1: Update ItemDeposit model in schema.prisma**

Add after the `completedAt` field (line ~208):

```prisma
  code             String?   @unique
  codeExpiresAt    DateTime? @map("code_expires_at")
  codeVerifiedAt   DateTime? @map("code_verified_at")
  ticketChannelId  String?   @map("ticket_channel_id")
  closedBy         String?   @map("closed_by")
  closeReason      String?   @map("close_reason")
```

Update the status comment to: `// pending | verified | confirmed | rejected`

- [ ] **Step 2: Update ItemWithdrawal model in schema.prisma**

Add after the `completedAt` field (line ~226):

```prisma
  code             String?   @unique
  codeExpiresAt    DateTime? @map("code_expires_at")
  codeVerifiedAt   DateTime? @map("code_verified_at")
  ticketChannelId  String?   @map("ticket_channel_id")
  closedBy         String?   @map("closed_by")
  closeReason      String?   @map("close_reason")
```

Update the status comment to: `// pending | verified | processing | completed | failed | cancelled`

- [ ] **Step 3: Update shared types**

In `packages/shared/src/types/index.ts`:

Change `ItemDepositStatus` (line ~268):
```typescript
export type ItemDepositStatus = 'pending' | 'verified' | 'confirmed' | 'rejected';
```

Change `ItemWithdrawalStatus` (line ~284):
```typescript
export type ItemWithdrawalStatus = 'pending' | 'verified' | 'processing' | 'completed' | 'failed' | 'cancelled';
```

Add new fields to `ItemDepositRecord`:
```typescript
  code: string | null;
  codeExpiresAt: string | null;
```

Add new fields to `ItemWithdrawalRecord`:
```typescript
  code: string | null;
  codeExpiresAt: string | null;
```

- [ ] **Step 4: Generate and run migration**

```bash
cd packages/api
npx prisma migrate dev --name add-ticket-code-fields
```

Expected: Migration creates successfully, adds 6 nullable columns to each table.

- [ ] **Step 5: Commit**

```bash
git add packages/api/prisma/ packages/shared/src/types/index.ts
git commit -m "feat: add ticket code fields to deposit/withdrawal schema"
```

---

## Task 2: HMAC Code Generation Utility

**Files:**
- Create: `packages/api/src/lib/deposit-code.ts`
- Modify: `packages/api/src/config/index.ts`

- [ ] **Step 1: Add CODE_SIGNING_SECRET to config**

In `packages/api/src/config/index.ts`, add to the `envSchema` object:
```typescript
  CODE_SIGNING_SECRET: z.string().min(32),
```

Add to `getRedactedConfig()`:
```typescript
    CODE_SIGNING_SECRET: config.CODE_SIGNING_SECRET ? '[REDACTED]' : '[NOT SET]',
```

- [ ] **Step 2: Create the deposit-code utility**

Create `packages/api/src/lib/deposit-code.ts`:

```typescript
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
```

- [ ] **Step 3: Commit**

```bash
git add packages/api/src/lib/deposit-code.ts packages/api/src/config/index.ts
git commit -m "feat: add HMAC code generation and verification utility"
```

---

## Task 3: Update Deposit & Withdrawal Services

**Files:**
- Modify: `packages/api/src/services/item-deposit.service.ts`
- Modify: `packages/api/src/services/item-withdrawal.service.ts`
- Modify: `packages/api/src/services/platform-settings.service.ts`

- [ ] **Step 1: Add ticket counter to platform settings service**

In `packages/api/src/services/platform-settings.service.ts`, add this method to the class:

```typescript
  /**
   * Atomically increment the ticket counter and return the new value.
   * Uses UPSERT to handle first-use case (row doesn't exist yet).
   */
  async incrementTicketCounter(): Promise<number> {
    const result = await prisma.$queryRaw<[{ value: string }]>`
      INSERT INTO platform_settings (key, value, updated_by, updated_at)
      VALUES ('ticket_counter', '1', 'system', NOW())
      ON CONFLICT (key) DO UPDATE SET value = (platform_settings.value::int + 1)::text, updated_at = NOW()
      RETURNING value
    `;
    return parseInt(result[0].value, 10);
  }
```

- [ ] **Step 2: Add management-bot methods to item-deposit service**

In `packages/api/src/services/item-deposit.service.ts`, add these imports at the top:

```typescript
import { generateCode } from '../lib/deposit-code.js';
```

Modify the `requestDeposit` method — after the `prisma.itemDeposit.create()` call, generate the code and update the record:

```typescript
    // Generate HMAC code for Discord verification
    const { code, expiresAt } = generateCode({
      type: 'deposit',
      id: deposit.id,
      userId,
      itemId: catalogItemId,
      quantity,
    });

    await prisma.itemDeposit.update({
      where: { id: deposit.id },
      data: { code, codeExpiresAt: expiresAt },
    });
```

Update the return object to include `code` and `codeExpiresAt: expiresAt.toISOString()`.

Add new methods to the service:

```typescript
  /**
   * Atomically verify a deposit code and mark as verified.
   * Used by the management bot after modal submission.
   */
  async verifyAndClaimDeposit(depositId: string): Promise<boolean> {
    const result = await prisma.itemDeposit.updateMany({
      where: { id: depositId, status: 'pending' },
      data: { status: 'verified', codeVerifiedAt: new Date() },
    });
    return result.count > 0;
  }

  /**
   * Check if a deposit was recently verified (for idempotent retries).
   */
  async isRecentlyVerified(depositId: string): Promise<boolean> {
    const deposit = await prisma.itemDeposit.findUnique({
      where: { id: depositId },
      select: { status: true, codeVerifiedAt: true },
    });
    if (!deposit || deposit.status !== 'verified' || !deposit.codeVerifiedAt) return false;
    return (Date.now() - deposit.codeVerifiedAt.getTime()) < 60_000;
  }

  /**
   * Confirm a verified deposit (management bot /close confirm).
   * Separate from existing confirmDeposit which expects 'pending' status.
   */
  async confirmVerifiedDeposit(depositId: string, closedBy: string): Promise<void> {
    const deposit = await prisma.itemDeposit.findUnique({
      where: { id: depositId },
      include: { catalogItem: true },
    });

    if (!deposit) {
      throw new AppError('Deposit not found', { code: 'DEPOSIT_NOT_FOUND', statusCode: 404 });
    }
    if (deposit.status !== 'verified') {
      throw new AppError('Deposit is not in verified state', {
        code: 'INVALID_DEPOSIT_STATE',
        statusCode: 400,
        details: { currentStatus: deposit.status },
      });
    }

    await withTransaction(async (tx) => {
      await inventoryRepository.addItems(deposit.userId, deposit.catalogItemId, deposit.quantity, tx);
      await tx.itemDeposit.update({
        where: { id: depositId },
        data: {
          status: 'confirmed',
          completedAt: new Date(),
          closedBy,
        },
      });
    });

    depLogger.info('confirmVerifiedDeposit', 'Verified deposit confirmed via Discord', {
      depositId, closedBy, userId: deposit.userId,
    });
  }

  /**
   * Reject a verified deposit (management bot /close reject).
   */
  async rejectVerifiedDeposit(depositId: string, closedBy: string, reason: string): Promise<void> {
    const deposit = await prisma.itemDeposit.findUnique({
      where: { id: depositId },
    });

    if (!deposit) {
      throw new AppError('Deposit not found', { code: 'DEPOSIT_NOT_FOUND', statusCode: 404 });
    }
    if (deposit.status !== 'verified') {
      throw new AppError('Deposit is not in verified state', {
        code: 'INVALID_DEPOSIT_STATE',
        statusCode: 400,
        details: { currentStatus: deposit.status },
      });
    }

    await prisma.itemDeposit.update({
      where: { id: depositId },
      data: {
        status: 'rejected',
        completedAt: new Date(),
        closedBy,
        closeReason: reason,
      },
    });

    depLogger.info('rejectVerifiedDeposit', 'Verified deposit rejected via Discord', {
      depositId, closedBy, reason,
    });
  }

  /**
   * Find a deposit by its ticket channel ID.
   */
  async findByTicketChannel(channelId: string) {
    return prisma.itemDeposit.findFirst({
      where: { ticketChannelId: channelId },
      include: { catalogItem: true, user: true },
    });
  }

  /**
   * Set the ticket channel ID on a deposit record.
   */
  async setTicketChannel(depositId: string, channelId: string): Promise<void> {
    await prisma.itemDeposit.update({
      where: { id: depositId },
      data: { ticketChannelId: channelId },
    });
  }
```

- [ ] **Step 3: Add management-bot methods to item-withdrawal service**

Same pattern as deposits. In `packages/api/src/services/item-withdrawal.service.ts`:

Add import:
```typescript
import { generateCode } from '../lib/deposit-code.js';
```

Modify `requestWithdrawal` — after creating the withdrawal record (inside the transaction), generate the code:

```typescript
    const { code, expiresAt } = generateCode({
      type: 'withdrawal',
      id: withdrawal.id,
      userId,
      itemId: catalogItemId,
      quantity,
    });

    // Update with code outside transaction (non-critical)
    await prisma.itemWithdrawal.update({
      where: { id: withdrawal.id },
      data: { code, codeExpiresAt: expiresAt },
    });
```

Update the return object to include `code` and `codeExpiresAt`.

Add new methods (mirror the deposit service pattern):

```typescript
  async verifyAndClaimWithdrawal(withdrawalId: string): Promise<boolean> {
    const result = await prisma.itemWithdrawal.updateMany({
      where: { id: withdrawalId, status: 'pending' },
      data: { status: 'verified', codeVerifiedAt: new Date() },
    });
    return result.count > 0;
  }

  async isRecentlyVerified(withdrawalId: string): Promise<boolean> {
    const withdrawal = await prisma.itemWithdrawal.findUnique({
      where: { id: withdrawalId },
      select: { status: true, codeVerifiedAt: true },
    });
    if (!withdrawal || withdrawal.status !== 'verified' || !withdrawal.codeVerifiedAt) return false;
    return (Date.now() - withdrawal.codeVerifiedAt.getTime()) < 60_000;
  }

  async confirmVerifiedWithdrawal(withdrawalId: string, closedBy: string): Promise<void> {
    const withdrawal = await prisma.itemWithdrawal.findUnique({
      where: { id: withdrawalId },
      include: { catalogItem: true },
    });

    if (!withdrawal) {
      throw new AppError('Withdrawal not found', { code: 'WITHDRAWAL_NOT_FOUND', statusCode: 404 });
    }
    if (withdrawal.status !== 'verified') {
      throw new AppError('Withdrawal is not in verified state', {
        code: 'INVALID_WITHDRAWAL_STATE',
        statusCode: 400,
        details: { currentStatus: withdrawal.status },
      });
    }

    await withTransaction(async (tx) => {
      // Debit items: reduce both quantity and reservedQuantity (with safety guard)
      const result = await tx.inventoryItem.updateMany({
        where: {
          userId: withdrawal.userId,
          catalogItemId: withdrawal.catalogItemId,
          quantity: { gte: withdrawal.quantity },
          reservedQuantity: { gte: withdrawal.quantity },
        },
        data: {
          quantity: { decrement: withdrawal.quantity },
          reservedQuantity: { decrement: withdrawal.quantity },
        },
      });
      if (result.count === 0) {
        throw new AppError('Failed to remove items — inventory inconsistency', {
          code: 'INVENTORY_INCONSISTENCY',
          statusCode: 500,
        });
      }
      await tx.itemWithdrawal.update({
        where: { id: withdrawalId },
        data: {
          status: 'completed',
          completedAt: new Date(),
          closedBy,
        },
      });
    });

    // Publish SSE event for real-time updates
    void eventBus.publish(withdrawal.userId, 'item_withdrawal.completed', {
      withdrawalId,
      catalogItemId: withdrawal.catalogItemId,
      quantity: withdrawal.quantity,
    });

    wdLogger.info('confirmVerifiedWithdrawal', 'Verified withdrawal confirmed via Discord', {
      withdrawalId, closedBy, userId: withdrawal.userId,
    });
  }

  async rejectVerifiedWithdrawal(withdrawalId: string, closedBy: string, reason: string): Promise<void> {
    const withdrawal = await prisma.itemWithdrawal.findUnique({
      where: { id: withdrawalId },
      include: { catalogItem: true },
    });

    if (!withdrawal) {
      throw new AppError('Withdrawal not found', { code: 'WITHDRAWAL_NOT_FOUND', statusCode: 404 });
    }
    if (withdrawal.status !== 'verified') {
      throw new AppError('Withdrawal is not in verified state', {
        code: 'INVALID_WITHDRAWAL_STATE',
        statusCode: 400,
        details: { currentStatus: withdrawal.status },
      });
    }

    await withTransaction(async (tx) => {
      // Release the reservation — items go back to user's available inventory
      await inventoryRepository.releaseReservation(
        withdrawal.userId, withdrawal.catalogItemId, withdrawal.quantity, tx
      );
      await tx.itemWithdrawal.update({
        where: { id: withdrawalId },
        data: {
          status: 'failed',
          completedAt: new Date(),
          closedBy,
          closeReason: reason,
        },
      });
    });

    wdLogger.info('rejectVerifiedWithdrawal', 'Verified withdrawal rejected via Discord', {
      withdrawalId, closedBy, reason,
    });
  }

  async findByTicketChannel(channelId: string) {
    return prisma.itemWithdrawal.findFirst({
      where: { ticketChannelId: channelId },
      include: { catalogItem: true, user: true },
    });
  }

  async setTicketChannel(withdrawalId: string, channelId: string): Promise<void> {
    await prisma.itemWithdrawal.update({
      where: { id: withdrawalId },
      data: { ticketChannelId: channelId },
    });
  }
```

- [ ] **Step 4: Commit**

```bash
git add packages/api/src/services/
git commit -m "feat: add management bot service methods for deposits, withdrawals, and ticket counter"
```

---

## Task 4: Management Bot Internal API Routes

**Files:**
- Create: `packages/api/src/routes/internal/management-bot.ts`
- Modify: `packages/api/src/routes/internal/index.ts`

- [ ] **Step 1: Create management bot internal routes**

Create `packages/api/src/routes/internal/management-bot.ts`:

```typescript
import { FastifyPluginAsync } from 'fastify';
import { config } from '../../config/index.js';
import { logger } from '../../lib/logger.js';
import { AppError } from '../../lib/errors.js';
import { verifyCode } from '../../lib/deposit-code.js';
import { itemDepositService } from '../../services/item-deposit.service.js';
import { itemWithdrawalService } from '../../services/item-withdrawal.service.js';
import { platformSettingsService } from '../../services/platform-settings.service.js';
import { prisma } from '../../services/database.js';

const botLogger = logger.module('internal.management-bot');

export const managementBotRoutes: FastifyPluginAsync = async (fastify) => {
  // Shared auth for all management bot routes
  const authenticateBot = async (request: any) => {
    const authHeader = request.headers.authorization;
    if (!authHeader) {
      throw new AppError('Authorization required', { code: 'UNAUTHORIZED', statusCode: 401 });
    }
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer' || parts[1] !== config.BOT_WEBHOOK_SECRET) {
      botLogger.warn('unauthorized', 'Invalid webhook secret for management bot');
      throw new AppError('Invalid authorization', { code: 'UNAUTHORIZED', statusCode: 401 });
    }
  };

  /**
   * POST /internal/management-bot/verify-code
   * Validate an HMAC code and mark the deposit/withdrawal as verified.
   */
  fastify.post<{ Body: { code: string } }>('/management-bot/verify-code', {
    schema: {
      body: {
        type: 'object',
        required: ['code'],
        properties: { code: { type: 'string' } },
      },
    },
    preHandler: authenticateBot,
  }, async (request) => {
    const { code } = request.body;

    const payload = verifyCode(code);
    if (!payload) {
      throw new AppError('Invalid or expired code', { code: 'INVALID_CODE', statusCode: 400 });
    }

    if (payload.type === 'deposit') {
      // Check idempotent retry
      if (await itemDepositService.isRecentlyVerified(payload.id)) {
        const deposit = await prisma.itemDeposit.findUnique({
          where: { id: payload.id },
          include: { catalogItem: true, user: true },
        });
        return {
          success: true,
          data: {
            type: 'deposit',
            recordId: payload.id,
            userId: payload.userId,
            username: deposit?.user?.minecraftUsername || 'Unknown',
            catalogItemDisplayName: deposit?.catalogItem?.displayName || 'Unknown',
            quantity: payload.quantity,
          },
        };
      }

      const claimed = await itemDepositService.verifyAndClaimDeposit(payload.id);
      if (!claimed) {
        throw new AppError('This code has already been used', { code: 'CODE_ALREADY_USED', statusCode: 409 });
      }

      const deposit = await prisma.itemDeposit.findUnique({
        where: { id: payload.id },
        include: { catalogItem: true, user: true },
      });

      botLogger.info('verify-code.deposit', 'Deposit code verified', {
        depositId: payload.id, userId: payload.userId,
      });

      return {
        success: true,
        data: {
          type: 'deposit',
          recordId: payload.id,
          userId: payload.userId,
          username: deposit?.user?.minecraftUsername || 'Unknown',
          catalogItemDisplayName: deposit?.catalogItem?.displayName || 'Unknown',
          quantity: payload.quantity,
        },
      };
    }

    if (payload.type === 'withdrawal') {
      if (await itemWithdrawalService.isRecentlyVerified(payload.id)) {
        const withdrawal = await prisma.itemWithdrawal.findUnique({
          where: { id: payload.id },
          include: { catalogItem: true, user: true },
        });
        return {
          success: true,
          data: {
            type: 'withdrawal',
            recordId: payload.id,
            userId: payload.userId,
            username: withdrawal?.user?.minecraftUsername || 'Unknown',
            catalogItemDisplayName: withdrawal?.catalogItem?.displayName || 'Unknown',
            quantity: payload.quantity,
          },
        };
      }

      const claimed = await itemWithdrawalService.verifyAndClaimWithdrawal(payload.id);
      if (!claimed) {
        throw new AppError('This code has already been used', { code: 'CODE_ALREADY_USED', statusCode: 409 });
      }

      const withdrawal = await prisma.itemWithdrawal.findUnique({
        where: { id: payload.id },
        include: { catalogItem: true, user: true },
      });

      botLogger.info('verify-code.withdrawal', 'Withdrawal code verified', {
        withdrawalId: payload.id, userId: payload.userId,
      });

      return {
        success: true,
        data: {
          type: 'withdrawal',
          recordId: payload.id,
          userId: payload.userId,
          username: withdrawal?.user?.minecraftUsername || 'Unknown',
          catalogItemDisplayName: withdrawal?.catalogItem?.displayName || 'Unknown',
          quantity: payload.quantity,
        },
      };
    }

    throw new AppError('Invalid code type', { code: 'INVALID_CODE', statusCode: 400 });
  });

  /**
   * POST /internal/management-bot/confirm-deposit/:id
   */
  fastify.post<{
    Params: { id: string };
    Body: { closedBy: string };
  }>('/management-bot/confirm-deposit/:id', {
    schema: {
      body: {
        type: 'object',
        required: ['closedBy'],
        properties: { closedBy: { type: 'string' } },
      },
    },
    preHandler: authenticateBot,
  }, async (request) => {
    await itemDepositService.confirmVerifiedDeposit(request.params.id, request.body.closedBy);
    return { success: true };
  });

  /**
   * POST /internal/management-bot/confirm-withdrawal/:id
   */
  fastify.post<{
    Params: { id: string };
    Body: { closedBy: string };
  }>('/management-bot/confirm-withdrawal/:id', {
    schema: {
      body: {
        type: 'object',
        required: ['closedBy'],
        properties: { closedBy: { type: 'string' } },
      },
    },
    preHandler: authenticateBot,
  }, async (request) => {
    await itemWithdrawalService.confirmVerifiedWithdrawal(request.params.id, request.body.closedBy);
    return { success: true };
  });

  /**
   * POST /internal/management-bot/reject-deposit/:id
   */
  fastify.post<{
    Params: { id: string };
    Body: { closedBy: string; reason: string };
  }>('/management-bot/reject-deposit/:id', {
    schema: {
      body: {
        type: 'object',
        required: ['closedBy', 'reason'],
        properties: {
          closedBy: { type: 'string' },
          reason: { type: 'string' },
        },
      },
    },
    preHandler: authenticateBot,
  }, async (request) => {
    await itemDepositService.rejectVerifiedDeposit(
      request.params.id, request.body.closedBy, request.body.reason
    );
    return { success: true };
  });

  /**
   * POST /internal/management-bot/reject-withdrawal/:id
   */
  fastify.post<{
    Params: { id: string };
    Body: { closedBy: string; reason: string };
  }>('/management-bot/reject-withdrawal/:id', {
    schema: {
      body: {
        type: 'object',
        required: ['closedBy', 'reason'],
        properties: {
          closedBy: { type: 'string' },
          reason: { type: 'string' },
        },
      },
    },
    preHandler: authenticateBot,
  }, async (request) => {
    await itemWithdrawalService.rejectVerifiedWithdrawal(
      request.params.id, request.body.closedBy, request.body.reason
    );
    return { success: true };
  });

  /**
   * POST /internal/management-bot/ticket-counter
   */
  fastify.post('/management-bot/ticket-counter', {
    preHandler: authenticateBot,
  }, async () => {
    const number = await platformSettingsService.incrementTicketCounter();
    return { success: true, data: { number } };
  });

  /**
   * PATCH /internal/management-bot/ticket-channel
   */
  fastify.patch<{
    Body: { type: 'deposit' | 'withdrawal'; recordId: string; channelId: string };
  }>('/management-bot/ticket-channel', {
    schema: {
      body: {
        type: 'object',
        required: ['type', 'recordId', 'channelId'],
        properties: {
          type: { type: 'string', enum: ['deposit', 'withdrawal'] },
          recordId: { type: 'string' },
          channelId: { type: 'string' },
        },
      },
    },
    preHandler: authenticateBot,
  }, async (request) => {
    const { type, recordId, channelId } = request.body;
    if (type === 'deposit') {
      await itemDepositService.setTicketChannel(recordId, channelId);
    } else {
      await itemWithdrawalService.setTicketChannel(recordId, channelId);
    }
    return { success: true };
  });
};
```

- [ ] **Step 2: Register management bot routes**

In `packages/api/src/routes/internal/index.ts`, add:

```typescript
import { managementBotRoutes } from './management-bot.js';
```

And register it:
```typescript
  await fastify.register(managementBotRoutes);
```

- [ ] **Step 3: Update user-facing deposit route to return code**

In `packages/api/src/routes/item-deposits.ts`, update the POST handler's return to include the new code fields from the service response. The service already returns them after Task 3 modifications.

- [ ] **Step 4: Update user-facing withdrawal route to return code**

Same pattern in `packages/api/src/routes/item-withdrawals.ts`.

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/routes/
git commit -m "feat: add management bot internal API routes and code returns"
```

---

## Task 5: Management Bot — Package Setup

**Files:**
- Create: `packages/management-bot/package.json`
- Create: `packages/management-bot/tsconfig.json`
- Create: `packages/management-bot/Dockerfile`
- Create: `packages/management-bot/src/config.ts`
- Create: `packages/management-bot/src/index.ts`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@donuttrade/management-bot",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "discord.js": "^14.16.0",
    "dotenv": "^16.4.0",
    "zod": "^3.22.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "tsx": "^4.7.0",
    "typescript": "^5.3.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "module": "NodeNext",
    "moduleResolution": "NodeNext"
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 3: Create Dockerfile**

Model after `packages/deposit-bot/Dockerfile` — multi-stage build with node:20-alpine and pnpm. Replace `deposit-bot` with `management-bot` in all paths.

- [ ] **Step 4: Create config.ts**

```typescript
import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '..', '..', '..', '.env') });

const envSchema = z.object({
  DISCORD_BOT_TOKEN: z.string().min(1),
  DISCORD_GUILD_ID: z.string().min(1),
  DISCORD_TICKET_CATEGORY_ID: z.string().min(1),
  DISCORD_MODERATOR_ROLE_ID: z.string().min(1),
  DISCORD_PANEL_CHANNEL_ID: z.string().min(1),
  DISCORD_LOGS_CHANNEL_ID: z.string().min(1),
  API_URL: z.string().url().default('http://api:3001'),
  BOT_WEBHOOK_SECRET: z.string().min(32),
});

const result = envSchema.safeParse(process.env);
if (!result.success) {
  console.error('Invalid environment variables:', result.error.format());
  process.exit(1);
}

export const config = result.data;
```

- [ ] **Step 5: Create index.ts**

```typescript
import { Client, GatewayIntentBits, Events } from 'discord.js';
import { config } from './config.js';
import { onReady } from './events/ready.js';
import { onInteractionCreate } from './events/interactionCreate.js';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});

client.once(Events.ClientReady, onReady);
client.on(Events.InteractionCreate, onInteractionCreate);

client.login(config.DISCORD_BOT_TOKEN);

// Graceful shutdown
function shutdown(signal: string) {
  console.log(`Received ${signal}. Shutting down...`);
  client.destroy();
  process.exit(0);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
```

- [ ] **Step 6: Install dependencies**

```bash
cd packages/management-bot
npm install
```

- [ ] **Step 7: Commit**

```bash
git add packages/management-bot/
git commit -m "feat: scaffold management bot package with config and entry point"
```

---

## Task 6: Management Bot — API Client

**Files:**
- Create: `packages/management-bot/src/api-client.ts`

- [ ] **Step 1: Create the API client**

```typescript
import { config } from './config.js';

const headers = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${config.BOT_WEBHOOK_SECRET}`,
};

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const url = `${config.API_URL}/internal/management-bot${path}`;
  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const json = await res.json() as any;

  if (!res.ok) {
    const errMsg = json?.error || json?.message || `API error ${res.status}`;
    throw new Error(errMsg);
  }

  return json as T;
}

export interface VerifyCodeResult {
  success: boolean;
  data: {
    type: 'deposit' | 'withdrawal';
    recordId: string;
    userId: string;
    username: string;
    catalogItemDisplayName: string;
    quantity: number;
  };
}

export const apiClient = {
  async verifyCode(code: string): Promise<VerifyCodeResult> {
    return request('POST', '/verify-code', { code });
  },

  async confirmDeposit(id: string, closedBy: string) {
    return request('POST', `/confirm-deposit/${id}`, { closedBy });
  },

  async confirmWithdrawal(id: string, closedBy: string) {
    return request('POST', `/confirm-withdrawal/${id}`, { closedBy });
  },

  async rejectDeposit(id: string, closedBy: string, reason: string) {
    return request('POST', `/reject-deposit/${id}`, { closedBy, reason });
  },

  async rejectWithdrawal(id: string, closedBy: string, reason: string) {
    return request('POST', `/reject-withdrawal/${id}`, { closedBy, reason });
  },

  async getNextTicketNumber(): Promise<number> {
    const result = await request<{ success: boolean; data: { number: number } }>('POST', '/ticket-counter');
    return result.data.number;
  },

  async setTicketChannel(type: 'deposit' | 'withdrawal', recordId: string, channelId: string) {
    return request('PATCH', '/ticket-channel', { type, recordId, channelId });
  },
};
```

- [ ] **Step 2: Commit**

```bash
git add packages/management-bot/src/api-client.ts
git commit -m "feat: add management bot API client"
```

---

## Task 7: Management Bot — Embeds & Ticket Service

**Files:**
- Create: `packages/management-bot/src/utils/embeds.ts`
- Create: `packages/management-bot/src/services/ticket.ts`
- Create: `packages/management-bot/src/services/transcript.ts`

- [ ] **Step 1: Create embed builders**

```typescript
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

const BRAND_COLOR = 0xF5A623; // amber/gold

export function buildPanelEmbed() {
  return new EmbedBuilder()
    .setTitle('DonutTrade Support')
    .setDescription('Need to deposit or withdraw items?\nClick below to create a ticket.')
    .setColor(BRAND_COLOR);
}

export function buildPanelButtons() {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('ticket_deposit')
      .setLabel('Deposit Items')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('📥'),
    new ButtonBuilder()
      .setCustomId('ticket_withdraw')
      .setLabel('Withdraw Items')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('📤'),
  );
}

export function buildTicketWelcomeEmbed(opts: {
  type: 'deposit' | 'withdrawal';
  number: number;
  username: string;
  itemName: string;
  quantity: number;
}) {
  const title = opts.type === 'deposit' ? `Deposit #${opts.number}` : `Withdrawal #${opts.number}`;
  return new EmbedBuilder()
    .setTitle(title)
    .setColor(opts.type === 'deposit' ? 0x57F287 : 0xED4245)
    .addFields(
      { name: 'Player', value: opts.username, inline: true },
      { name: 'Item', value: opts.itemName, inline: true },
      { name: 'Quantity', value: opts.quantity.toString(), inline: true },
    )
    .setDescription('A moderator will coordinate the in-game handoff with you.')
    .setFooter({ text: 'Moderators: use /close when the handoff is complete' })
    .setTimestamp();
}

export function buildTranscriptEmbed(opts: {
  channelName: string;
  type: 'deposit' | 'withdrawal';
  username: string;
  itemName: string;
  quantity: number;
  result: 'confirmed' | 'rejected';
  closedBy: string;
  openedAt: Date;
}) {
  return new EmbedBuilder()
    .setTitle(opts.channelName)
    .setColor(opts.result === 'confirmed' ? 0x57F287 : 0xED4245)
    .addFields(
      { name: 'Player', value: opts.username, inline: true },
      { name: 'Item', value: opts.itemName, inline: true },
      { name: 'Quantity', value: opts.quantity.toString(), inline: true },
      { name: 'Result', value: opts.result, inline: true },
      { name: 'Closed by', value: opts.closedBy, inline: true },
      { name: 'Opened', value: `<t:${Math.floor(opts.openedAt.getTime() / 1000)}:R>`, inline: true },
    )
    .setTimestamp();
}
```

- [ ] **Step 2: Create ticket service**

```typescript
import {
  Guild,
  ChannelType,
  PermissionFlagsBits,
  TextChannel,
} from 'discord.js';
import { config } from '../config.js';
import { apiClient } from '../api-client.js';
import { buildTicketWelcomeEmbed } from '../utils/embeds.js';

export async function createTicketChannel(guild: Guild, opts: {
  type: 'deposit' | 'withdrawal';
  userId: string; // Discord user ID
  recordId: string;
  username: string;
  itemName: string;
  quantity: number;
}): Promise<TextChannel> {
  const number = await apiClient.getNextTicketNumber();
  const channelName = `${opts.type === 'deposit' ? 'deposit' : 'withdraw'}-${number}`;

  const channel = await guild.channels.create({
    name: channelName,
    type: ChannelType.GuildText,
    parent: config.DISCORD_TICKET_CATEGORY_ID,
    topic: opts.recordId, // Store record ID for /close lookup
    permissionOverwrites: [
      {
        id: guild.id, // @everyone
        deny: [PermissionFlagsBits.ViewChannel],
      },
      {
        id: opts.userId,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.AttachFiles,
        ],
      },
      {
        id: config.DISCORD_MODERATOR_ROLE_ID,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.ManageMessages,
        ],
      },
      {
        id: guild.members.me!.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ManageChannels,
          PermissionFlagsBits.ReadMessageHistory,
        ],
      },
    ],
  });

  // Store channel ID on the record
  await apiClient.setTicketChannel(opts.type, opts.recordId, channel.id);

  // Send welcome embed
  const embed = buildTicketWelcomeEmbed({
    type: opts.type,
    number,
    username: opts.username,
    itemName: opts.itemName,
    quantity: opts.quantity,
  });

  await channel.send({ embeds: [embed] });

  return channel;
}
```

- [ ] **Step 3: Create transcript service**

```typescript
import { TextChannel, AttachmentBuilder, Message } from 'discord.js';

/**
 * Fetch all messages from a channel and format as a text transcript.
 */
export async function generateTranscript(channel: TextChannel): Promise<AttachmentBuilder> {
  const allMessages: Message[] = [];
  let lastId: string | undefined;

  // Fetch all messages (100 at a time)
  while (true) {
    const batch = await channel.messages.fetch({ limit: 100, before: lastId });
    if (batch.size === 0) break;

    for (const msg of batch.values()) {
      allMessages.push(msg);
    }

    lastId = batch.last()?.id;
    if (batch.size < 100) break;
  }

  // Sort all messages chronologically (oldest first)
  allMessages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);

  const lines = allMessages.map((msg) => {
    const time = msg.createdAt.toISOString().replace('T', ' ').slice(0, 19);
    const author = msg.author.bot ? `[BOT] ${msg.author.username}` : msg.author.username;
    const content = msg.content || (msg.embeds.length > 0 ? '[embed]' : '[no content]');
    return `[${time}] ${author}: ${content}`;
  });

  const transcript = lines.join('\n') || '(empty conversation)';
  const fileName = `${channel.name}-transcript.txt`;

  return new AttachmentBuilder(Buffer.from(transcript, 'utf-8'), { name: fileName });
}
```

- [ ] **Step 4: Commit**

```bash
git add packages/management-bot/src/utils/ packages/management-bot/src/services/
git commit -m "feat: add embed builders, ticket service, and transcript generation"
```

---

## Task 8: Management Bot — Interactions (Panel, Modal, Close)

**Files:**
- Create: `packages/management-bot/src/interactions/ticket-panel.ts`
- Create: `packages/management-bot/src/interactions/ticket-modal.ts`
- Create: `packages/management-bot/src/interactions/ticket-close.ts`

- [ ] **Step 1: Create ticket panel interaction**

```typescript
import { Client, TextChannel } from 'discord.js';
import { config } from '../config.js';
import { buildPanelEmbed, buildPanelButtons } from '../utils/embeds.js';

/**
 * Ensure the persistent panel exists in the configured channel.
 * Scans recent messages; if none found from this bot with the right embed, sends a new one.
 */
export async function ensurePanel(client: Client<true>): Promise<void> {
  const channel = client.channels.cache.get(config.DISCORD_PANEL_CHANNEL_ID);
  if (!channel?.isTextBased()) {
    console.error(`Panel channel ${config.DISCORD_PANEL_CHANNEL_ID} not found or not text-based`);
    return;
  }

  const textChannel = channel as TextChannel;
  const messages = await textChannel.messages.fetch({ limit: 50 });
  const existingPanel = messages.find(
    (m) => m.author.id === client.user.id && m.embeds.some((e) => e.title === 'DonutTrade Support')
  );

  if (existingPanel) {
    console.log('Panel already exists, skipping creation');
    return;
  }

  const embed = buildPanelEmbed();
  const buttons = buildPanelButtons();
  await textChannel.send({ embeds: [embed], components: [buttons] });
  console.log('Persistent panel sent to #create-ticket');
}
```

- [ ] **Step 2: Create ticket modal interaction**

```typescript
import {
  ButtonInteraction,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ModalSubmitInteraction,
} from 'discord.js';
import { apiClient } from '../api-client.js';
import { createTicketChannel } from '../services/ticket.js';

// Per-user cooldown: 1 modal per 10 seconds
const cooldowns = new Map<string, number>();
const COOLDOWN_MS = 10_000;

export async function handleTicketButton(interaction: ButtonInteraction) {
  const userId = interaction.user.id;

  // Rate limit check
  const lastUse = cooldowns.get(userId) || 0;
  if (Date.now() - lastUse < COOLDOWN_MS) {
    const remaining = Math.ceil((COOLDOWN_MS - (Date.now() - lastUse)) / 1000);
    await interaction.reply({ content: `Please wait ${remaining}s before creating another ticket.`, ephemeral: true });
    return;
  }
  cooldowns.set(userId, Date.now());

  const type = interaction.customId === 'ticket_deposit' ? 'deposit' : 'withdrawal';
  const prefix = type === 'deposit' ? 'DT-DEP-' : 'DT-WTH-';

  const modal = new ModalBuilder()
    .setCustomId(`modal_${type}`)
    .setTitle(type === 'deposit' ? 'Deposit Items' : 'Withdraw Items');

  const codeInput = new TextInputBuilder()
    .setCustomId('code_input')
    .setLabel('Paste your code from the DonutTrade website')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder(`${prefix}eyJ...`)
    .setRequired(true);

  modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(codeInput));
  await interaction.showModal(modal);
}

export async function handleModalSubmit(interaction: ModalSubmitInteraction) {
  await interaction.deferReply({ ephemeral: true });

  const code = interaction.fields.getTextInputValue('code_input').trim();
  const type = interaction.customId === 'modal_deposit' ? 'deposit' : 'withdrawal';

  try {
    const result = await apiClient.verifyCode(code);

    const channel = await createTicketChannel(interaction.guild!, {
      type,
      userId: interaction.user.id,
      recordId: result.data.recordId,
      username: result.data.username,
      itemName: result.data.catalogItemDisplayName,
      quantity: result.data.quantity,
    });

    await interaction.editReply({ content: `Ticket created: ${channel}` });
  } catch (err: any) {
    const message = err.message?.includes('expired') || err.message?.includes('Invalid')
      ? 'Invalid or expired code. Please generate a new one on the website.'
      : err.message?.includes('already been used')
        ? 'This code has already been used.'
        : 'Could not reach the platform. Please try again later.';

    await interaction.editReply({ content: message });
  }
}
```

- [ ] **Step 3: Create ticket close interaction**

```typescript
import {
  ChatInputCommandInteraction,
  TextChannel,
  SlashCommandBuilder,
  PermissionFlagsBits,
} from 'discord.js';
import { config } from '../config.js';
import { apiClient } from '../api-client.js';
import { generateTranscript } from '../services/transcript.js';
import { buildTranscriptEmbed } from '../utils/embeds.js';

export const closeCommandData = new SlashCommandBuilder()
  .setName('close')
  .setDescription('Close a ticket channel')
  .addStringOption((opt) =>
    opt.setName('action')
      .setDescription('Confirm or reject the deposit/withdrawal')
      .addChoices(
        { name: 'confirm', value: 'confirm' },
        { name: 'reject', value: 'reject' },
      )
  )
  .addStringOption((opt) =>
    opt.setName('reason')
      .setDescription('Reason for rejection (required when rejecting)')
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels);

export async function handleCloseCommand(interaction: ChatInputCommandInteraction) {
  // Check moderator role
  const member = interaction.guild!.members.cache.get(interaction.user.id)
    || await interaction.guild!.members.fetch(interaction.user.id);
  if (!member.roles.cache.has(config.DISCORD_MODERATOR_ROLE_ID)) {
    await interaction.reply({ content: 'Only moderators can close tickets.', ephemeral: true });
    return;
  }

  const channel = interaction.channel as TextChannel;
  const channelName = channel.name;
  const action = interaction.options.getString('action') || 'confirm';
  const reason = interaction.options.getString('reason') || '';

  if (action === 'reject' && !reason) {
    await interaction.reply({ content: 'Please provide a reason for rejection.', ephemeral: true });
    return;
  }

  // Determine type from channel name
  let type: 'deposit' | 'withdrawal';
  if (channelName.startsWith('deposit-')) {
    type = 'deposit';
  } else if (channelName.startsWith('withdraw-')) {
    type = 'withdrawal';
  } else {
    await interaction.reply({ content: 'This command can only be used in a ticket channel.', ephemeral: true });
    return;
  }

  // Look up the record by channel ID
  // (The API client doesn't have a lookup-by-channel method, so we use verify-code endpoint's
  //  stored ticketChannelId — but we need a find endpoint. For now, we'll store the recordId
  //  in the channel topic as a lightweight approach.)
  // Actually, let's search by ticketChannelId via a new endpoint or use channel topic.
  // Simpler: store recordId in channel topic when creating the channel.

  await interaction.deferReply();

  try {
    // Read record ID from channel topic (set during channel creation)
    const recordId = channel.topic;
    if (!recordId) {
      await interaction.editReply({ content: 'Could not find the ticket record for this channel.' });
      return;
    }

    const closedBy = interaction.user.username;

    // Confirm or reject via API
    if (action === 'confirm') {
      if (type === 'deposit') {
        await apiClient.confirmDeposit(recordId, closedBy);
      } else {
        await apiClient.confirmWithdrawal(recordId, closedBy);
      }
    } else {
      if (type === 'deposit') {
        await apiClient.rejectDeposit(recordId, closedBy, reason);
      } else {
        await apiClient.rejectWithdrawal(recordId, closedBy, reason);
      }
    }

    // Extract ticket info from welcome embed
    const messages = await channel.messages.fetch({ limit: 10 });
    const welcomeMsg = messages.find(
      (m) => m.author.id === interaction.client.user!.id && m.embeds.length > 0
    );
    const fields = welcomeMsg?.embeds[0]?.fields;
    const username = fields?.find((f) => f.name === 'Player')?.value ?? '(unknown)';
    const itemName = fields?.find((f) => f.name === 'Item')?.value ?? '(unknown)';
    const quantity = parseInt(fields?.find((f) => f.name === 'Quantity')?.value ?? '0', 10);

    // Generate transcript
    const transcript = await generateTranscript(channel);

    // Send to ticket-logs
    const logsChannel = interaction.guild!.channels.cache.get(config.DISCORD_LOGS_CHANNEL_ID) as TextChannel;
    if (logsChannel) {
      const embed = buildTranscriptEmbed({
        channelName,
        type,
        username,
        itemName,
        quantity,
        result: action === 'confirm' ? 'confirmed' : 'rejected',
        closedBy,
        openedAt: channel.createdAt || new Date(),
      });

      await logsChannel.send({ embeds: [embed], files: [transcript] });
    }

    await interaction.editReply({ content: `Ticket ${action}ed. Deleting channel in 5 seconds...` });

    // Delete channel after brief delay
    setTimeout(async () => {
      try {
        await channel.delete();
      } catch (e) {
        console.error('Failed to delete ticket channel:', e);
      }
    }, 5000);

  } catch (err: any) {
    const message = err.message?.includes('already been closed')
      ? 'This ticket has already been closed.'
      : `Error closing ticket: ${err.message}`;
    await interaction.editReply({ content: message });
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add packages/management-bot/src/interactions/
git commit -m "feat: add ticket panel, modal, and close command interactions"
```

---

## Task 9: Management Bot — Event Handlers

**Files:**
- Create: `packages/management-bot/src/events/ready.ts`
- Create: `packages/management-bot/src/events/interactionCreate.ts`

- [ ] **Step 1: Create ready event handler**

```typescript
import { Client, REST, Routes } from 'discord.js';
import { config } from '../config.js';
import { ensurePanel } from '../interactions/ticket-panel.js';
import { closeCommandData } from '../interactions/ticket-close.js';

export async function onReady(client: Client<true>) {
  console.log(`Management bot logged in as ${client.user.tag}`);
  console.log(`Serving guild: ${config.DISCORD_GUILD_ID}`);

  // Register /close slash command (guild-scoped for instant availability)
  const rest = new REST({ version: '10' }).setToken(config.DISCORD_BOT_TOKEN);
  try {
    await rest.put(
      Routes.applicationGuildCommands(client.user.id, config.DISCORD_GUILD_ID),
      { body: [closeCommandData.toJSON()] },
    );
    console.log('Registered /close slash command');
  } catch (err) {
    console.error('Failed to register slash commands:', err);
  }

  // Ensure persistent panel exists
  await ensurePanel(client);
}
```

- [ ] **Step 2: Create interactionCreate event handler**

```typescript
import { Interaction } from 'discord.js';
import { handleTicketButton, handleModalSubmit } from '../interactions/ticket-modal.js';
import { handleCloseCommand } from '../interactions/ticket-close.js';

export async function onInteractionCreate(interaction: Interaction) {
  try {
    if (interaction.isButton()) {
      if (interaction.customId === 'ticket_deposit' || interaction.customId === 'ticket_withdraw') {
        return handleTicketButton(interaction);
      }
    }

    if (interaction.isModalSubmit()) {
      if (interaction.customId === 'modal_deposit' || interaction.customId === 'modal_withdraw') {
        return handleModalSubmit(interaction);
      }
    }

    if (interaction.isChatInputCommand()) {
      if (interaction.commandName === 'close') {
        return handleCloseCommand(interaction);
      }
    }
  } catch (err) {
    console.error('Interaction handler error:', err);
    if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: 'An error occurred.', ephemeral: true }).catch(() => {});
    }
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/management-bot/src/events/
git commit -m "feat: add ready and interactionCreate event handlers"
```

---

## Task 10: Management Bot — tsconfig exclude

**Files:**
- Modify: `packages/management-bot/tsconfig.json`

- [ ] **Step 1: Add exclude to tsconfig**

Add `"exclude": ["node_modules", "dist"]` to `packages/management-bot/tsconfig.json` (matching deposit-bot pattern).

- [ ] **Step 2: Commit**

```bash
git add packages/management-bot/tsconfig.json
git commit -m "chore: add exclude to management bot tsconfig"
```

---

## Task 11: Docker & Infrastructure

**Files:**
- Modify: `docker-compose.yml`

- [ ] **Step 1: Add management-bot service to docker-compose.yml**

Add after the `deposit-bot` service:

```yaml
  # Discord Management Bot
  management-bot:
    build:
      context: .
      dockerfile: packages/management-bot/Dockerfile
    container_name: donuttrade-management-bot
    environment:
      - API_URL=http://api:3001
    env_file:
      - .env
    depends_on:
      - api
    restart: unless-stopped
```

- [ ] **Step 2: Commit**

```bash
git add docker-compose.yml
git commit -m "feat: add management bot to Docker Compose"
```

---

## Task 12: Web Frontend — Tabbed Deposit Modal

**Files:**
- Modify: `packages/web/app/(app)/dashboard/page.tsx`

- [ ] **Step 1: Add constants and types at the top of the file**

Add near the existing constants (after line ~22):

```typescript
const DISCORD_INVITE_URL = process.env.NEXT_PUBLIC_DISCORD_INVITE_URL || '#';

interface CatalogItem {
  id: string;
  displayName: string;
  name: string;
  category: string;
  enabled: boolean;
}
```

- [ ] **Step 2: Replace DepositModal with tabbed version**

Replace the entire `DepositModal` component (lines ~26-51) with:

```tsx
function DepositModal({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<'money' | 'items'>('money');
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);
  const [selectedItemId, setSelectedItemId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [codeExpiresAt, setCodeExpiresAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (tab === 'items' && catalogItems.length === 0) {
      apiFetch<{ data: CatalogItem[] }>('/catalog/items')
        .then((res) => {
          const enabled = res.data.filter((i) => i.enabled);
          setCatalogItems(enabled);
          if (enabled.length > 0) setSelectedItemId(enabled[0].id);
        })
        .catch(() => setError('Failed to load catalog items'));
    }
  }, [tab]);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<{ data: { code: string; codeExpiresAt: string } }>('/item-deposits', {
        method: 'POST',
        body: JSON.stringify({ catalogItemId: selectedItemId, quantity: parseInt(quantity, 10) || 1 }),
      });
      setGeneratedCode(res.data.code);
      setCodeExpiresAt(res.data.codeExpiresAt);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to generate code');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (generatedCode) {
      navigator.clipboard.writeText(generatedCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Modal onClose={onClose}>
      <h3 className="text-lg font-semibold">Deposit</h3>

      {/* Tab switcher */}
      <div className="mt-3 flex gap-1 border-b border-neutral-800">
        <button
          onClick={() => { setTab('money'); setGeneratedCode(null); setError(null); }}
          className={`px-3 py-1.5 text-xs font-medium rounded-t ${tab === 'money' ? 'bg-white/5 text-amber-400' : 'text-neutral-500'}`}
        >
          Deposit Money
        </button>
        <button
          onClick={() => { setTab('items'); setGeneratedCode(null); setError(null); }}
          className={`px-3 py-1.5 text-xs font-medium rounded-t ${tab === 'items' ? 'bg-white/5 text-amber-400' : 'text-neutral-500'}`}
        >
          Deposit Items
        </button>
      </div>

      {tab === 'money' ? (
        <>
          <p className="mt-3 text-sm text-neutral-400">Send money to the deposit bot in-game:</p>
          <div className="mt-3 rounded-lg border border-[#1a1a1a] bg-white/[0.03] p-3">
            <code className="text-sm text-amber-400">/pay {DEPOSIT_BOT_NAME} &lt;amount&gt;</code>
          </div>
          <div className="mt-4 space-y-2 text-xs text-neutral-500">
            <p>Min: ${DEPOSIT_MIN.toLocaleString()} &mdash; Max: ${DEPOSIT_MAX.toLocaleString()}</p>
            <p>Your balance updates automatically after payment.</p>
          </div>
          <Button variant="secondary" className="mt-5 w-full" onClick={onClose}>Close</Button>
        </>
      ) : generatedCode ? (
        <>
          <p className="mt-3 text-sm font-semibold text-neutral-200">Your Deposit Code</p>
          <div className="mt-2 flex items-center gap-2">
            <div className="flex-1 rounded-lg border border-neutral-700 bg-white/[0.03] p-2.5 overflow-hidden">
              <code className="text-xs text-sky-300 break-all">{generatedCode}</code>
            </div>
            <button onClick={handleCopy} className="shrink-0 rounded-lg border border-neutral-700 bg-white/[0.03] p-2.5 text-neutral-400 hover:text-white" title="Copy">
              {copied ? '✓' : '📋'}
            </button>
          </div>
          <p className="mt-1.5 text-xs text-amber-500/80">This code expires in ~3 hours</p>
          <div className="mt-3 rounded-lg border border-indigo-500/30 bg-indigo-500/10 p-3">
            <p className="text-xs font-semibold text-neutral-300">Next steps:</p>
            <ol className="mt-1 list-decimal pl-4 text-xs text-neutral-400 space-y-0.5">
              <li>Copy this code</li>
              <li>Go to our Discord server</li>
              <li>Click &quot;Deposit Items&quot; in #create-ticket</li>
              <li>Paste your code in the popup</li>
            </ol>
          </div>
          <div className="mt-4 flex gap-2">
            <a href={DISCORD_INVITE_URL} target="_blank" rel="noopener noreferrer" className="flex-1">
              <Button className="w-full bg-indigo-600 hover:bg-indigo-700">Open Discord</Button>
            </a>
            <Button variant="secondary" className="flex-1" onClick={onClose}>Close</Button>
          </div>
        </>
      ) : (
        <>
          <div className="mt-3">
            <label className="block text-xs text-neutral-400">Item</label>
            <select
              value={selectedItemId}
              onChange={(e) => setSelectedItemId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-neutral-700 bg-white/[0.03] px-3 py-2 text-sm text-neutral-200"
            >
              {catalogItems.map((item) => (
                <option key={item.id} value={item.id}>{item.displayName}</option>
              ))}
            </select>
          </div>
          <div className="mt-3">
            <label className="block text-xs text-neutral-400">Quantity</label>
            <Input
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="mt-1"
            />
          </div>
          {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
          <Button onClick={handleGenerate} disabled={loading || !selectedItemId} className="mt-4 w-full">
            {loading ? 'Generating...' : 'Generate Deposit Code'}
          </Button>
          <Button variant="secondary" className="mt-2 w-full" onClick={onClose}>Cancel</Button>
        </>
      )}
    </Modal>
  );
}
```

- [ ] **Step 3: Replace WithdrawModal with tabbed version**

Replace the entire `WithdrawModal` component (lines ~55-178). Keep the existing money tab content identical. Add an items tab that:
- Reads from the user's existing inventory (fetched via `GET /inventory`)
- Shows a dropdown of items with `availableQuantity > 0`
- Quantity input with max = available quantity
- "Generate Withdrawal Code" button → `POST /item-withdrawals`
- Same code display + copy + Discord link pattern as the deposit modal

The structure mirrors `DepositModal` above — use the same tab switcher, same code display state, same copy logic. The key difference is the item dropdown reads from `inventoryItems` (already fetched elsewhere on the dashboard) and the API call goes to `/item-withdrawals`.

- [ ] **Step 4: Test the modals manually**

Verify:
- Both tabs work and switch correctly
- Item dropdown populates from catalog API (deposits) or inventory (withdrawals)
- Code generation calls the correct API and displays the code
- Copy button works
- Discord link opens in new tab
- Money tab behavior is unchanged

- [ ] **Step 5: Commit**

```bash
git add packages/web/app/\(app\)/dashboard/page.tsx
git commit -m "feat: add tabbed deposit/withdraw modals with code generation"
```

---

## Task 13: Environment Variables & Documentation

**Files:**
- Modify: `.env.example` (if exists, otherwise `.env`)

- [ ] **Step 1: Add new env vars to .env.example**

```env
# Management Bot (Discord)
DISCORD_BOT_TOKEN=
DISCORD_GUILD_ID=
DISCORD_TICKET_CATEGORY_ID=
DISCORD_MODERATOR_ROLE_ID=
DISCORD_PANEL_CHANNEL_ID=
DISCORD_LOGS_CHANNEL_ID=

# Code signing
CODE_SIGNING_SECRET=

# Web
NEXT_PUBLIC_DISCORD_INVITE_URL=
```

- [ ] **Step 2: Generate a CODE_SIGNING_SECRET**

Run:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Add the output to your `.env` file as `CODE_SIGNING_SECRET=<generated value>`.

- [ ] **Step 3: Add Discord IDs to .env**

From the Discord Developer Portal and your server:
1. Copy bot token → `DISCORD_BOT_TOKEN`
2. Right-click your server → Copy ID → `DISCORD_GUILD_ID`
3. Right-click `#create-ticket` → Copy ID → `DISCORD_PANEL_CHANNEL_ID`
4. Right-click `#ticket-logs` → Copy ID → `DISCORD_LOGS_CHANNEL_ID`
5. Right-click the Tickets category → Copy ID → `DISCORD_TICKET_CATEGORY_ID`
6. Right-click your moderator role → Copy ID → `DISCORD_MODERATOR_ROLE_ID`
7. Your Discord server invite URL → `NEXT_PUBLIC_DISCORD_INVITE_URL`

- [ ] **Step 4: Commit**

```bash
git add .env.example
git commit -m "docs: add management bot environment variables"
```

---

## Task 14: Build & Smoke Test

- [ ] **Step 1: Build the API**

```bash
cd packages/api
npx prisma generate
npx tsc --noEmit
```

Expected: No TypeScript errors.

- [ ] **Step 2: Build the management bot**

```bash
cd packages/management-bot
npx tsc --noEmit
```

Expected: No TypeScript errors.

- [ ] **Step 3: Build the web frontend**

```bash
cd packages/web
npx next build
```

Expected: Build succeeds.

- [ ] **Step 4: Test locally with Docker**

```bash
docker compose build api management-bot
docker compose up -d
```

Verify:
- Management bot logs "logged in as ..."
- Panel embed appears in `#create-ticket`
- `/close` command is registered

- [ ] **Step 5: End-to-end test**

1. On the web dashboard, open Deposit modal → "Deposit Items" tab
2. Select an item and quantity, click "Generate Code"
3. Copy the code
4. In Discord `#create-ticket`, click "Deposit Items"
5. Paste the code in the modal
6. Verify: private channel created with welcome embed
7. Send a test message in the channel
8. Run `/close` — verify transcript in `#ticket-logs` and channel deleted
9. Check the user's inventory updated on the web

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "feat: management bot complete — Discord item deposit/withdrawal ticket system"
```
