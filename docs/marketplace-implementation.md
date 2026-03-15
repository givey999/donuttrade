# Marketplace Implementation

Built 2026-03-14. Adds item trading with partial order fulfillment to DonutTrade.

---

## Overview

Users can deposit/withdraw spawner items (admin-verified), then create buy or sell orders on the marketplace. Other users can partially or fully fill those orders. Money and items are escrowed to prevent fraud.

## Architecture

```
User deposits items → Admin confirms → Inventory updated
User creates sell order → Items reserved (escrowed)
User creates buy order → Money locked (escrowed)
Another user fills order → Items + money transfer atomically
Order expires/cancelled → Unfilled portion refunded
```

## Database Models

### catalog_items
Item definitions. Currently 10 spawner types seeded (zombie, skeleton, blaze, spider, cave spider, creeper, enderman, iron golem, silverfish, magma cube).

| Column | Type | Notes |
|--------|------|-------|
| name | String (unique) | Internal name: `zombie_spawner` |
| display_name | String | User-facing: `Zombie Spawner` |
| category | String | Default: `spawner` |
| enabled | Boolean | Disabled items can't be traded |

### inventory_items
Per-user item balances. Unique on `(user_id, catalog_item_id)`.

| Column | Type | Notes |
|--------|------|-------|
| quantity | Int | Total owned |
| reserved_quantity | Int | Locked by sell orders or pending withdrawals |
| *available* | *computed* | `quantity - reserved_quantity` |

### item_deposits / item_withdrawals
Admin-verified item entry/exit from the platform. Deposits add to inventory on confirm. Withdrawals reserve items on request, remove on confirm, release on fail/cancel.

### orders
Buy and sell orders with partial fill support.

| Column | Type | Notes |
|--------|------|-------|
| type | String | `buy` or `sell` |
| quantity | Int | Total requested |
| filled_quantity | Int | How much has been filled |
| price_per_unit | Decimal(20,2) | Price per item |
| commission_rate | Decimal(5,4) | Snapshot at creation (default 0.02) |
| escrow_amount | Decimal(20,2) | Money locked (buy orders only) |
| premium_fee | Decimal(20,2) | $10M for 48h listing |
| status | String | `active`, `completed`, `cancelled`, `expired` |
| expires_at | DateTime | 24h (free) or 48h (premium) from creation |

### order_fills
Individual fill records linking a filler to an order.

| Column | Type | Notes |
|--------|------|-------|
| filled_by_user_id | String | Who filled it |
| quantity | Int | How many items in this fill |
| total_price | Decimal | `quantity * price_per_unit` |
| commission_amount | Decimal | `total_price * commission_rate` |
| net_amount | Decimal | `total_price - commission_amount` (seller receives) |

## Escrow Mechanics

### Buy Order Flow
1. **Create**: Buyer's balance decremented by `quantity * pricePerUnit + premiumFee`
2. **Fill**: Seller provides items → items go to buyer, seller gets paid from escrow minus commission
3. **Cancel/Expire**: Unfilled portion refunded to buyer's balance

### Sell Order Flow
1. **Create**: Seller's items reserved (`reservedQuantity` incremented)
2. **Fill**: Buyer pays directly → reserved items transfer to buyer, seller gets money minus commission
3. **Cancel/Expire**: Unfilled items released (reservation decremented)

### Commission
- Default 2%, configurable via `MARKETPLACE_COMMISSION_RATE` env var
- Always charged to the **seller** (deducted from proceeds)
- Snapshotted on the order at creation time

## API Routes

### Public
| Method | Path | Description |
|--------|------|-------------|
| GET | `/catalog/items` | List enabled catalog items |
| GET | `/marketplace` | Browse active orders (filters: type, catalogItemId, category, minPrice, maxPrice, sort) |
| GET | `/marketplace/:id` | Order detail with fill history |

### Authenticated (user)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/inventory` | User's item balances |
| POST | `/item-deposits` | Request item deposit |
| GET | `/item-deposits` | Own deposit history |
| POST | `/item-withdrawals` | Request item withdrawal |
| GET | `/item-withdrawals` | Own withdrawal history |
| DELETE | `/item-withdrawals/:id` | Cancel pending withdrawal |
| POST | `/orders` | Create buy/sell order |
| POST | `/orders/:id/fill` | Fill an order |
| DELETE | `/orders/:id` | Cancel own order |
| GET | `/orders/my` | Own orders (filter by status) |

### Internal (bot/admin, Bearer token auth)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/internal/item-deposits/pending` | List pending deposits |
| PATCH | `/internal/item-deposits/:id/confirm` | Confirm deposit |
| PATCH | `/internal/item-deposits/:id/reject` | Reject deposit |
| GET | `/internal/item-withdrawals/pending` | List pending withdrawals |
| PATCH | `/internal/item-withdrawals/:id/claim` | Claim for processing |
| PATCH | `/internal/item-withdrawals/:id/confirm` | Confirm withdrawal |
| PATCH | `/internal/item-withdrawals/:id/fail` | Fail withdrawal |

## Transaction Types

Added to existing system: `escrow`, `escrow_refund`, `listing_fee`

## Background Jobs

**Order Expiry** (`order-expiry.service.ts`): Runs every 60 seconds. Finds orders where `status = 'active' AND expires_at < NOW()`, refunds unfilled portions (money for buy orders, items for sell orders), marks as `expired`. Errors on individual orders are logged but don't block processing of others.

## Frontend Pages

| Page | Path | Description |
|------|------|-------------|
| Marketplace | `/marketplace` | Browse orders with type/item/sort filters, fill modal |
| Create Order | `/marketplace/create` | Buy/sell toggle, item picker, qty/price inputs, 24h/48h duration |
| My Orders | `/orders` | Status tabs, cancel action, paginated table |
| Order Detail | `/orders/[id]` | Progress bar, fill history table, cancel button |
| Dashboard | `/dashboard` | Added inventory section showing item balances |
| Navbar | (layout) | Navigation: Dashboard, Marketplace, My Orders |

## Files Created

### Backend
```
packages/api/prisma/seed.ts
packages/api/src/repositories/catalog-item.repository.ts
packages/api/src/repositories/inventory.repository.ts
packages/api/src/services/item-deposit.service.ts
packages/api/src/services/item-withdrawal.service.ts
packages/api/src/services/marketplace.service.ts
packages/api/src/services/order-expiry.service.ts
packages/api/src/routes/catalog.ts
packages/api/src/routes/inventory.ts
packages/api/src/routes/item-deposits.ts
packages/api/src/routes/item-withdrawals.ts
packages/api/src/routes/marketplace.ts
packages/api/src/routes/orders.ts
packages/api/src/routes/internal/item-deposit.ts
packages/api/src/routes/internal/item-withdrawal.ts
```

### Frontend
```
packages/web/components/navbar.tsx
packages/web/components/marketplace/fill-order-modal.tsx
packages/web/app/marketplace/page.tsx
packages/web/app/marketplace/create/page.tsx
packages/web/app/orders/page.tsx
packages/web/app/orders/[id]/page.tsx
```

### Files Modified
```
packages/api/prisma/schema.prisma          — 6 new models + User relations
packages/api/package.json                  — prisma seed config
packages/api/src/index.ts                  — 6 new route plugins + expiry job
packages/api/src/config/index.ts           — MARKETPLACE_COMMISSION_RATE env
packages/api/src/routes/internal/index.ts  — item deposit/withdrawal internal routes
packages/api/src/routes/transactions.ts    — extended VALID_TYPES
packages/shared/src/types/index.ts         — all new types + extended TransactionType
packages/shared/src/constants/index.ts     — marketplace constants
packages/web/app/layout.tsx                — navbar
packages/web/app/dashboard/page.tsx        — inventory section + new transaction type badges
```

## Configuration

| Env Var | Default | Description |
|---------|---------|-------------|
| `MARKETPLACE_COMMISSION_RATE` | `0.02` | Commission rate (0-1) charged to sellers |

## Shared Constants

```ts
MARKETPLACE_COMMISSION_RATE = 0.02      // 2% default
MARKETPLACE_PREMIUM_FEE = 10_000_000    // $10M for 48h listing
MARKETPLACE_STANDARD_DURATION_MS        // 24 hours
MARKETPLACE_PREMIUM_DURATION_MS         // 48 hours
MARKETPLACE_MIN_PRICE = 1
MARKETPLACE_MAX_PRICE = 100_000_000_000
MARKETPLACE_MIN_QUANTITY = 1
MARKETPLACE_MAX_QUANTITY = 10_000
```
