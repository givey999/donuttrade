# Phase 2: Complete Microsoft OAuth + Verification Flow

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

## Context

After Microsoft OAuth, the API currently exchanges the code for tokens but returns a bare redirect without creating a user or session. Users land on a "success" page but nothing actually happened. This plan completes the full signup flow: decode ID token → create user → enter Minecraft username → verify via in-game payment → issue session.

**Goal:** Make Microsoft login fully functional end-to-end, including Minecraft account verification.

**Architecture:** The API callback decodes the Microsoft ID token, creates/finds the user, and redirects based on their state. New users go through a username entry page then a payment verification page. A verification bot (packages/bot-bridge/) monitors in-game payments and reports matches via webhook.

**Tech Stack:** Existing Fastify API, Next.js frontend, new Mineflayer verification bot in TypeScript

---

## Task 1: ID Token Decoding + Config Updates

**Files:**
- Modify: `packages/api/src/services/auth/microsoft.service.ts` — add `decodeIdToken()` method
- Modify: `packages/api/src/config/index.ts` — add `BOT_WEBHOOK_SECRET` and `VERIFICATION_BOT_DISPLAY_NAME` env vars
- Modify: `.env.example` — document new env vars

### decodeIdToken

Add to the `microsoftService` object. Decodes the JWT payload segment (base64url) without signature verification — Microsoft already validated it during the token exchange over TLS. Extract `oid` (preferred) or `sub` for microsoftId, `email` or `preferred_username` for email.

### Config additions

```
BOT_WEBHOOK_SECRET: z.string().min(32).optional()
VERIFICATION_BOT_DISPLAY_NAME: z.string().default('DonutTradeBot')
```

---

## Task 2: Pending Token Mechanism

**Problem:** After OAuth, new users need to set their Minecraft username and verify. The session service requires `minecraftUsername` to be set, so we can't issue a full session yet. We need a way to identify the user during setup.

**Solution:** A short-lived "pending setup" JWT (30 min), set as an HttpOnly cookie (`dt_pending_token`). Uses the existing JWT infrastructure.

**Files:**
- Modify: `packages/api/src/lib/jwt.ts` — add `signPendingToken(userId)` and `verifyPendingToken(token)` functions
- Modify: `packages/api/src/plugins/auth.ts` — add `authenticatePending` decorator that reads from `dt_pending_token` cookie
- Modify: `packages/shared/src/constants/index.ts` — add `PENDING_TOKEN: 'dt_pending_token'` to `Cookies` object

### Pending token payload
```typescript
{ sub: userId, purpose: 'pending_setup', iat, exp }
```

### authenticatePending decorator
Reads `request.cookies.dt_pending_token`, verifies with `verifyPendingToken()`, sets `request.pendingUser = { id: payload.sub }`. Add `FastifyRequest.pendingUser` and `FastifyInstance.authenticatePending` to declaration merging.

---

## Task 3: Complete Microsoft OAuth Callback

**Files:**
- Modify: `packages/api/src/routes/auth/microsoft.ts` — replace placeholder with full user flow

### Three branches after token exchange:

**A. Returning verified user** (user exists, `verificationStatus === 'verified'`):
- `updateLastLogin(user.id)`
- `sessionService.createSession(user.id, userAgent, ip)` → get tokens
- Set `dt_refresh_token` cookie (HttpOnly, secure, sameSite: lax, 30 days)
- Redirect to `${frontendUrl}/auth/callback?success=true&token=${accessToken}`

**B. Returning user in setup** (user exists, not verified):
- Sign pending token, set `dt_pending_token` cookie (30 min)
- If no `minecraftUsername` → redirect to `${frontendUrl}/signup/username`
- If has username → redirect to `${frontendUrl}/verify`

**C. New user:**
- `userRepository.create({ authProvider: 'microsoft', microsoftId, email })`
- Sign pending token, set cookie
- Redirect to `${frontendUrl}/signup/username`

### Cookie settings (all paths)
```typescript
{ httpOnly: true, secure: !isDevelopment, sameSite: 'lax', path: '/' }
```

### Imports to add
- `config`, `isDevelopment` from config
- `signPendingToken` from jwt
- `userRepository` from repositories
- `sessionService` from services
- `Cookies` from @donuttrade/shared

---

## Task 4: Username Entry API Endpoint

**Files:**
- Create: `packages/api/src/routes/auth/username.ts`
- Modify: `packages/api/src/routes/auth/index.ts` — register new route

### POST /auth/set-username
- Auth: `authenticatePending` preHandler
- Body: `{ username: string }`
- Validation: regex `/^\.?[a-zA-Z0-9_ ]{3,16}$/` (allows spaces for Bedrock)
- Check uniqueness via `userRepository.findByMinecraftUsername()`
- Verify user exists and is not already verified
- `userRepository.update(userId, { minecraftUsername: trimmed })`
- Return `{ success: true, data: { username } }`

---

## Task 5: Verification Service + API Endpoints

**Files:**
- Create: `packages/api/src/services/auth/verification.service.ts`
- Create: `packages/api/src/routes/auth/verification.ts` — user-facing endpoints
- Create: `packages/api/src/routes/internal/index.ts` — internal routes registration
- Create: `packages/api/src/routes/internal/verification.ts` — bot webhook
- Modify: `packages/api/src/routes/auth/index.ts` — register verification routes
- Modify: `packages/api/src/index.ts` — register `/internal` prefix routes

### Verification Service Methods

| Method | Purpose |
|--------|---------|
| `startVerification(userId)` | Generate random amount 1-1000 (`crypto.randomInt`), set 15-min expiry, update user record |
| `getStatus(userId)` | Return status, auto-expire if past due. Include `botUsername` from config |
| `retryVerification(userId)` | Generate new amount, reset timer (soft retry) |
| `confirmPayment(username, amount)` | Match username + exact amount, mark verified if match |

### User-facing routes (under /auth)
- `POST /auth/verification/start` — auth: `authenticatePending`
- `GET /auth/verification/status` — auth: `authenticatePending`
- `POST /auth/verification/retry` — auth: `authenticatePending`

### Internal webhook (under /internal)
- `POST /internal/verification/confirm` — auth: `Bearer ${BOT_WEBHOOK_SECRET}` header
- Body: `{ username, amount, timestamp }`
- Returns `{ success, data: { userId, verified } }`

### Reuse existing constants
- `VERIFICATION_AMOUNT_MIN` (1), `VERIFICATION_AMOUNT_MAX` (1000), `VERIFICATION_TIMEOUT_MS` (15 min) from `@donuttrade/shared`

---

## Task 6: Frontend — Username Entry Page

**Files:**
- Create: `packages/web/app/signup/username/page.tsx`

### Client component with:
- Text input for Minecraft username
- **Bedrock disclaimer** (prominent amber/yellow info box): "Bedrock Edition Users: write your username with a dot (.) in front. Example: .PlayerName"
- Submit button → `POST ${API_URL}/auth/set-username` with `credentials: 'include'`
- On success → `router.push('/verify')`
- Error display for validation/conflict errors
- Same dark theme as login page (centered card, neutral borders)

---

## Task 7: Frontend — Payment Verification Page

**Files:**
- Create: `packages/web/app/verify/page.tsx`

### Client component with:
- On mount: `POST /auth/verification/start` (credentials: include) → get amount + expiresAt + botUsername
- Display: "Pay exactly $[amount] to [botUsername]" + command: `/pay [botUsername] [amount]`
- **Countdown timer**: mm:ss format, updates every second
- **Status polling**: every 3 seconds, `GET /auth/verification/status` (credentials: include)
- **States:**
  - `loading` — starting verification
  - `pending` — waiting for payment (shows amount + timer)
  - `verified` — green success, redirect to `/auth/callback?success=true` after 1.5s
  - `expired` — "Verification expired" + "Try Again" button (calls `/auth/verification/retry`)
  - `error` — network error display
- Same dark theme, centered layout

---

## Task 8: Verification Bot (packages/bot-bridge/)

**Files:**
- Rewrite: `packages/bot-bridge/package.json` — real deps (mineflayer, dotenv)
- Create: `packages/bot-bridge/tsconfig.json`
- Create: `packages/bot-bridge/src/bot.ts` — TypeScript port of `src/bot.js` (MinecraftChatBot)
- Create: `packages/bot-bridge/src/payment-handler.ts` — TypeScript port of `src/payments.js` (PaymentHandler)
- Create: `packages/bot-bridge/src/webhook-client.ts` — HTTP client for API webhook
- Create: `packages/bot-bridge/src/index.ts` — entry point

### Pattern: Mirror the legacy bot structure
The existing bot in `src/` has: `MinecraftChatBot` (connection + events) → `ChatHandler` (filtering) → `PaymentHandler` (regex parsing). The verification bot uses the same `MinecraftChatBot` and `PaymentHandler` but replaces file logging with a `WebhookClient` that POSTs to `/internal/verification/confirm`.

### bot.ts (from src/bot.js)
- Same EventEmitter pattern, same mineflayer config
- Same auto-reconnect with exponential backoff (5s → 5min)
- Same events: connected, disconnected, kicked, error, rawMessage
- TypeScript types added

### payment-handler.ts (from src/payments.js)
- Same regex: `/^(.+?) paid you \$(.+)$/`
- Same `_parseAmount()` with K/M/B/T suffix handling
- Returns `{ username, amountRaw, amount, timestamp }` or null
- No file logging — just parse and return

### webhook-client.ts (new)
- `reportPayment(username, amount)` → `POST /internal/verification/confirm`
- Auth: `Bearer ${BOT_WEBHOOK_SECRET}`
- Returns whether verification matched

### index.ts (entry point)
- Load env from monorepo root `.env`
- Create bot with MC server config from env vars
- On `rawMessage` (system position) → parse payment → report via webhook
- Graceful shutdown on SIGINT/SIGTERM

### Environment variables
```
MC_SERVER_HOST=donutsmp.net
MC_SERVER_PORT=25565
MC_SERVER_VERSION=1.21.11
MC_BOT_USERNAME=<microsoft-auth-email>
BOT_WEBHOOK_SECRET=<shared-secret>
API_URL=http://localhost:3001
```

---

## Task 9: Wiring + Docker + Caddy

**Files:**
- Modify: `docker-compose.yml` — add bot-bridge service
- Modify: `Caddyfile` — add `/internal/*` route to API
- Modify: `package.json` (root) — add bot-bridge scripts
- Modify: `packages/web/app/auth/callback/page.tsx` — handle `token` query param for returning users

### docker-compose.yml — bot-bridge service
```yaml
bot-bridge:
  build:
    context: .
    dockerfile: packages/bot-bridge/Dockerfile
  container_name: donuttrade-bot-bridge
  environment:
    - API_URL=http://api:3001
  env_file:
    - .env
  depends_on:
    - api
  restart: unless-stopped
```

### Caddyfile — add internal route
```caddy
handle /internal/* {
    reverse_proxy api:3001
}
```

### Root package.json scripts
```json
"bot:verify:dev": "pnpm --filter @donuttrade/bot-bridge dev",
"bot:verify:start": "pnpm --filter @donuttrade/bot-bridge start"
```

### Callback page update
When `token` query param is present (returning verified user), store it (localStorage or memory) for API calls. This is temporary until a proper auth context is built.

---

## Dependency Order

```
Task 1 (decodeIdToken + config)
  → Task 2 (pending token)
    → Task 3 (complete OAuth callback)
      → Task 4 (username endpoint)
      → Task 5 (verification service + endpoints)
        → Task 6 (username page) — needs Task 4
        → Task 7 (verify page) — needs Task 5
        → Task 8 (verification bot) — needs Task 5's webhook
      → Task 9 (wiring) — finalize last
```

Tasks 6, 7, 8 can run in parallel after Task 5.

---

## Verification

### End-to-end test flow:
1. `pnpm dev:web` + `pnpm dev` (API) + `pnpm bot:verify:dev` (bot)
2. Open `http://localhost:3000/login` → click "Sign in with Microsoft"
3. Complete Microsoft OAuth → should redirect to `/signup/username` (new user)
4. Enter Minecraft username → submit → redirects to `/verify`
5. Verification page shows random amount and bot username
6. In-game: `/pay [botUsername] [amount]` from the entered username
7. Bot detects payment → calls webhook → status polling picks it up
8. Page shows "Verified!" → redirects to callback with success
9. Returning login: repeat OAuth → should skip username/verify → get session directly

### API endpoint testing (curl):
```bash
# Check verification status (with pending token cookie)
curl -b "dt_pending_token=..." http://localhost:3001/auth/verification/status

# Simulate bot webhook
curl -X POST http://localhost:3001/internal/verification/confirm \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $BOT_WEBHOOK_SECRET" \
  -d '{"username":"PlayerName","amount":42,"timestamp":"2026-03-01T00:00:00Z"}'
```
