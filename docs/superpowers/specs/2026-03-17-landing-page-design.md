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
| Stats | Live stats strip pulled from `/admin/stats` API |
| Marketplace preview | Static CSS mockup of the order book |
| Trust section | Escrow Protection / Verified Players / 24/7 Monitoring |
| Font | Inter (already used site-wide) |
| Color palette | `#0a0a0f` background, `#f59e0b` amber accent, neutral grays |

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
- **Content (centered):**
  - Pill badge: "DonutSMP Trading Platform" (amber border, amber text)
  - Headline: "The trusted way to trade on **DonutSMP**" (DonutSMP in amber)
  - Subtitle: "Secure escrow trading for Minecraft items. Deposit. Trade. Withdraw. Simple."
  - CTA button: "Start Trading" → `/login`

### 3. Stats Strip
- Horizontal bar below hero, bordered top and bottom (`#1a1a1a`)
- 4 stat columns centered: Items Traded / Total Volume / Active Orders / Traders
- Large bold number + small uppercase label
- **Data source:** Fetch from existing `GET /admin/stats` endpoint (public subset) or new public stats endpoint

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
- Section title: "Live marketplace"
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
- Replace the current `redirect('/login')` in `packages/web/app/page.tsx` with the landing page component
- The landing page is a **public page** — no auth required
- The existing navbar (`components/navbar.tsx`) already returns `null` when unauthenticated, so it won't conflict

### Stats Endpoint
- Option A: Create a new lightweight `GET /public/stats` endpoint that returns only aggregate counts (no auth required)
- Option B: Hardcode stats initially, add live stats later
- **Recommendation:** Option A — a simple public endpoint returning total users, items traded, active orders, total volume

### Responsive Design
- Hero: full width, text scales down on mobile
- 3-column grids (steps, trust cards): collapse to single column on mobile (`grid-cols-1` below `md`)
- Stats strip: wrap to 2x2 grid on mobile
- Marketplace preview table: horizontal scroll on mobile

### Animation Performance
- All particle animations use CSS `transform` and `opacity` only (GPU-accelerated, no layout thrashing)
- `pointer-events: none` on all decorative elements
- No JavaScript animation — pure CSS keyframes

## Files

### New Files
- `packages/web/app/(landing)/page.tsx` — Landing page component (route group so it doesn't use the main layout's navbar)
- `packages/web/app/(landing)/layout.tsx` — Minimal layout without authenticated navbar
- `packages/api/src/routes/public/stats.ts` — Public stats endpoint

### Modified Files
- `packages/web/app/page.tsx` — Remove redirect, replaced by route group
- `packages/api/src/index.ts` — Register public stats route
