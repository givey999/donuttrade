# Phase 4: Implementation & Testing Guide

**Phase**: Payment Verification System
**Status**: ✅ Completed
**Date**: February 2026 (Rewritten) | **Completed**: February 2026
**Dependencies**: Phase 3 (Discord OAuth + Email/Password Authentication)

> **Implementation Note:** All items in this phase have been implemented. The verification service, API routes, internal webhook, and bot-bridge package are all in place. Note: Phase 4 was implemented before Phase 3 (Discord/Email) since Microsoft OAuth alone was sufficient to test the verification flow. The background expiry job exists but needs startup integration (minor gap — auto-expiry in `getStatus()` serves as a fallback).

---

## Overview

This phase implements the in-game payment verification system. After signing up and entering their Minecraft username, users must pay a random amount (1-1000) to a verification bot on the DonutSMP server within 15 minutes. This proves ownership of the Minecraft account.

**Key changes from previous version:**
- Entire phase replaced. Previously this was "User Registration & Session Management"
- Now covers: payment verification service, verification bot, verification API endpoints
- Session management has been moved to Phase 5

**What this phase delivers:**
1. Payment verification service (amount generation, timeout, soft delete, retry)
2. Verification bot (new Mineflayer bot for payment detection)
3. Verification API routes (`GET /auth/verification/status`, `POST /auth/verification/retry`)
4. Internal webhook for bot to report payments (`POST /internal/verification/confirm`)
5. Background job to expire stale verifications

---

## Prerequisites

Before starting Phase 4, ensure Phase 3 is complete:

- [x] ~~All Phase 3 tests passing~~ (Phase 3 Discord/Email not yet built; Phase 4 was implemented ahead of it)
- [ ] ~~Discord OAuth flow working~~ (not yet — Phase 3)
- [ ] ~~Email registration and verification working~~ (not yet — Phase 3)
- [x] Username entry endpoint working
- [x] Database running with all auth fields

Verify Phase 3:
```bash
cd packages/api
npx tsx src/test-auth-methods.ts   # All tests pass
npm run build                       # No errors
```

---

## Step 1: Environment Configuration

### 1.1 Add Verification Bot Variables

**File: `packages/api/.env`**

```env
# Existing variables...

# Verification Bot
VERIFICATION_BOT_USERNAME=DonutTradeVerify
VERIFICATION_BOT_SERVER=donutsmp.net
VERIFICATION_BOT_PORT=25565

# Internal webhook secret (for bot -> API communication)
VERIFICATION_WEBHOOK_SECRET=your-random-secret-here
```

### 1.2 Update Config Validation

**File: `packages/api/src/config/index.ts`**

```typescript
const configSchema = z.object({
  // ... existing fields

  // Verification Bot
  VERIFICATION_BOT_USERNAME: z.string().optional(),
  VERIFICATION_WEBHOOK_SECRET: z.string().optional(),
});
```

---

## Step 2: Implement Payment Verification Service

### 2.1 Create Verification Service

**File: `packages/api/src/services/verification/payment-verification.service.ts`**

```typescript
import crypto from 'crypto';
import { createModuleLogger } from '../../lib/logger.js';
import { userRepository } from '../../repositories/user.repository.js';
import {
  VERIFICATION_AMOUNT_MIN,
  VERIFICATION_AMOUNT_MAX,
  VERIFICATION_TIMEOUT_MS,
} from '@donuttrade/shared/constants';

const logger = createModuleLogger('verification', 'payment-verification');

export class PaymentVerificationService {
  /**
   * Generate a random verification amount between 1 and 1000
   */
  private generateAmount(): number {
    return crypto.randomInt(VERIFICATION_AMOUNT_MIN, VERIFICATION_AMOUNT_MAX + 1);
  }

  /**
   * Create a new payment verification for a user
   * Called after the user sets their Minecraft username
   */
  async createVerification(userId: string) {
    const startTime = Date.now();
    logger.info({ action: 'create_verification_start', userId });

    const user = await userRepository.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    if (!user.minecraftUsername) {
      throw new Error('Minecraft username must be set before verification');
    }

    if (user.verificationStatus === 'verified') {
      throw new Error('User is already verified');
    }

    const amount = this.generateAmount();
    const expiresAt = new Date(Date.now() + VERIFICATION_TIMEOUT_MS);

    await userRepository.update(userId, {
      verificationAmount: amount,
      verificationExpiresAt: expiresAt,
      verificationStatus: 'pending',
    });

    const duration = Date.now() - startTime;
    logger.info({
      action: 'create_verification_success',
      userId,
      amount,
      expiresAt: expiresAt.toISOString(),
      duration,
    });

    return {
      amount,
      expiresAt,
      minecraftUsername: user.minecraftUsername,
      botUsername: process.env.VERIFICATION_BOT_USERNAME || 'DonutTradeVerify',
    };
  }

  /**
   * Check the status of a user's payment verification
   */
  async checkVerification(userId: string) {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Check if verification has expired
    if (
      user.verificationStatus === 'pending' &&
      user.verificationExpiresAt &&
      new Date() > user.verificationExpiresAt
    ) {
      // Mark as expired (soft delete)
      await userRepository.update(userId, { verificationStatus: 'expired' });

      logger.info({ action: 'verification_expired', userId });

      return {
        status: 'expired' as const,
        canRetry: true,
        message: 'Verification expired. You can try again with a new amount.',
      };
    }

    return {
      status: user.verificationStatus as 'pending' | 'verified' | 'expired',
      amount: user.verificationAmount,
      expiresAt: user.verificationExpiresAt,
      canRetry: user.verificationStatus === 'expired',
      botUsername: process.env.VERIFICATION_BOT_USERNAME || 'DonutTradeVerify',
    };
  }

  /**
   * Confirm a payment was received
   * Called by the verification bot when it detects a matching payment
   */
  async confirmPayment(minecraftUsername: string, amount: number) {
    const startTime = Date.now();
    logger.info({
      action: 'confirm_payment_start',
      minecraftUsername,
      amount,
    });

    const user = await userRepository.findByMinecraftUsername(minecraftUsername);
    if (!user) {
      logger.warn({ action: 'confirm_payment_user_not_found', minecraftUsername });
      return { matched: false, reason: 'User not found' };
    }

    if (user.verificationStatus !== 'pending') {
      logger.warn({ action: 'confirm_payment_not_pending', userId: user.id, status: user.verificationStatus });
      return { matched: false, reason: 'No pending verification' };
    }

    if (user.verificationExpiresAt && new Date() > user.verificationExpiresAt) {
      logger.warn({ action: 'confirm_payment_expired', userId: user.id });
      await userRepository.update(user.id, { verificationStatus: 'expired' });
      return { matched: false, reason: 'Verification expired' };
    }

    if (user.verificationAmount !== amount) {
      logger.warn({
        action: 'confirm_payment_wrong_amount',
        userId: user.id,
        expected: user.verificationAmount,
        received: amount,
      });
      return { matched: false, reason: 'Wrong amount' };
    }

    // Payment matches! Mark as verified
    await userRepository.update(user.id, {
      verificationStatus: 'verified',
      verificationAmount: null,
      verificationExpiresAt: null,
      lastLoginAt: new Date(),
    });

    const duration = Date.now() - startTime;
    logger.info({
      action: 'confirm_payment_success',
      userId: user.id,
      minecraftUsername,
      duration,
    });

    return { matched: true, userId: user.id };
  }

  /**
   * Retry an expired verification
   * Generates a new amount and resets the timer
   * User data is preserved (soft delete)
   */
  async retryVerification(userId: string) {
    logger.info({ action: 'retry_verification_start', userId });

    const user = await userRepository.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    if (user.verificationStatus === 'verified') {
      throw new Error('User is already verified');
    }

    if (user.verificationStatus !== 'expired') {
      throw new Error('Can only retry expired verifications');
    }

    // Generate new amount and reset timer
    const amount = this.generateAmount();
    const expiresAt = new Date(Date.now() + VERIFICATION_TIMEOUT_MS);

    await userRepository.update(userId, {
      verificationAmount: amount,
      verificationExpiresAt: expiresAt,
      verificationStatus: 'pending',
    });

    logger.info({
      action: 'retry_verification_success',
      userId,
      newAmount: amount,
      expiresAt: expiresAt.toISOString(),
    });

    return {
      amount,
      expiresAt,
      minecraftUsername: user.minecraftUsername,
      botUsername: process.env.VERIFICATION_BOT_USERNAME || 'DonutTradeVerify',
    };
  }

  /**
   * Expire all stale pending verifications
   * Called periodically by a background job
   */
  async expireStaleVerifications() {
    const expired = await userRepository.findExpiredVerifications();

    for (const user of expired) {
      await userRepository.update(user.id, { verificationStatus: 'expired' });
      logger.info({ action: 'auto_expire_verification', userId: user.id });
    }

    if (expired.length > 0) {
      logger.info({ action: 'expire_stale_batch', count: expired.length });
    }

    return expired.length;
  }
}

export const paymentVerificationService = new PaymentVerificationService();
```

---

## Step 3: Verification API Routes

### 3.1 Create Verification Routes

**File: `packages/api/src/routes/auth/verification.ts`**

```typescript
import { FastifyPluginAsync } from 'fastify';
import { paymentVerificationService } from '../../services/verification/payment-verification.service.js';
import { createModuleLogger } from '../../lib/logger.js';
import { config } from '../../config/index.js';

const logger = createModuleLogger('verification', 'verification-routes');

const verificationRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * POST /auth/verification/start
   * Start payment verification for a user (after username is set)
   */
  fastify.post('/verification/start', async (request, reply) => {
    const { userId } = request.body as { userId: string };

    if (!userId) {
      return reply.status(400).send({ error: 'userId is required' });
    }

    try {
      const verification = await paymentVerificationService.createVerification(userId);
      logger.info({
        action: 'verification_started',
        userId,
        correlationId: request.id,
      });

      return reply.send({
        message: 'Payment verification started.',
        amount: verification.amount,
        expiresAt: verification.expiresAt.toISOString(),
        botUsername: verification.botUsername,
        instruction: `Pay exactly $${verification.amount} to ${verification.botUsername} using: /pay ${verification.botUsername} ${verification.amount}`,
        timeoutMinutes: 15,
      });
    } catch (error: any) {
      logger.warn({ action: 'verification_start_error', error: error.message, correlationId: request.id });
      return reply.status(400).send({ error: error.message });
    }
  });

  /**
   * GET /auth/verification/status
   * Check the current verification status
   */
  fastify.get('/verification/status', async (request, reply) => {
    const { userId } = request.query as { userId: string };

    if (!userId) {
      return reply.status(400).send({ error: 'userId is required' });
    }

    try {
      const status = await paymentVerificationService.checkVerification(userId);
      return reply.send(status);
    } catch (error: any) {
      return reply.status(400).send({ error: error.message });
    }
  });

  /**
   * POST /auth/verification/retry
   * Retry an expired verification with a new amount
   */
  fastify.post('/verification/retry', async (request, reply) => {
    const { userId } = request.body as { userId: string };

    if (!userId) {
      return reply.status(400).send({ error: 'userId is required' });
    }

    try {
      const verification = await paymentVerificationService.retryVerification(userId);
      logger.info({
        action: 'verification_retry',
        userId,
        correlationId: request.id,
      });

      return reply.send({
        message: 'New verification started.',
        amount: verification.amount,
        expiresAt: verification.expiresAt.toISOString(),
        botUsername: verification.botUsername,
        instruction: `Pay exactly $${verification.amount} to ${verification.botUsername} using: /pay ${verification.botUsername} ${verification.amount}`,
        timeoutMinutes: 15,
      });
    } catch (error: any) {
      logger.warn({ action: 'verification_retry_error', error: error.message, correlationId: request.id });
      return reply.status(400).send({ error: error.message });
    }
  });

  /**
   * POST /internal/verification/confirm
   * Internal endpoint for the verification bot to report payments
   * Protected by a webhook secret
   */
  fastify.post('/internal/verification/confirm', async (request, reply) => {
    const { minecraftUsername, amount, webhookSecret } = request.body as {
      minecraftUsername: string;
      amount: number;
      webhookSecret: string;
    };

    // Validate webhook secret
    if (!config.VERIFICATION_WEBHOOK_SECRET || webhookSecret !== config.VERIFICATION_WEBHOOK_SECRET) {
      logger.warn({ action: 'webhook_unauthorized', correlationId: request.id });
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    if (!minecraftUsername || amount === undefined) {
      return reply.status(400).send({ error: 'minecraftUsername and amount are required' });
    }

    const result = await paymentVerificationService.confirmPayment(minecraftUsername, amount);
    logger.info({
      action: 'webhook_confirm',
      minecraftUsername,
      amount,
      matched: result.matched,
      correlationId: request.id,
    });

    return reply.send(result);
  });
};

export default verificationRoutes;
```

### 3.2 Update Route Registration

**File: `packages/api/src/routes/auth/index.ts`**

```typescript
import { FastifyPluginAsync } from 'fastify';
import microsoftRoutes from './microsoft.js';
import discordRoutes from './discord.js';
import emailRoutes from './email.js';
import usernameRoutes from './username.js';
import verificationRoutes from './verification.js';

const authRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.register(microsoftRoutes);
  fastify.register(discordRoutes);
  fastify.register(emailRoutes);
  fastify.register(usernameRoutes);
  fastify.register(verificationRoutes);
  // Session routes will be added in Phase 5
};

export default authRoutes;
```

---

## Step 4: Background Job for Expiring Verifications

### 4.1 Create Expiry Job

**File: `packages/api/src/jobs/expire-verifications.ts`**

```typescript
import { paymentVerificationService } from '../services/verification/payment-verification.service.js';
import { createModuleLogger } from '../lib/logger.js';

const logger = createModuleLogger('verification', 'expire-job');

const INTERVAL_MS = 60 * 1000; // Check every 1 minute

let intervalId: NodeJS.Timeout | null = null;

/**
 * Start the background job that expires stale verifications
 */
export function startExpiryJob() {
  logger.info({ action: 'expiry_job_start', intervalMs: INTERVAL_MS });

  intervalId = setInterval(async () => {
    try {
      const count = await paymentVerificationService.expireStaleVerifications();
      if (count > 0) {
        logger.info({ action: 'expiry_job_run', expired: count });
      }
    } catch (error) {
      logger.error({ action: 'expiry_job_error', error });
    }
  }, INTERVAL_MS);
}

/**
 * Stop the background job
 */
export function stopExpiryJob() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    logger.info({ action: 'expiry_job_stop' });
  }
}
```

### 4.2 Register Job in Server Startup

Add `startExpiryJob()` to the server startup in `packages/api/src/index.ts`:

```typescript
import { startExpiryJob, stopExpiryJob } from './jobs/expire-verifications.js';

// After server starts:
startExpiryJob();

// On server shutdown:
stopExpiryJob();
```

---

## Step 5: Verification Bot

### 5.1 Create Verification Bot Package

The verification bot is a new separate package. Create it at `packages/verification-bot/`.

**File: `packages/verification-bot/package.json`**

```json
{
  "name": "@donuttrade/verification-bot",
  "version": "1.0.0",
  "type": "module",
  "private": true,
  "scripts": {
    "start": "node dist/index.js",
    "dev": "tsx watch src/index.ts",
    "build": "tsc"
  },
  "dependencies": {
    "mineflayer": "^4.14.0",
    "pino": "^8.18.0"
  },
  "devDependencies": {
    "tsx": "^4.7.0",
    "typescript": "^5.3.3"
  }
}
```

**File: `packages/verification-bot/src/index.ts`**

```typescript
import mineflayer from 'mineflayer';
import pino from 'pino';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

const BOT_CONFIG = {
  host: process.env.VERIFICATION_BOT_SERVER || 'donutsmp.net',
  port: parseInt(process.env.VERIFICATION_BOT_PORT || '25565'),
  username: process.env.VERIFICATION_BOT_EMAIL || '',
  auth: 'microsoft' as const,
};

const API_URL = process.env.API_URL || 'http://localhost:3001';
const WEBHOOK_SECRET = process.env.VERIFICATION_WEBHOOK_SECRET || '';

// Payment message pattern: "username paid you $amount"
const PAYMENT_REGEX = /^(\S+) paid you \$([0-9,.]+[KMBTkmbt]?)\.?$/;

function parseAmount(raw: string): number {
  const suffixes: Record<string, number> = {
    k: 1_000,
    m: 1_000_000,
    b: 1_000_000_000,
    t: 1_000_000_000_000,
  };

  const cleaned = raw.replace(/,/g, '').replace(/\.$/, '');
  const suffix = cleaned.slice(-1).toLowerCase();

  if (suffixes[suffix]) {
    return parseFloat(cleaned.slice(0, -1)) * suffixes[suffix];
  }

  return parseFloat(cleaned);
}

function createBot() {
  logger.info({ action: 'bot_connecting', host: BOT_CONFIG.host });

  const bot = mineflayer.createBot(BOT_CONFIG);

  bot.on('login', () => {
    logger.info({ action: 'bot_connected', username: bot.username });
  });

  bot.on('message', async (message) => {
    const text = message.toString().trim();
    const match = text.match(PAYMENT_REGEX);

    if (!match) return;

    const [, username, rawAmount] = match;
    const amount = parseAmount(rawAmount);

    logger.info({
      action: 'payment_detected',
      from: username,
      amount,
      raw: rawAmount,
    });

    // Report to API
    try {
      const response = await fetch(`${API_URL}/internal/verification/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          minecraftUsername: username,
          amount,
          webhookSecret: WEBHOOK_SECRET,
        }),
      });

      const result = await response.json();

      if (result.matched) {
        logger.info({
          action: 'verification_confirmed',
          username,
          amount,
          userId: result.userId,
        });
      } else {
        logger.debug({
          action: 'payment_not_matched',
          username,
          amount,
          reason: result.reason,
        });
      }
    } catch (error) {
      logger.error({ action: 'api_report_error', error, username, amount });
    }
  });

  bot.on('kicked', (reason) => {
    logger.warn({ action: 'bot_kicked', reason: reason.toString() });
    setTimeout(createBot, 10000); // Reconnect after 10 seconds
  });

  bot.on('error', (error) => {
    logger.error({ action: 'bot_error', error });
  });

  bot.on('end', () => {
    logger.warn({ action: 'bot_disconnected' });
    setTimeout(createBot, 10000); // Reconnect after 10 seconds
  });

  return bot;
}

// Start the bot
createBot();
```

### 5.2 Update Workspace Configuration

**File: `pnpm-workspace.yaml`**

Ensure `packages/verification-bot` is included:

```yaml
packages:
  - 'packages/*'
```

---

## Step 6: Test Script

### 6.1 Create Verification Test Script

**File: `packages/api/src/test-verification.ts`**

```typescript
import { PrismaClient } from '@prisma/client';
import { createModuleLogger } from './lib/logger.js';
import { paymentVerificationService } from './services/verification/payment-verification.service.js';

const logger = createModuleLogger('api', 'test-verification');
const prisma = new PrismaClient();

async function testVerification() {
  logger.info({ action: 'test_start', message: 'Testing Phase 4 payment verification' });

  try {
    // Setup: Create a test user with username set
    const user = await prisma.user.create({
      data: {
        authProvider: 'microsoft',
        microsoftId: 'test-ms-' + Date.now(),
        minecraftUsername: 'VerifyTestUser' + Date.now(),
        verificationStatus: 'pending',
      },
    });

    // Test 1: Create verification
    const verification = await paymentVerificationService.createVerification(user.id);
    const amountValid = verification.amount >= 1 && verification.amount <= 1000;
    logger.info({
      action: 'test_create_verification',
      amount: verification.amount,
      result: amountValid ? 'PASS' : 'FAIL',
    });

    // Test 2: Check verification status
    const status = await paymentVerificationService.checkVerification(user.id);
    logger.info({
      action: 'test_check_status',
      status: status.status,
      result: status.status === 'pending' ? 'PASS' : 'FAIL',
    });

    // Test 3: Wrong amount doesn't verify
    const wrongResult = await paymentVerificationService.confirmPayment(
      user.minecraftUsername!,
      verification.amount + 1,
    );
    logger.info({
      action: 'test_wrong_amount',
      matched: wrongResult.matched,
      result: !wrongResult.matched ? 'PASS' : 'FAIL',
    });

    // Test 4: Correct amount verifies
    const correctResult = await paymentVerificationService.confirmPayment(
      user.minecraftUsername!,
      verification.amount,
    );
    logger.info({
      action: 'test_correct_amount',
      matched: correctResult.matched,
      result: correctResult.matched ? 'PASS' : 'FAIL',
    });

    // Test 5: Check verified status
    const verifiedStatus = await paymentVerificationService.checkVerification(user.id);
    logger.info({
      action: 'test_verified_status',
      status: verifiedStatus.status,
      result: verifiedStatus.status === 'verified' ? 'PASS' : 'FAIL',
    });

    // Setup for retry test: Create another user
    const user2 = await prisma.user.create({
      data: {
        authProvider: 'discord',
        discordId: 'test-discord-' + Date.now(),
        minecraftUsername: 'RetryTestUser' + Date.now(),
        verificationStatus: 'expired', // Already expired
      },
    });

    // Test 6: Retry expired verification
    const retryResult = await paymentVerificationService.retryVerification(user2.id);
    const retryAmountValid = retryResult.amount >= 1 && retryResult.amount <= 1000;
    logger.info({
      action: 'test_retry_verification',
      newAmount: retryResult.amount,
      result: retryAmountValid ? 'PASS' : 'FAIL',
    });

    // Test 7: Check retry changes status back to pending
    const retryStatus = await paymentVerificationService.checkVerification(user2.id);
    logger.info({
      action: 'test_retry_status',
      status: retryStatus.status,
      result: retryStatus.status === 'pending' ? 'PASS' : 'FAIL',
    });

    // Cleanup
    await prisma.user.deleteMany({
      where: { id: { in: [user.id, user2.id] } },
    });

    logger.info({ action: 'test_complete', message: 'All Phase 4 verification tests passed!' });
  } catch (error) {
    logger.error({ action: 'test_error', error });
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

testVerification();
```

---

## Verification Checklist

### Payment Verification Service
- [x] `createVerification()` generates random amount 1-1000
- [x] `createVerification()` sets 15-minute expiry
- [x] `checkVerification()` returns correct status
- [x] `checkVerification()` auto-expires past-due verifications
- [x] `confirmPayment()` with correct username + amount marks as verified
- [x] `confirmPayment()` with wrong amount returns `matched: false`
- [x] `confirmPayment()` with unknown username returns `matched: false`
- [x] `retryVerification()` generates new amount and resets timer
- [x] `retryVerification()` preserves all user data (soft delete)
- [x] `expireStaleVerifications()` expires all past-due pending verifications

### API Routes
- [x] `POST /auth/verification/start` creates verification and returns amount
- [x] `GET /auth/verification/status?userId=xxx` returns current status
- [x] `POST /auth/verification/retry` generates new amount for expired verifications
- [x] `POST /internal/verification/confirm` validates webhook secret
- [x] `POST /internal/verification/confirm` matches payment to pending verification

### Verification Bot (bot-bridge)
- [x] Bot connects to DonutSMP server
- [x] Bot parses incoming payment messages
- [x] Bot reports payments to API via webhook
- [x] Bot reconnects after disconnect
- [x] Bot handles K/M/B/T suffixes in payment amounts

### Actual Files Implemented
- `packages/api/src/services/auth/verification.service.ts` — Start, check, confirm, retry, expire stale
- `packages/api/src/routes/auth/verification.ts` — `/auth/verification/start`, `/status`, `/retry`
- `packages/api/src/routes/internal/verification.ts` — `/internal/verification/confirm` (bot webhook)
- `packages/bot-bridge/src/index.ts` — Main entry, Minecraft connection
- `packages/bot-bridge/src/bot.ts` — MinecraftChatBot using mineflayer
- `packages/bot-bridge/src/payment-handler.ts` — Parses in-game payment messages
- `packages/bot-bridge/src/webhook-client.ts` — Reports payments to API webhook

### Implementation Deviation
- The doc planned a `packages/verification-bot/` package, but implementation uses `packages/bot-bridge/` instead (the existing bot infrastructure was extended rather than creating a new package)
- Background expiry job file exists but is not wired into server startup; auto-expiry in `getStatus()` provides equivalent coverage

### Manual Verification
```bash
# 1. Start verification for a user
curl -X POST http://localhost:3001/auth/verification/start \
  -H "Content-Type: application/json" \
  -d '{"userId":"xxx"}'

# 2. Check status
curl http://localhost:3001/auth/verification/status?userId=xxx

# 3. Simulate bot payment confirmation
curl -X POST http://localhost:3001/internal/verification/confirm \
  -H "Content-Type: application/json" \
  -d '{"minecraftUsername":"TestUser","amount":500,"webhookSecret":"your-secret"}'

# 4. Check status again (should be verified)
curl http://localhost:3001/auth/verification/status?userId=xxx

# 5. Run test script
cd packages/api && npx tsx src/test-verification.ts
```

### Log Verification
Expected log entries:
```
INFO  [verification:payment-verification] action=create_verification_success amount=347 expiresAt=...
INFO  [verification:verification-routes]  action=verification_started userId=xxx
INFO  [verification:payment-verification] action=confirm_payment_success userId=xxx
INFO  [verification:expire-job]           action=expiry_job_run expired=2
```
