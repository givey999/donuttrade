# Management Bot & Discord Item Deposit/Withdrawal Flow — Design Spec

**Date:** 2026-03-23
**Status:** Approved

---

## Overview

Add a Discord management bot (`packages/management-bot/`) that handles item deposit and withdrawal tickets via Discord. Users generate HMAC-signed codes on the DonutTrade website, paste them into a Discord modal, and the bot creates private ticket channels for admin coordination. When the admin confirms the handoff, the bot credits/debits inventory, logs a transcript, and cleans up.

### Scope — What we ARE building

- Persistent ticket panel embed in `#create-ticket` with Deposit/Withdraw buttons
- Discord modal popup for code entry
- HMAC code generation on the API (deposit + withdrawal)
- Code verification via internal API endpoint
- Private ticket channel creation with sequential numbering (`#deposit-1`, `#withdraw-2`, etc.)
- `/close` slash command (mod-only) that confirms the deposit/withdrawal, sends transcript to `#ticket-logs`, and deletes the channel
- Tabbed deposit/withdraw modals on the web frontend with code display

### Scope — What we are NOT building (deferred)

- Discord account linking (skip code step for linked users)
- Dupe detection / auto-maintenance mode
- Slash commands (`/lookup`, `/ban`, `/timeout`)
- Admin notification channels
- Order/marketplace event feeds

---

## Architecture

```
┌─────────────────┐     ┌──────────────┐     ┌─────────────────────┐
│  Web Frontend   │     │   API        │     │  Management Bot     │
│  (Next.js)      │     │  (Fastify)   │     │  (discord.js v14)   │
├─────────────────┤     ├──────────────┤     ├─────────────────────┤
│ Tabbed deposit/ │     │ HMAC code    │     │ Persistent panel    │
│ withdraw modals │────▶│ generation   │◀────│ Modal form          │
│ Code display +  │     │              │     │ Code verification   │
│ copy + Discord  │     │ Verify       │     │ Channel creation    │
│ link            │     │ endpoints    │     │ /close + transcript │
└─────────────────┘     │ Confirm on   │     │ Ticket numbering    │
                        │ close        │     └─────────────────────┘
                        └──────────────┘
```

**Communication:** Bot → API via internal Docker network (`http://api:3001`), authenticated with `BOT_WEBHOOK_SECRET` (same shared secret as existing bots).

---

## Discord Developer Portal Setup

The bot application already exists in the Discord Developer Portal. Before deployment, ensure these settings:

### Privileged Gateway Intents (Bot settings page)

Enable these in the Developer Portal under Bot > Privileged Gateway Intents:

| Intent | Why |
|--------|-----|
| **Message Content** | Read message content in ticket channels for transcript generation |
| **Server Members** | Resolve user info when creating ticket channels (optional but recommended) |

### Bot Permissions

When generating the OAuth2 invite URL (OAuth2 > URL Generator), select these permissions:

| Permission | Why |
|------------|-----|
| Manage Channels | Create and delete ticket channels |
| Send Messages | Post embeds and responses |
| Embed Links | Render rich embeds |
| Read Message History | Read messages for transcripts |
| Manage Messages | Pin/delete messages in ticket channels |
| View Channels | See channels and categories |
| Use Application Commands | Register and handle `/close` slash command |

### OAuth2 Scopes

Select `bot` and `applications.commands` scopes when generating the invite URL.

### Required tokens/IDs from the Developer Portal

| Value | Where to find it | Stored as |
|-------|-------------------|-----------|
| Bot Token | Bot page > "Reset Token" | `DISCORD_BOT_TOKEN` in `.env` |
| Application ID | General Information > Application ID | Not needed in env (discord.js reads from token) |

### Discord server setup (manual, one-time)

Before the bot starts, create these in the Discord server and note their IDs:

| Resource | Purpose | Env var |
|----------|---------|---------|
| Server (guild) ID | Target server | `DISCORD_GUILD_ID` |
| `#create-ticket` channel | Where the persistent panel lives | `DISCORD_PANEL_CHANNEL_ID` |
| `#ticket-logs` channel | Where transcripts are posted | `DISCORD_LOGS_CHANNEL_ID` |
| "Tickets" category | Parent category for ticket channels | `DISCORD_TICKET_CATEGORY_ID` |
| Moderator role | Role that can see tickets + run `/close` | `DISCORD_MODERATOR_ROLE_ID` |

To get IDs: Enable Developer Mode in Discord (User Settings > App Settings > Advanced > Developer Mode), then right-click any channel/role/server > "Copy ID".

---

## API Changes

### Schema additions (Prisma)

```prisma
model ItemDeposit {
  // ... existing fields ...
  code             String?   @unique
  codeExpiresAt    DateTime? @map("code_expires_at")
  codeVerifiedAt   DateTime? @map("code_verified_at")
  ticketChannelId  String?   @map("ticket_channel_id")
  closedBy         String?   @map("closed_by")       // Discord username of mod who ran /close
  closeReason      String?   @map("close_reason")     // Reason when rejected
}

model ItemWithdrawal {
  // ... existing fields ...
  code             String?   @unique
  codeExpiresAt    DateTime? @map("code_expires_at")
  codeVerifiedAt   DateTime? @map("code_verified_at")
  ticketChannelId  String?   @map("ticket_channel_id")
  closedBy         String?   @map("closed_by")       // Discord username of mod who ran /close
  closeReason      String?   @map("close_reason")     // Reason when rejected
}
```

### Updated status flows

**ItemDeposit** statuses: `pending | verified | confirmed | rejected`
- `pending` — user requested on web, code generated
- `verified` — bot validated code, ticket channel created
- `confirmed` — admin ran `/close`, items credited to inventory
- `rejected` — admin ran `/close reject`, handoff did not happen

**ItemWithdrawal** statuses: `pending | verified | processing | completed | failed | cancelled`
- `pending` — user requested on web, code generated
- `verified` — bot validated code, ticket channel created
- `processing` — (existing, used by admin panel flow)
- `completed` — admin ran `/close`, items debited from inventory
- `failed` / `cancelled` — (existing)

Update the shared types in `packages/shared/src/types/index.ts`:
- `ItemDepositStatus`: add `'verified'`
- `ItemWithdrawalStatus`: add `'verified'`

Update the Prisma schema comments to reflect the new status values.

**Compatibility note:** The existing deposit-bot and admin panel flows (`pending → confirmed` for deposits, `pending → processing → completed` for withdrawals) are unaffected. The `verified` status is only set by the management bot's verify-code endpoint. The new management-bot confirm endpoints use **separate service methods** that accept `verified` as valid input status, avoiding any changes to the existing `confirmDeposit`/`confirmWithdrawal` methods.

### New platform setting

Use the existing `PlatformSettings` table (key/value store) with a row `key: 'ticket_counter'`, `value: '0'`. Seed this row via the Prisma migration or seed script. Increment atomically via:
```sql
INSERT INTO platform_settings (key, value) VALUES ('ticket_counter', '1')
ON CONFLICT (key) DO UPDATE SET value = (platform_settings.value::int + 1)::text
RETURNING value
```
This UPSERT pattern handles both the first-use case (row doesn't exist) and concurrent increments safely.

### New environment variable

```
CODE_SIGNING_SECRET — min 32 chars, used for HMAC-SHA256 code signatures
```

Add to API config schema in `packages/api/src/config/index.ts`:
```typescript
CODE_SIGNING_SECRET: z.string().min(32),
```

Add to `getRedactedConfig()`:
```typescript
CODE_SIGNING_SECRET: config.CODE_SIGNING_SECRET ? '[REDACTED]' : '[NOT SET]',
```

### Modified endpoints

**`POST /item-deposits`** — after creating the record, also:
- Generate HMAC code: `DT-DEP-<base64url(payload)>.<hmac-sha256>`
- Set `codeExpiresAt` = now + 3 hours
- Return `code` and `codeExpiresAt` in response
- **Existing deposit-bot flow is unaffected** — the deposit-bot uses `/internal/deposit/confirm`, not this endpoint. Code generation is purely additive (new fields in the response, no behavioral change to existing callers).

**`POST /item-withdrawals`** — same pattern with prefix `DT-WTH-`

### Code format

```
Prefix: DT-DEP- (deposits) or DT-WTH- (withdrawals)
Payload (JSON, base64url-encoded):
{
  type: "deposit" | "withdrawal",
  id: "<record UUID>",
  userId: "<user UUID>",
  itemId: "<catalog item UUID>",
  quantity: <number>,
  exp: <unix timestamp, +3 hours>
}
Signature: HMAC-SHA256(payload, CODE_SIGNING_SECRET)
Full code: <prefix><base64url(payload)>.<signature>
```

### New internal endpoints

All under `/internal/management-bot/`, authenticated with `BOT_WEBHOOK_SECRET`.

#### `POST /internal/management-bot/verify-code`

Request: `{ code: string }`

Validation:
1. Parse prefix → determine type (deposit or withdrawal)
2. Decode base64url payload
3. Verify HMAC signature against `CODE_SIGNING_SECRET`
4. Check `exp` > now (not expired)
5. Look up record by `id` from payload
6. Check record status — if already `verified` and `codeVerifiedAt` is within the last 60 seconds, return success (idempotent retry). If any other non-`pending` status, reject as already used.
7. Atomically update status to `verified` using `WHERE id = :id AND status = 'pending'` to prevent TOCTOU race conditions. If no rows updated, another request claimed it first — return error.
8. Set `codeVerifiedAt = now`
9. Handle nullable `minecraftUsername` — if null, fall back to `'Unknown'` in the response

Response (success):
```json
{
  "success": true,
  "data": {
    "type": "deposit",
    "recordId": "uuid",
    "userId": "uuid",
    "username": "SteveMinecraft",
    "catalogItemDisplayName": "Zombie Spawner",
    "quantity": 3
  }
}
```

Response (error): `{ success: false, error: "Invalid or expired code" }`

#### `POST /internal/management-bot/confirm-deposit/:id`

Request: `{ closedBy: string }` — Discord username of the moderator who ran `/close`

- Checks deposit status is `verified` (not `pending` — uses separate service method from existing admin flow)
- Marks deposit as `confirmed`, sets `completedAt`, stores `closedBy` in dedicated `closed_by` column
- Credits items to user's inventory (same business logic as existing `confirmDeposit`)
- Returns `{ success: true }`

#### `POST /internal/management-bot/confirm-withdrawal/:id`

Request: `{ closedBy: string }` — Discord username of the moderator

- Checks withdrawal status is `verified` (separate service method)
- Marks withdrawal as `completed`, sets `completedAt`, stores `closedBy` in dedicated `closed_by` column
- Debits items from user's inventory (same business logic as existing `confirmWithdrawal`)
- Returns `{ success: true }`

#### `POST /internal/management-bot/reject-deposit/:id`

Request: `{ closedBy: string, reason: string }`

- Marks deposit as `rejected` — items were NOT handed off
- Returns `{ success: true }`

#### `POST /internal/management-bot/reject-withdrawal/:id`

Request: `{ closedBy: string, reason: string }`

- Marks withdrawal as `failed`, releases reserved items back to user inventory
- Returns `{ success: true }`

#### `POST /internal/management-bot/ticket-counter`

- Atomically increments and returns the next ticket number using `PlatformSettings` table
- Returns `{ success: true, data: { number: 7 } }`

#### `PATCH /internal/management-bot/ticket-channel`

Request: `{ type: "deposit" | "withdrawal", recordId: string, channelId: string }`

- Updates `ticketChannelId` on the correct table (deposit or withdrawal) based on `type`
- Used by the bot after creating the channel, for cleanup tracking
- Returns `{ success: true }`

---

## Management Bot Package

### Tech stack

- **discord.js** v14 (latest)
- **TypeScript** 5.x
- **Node.js** 22 (matches other packages)
- **zod** for config validation (matches API pattern)

### File structure

```
packages/management-bot/
├── package.json
├── tsconfig.json
├── Dockerfile
└── src/
    ├── index.ts              # Client setup, login, register slash command, graceful shutdown
    ├── config.ts             # Env var validation with zod
    ├── api-client.ts         # HTTP client for DonutTrade internal API
    ├── events/
    │   ├── ready.ts          # Log startup, verify panel exists, register /close command
    │   └── interactionCreate.ts  # Route buttons, modals, slash commands
    ├── interactions/
    │   ├── ticket-panel.ts   # Send/restore persistent embed with deposit+withdraw buttons
    │   ├── ticket-modal.ts   # Handle modal submit: verify code, create channel
    │   └── ticket-close.ts   # /close: confirm via API, transcript, delete channel
    ├── services/
    │   ├── transcript.ts     # Fetch all messages from channel, format as text
    │   └── ticket.ts         # Channel creation, permission setup, numbering
    └── utils/
        └── embeds.ts         # Reusable embed builders (panel, welcome, transcript, errors)
```

### Gateway Intents

```typescript
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,          // Channel/guild structure
    GatewayIntentBits.GuildMessages,    // messageCreate for transcripts
    GatewayIntentBits.MessageContent,   // Read message content (privileged)
    GatewayIntentBits.GuildMembers,     // Resolve member info (privileged)
  ],
});
```

### Environment variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DISCORD_BOT_TOKEN` | Bot token from Developer Portal | `MTI3...` |
| `DISCORD_GUILD_ID` | Discord server ID | `1234567890` |
| `DISCORD_TICKET_CATEGORY_ID` | Category for ticket channels | `1234567890` |
| `DISCORD_MODERATOR_ROLE_ID` | Role that sees tickets + can `/close` | `1234567890` |
| `DISCORD_PANEL_CHANNEL_ID` | `#create-ticket` channel ID | `1234567890` |
| `DISCORD_LOGS_CHANNEL_ID` | `#ticket-logs` channel ID | `1234567890` |
| `API_URL` | DonutTrade API (internal) | `http://api:3001` |
| `BOT_WEBHOOK_SECRET` | Shared API auth secret | `(min 32 chars)` |

### Interaction flow

#### 1. Persistent panel (on startup)

On `ClientReady`:
- Fetch `DISCORD_PANEL_CHANNEL_ID`
- Scan recent messages for an existing panel (match by bot author + embed title)
- If missing, send new panel embed:
  - Title: "DonutTrade Support"
  - Description: "Need to deposit or withdraw items? Click below to create a ticket."
  - Color: branded amber/gold
  - Buttons: "Deposit Items" (`ticket_deposit`) and "Withdraw Items" (`ticket_withdraw`)

#### 2. Button click → Modal popup

When user clicks "Deposit Items" or "Withdraw Items":
- Rate limit: 1 modal per 10 seconds per user (tracked in-memory Map, prevents spam)
- Show a Discord modal (TextInputComponent):
  - Title: "Deposit Items" or "Withdraw Items"
  - Input label: "Paste your code from the DonutTrade website"
  - Input style: Short (single line)
  - Placeholder: "DT-DEP-eyJ..."
  - customId: `modal_deposit` or `modal_withdraw`

#### 3. Modal submit → Verify + Create channel

On modal submit:
1. Extract code string from the input
2. Call `POST /internal/management-bot/verify-code` with `{ code }`
3. **If invalid:** Reply ephemeral — "Invalid or expired code. Please generate a new one on the website."
4. **If valid:**
   a. Call `POST /internal/management-bot/ticket-counter` → get number N
   b. Create channel `#deposit-N` or `#withdraw-N` under `DISCORD_TICKET_CATEGORY_ID`
   c. Permission overwrites: deny @everyone, allow user + mod role + bot
   d. Call `PATCH /internal/management-bot/ticket-channel/:id` with the Discord channel ID
   e. Send welcome embed in the channel:
      - Title: "Deposit #N" or "Withdrawal #N"
      - Fields: Player, Item, Quantity
      - Description: "A moderator will coordinate the in-game handoff with you."
      - Footer: "Moderators: use /close when the handoff is complete"
   f. Reply ephemeral to user: "Ticket created: #deposit-N"

#### 4. `/close` slash command

Registration: On `ClientReady`, register a guild-scoped slash command:
```
/close [action] [reason]
  action: optional, choices: "confirm" (default) | "reject"
  reason: optional string, required when action is "reject"
```

Handler:
1. Check caller has moderator role → if not, ephemeral error
2. Determine type from channel name prefix (`deposit-` → search ItemDeposit, `withdraw-` → search ItemWithdrawal), then look up record by `ticketChannelId` matching the current channel ID → if no record found, ephemeral error: "This command can only be used in a ticket channel."
3. If action is "confirm" (default):
   - Call `POST /internal/management-bot/confirm-deposit/:id` or `confirm-withdrawal/:id` with `{ closedBy: moderator.username }`
4. If action is "reject":
   - Call `POST /internal/management-bot/reject-deposit/:id` or `reject-withdrawal/:id` with `{ closedBy, reason }`
5. Generate transcript: fetch all messages in the channel, format as text
6. Send transcript to `#ticket-logs` as a `.txt` file attachment with an embed summary:
   - Embed title: `deposit-N` or `withdraw-N`
   - Embed fields: Player, Item, Quantity, Opened, Closed by, Result (confirmed/rejected)
   - Attached file: `deposit-N-transcript.txt` containing the full conversation
7. Delete the ticket channel

### Docker integration

```yaml
# Added to docker-compose.yml
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

---

## Frontend Changes

### DepositModal (dashboard)

Replace the existing single-content modal with a tabbed modal:

**Tab 1: "Deposit Money"** — existing content, unchanged.

**Tab 2: "Deposit Items"** — new:
1. Item dropdown: populated from `GET /catalog/items` (enabled items only)
2. Quantity input: number, min 1
3. "Generate Deposit Code" button → `POST /item-deposits` with `{ catalogItemId, quantity }`
4. On success, show:
   - Code string with copy-to-clipboard button
   - "This code expires in ~3 hours"
   - Next steps box (copy, go to Discord, click Deposit, paste code)
   - "Open Discord" button (links to server invite URL)
   - "Close" button

### WithdrawModal (dashboard)

Same tabbed pattern:

**Tab 1: "Withdraw Money"** — existing content, unchanged.

**Tab 2: "Withdraw Items"** — new:
1. Item dropdown: populated from user's inventory (`GET /inventory` filtered to `availableQuantity > 0`)
2. Quantity input: number, min 1, max = available quantity
3. "Generate Withdrawal Code" button → `POST /item-withdrawals`
4. Same code display as deposit

### New environment variable (web)

```
NEXT_PUBLIC_DISCORD_INVITE_URL — Discord server invite link for "Open Discord" button
```

---

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Invalid/expired code in modal | Ephemeral error: "Invalid or expired code. Please generate a new one on the website." |
| Code already used (status != pending) | Ephemeral error: "This code has already been used." |
| `/close` by non-moderator | Ephemeral error: "Only moderators can close tickets." |
| `/close` outside ticket channel | Ephemeral error: "This command can only be used in a ticket channel." |
| API unreachable from bot | Ephemeral error: "Could not reach the platform. Please try again later." |
| Bot restarts | Panel persists (Discord message). Open ticket channels persist. `/close` still works. Counter is in DB. |
| Transcript too long | Always uploaded as `.txt` file attachment — no character limit concerns |
| `/close reject` without reason | Ephemeral error: "Please provide a reason for rejection." |
| Record already confirmed/rejected | Ephemeral error: "This ticket has already been closed." |

---

## Data Flow — Complete Happy Path

1. **Web:** User opens Deposit modal → "Deposit Items" tab → selects Zombie Spawner × 3 → "Generate Code"
2. **API:** Creates ItemDeposit (status: `pending`), generates HMAC code `DT-DEP-...`, returns code + 3hr expiry
3. **Web:** Shows code with copy button + "Open Discord" link
4. **Discord:** User clicks "Deposit Items" in `#create-ticket` → modal popup → pastes code
5. **Bot → API:** `POST /internal/management-bot/verify-code` → validates HMAC, checks expiry, marks `verified`
6. **Bot:** Gets ticket number → creates `#deposit-7` (private channel) → sends welcome embed with details
7. **Discord:** User and admin coordinate in-game item handoff
8. **Admin:** Runs `/close` in `#deposit-7`
9. **Bot → API:** `POST /internal/management-bot/confirm-deposit/:id` → credits 3 Zombie Spawners to user inventory
10. **Bot:** Generates transcript → sends to `#ticket-logs` → deletes `#deposit-7`
