# Landing Page Design Spec

## Overview

A GeoSpy-inspired landing page for DonutTrade at `/` (currently redirects to `/login`). Dark theme with amber accent, animated particles, and gradient glow. The page presents DonutTrade as "The trusted way to trade on DonutSMP" — emphasizing security and escrow protection.

## Design Decisions

| Decision | Choice |
|----------|--------|
| Core message | Trust and safety — escrow-backed trading |
| Hero headline | "The trusted way to trade on DonutSMP" |
| CTA text | "Start Trading" (single CTA, links to `/login`) |
| Visual style | Amber gradient glow + grid + animated floating particles |
| Stats | Live stats strip from new `GET /public/stats` endpoint |
| Marketplace preview | Static CSS mockup of the order book |
| Trust section | Escrow Protection / Verified Players / 24/7 Monitoring |
| Font | Inter (already used site-wide) |
| Color palette | `#0a0a0f` background, `#f59e0b` amber accent, neutral grays |
| Authenticated users | Redirect to `/dashboard` if already logged in |

## Page Sections (top to bottom)

### 1. Navigation Bar
- Sticky top, `bg-[#0a0a0f]/90` with backdrop blur
- Left: "DonutTrade" logo text
- Right: "Start Trading" amber button → `/login`
- This is a **landing-only nav** — the existing authenticated navbar remains unchanged

### 2. Hero Section
- **Background effects:**
  - Radial amber gradient glow centered behind headline
  - Subtle dot grid overlay (`56px` spacing, `rgba(255,255,255,0.02)`)
  - ~25 animated floating particles with 6 motion types: float-up, float-up-left, float-down, drift-right, drift-left, pulse-glow
  - 3 larger blurred orbs that pulse slowly
  - All particles use staggered `animation-delay` for organic feel
  - Respect `prefers-reduced-motion`: disable all animations when user prefers reduced motion
- **Content (centered):**
  - Pill badge: "DonutSMP Trading Platform" (amber border, amber text)
  - Headline: "The trusted way to trade on **DonutSMP**" (DonutSMP in amber)
  - Subtitle: "Secure escrow trading for Minecraft items. Deposit. Trade. Withdraw. Simple."
  - CTA button: "Start Trading" → `/login`

### 3. Stats Strip
- Horizontal bar below hero, bordered top and bottom (`#1a1a1a`)
- 4 stat columns centered: Items Traded / Total Volume / Active Orders / Traders
- Large bold number + small uppercase label
- **Data source:** `GET /public/stats` (no auth required)
- **Loading state:** Show `—` dashes while loading; keep dashes on error (fail silently)
- **Response fields:**
  - `totalTraders`: count of users with `verification_status = 'verified'`
  - `itemsTraded`: sum of `order_fills.quantity`
  - `totalVolume`: sum of `order_fills.total_price`
  - `activeOrders`: count of orders with `status = 'active'`

### 4. How It Works
- Section title: "How it works"
- Subtitle: "Three simple steps to start trading safely"
- 3 cards in a row:
  1. **Deposit** — "Send items to our bot in-game. Your inventory is tracked and secured automatically."
  2. **Trade** — "Buy and sell on the marketplace. Funds are held in escrow until the order fills."
  3. **Withdraw** — "Collect your items in-game. An admin confirms delivery and you're done."
- Each card has a numbered amber badge (1, 2, 3)

### 5. Why Trust DonutTrade?
- Section title: "Why trust DonutTrade?"
- Subtitle: "Built from the ground up for safe, transparent trading"
- 3 trust cards:
  1. **Escrow Protection** (lock icon) — "Every trade is backed by escrow. Funds and items are locked until both sides are fulfilled — no chance of scams."
  2. **Verified Players** (checkmark icon) — "All traders are verified through Microsoft authentication linked to their Minecraft account."
  3. **24/7 Monitoring** (eye icon) — "Our admin team reviews every deposit, withdrawal, and trade. Full audit trail on every action."

### 6. Marketplace Preview
- Section title: "The marketplace"
- Subtitle: "A real-time order book where buyers meet sellers"
- Fake browser window (macOS-style dots: red/yellow/green)
- Title bar shows: `moldo.go.ro:9443/marketplace`
- Table with columns: Type | Item | Qty | Price/unit | Trader | Expires
- 4 example rows with BUY/SELL badges (green/amber)
- Static content — not fetched from API

### 7. Final CTA
- "Ready to trade?"
- "Sign in with your Microsoft account and start trading in seconds."
- "Start Trading" button → `/login`

### 8. Footer
- Simple centered text: "(c) 2026 DonutTrade. All rights reserved."
- Top border `#1a1a1a`

## Technical Considerations

### Routing
- **Delete** `packages/web/app/page.tsx` (the current redirect-to-login file)
- Create `packages/web/app/(landing)/page.tsx` and `packages/web/app/(landing)/layout.tsx` as a route group
- The `(landing)` layout provides a minimal HTML shell without `AuthProvider`, `Navbar`, or `TimeoutBanner` — avoiding unnecessary auth checks for unauthenticated visitors
- The existing `app/layout.tsx` (root layout) is restructured: move `AuthProvider`/`Navbar`/`TimeoutBanner` into a new `app/(app)/layout.tsx` route group that wraps all authenticated pages (`dashboard`, `marketplace`, `orders`, `admin`, `login`, `auth`, `signup`, `verify`)
- This means two route groups at the top level: `(landing)` for `/` and `(app)` for everything else
- **Authenticated user redirect:** The landing page checks for an existing access token in localStorage. If found, redirect to `/dashboard` client-side.

### Stats Endpoint
- New `GET /public/stats` Fastify route — no authentication required
- Returns `{ totalTraders, itemsTraded, totalVolume, activeOrders }`
- Queries: `prisma.user.count()`, `prisma.$queryRaw` for order fill aggregates, `prisma.order.count()`
- **Caddy routing note:** The frontend fetch must include `Content-Type: application/json` header so Caddy routes the request to Fastify instead of Next.js

### Responsive Design
- Hero: full width, text scales down on mobile
- 3-column grids (steps, trust cards): collapse to single column on mobile (`grid-cols-1` below `md`)
- Stats strip: wrap to 2x2 grid on mobile
- Marketplace preview table: horizontal scroll on mobile

### Animation Performance
- All particle animations use CSS `transform` and `opacity` only (GPU-accelerated, no layout thrashing)
- `pointer-events: none` on all decorative elements
- No JavaScript animation — pure CSS keyframes
- `@media (prefers-reduced-motion: reduce)` — disable all particle animations

### SEO
- Page title: "DonutTrade — The trusted way to trade on DonutSMP"
- Meta description: "Secure escrow trading for Minecraft items on DonutSMP. Deposit, trade, and withdraw safely."
- Open Graph tags for title, description, and site name

## Files

### New Files
- `packages/web/app/(landing)/page.tsx` — Landing page component
- `packages/web/app/(landing)/layout.tsx` — Minimal layout (no AuthProvider/Navbar)
- `packages/api/src/routes/public/stats.ts` — Public stats endpoint

### Modified Files
- `packages/api/src/index.ts` — Register public stats route
- `packages/web/app/layout.tsx` — Strip to bare HTML shell (move providers to app group)
- `packages/web/app/(app)/layout.tsx` — New route group wrapping all authenticated pages with AuthProvider/Navbar/TimeoutBanner

### Deleted Files
- `packages/web/app/page.tsx` — Replaced by `(landing)/page.tsx` route group
