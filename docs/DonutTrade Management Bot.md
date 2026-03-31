# DonutTrade Management Bot

## Overview

The DonutTrade Management Bot is a Discord bot (`packages/management-bot/`) that manages item deposit and withdrawal tickets in the DonutTrade Discord server. Users generate codes on the website, paste them in Discord, and moderators coordinate in-game item handoffs through private ticket channels.

The bot runs as a Docker container alongside the API, communicating through scoped internal endpoints authenticated with `BOT_WEBHOOK_SECRET`.

---

## Core Features

### Persistent Ticket Panel

On startup, the bot posts (or finds an existing) embed in the panel channel with two buttons:
- **Deposit Items** — Opens a modal for deposit codes
- **Withdraw Items** — Opens a modal for withdrawal codes

The bot checks for its own recent embed to avoid posting duplicates on restart.

### Code Verification Flow

1. User generates a deposit/withdrawal on the website → receives an HMAC-signed code (`DT-DEP-...` or `DT-WTH-...`)
2. User clicks button on Discord panel → modal appears → pastes code
3. Bot calls `POST /internal/management-bot/verify-code` → API validates HMAC signature, checks expiry (3 hours), marks as `verified`
4. Bot creates a private ticket channel under the appropriate category

Code format: `DT-DEP-<base64url(JSON payload)>.<hmac-sha256 signature>`
Payload contains: `{ type, id, userId, itemId, quantity, exp }`

### Ticket Channels

Each ticket is a private text channel named `deposit-{N}` or `withdraw-{N}` (sequentially numbered via an atomic counter in `platform_settings`).

**Permissions set on creation:**
- `@everyone` — No access
- Ticket user — View, Send Messages, Read History, Attach Files
- Moderator role — View, Send Messages, Read History, Manage Messages
- Bot — View, Send Messages, Manage Channels, Read History

The record ID is stored in the channel topic for lookup during `/close`.

**Welcome embed** shows: Player username, Item name, Quantity, and a footer instructing moderators to use `/close`.

### Ticket Closure (`/close` slash command)

Moderators use `/close confirm` or `/close reject reason:...` to close tickets.

**Confirm flow:**
1. Calls API to confirm the deposit/withdrawal (adds/removes items from inventory)
2. Generates a text transcript of all messages (paginated, fetches all messages)
3. Sends summary embed + transcript to the logs channel with the ticket label as searchable text content (e.g., `deposit-5`)
4. Forwards all messages with attachments to the logs channel (preserves files after channel deletion via Discord's native message forwarding — no downloading through the bot)
5. Deletes the ticket channel after 5 seconds

**Reject flow:** Same as confirm but marks the deposit/withdrawal as rejected. No inventory changes.

**Error resilience:** The confirm/reject API call and the transcript generation are in separate try/catch blocks. If the transcript fails, the deposit still goes through — the user sees "Ticket confirmed" not a misleading error.

### Ticket Search (Admin Workflow)

1. Admin goes to web admin panel → Users → selects a user → Deposits/Withdrawals tab
2. Sees the ticket label (e.g., `deposit-5`) in the table
3. Copies it, searches in the Discord logs channel
4. Finds the summary embed, transcript file, and forwarded attachments

The ticket label is stored on the `ItemDeposit`/`ItemWithdrawal` database records (`ticket_label` column) and included as plain text content on Discord log messages for search indexing.

### Rate Limiting

Users have a 10-second cooldown between ticket button clicks to prevent spam.

---

## Technical Architecture

### Stack

- **Language:** TypeScript
- **Discord library:** discord.js v14
- **Package:** `packages/management-bot/`
- **Deployment:** Docker container, depends on API service

### File Structure

```
packages/management-bot/src/
├── index.ts                          # Entry point, bot login, event handlers
├── config.ts                         # Zod-validated environment variables
├── api-client.ts                     # Scoped API client (fetch-based, Bearer auth)
├── events/
│   ├── ready.ts                      # Slash command registration, panel check
│   └── interactionCreate.ts          # Routes buttons, modals, commands
├── interactions/
│   ├── ticket-panel.ts               # Panel embed + button builders
│   ├── ticket-modal.ts               # Modal show + submit handlers
│   └── ticket-close.ts               # /close slash command handler
├── services/
│   ├── ticket.ts                     # Channel creation with permissions
│   └── transcript.ts                 # Message fetching + text transcript generation
└── utils/
    └── embeds.ts                     # Embed builders (panel, welcome, transcript)
```

### API Endpoints Used

All under `/internal/management-bot/`, authenticated with `Authorization: Bearer {BOT_WEBHOOK_SECRET}`:

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/verify-code` | Verify deposit/withdrawal HMAC code |
| POST | `/confirm-deposit/{id}` | Confirm deposit, add items to inventory |
| POST | `/confirm-withdrawal/{id}` | Confirm withdrawal, remove items from inventory |
| POST | `/reject-deposit/{id}` | Reject deposit (with closedBy, reason) |
| POST | `/reject-withdrawal/{id}` | Reject withdrawal (with closedBy, reason) |
| POST | `/ticket-counter` | Atomic increment, returns next ticket number |
| PATCH | `/ticket-channel` | Store Discord channel ID + ticket label on record |

### Environment Variables

| Variable | Description |
|----------|-------------|
| `DISCORD_BOT_TOKEN` | Bot token from Discord Developer Portal |
| `DISCORD_GUILD_ID` | DonutTrade Discord server ID |
| `DISCORD_DEPOSIT_CATEGORY_ID` | Category for deposit ticket channels |
| `DISCORD_WITHDRAWAL_CATEGORY_ID` | Category for withdrawal ticket channels |
| `DISCORD_MODERATOR_ROLE_ID` | Role that can see/close all tickets |
| `DISCORD_PANEL_CHANNEL_ID` | Channel where the persistent panel lives |
| `DISCORD_LOGS_CHANNEL_ID` | Channel for transcripts and forwarded attachments |
| `API_URL` | Internal API URL (default: `http://api:3001`) |
| `BOT_WEBHOOK_SECRET` | Shared secret for API auth (min 32 chars) |
| `CODE_SIGNING_SECRET` | HMAC-SHA256 secret for code generation (min 32 chars) |

### Database Fields

**On `ItemDeposit` and `ItemWithdrawal` models:**
- `code` — HMAC-signed verification code (unique)
- `codeExpiresAt` — 3-hour expiry timestamp
- `codeVerifiedAt` — When the code was verified via Discord
- `ticketChannelId` — Discord channel ID of the ticket
- `ticketLabel` — Human-readable label like `deposit-5` (used for Discord search)
- `closedBy` — Discord username of the moderator who closed the ticket
- `closeReason` — Reason provided on rejection

### Bot Permissions Required (Server Role Level)

| Permission | Reason |
|------------|--------|
| Manage Channels | Create/delete ticket channels |
| Send Messages | Post embeds, transcripts, responses |
| Read Message History | Fetch messages for transcripts |
| Manage Messages | Clean up in ticket channels |
| View Channels | Access categories and channels |
| Attach Files | Send transcript files |

**Important:** Manage Channels must be granted at the server role level, not just per-category. The bot also needs explicit access to the logs channel (View, Send Messages, Attach Files).

---

## Bugs Fixed During Initial Testing (2026-03-24)

1. **FK violation on ticket counter** — `incrementTicketCounter()` used `updated_by = 'system'` but `platform_settings.updated_by` is a FK to `users.id`. Fixed by using `NULL`.

2. **Discord Missing Permissions (50013)** — Bot needed Manage Channels at the server role level, not just on individual categories. Also needed explicit access to the logs channel.

3. **API error parsing** — `api-client.ts` did `new Error(json.error)` but `json.error` was an object, producing `Error: [object Object]`. Fixed to extract `.message` from object errors.

4. **Fragile close handler** — Transcript errors masked successful deposit confirmations. Split into separate try/catch so confirm/reject always succeeds even if transcript fails.

5. **Welcome embed not found** — Close handler fetched last 10 messages but the welcome embed was the first message. Busy channels with 10+ messages missed it. Fixed by using the messages already fetched for the transcript.

6. **Attachment CDN links dying** — When ticket channels are deleted, Discord CDN URLs for uploaded files break. Fixed by forwarding messages with attachments to the logs channel via Discord's native `message.forward()` before deletion. Forwarded messages create independent copies — attachments survive.

---

## Discord OAuth2 Sign-Up (Planned)

### What

Add a "Sign in with Discord" button to the login page, alongside the existing Microsoft sign-in. Users can create and authenticate their DonutTrade account using their Discord account.

### Why

Many DonutTrade users already have Discord accounts (they use the Discord server for tickets). Letting them sign up with Discord removes friction — no need for a separate Microsoft account.

### How It Works

The flow mirrors the existing Microsoft OAuth2 implementation:

1. User clicks "Sign in with Discord" on the login page
2. Redirected to Discord OAuth2 authorization URL
3. Discord redirects back to `https://donuttrade.com/auth/discord/callback` with an authorization code
4. API exchanges the code for Discord tokens
5. API fetches the user's Discord profile (id, username, email)
6. Three branches:
   - **New user:** Create account with `authProvider: 'discord'`, store `discordId` + `discordUsername`, redirect to username setup + verification
   - **Returning verified user:** Create session, redirect to dashboard
   - **Returning unverified user:** Redirect to username setup or verification

### What Already Exists

- `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `DISCORD_REDIRECT_URI` — env vars already in `.env` (empty)
- `discordId` and `discordUsername` — fields already on the User model
- `userRepository.findByDiscordId()` — already implemented
- `isDiscordOAuthConfigured()` — helper already in `config/oauth.ts`
- `AUTH_PROVIDERS` constant includes `'discord'`
- Login page has a disabled "Discord (coming soon)" button
- `authProvider` column already supports `'discord'` as a value

### What Needs To Be Built

1. **Discord OAuth2 service** (`packages/api/src/services/auth/discord.service.ts`) — Token exchange, profile fetch. Mirrors `microsoft.service.ts`.
2. **Discord auth route** (`packages/api/src/routes/auth/discord.ts`) — Two endpoints: `GET /auth/discord` (initiate) and `GET /auth/discord/callback` (handle callback). Mirrors `microsoft.ts`.
3. **Register the route** in `packages/api/src/routes/auth/index.ts`
4. **Enable the login button** on the frontend (`packages/web/app/(app)/login/page.tsx`)
5. **Fill in env vars** — Create OAuth2 credentials in Discord Developer Portal (same app as the bot), set redirect URI to `https://donuttrade.com/auth/discord/callback`

### Discord OAuth2 Details

- Authorization URL: `https://discord.com/oauth2/authorize`
- Token URL: `https://discord.com/api/oauth2/token`
- User info URL: `https://discord.com/api/users/@me`
- Scopes needed: `identify email`
- Returns: `id`, `username`, `email` (if user has a verified email)

### Considerations

- Users who sign up with Discord get `authProvider: 'discord'` — they can't also sign in with Microsoft (one provider per account, same as current design)
- The `discordId` from OAuth2 can later be used by the management bot to auto-identify users, but this is optional — the code paste system works fine
- CSRF state protection must be implemented (same pattern as Microsoft — random state token, validated on callback)

---

## Planned Future Capabilities

- **Dupe detection** — Monitor transaction patterns, auto-trigger maintenance mode
- **Admin notifications** — Alert moderators for high-value transactions
- **User lookup** — `/lookup <username>` slash command
- **Order notifications** — Marketplace events to a #marketplace-feed channel
- **Moderation actions** — `/ban`, `/timeout`, `/verify` slash commands
- **Status dashboard** — Periodic platform health embeds
- **Audit log feed** — Stream admin actions to #audit-log
