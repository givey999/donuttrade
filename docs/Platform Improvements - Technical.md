# DonutTrade — Technical Improvements

Improvements identified from codebase review. Organized by priority.

---

## High Priority

### Rate Limiting
Rate limit constants exist in shared package but are never enforced. Auth, marketplace, and withdrawal endpoints are unprotected against spam/brute force. Needs `@fastify/rate-limit` wired to sensitive routes.

### Real-Time Notifications
Users have no way to know when orders get filled, deposits confirmed, or withdrawals processed without manually refreshing. WebSocket or SSE connection pushing events (`order.filled`, `deposit.confirmed`, `withdrawal.ready`) + notification bell in navbar.

### Trade History Page
No unified view of all trades a user participated in (as creator and filler). Users want to see fill history, profit/loss per trade, and trading stats in one place.

### Price History & Market Data
No historical price data is stored. A `price_history` table tracking avg fill price per item per day enables price charts and "last sold for $X" hints on the create order page.

### Health Check
`/health` returns `ok` without checking Postgres or Redis. If either goes down, the API reports healthy while silently failing. Should ping both services with timeouts.

---

## Medium Priority

### Order Price Editing
Users must cancel and recreate orders to change the price, losing premium fees. Allow editing price on active orders that haven't been partially filled yet.

### Toast Notifications
No visual confirmation after actions (order created, cancelled, withdrawal requested). A brief toast component after successful operations makes the platform feel responsive.

### Catalog Item Icons
Items are text-only names. Icons or visual identifiers make the marketplace grid faster to scan.

### Admin Alerts (Discord/Email)
Admins must manually check the panel for new deposits/withdrawals. Large transactions or pending actions should push alerts via Discord webhook or email.

### Large Withdrawal Confirmation
Withdrawals above a configurable threshold should require a confirmation step (in-game command or cooldown period) to protect against stolen sessions.

---

## Lower Priority

### Cursor-Based Pagination
All pagination is offset-based, which slows down on large datasets. Cursor-based (`after=lastId`) scales better as trading volume grows.

### Favorite Items / Watchlist
Let users mark items as favorites for quick-filtered marketplace access to frequently traded items.

### API Response Caching
Catalog items and commission rate are fetched on every page load. Short `Cache-Control` headers or Redis TTL on public endpoints would reduce unnecessary load.

### Mobile Admin Panel
Admin tables (users, deposits, audit log) break on narrow screens. Responsive card layout needed for phone access.

### CSV Export
Admin pages should have an export button for transactions, audit logs, and orders for accounting and record-keeping.
