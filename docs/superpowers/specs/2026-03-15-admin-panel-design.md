# Admin Panel Design

Built for DonutTrade. Adds a role-based admin panel with sidebar navigation for managing users, item deposits/withdrawals, orders, and the catalog.

---

## Roles & Permissions

Add `role` field to `users` table: `user` (default), `moderator`, `admin`.

`.givey3917` promoted to `admin` in the migration.

### Permission Matrix

| Action | Moderator | Admin |
|--------|-----------|-------|
| View admin panel & stats | Yes | Yes |
| Confirm/reject item deposits | Yes | Yes |
| Claim/confirm/fail item withdrawals | Yes | Yes |
| View all orders | Yes | Yes |
| Cancel any order | No | Yes |
| View/search users | Yes | Yes |
| Ban/unban users | No | Yes |
| Adjust user balances | No | Yes |
| Manage catalog items (add/enable/disable) | No | Yes |
| Promote/demote users | No | Yes |

### Guardrails

- An admin **cannot ban themselves** (`targetId !== requestingUserId`).
- An admin **cannot change their own role**.
- An admin **cannot demote another admin** — only the seed admin (`.givey3917`) or a future superadmin mechanism can do that. This prevents mutual demotion wars and ensures there's always at least one admin.

---

## Shared Types

```ts
export type UserRole = 'user' | 'moderator' | 'admin';

export interface UserProfile {
  // ... existing fields
  role: UserRole;
}
```

Add `admin_adjustment` to `TransactionType`:
```ts
export type TransactionType = 'deposit' | 'withdrawal' | 'purchase' | 'sale'
  | 'escrow' | 'escrow_refund' | 'listing_fee' | 'admin_adjustment';
```

---

## Backend

### Schema Change

```prisma
model User {
  // ... existing fields
  role String @default("user") @map("role") // 'user' | 'moderator' | 'admin'
}
```

Migration adds `role` column with default `'user'`, then updates `.givey3917` to `'admin'`.

### Auth Middleware

New `requireRole(...roles)` preHandler. Since admin routes are low-traffic, it **reads the role from the database** on every request (not from the JWT). This avoids stale-role problems — if a user's role is changed, the next request sees the new role immediately.

Include `role` in:
- `UserProfile` shared type
- `/auth/me` response (read from DB)
- `AuthUser` interface in `auth.ts` plugin (populated from DB lookup in `requireRole`)

The JWT payload does **not** need `role` — the frontend gets it from `/auth/me` and the backend always checks the DB.

### API Routes

All under `/admin` prefix, all require `authenticate` + `requireRole('moderator')` minimum.

All list endpoints support `?page=1&perPage=20` pagination with `PaginationMeta` response, consistent with existing patterns.

#### Stats (moderator+)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/stats` | Dashboard stats: total users, pending deposits count, pending withdrawals count, active orders count, volume per catalog item |

#### Item Deposits (moderator+)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/item-deposits` | List deposits with user info. Filter by `?status=` (default: pending). Supports pagination |
| PATCH | `/admin/item-deposits/:id/confirm` | Confirm deposit (adds items to inventory). Uses `itemDepositService.confirmDeposit()` |
| PATCH | `/admin/item-deposits/:id/reject` | Reject deposit with optional notes. Uses `itemDepositService.rejectDeposit()` |

#### Item Withdrawals (moderator+)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/item-withdrawals` | List withdrawals. Filter by `?status=` (default: pending,processing). Supports pagination |
| PATCH | `/admin/item-withdrawals/:id/claim` | Claim for processing. Uses `itemWithdrawalService.claimWithdrawal()` |
| PATCH | `/admin/item-withdrawals/:id/confirm` | Confirm withdrawal. Uses `itemWithdrawalService.confirmWithdrawal()` |
| PATCH | `/admin/item-withdrawals/:id/fail` | Fail with reason. Uses `itemWithdrawalService.failWithdrawal()` |

#### Orders (mixed permissions)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/orders` | All orders with filters (status, type, catalogItemId, userId). Moderator+. Supports pagination |
| DELETE | `/admin/orders/:id` | Admin force-cancel. Admin only. See Force-Cancel section below |

#### Users (mixed permissions)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/users` | Search/list users (by username, email, role). Moderator+. Supports pagination |
| GET | `/admin/users/:id` | User detail (profile, balance, recent orders/deposits/withdrawals). Moderator+ |
| PATCH | `/admin/users/:id/ban` | Ban user with reason. Admin only. See Ban Side Effects below |
| PATCH | `/admin/users/:id/unban` | Unban user. Admin only |
| PATCH | `/admin/users/:id/balance` | Adjust balance (amount + reason). Creates `admin_adjustment` transaction. Admin only |
| PATCH | `/admin/users/:id/role` | Change role. Admin only. Subject to guardrails above |

#### Catalog (admin only)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/catalog` | List all catalog items (including disabled). Supports pagination |
| POST | `/admin/catalog` | Add new catalog item (name, displayName, category, description?, iconUrl?) |
| PATCH | `/admin/catalog/:id` | Update item (displayName, description, iconUrl, enabled) |

### Force-Cancel (admin)

`DELETE /admin/orders/:id` calls a new `marketplaceService.adminCancelOrder(orderId, adminId)` method that:
- Bypasses the ownership check (any active order can be cancelled)
- Reuses the same escrow refund / reservation release logic from `cancelOrder`
- Logs the admin's ID in the order metadata or a structured log entry

### Ban Side Effects

When an admin bans a user via `PATCH /admin/users/:id/ban`:
1. Set `bannedAt` and `banReason` on the user
2. Active orders are **not** force-cancelled — they will expire naturally (the ban prevents new actions, and existing service methods already check `bannedAt`)
3. Pending deposits/withdrawals remain as-is (admins can reject/fail them separately if needed)

This keeps the ban action simple and predictable. Admins can manually clean up outstanding orders/deposits if needed.

### Balance Adjustment Audit Trail

Every balance adjustment via `/admin/users/:id/balance` creates a `Transaction` record:
- `type: 'admin_adjustment'`
- `amount`: the adjustment amount (positive for add, stored as absolute value)
- `description`: admin-provided reason
- `metadata`: `{ adminId, adminUsername, direction: 'add' | 'subtract' }`

### Volume Calculation

Platform volume per item computed from `order_fills`. Fills from partially-filled orders that were later cancelled/expired are intentionally included (the trades did happen).

```sql
SELECT
  ci.id, ci.display_name,
  COALESCE(SUM(of.quantity), 0) as total_traded,
  COALESCE(SUM(of.total_price), 0) as total_volume
FROM catalog_items ci
LEFT JOIN orders o ON o.catalog_item_id = ci.id
LEFT JOIN order_fills of ON of.order_id = o.id
GROUP BY ci.id, ci.display_name
ORDER BY total_volume DESC
```

### Relationship to Internal Routes

The existing `/internal/*` routes (using `BOT_WEBHOOK_SECRET`) remain for bot automation (machine-to-machine). Both the `/admin/*` routes (JWT + role check) and `/internal/*` routes (Bearer token) call the same underlying service methods. No deprecation — they serve different auth paths.

---

## Frontend

### Layout

Sidebar navigation at `/admin` with a shared layout component. The sidebar is persistent across all admin pages.

**Sidebar sections:**
- **Overview**: Dashboard
- **Operations**: Item Deposits (with pending count badge), Item Withdrawals (with pending count badge), Orders
- **Management**: Users, Catalog Items (hidden for moderators since it's admin-only)

**Main navbar change:** Add "Admin" link (amber colored, with badge styling) visible only when `user.role !== 'user'`.

**Sidebar badge counts:** Fetched from `/admin/stats` on layout mount, refreshed on a 30-second polling interval.

### Pages

| Page | Path | Description |
|------|------|-------------|
| Dashboard | `/admin` | Stat cards (total users, pending deposits, pending withdrawals, active orders) + volume-per-item table sorted by volume |
| Item Deposits | `/admin/deposits` | Table with status tabs (pending/confirmed/rejected/all). Pending rows have Confirm/Reject buttons. Paginated |
| Item Withdrawals | `/admin/withdrawals` | Table with status tabs (pending/processing/completed/failed/all). Action buttons per status. Paginated |
| Orders | `/admin/orders` | All orders with filters (status tabs, type, item dropdown). Table with user, item, type, qty, price, status. Admin: cancel button on active orders. Paginated |
| Users | `/admin/users` | Search bar + paginated user table: username, email, balance, role badge, status, joined date. Click row to open detail |
| User Detail | `/admin/users/[id]` | Profile info, balance with adjust button (admin), role dropdown (admin), ban/unban (admin). Tabs for recent transactions, orders, deposits, withdrawals |
| Catalog | `/admin/catalog` | Table of all items: name, displayName, category, enabled toggle. "Add Item" form (name, displayName, category). Admin only page |

### Access Control (frontend)

- Admin layout checks `user.role` on load. If `user`, redirects to `/dashboard`.
- Moderator-only elements render normally.
- Admin-only elements (cancel order, ban, adjust balance, manage catalog, change role) conditionally rendered based on `user.role === 'admin'`.
- Catalog page redirects moderators to `/admin` since they have no access.

### Styling

Follows existing dark theme:
- Sidebar: `bg-neutral-950`, `border-r border-neutral-800`, width ~220px
- Active sidebar link: `bg-neutral-800 text-white`
- Inactive: `text-neutral-400 hover:bg-neutral-800/50`
- Section headers: uppercase, `text-xs text-neutral-500`
- Pending count badges: `bg-amber-500/20 text-amber-400` rounded pills
- Stat cards: `bg-neutral-900/50 border border-neutral-800 rounded-xl`
- Tables: same style as existing orders/transactions tables
- Role badges: user=neutral, moderator=blue, admin=amber

---

## Files

### New Files
```
packages/api/prisma/migrations/TIMESTAMP_add_user_role/migration.sql
packages/api/src/plugins/require-role.ts
packages/api/src/routes/admin/index.ts
packages/api/src/routes/admin/stats.ts
packages/api/src/routes/admin/item-deposits.ts
packages/api/src/routes/admin/item-withdrawals.ts
packages/api/src/routes/admin/orders.ts
packages/api/src/routes/admin/users.ts
packages/api/src/routes/admin/catalog.ts
packages/web/app/admin/layout.tsx
packages/web/app/admin/page.tsx
packages/web/app/admin/deposits/page.tsx
packages/web/app/admin/withdrawals/page.tsx
packages/web/app/admin/orders/page.tsx
packages/web/app/admin/users/page.tsx
packages/web/app/admin/users/[id]/page.tsx
packages/web/app/admin/catalog/page.tsx
packages/web/components/admin/sidebar.tsx
```

### Modified Files
```
packages/api/prisma/schema.prisma              — add role field to User
packages/api/src/index.ts                      — register admin routes
packages/api/src/plugins/auth.ts               — add role to AuthUser interface
packages/api/src/routes/auth/session.ts        — include role in /auth/me response
packages/api/src/routes/transactions.ts        — add admin_adjustment to VALID_TYPES
packages/api/src/services/marketplace.service.ts — add adminCancelOrder method
packages/shared/src/types/index.ts             — add UserRole, update UserProfile, update TransactionType
packages/web/components/navbar.tsx              — add Admin link for non-user roles
```
