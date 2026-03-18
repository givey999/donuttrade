# Platform Enhancements Design Spec

**Date:** 2026-03-18
**Features:** Listing Customization, Hidden Mode, Admin-Configurable Fee, Maintenance Mode

---

## 1. Listing Customization

### Overview

Users can customize their marketplace listings with border colors, username colors, and username fonts. Cosmetics are organized into three tiers: free, paid (purchased with balance), and volume-unlocked (earned by trading).

### Cosmetic Definitions (stored as constants in `packages/shared`)

**Colors** (used for both border and username independently):

| ID | Hex | Tier | Cost / Requirement |
|----|-----|------|--------------------|
| `red` | `#EF4444` | free | -- |
| `blue` | `#3B82F6` | free | -- |
| `green` | `#22C55E` | free | -- |
| `gold` | `#EAB308` | paid | $1,000,000 |
| `purple` | `#A855F7` | paid | $1,000,000 |
| `pink` | `#EC4899` | paid | $1,000,000 |
| `diamond` | `#06B6D4` | volume | $250,000,000 volume |
| `emerald` | `#10B981` | volume | $500,000,000 volume |
| `ruby` | `#DC2626` | volume | $3,000,000,000 volume |

**Fonts** (used for username only):

| ID | Display Name | Tier | Cost / Requirement |
|----|-------------|------|--------------------|
| `sans` | Sans Serif | free | -- |
| `serif` | Serif | free | -- |
| `mono` | Monospace | free | -- |
| `cursive` | Cursive | paid | $1,000,000 |
| `fantasy` | Fantasy | paid | $1,000,000 |
| `rounded` | Rounded | paid | $1,000,000 |
| `elegant` | Elegant | volume | $250,000,000 volume |
| `bold-display` | Bold Display | volume | $500,000,000 volume |
| `premium` | Premium | volume | $3,000,000,000 volume |

### Per-Listing Customization

Each listing (Order) can independently have:
- **Border color** — any unlocked color
- **Username color** — any unlocked color (can differ from border)
- **Username font** — any unlocked font
- All three can be used simultaneously on a single listing.

### User Unlocks

Users unlock cosmetics by:
1. **Free tier** — available to all users immediately
2. **Paid tier** — purchased with in-game balance (one-time unlock, usable on all future listings)
3. **Volume tier** — automatically unlocked when the user's cumulative trading volume reaches the threshold

### Database Changes

**New table — `UserCosmetics`:**

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | Primary key |
| `userId` | UUID | FK to User, unique (one record per user) |
| `unlockedColors` | String[] | Array of paid color IDs the user has purchased |
| `unlockedFonts` | String[] | Array of paid font IDs the user has purchased |
| `hiddenModePurchased` | Boolean | Default false |
| `hiddenMode` | Boolean | Default false (current toggle state) |

**New column on `User`:**

| Column | Type | Notes |
|--------|------|-------|
| `tradingVolume` | Decimal | Default 0. Cumulative trade volume, updated on each OrderFill |

**New columns on `Order`:**

| Column | Type | Notes |
|--------|------|-------|
| `borderColor` | String? | Color ID for listing border |
| `usernameColor` | String? | Color ID for username |
| `usernameFont` | String? | Font ID for username |

### API Endpoints

- `GET /cosmetics` — returns all color/font definitions with tiers, plus the user's unlocked cosmetics and current trading volume
- `POST /cosmetics/unlock` — purchase a paid cosmetic `{ type: "color" | "font", id: string }`. Deducts balance, records transaction, adds to `UserCosmetics`
- Order creation (`POST /orders`) — accepts optional `borderColor`, `usernameColor`, `usernameFont` fields. Validates that the user has unlocked each cosmetic used.

### Frontend Changes

- **Dashboard** — new "Cosmetics" section showing unlocked/locked items, with buy buttons for paid tier and progress bars for volume tier
- **Create Order page** — color/font pickers for border, username color, and username font (only show unlocked options as selectable)
- **Marketplace page** — render listings with their custom border color, username color, and username font
- **Orders page** — show customization on user's own orders

### Volume Tracking

- On each `OrderFill`, increment both the order creator's and the filler's `tradingVolume` by the fill's `totalPrice`
- **This update must happen atomically within the same Prisma transaction** as the fill itself (inside `_fillBuyOrder` / `_fillSellOrder`). If the fill succeeds but volume tracking fails, cosmetic access would be inconsistent with actual trade history.
- Volume-tier cosmetics unlock automatically — no purchase needed. The API checks `user.tradingVolume >= requiredVolume` to determine availability.

### Unlock Resolution Logic

To determine a user's complete set of available cosmetics, `GET /cosmetics` combines three sources:
1. **Free tier** — all items with `tier: "free"` are always available
2. **Paid tier** — items whose ID appears in `UserCosmetics.unlockedColors` / `unlockedFonts`
3. **Volume tier** — items where `user.tradingVolume >= item.requiredVolume`

The response marks each cosmetic as `{ available: true/false, reason: "free" | "purchased" | "volume_unlocked" | "locked_paid" | "locked_volume" }`.

### Cosmetic Purchase Atomicity

`POST /cosmetics/unlock` must use a Prisma transaction that:
1. Reads the user's current balance with a fresh query (not cached)
2. Validates sufficient funds
3. Deducts balance
4. Adds the cosmetic ID to `UserCosmetics.unlockedColors` or `unlockedFonts`
5. Creates a `Transaction` record with type `cosmetic_purchase`

This prevents race conditions from concurrent purchase requests — matching the pattern used in `_createBuyOrder`.

### Cosmetic Validation on Order Creation

When `POST /orders` receives `borderColor`, `usernameColor`, or `usernameFont`, validate each against the shared `COLORS` / `FONTS` constants and confirm the user has unlocked that cosmetic. Reject with 400 if any cosmetic is invalid or locked.

---

## 2. Hidden Mode

### Overview

Users can purchase hidden mode (one-time, admin-configured price) and toggle it on/off. When active, the user appears as "Hidden" on all their listings and is excluded from leaderboards. All listing customization is suppressed while hidden.

### Behavior

- **Purchase:** One-time fee stored in `PlatformSettings` (key: `hidden_mode_price`). Deducts balance, sets `UserCosmetics.hiddenModePurchased = true`.
- **Toggle:** User can turn hidden mode on/off from their dashboard at any time (no additional cost).
- **Active listings:** Toggling hidden mode on/off immediately affects all active listings:
  - **On:** Username displays as "Hidden", border color / username color / username font are suppressed (listing renders in default style)
  - **Off:** Username and all customization are restored
- **Leaderboards:** Hidden users are excluded from all leaderboard queries.

### Database Changes

Uses the `UserCosmetics` table (fields `hiddenModePurchased` and `hiddenMode` defined above in Section 1).

### API Endpoints

- `POST /cosmetics/hidden/purchase` — buy hidden mode. Must use a Prisma transaction (fresh balance read, deduct, set `hiddenModePurchased = true`, create `Transaction` with type `hidden_mode_purchase`). Reads price from `PlatformSettings` via `PlatformSettingsService`.
- `POST /cosmetics/hidden/toggle` — toggle `hiddenMode` on/off. Requires `hiddenModePurchased = true`.
- Marketplace/orders queries check `hiddenMode` on the order creator: if true, return username as "Hidden" and null out style fields.

### Hidden Mode Suppression Strategy

Customization fields (`borderColor`, `usernameColor`, `usernameFont`) remain stored on the `Order` row — they are **not** deleted when hidden mode is toggled on. Instead, they are **masked at query time**: if the order creator's `hiddenMode` is `true`, the API returns `null` for all style fields and "Hidden" for the username. When hidden mode is toggled off, the original customization is restored automatically.

### Affected Query Paths

The following endpoints must apply hidden mode masking:
- `GET /marketplace` — public marketplace listing
- `GET /marketplace/:id` — single order detail
- `GET /orders/my` — user's own orders (still shows real username to the owner, but other users' names on fills are masked if those users are hidden)

**Admin endpoints should NOT mask hidden users** — admins always see real usernames:
- `GET /admin/orders`
- `GET /admin/users/:id` (recent orders section)

### Frontend Changes

- **Dashboard** — "Hidden Mode" card: shows purchase button (if not bought) or on/off toggle (if bought). Clear explanation that customization is suppressed while hidden.
- **Marketplace** — listings from hidden users show "Hidden" as username with default styling.

---

## 3. Admin-Configurable Fee (Commission)

### Overview

Move the marketplace commission rate from an environment variable to the `PlatformSettings` database table, making it editable from the admin panel. Add a revenue dashboard showing commission earnings.

### Current State

- `MARKETPLACE_COMMISSION_RATE` env var (default 0.02 / 2%)
- Commission calculated on each `OrderFill` and stored in `commissionAmount`

### New Behavior

- Commission rate read from `PlatformSettings` (key: `commission_rate`) with Redis cache
- Env var becomes the initial seed value (used in migration only)
- Admin can update the rate from the admin panel; changes take effect immediately (Redis updated on write)

### Database Changes

**New table — `PlatformSettings`:**

| Column | Type | Notes |
|--------|------|-------|
| `key` | String | Primary key |
| `value` | String | JSON-encoded value |
| `updatedAt` | DateTime | Auto-updated |
| `updatedBy` | UUID? | FK to User (which admin changed it), **onDelete: SetNull** |

**Seeded values on migration:**

| Key | Initial Value | Description |
|-----|---------------|-------------|
| `commission_rate` | `"0.02"` | Marketplace commission rate |
| `hidden_mode_price` | `"10000000"` | Hidden mode purchase price |
| `maintenance_enabled` | `"false"` | Maintenance mode toggle |
| `maintenance_message` | `""` | Maintenance mode message |

### Revenue Dashboard (Admin Panel)

- **Total commission earned** (all time) — `SUM(OrderFill.commissionAmount)`
- **Commission this week / this month** — filtered by `OrderFill.createdAt`
- **Commission by item** — grouped by `Order.catalogItemId`, showing which items generate the most fees
- No new tables needed — queries aggregate existing `OrderFill.commissionAmount` data.

### User-Facing Fee Transparency

- **Marketplace page** — display current fee rate (e.g., "Platform fee: 2%")
- **Create order page** — show fee preview based on order total (e.g., "Fee: $200,000 (2% of $10,000,000)")
- **Fill order modal** — show how much commission will be deducted from the transaction

### API Changes

- New service: `PlatformSettingsService` — read/write settings with Redis cache layer
- `GET /admin/settings` — returns all platform settings (admin only)
- `PUT /admin/settings/:key` — update a setting (admin only). Validates against an allowlist of known keys with per-key validation rules (see below). Writes to DB + invalidates Redis cache. Creates an audit log entry.

**Setting Validation Rules:**

| Key | Type | Constraints |
|-----|------|-------------|
| `commission_rate` | number | 0 ≤ value ≤ 0.50 (max 50%) |
| `hidden_mode_price` | number | value ≥ 0 (integer) |
| `maintenance_enabled` | boolean | true/false only |
| `maintenance_message` | string | max 500 characters |

Unknown keys are rejected with 400. The new rate applies only to orders created after the change; existing orders retain the `commissionRate` captured at creation time.
- `GET /public/settings/commission-rate` — public endpoint returning current commission rate (for marketplace UI)
- `GET /admin/revenue` — revenue dashboard data (admin only)
- Marketplace service updated to read commission rate from `PlatformSettingsService` instead of env var

---

## 4. Maintenance Mode

### Overview

Admins can put the entire platform into maintenance mode with a custom message. All non-admin users (including moderators and managers) are blocked from using the platform.

### Storage

- **Database:** `PlatformSettings` table (keys: `maintenance_enabled`, `maintenance_message`)
- **Redis cache:** For fast per-request checks without DB hits
- On toggle: write to DB first, then update Redis
- On app startup: hydrate Redis from DB

### API Behavior

- **Fastify hook** runs on every request (before route handler):
  1. Check Redis for `maintenance_enabled`
  2. If `false` → continue normally
  3. If `true` → check requesting user's role
     - `admin` role → continue normally
     - Everyone else → return `503 Service Unavailable` with `{ maintenance: true, message: "..." }`
  4. Exempt routes: `/health`, `/auth/*` (so admins can still log in), `/internal/*` (bot-bridge webhooks for deposits/verification — these use `BOT_WEBHOOK_SECRET`, not user auth), `/public/*` (public stats/settings)

### Admin Panel

- **Settings page** — maintenance mode section:
  - Toggle switch (enable/disable)
  - Text area for maintenance message/reason
  - Toggle on → writes to DB + Redis, immediately blocks non-admin users
  - Toggle off → clears maintenance state, platform resumes

### Frontend Behavior

- On receiving a 503 maintenance response, the app shows a **full-screen maintenance page**:
  - Platform logo
  - "Under Maintenance" heading
  - Custom message from admin
  - "Check again" button (re-fetches to see if maintenance ended)
  - No navigation, no sidebar, no other UI
- **Admins** see a small **banner** at the top of the page ("Platform is in maintenance mode") but can use everything normally

### Access Rules

| Role | During Maintenance |
|------|-------------------|
| `admin` | Full access + maintenance banner |
| `manager` | Blocked — sees maintenance screen |
| `moderator` | Blocked — sees maintenance screen |
| `user` | Blocked — sees maintenance screen |

---

## Architecture Summary

### New Database Tables

1. **`PlatformSettings`** (`@@map("platform_settings")`) — key-value store for admin configuration. `updatedBy` FK uses `onDelete: SetNull`.
2. **`UserCosmetics`** (`@@map("user_cosmetics")`) — per-user cosmetic unlocks and hidden mode state

### Modified Tables

1. **`User`** — add `tradingVolume` (Decimal)
2. **`Order`** — add `borderColor`, `usernameColor`, `usernameFont` (String?)

### New API Routes

| Method | Route | Auth | Purpose |
|--------|-------|------|---------|
| GET | `/cosmetics` | user | Get cosmetic definitions + user unlocks |
| POST | `/cosmetics/unlock` | user | Purchase a paid cosmetic |
| POST | `/cosmetics/hidden/purchase` | user | Buy hidden mode |
| POST | `/cosmetics/hidden/toggle` | user | Toggle hidden mode on/off |
| GET | `/public/settings/commission-rate` | public | Current commission rate |
| GET | `/admin/settings` | admin | All platform settings |
| PUT | `/admin/settings/:key` | admin | Update a platform setting |
| GET | `/admin/revenue` | admin | Revenue dashboard data |

### New Transaction Types

Add to `TransactionType` in `packages/shared/src/types/index.ts`:
- `cosmetic_purchase` — when a user buys a paid color or font
- `hidden_mode_purchase` — when a user buys hidden mode

### New Shared Constants

- Color definitions with tiers, prices, and volume thresholds
- Font definitions with tiers, prices, and volume thresholds
- `COSMETICS_RATE_LIMIT` — use existing `RateLimits.PURCHASES` (10/min) for all cosmetic/hidden mode endpoints

### Redis Keys

- `platform:commission_rate` — cached commission rate
- `platform:hidden_mode_price` — cached hidden mode price
- `platform:maintenance_enabled` — cached maintenance flag
- `platform:maintenance_message` — cached maintenance message

### Audit Logging

Admin actions that create audit log entries:
- Commission rate changes (`setting.update` action, target: `commission_rate`)
- Hidden mode price changes (`setting.update` action, target: `hidden_mode_price`)
- Maintenance mode toggle (`setting.update` action, target: `maintenance_enabled`)

### Time Zone

Revenue dashboard queries (commission this week/month) use UTC boundaries, matching the existing `createdAt` timestamps in the database.
