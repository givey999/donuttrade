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
| Promote users to moderator/admin | No | Yes |

---

## Backend

### Schema Change

```prisma
model User {
  // ... existing fields
  role String @default("user") // 'user' | 'moderator' | 'admin'
}
```

Migration adds `role` column with default `'user'`, then updates `.givey3917` to `'admin'`.

### Auth Middleware

New `requireRole(...roles)` preHandler that checks `request.user.role` against allowed roles. Reuses the existing `authenticate` decorator (JWT). Returns 403 if role insufficient.

Include `role` in:
- JWT payload (set at login, refreshed on token refresh)
- `UserProfile` shared type
- `/auth/me` response

### API Routes

All under `/admin` prefix, all require `authenticate` + `requireRole('moderator')` minimum.

#### Stats (moderator+)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/stats` | Dashboard stats: total users, pending deposits count, pending withdrawals count, active orders count, volume per catalog item (total filled quantity + total value from order_fills) |

#### Item Deposits (moderator+)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/item-deposits` | List pending deposits with user info |
| PATCH | `/admin/item-deposits/:id/confirm` | Confirm deposit (adds items to inventory) |
| PATCH | `/admin/item-deposits/:id/reject` | Reject deposit with optional notes |

#### Item Withdrawals (moderator+)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/item-withdrawals` | List pending/processing withdrawals |
| PATCH | `/admin/item-withdrawals/:id/claim` | Claim for processing |
| PATCH | `/admin/item-withdrawals/:id/confirm` | Confirm withdrawal |
| PATCH | `/admin/item-withdrawals/:id/fail` | Fail with reason |

#### Orders (mixed permissions)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/orders` | All orders with filters (status, type, user, item). Moderator+ |
| DELETE | `/admin/orders/:id` | Force-cancel any order. Admin only |

#### Users (mixed permissions)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/users` | Search/list users (by username, email). Moderator+ |
| GET | `/admin/users/:id` | User detail (balance, orders, deposits, withdrawals). Moderator+ |
| PATCH | `/admin/users/:id/ban` | Ban user with reason. Admin only |
| PATCH | `/admin/users/:id/unban` | Unban user. Admin only |
| PATCH | `/admin/users/:id/balance` | Adjust balance (add/subtract with reason). Admin only |
| PATCH | `/admin/users/:id/role` | Change role. Admin only |

#### Catalog (admin only)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/catalog` | List all catalog items (including disabled) |
| POST | `/admin/catalog` | Add new catalog item (name, displayName, category) |
| PATCH | `/admin/catalog/:id` | Update item (displayName, enabled) |

### Volume Calculation

Platform volume per item is computed from `order_fills`:

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

---

## Frontend

### Layout

Sidebar navigation at `/admin` with a shared layout component. The sidebar is persistent across all admin pages.

**Sidebar sections:**
- **Overview**: Dashboard
- **Operations**: Item Deposits (with pending count badge), Item Withdrawals (with pending count badge), Orders
- **Management**: Users, Catalog Items (admin-only items hidden for moderators)

**Main navbar change:** Add "Admin" link (amber colored, with badge styling) visible only when `user.role !== 'user'`.

### Pages

| Page | Path | Description |
|------|------|-------------|
| Dashboard | `/admin` | Stat cards (total users, pending deposits, pending withdrawals, active orders) + volume-per-item table sorted by volume |
| Item Deposits | `/admin/deposits` | Table of pending deposits: user, item, quantity, date. Confirm/Reject buttons per row |
| Item Withdrawals | `/admin/withdrawals` | Table of pending/processing withdrawals: user, item, quantity, status, date. Claim/Confirm/Fail buttons |
| Orders | `/admin/orders` | All orders with filters (status tabs, type, item). Table with user, item, type, qty, price, status. Admin: cancel button on active orders |
| Users | `/admin/users` | Search bar + paginated user table: username, email, balance, role, status (verified/banned), joined date. Click row to open detail |
| User Detail | `/admin/users/[id]` | Profile info, balance with adjust button (admin), role dropdown (admin), ban/unban (admin). Recent transactions, orders, deposits, withdrawals |
| Catalog | `/admin/catalog` | Table of all items: name, category, enabled toggle. "Add Item" button opens form (name, display name, category). Admin only |

### Access Control (frontend)

- Admin layout checks `user.role` on load. If `user`, redirects to `/dashboard`.
- Moderator-only elements render normally.
- Admin-only elements (cancel order, ban, adjust balance, manage catalog, change role) conditionally rendered based on `user.role === 'admin'`.

### Styling

Follows existing dark theme:
- Sidebar: `bg-neutral-950`, `border-r border-neutral-800`, width ~220px
- Active sidebar link: `bg-neutral-800 text-white`
- Inactive: `text-neutral-400 hover:bg-neutral-800/50`
- Section headers: uppercase, `text-xs text-neutral-500`
- Pending count badges: `bg-amber-500/20 text-amber-400` rounded pills
- Stat cards: `bg-neutral-900/50 border border-neutral-800 rounded-xl`
- Tables: same style as existing orders/transactions tables

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
packages/api/prisma/schema.prisma          — add role field to User
packages/api/src/index.ts                  — register admin routes
packages/shared/src/types/index.ts         — add role to UserProfile, add admin types
packages/web/components/navbar.tsx          — add Admin link for non-user roles
```
