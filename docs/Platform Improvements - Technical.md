# DonutTrade — Technical Improvements

Improvements identified from codebase review. Organized by priority.

---

## Completed

- **Rate Limiting** — `@fastify/rate-limit` with Redis store, per-route overrides on auth/orders/withdrawals
- **Real-Time Notifications** — SSE event bus with Redis Pub/Sub, notification bell in navbar, toast integration
- **Trade History Page** — Orders + transactions pages with filtering and pagination
- **Price History & Market Data** — Price history API with Redis cache, SVG chart component, "last sold for" hints
- **Health Check** — Detailed health endpoint checking Postgres + Redis with latency
- **Order Price Editing** — PATCH endpoint with escrow recalculation, edit modal on orders pages
- **Toast Notifications** — ToastContext with portal-rendered component, 4 variants, auto-dismiss
- **Catalog Item Icons** — iconUrl field in schema + admin UI
- **Large Withdrawal Confirmation** — Admin review flow required before completion
- **Cursor-Based Pagination** — nextCursor/prevCursor in pagination meta, opt-in cursor navigation
- **API Response Caching** — Redis + Cache-Control headers on catalog, commission rate, public stats
- **Mobile Responsiveness** — Hamburger nav, admin sidebar overlay, responsive tables, dropdown fixes
- **CSV Export** — Export buttons on admin orders + audit log pages with auth'd blob download

---

## Remaining

### Admin Alerts (Discord/Email)
Admins must manually check the panel for new deposits/withdrawals. Large transactions or pending actions should push alerts via Discord webhook or email.
