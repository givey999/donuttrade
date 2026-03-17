# Landing Page Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a GeoSpy-inspired public landing page at `/` with animated hero, live stats, and trust sections.

**Architecture:** Next.js route groups split the app into `(landing)` (public, no auth) and `(app)` (authenticated, has Navbar/AuthProvider). A new public Fastify endpoint serves aggregate stats without authentication.

**Tech Stack:** Next.js 15 App Router, Tailwind v4, Fastify, Prisma, CSS keyframe animations

**Spec:** `docs/superpowers/specs/2026-03-17-landing-page-design.md`

---

## Task 1: Public Stats API Endpoint

**Files:**
- Create: `packages/api/src/routes/public/stats.ts`
- Modify: `packages/api/src/index.ts`

- [ ] **Step 1: Create the public stats route**

Create `packages/api/src/routes/public/stats.ts`:

```ts
import { FastifyPluginAsync } from 'fastify';
import { prisma } from '../../services/database.js';

export const publicStatsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', async () => {
    const [totalTraders, activeOrders] = await Promise.all([
      prisma.user.count({ where: { verificationStatus: 'verified' } }),
      prisma.order.count({ where: { status: 'active' } }),
    ]);

    const fillAggregates = await prisma.$queryRaw<[{
      items_traded: bigint;
      total_volume: string;
    }]>`
      SELECT
        COALESCE(SUM(quantity), 0)::bigint AS items_traded,
        COALESCE(SUM(total_price), 0)::text AS total_volume
      FROM order_fills
    `;

    return {
      success: true,
      data: {
        totalTraders,
        itemsTraded: Number(fillAggregates[0].items_traded),
        totalVolume: fillAggregates[0].total_volume,
        activeOrders,
      },
    };
  });
};
```

- [ ] **Step 2: Register the route in the API entry point**

In `packages/api/src/index.ts`, add import and registration (no auth required):

```ts
// Add import at top with other route imports:
import { publicStatsRoutes } from './routes/public/stats.js';

// Add registration after other routes, before `return app;`:
await app.register(publicStatsRoutes, { prefix: '/public/stats' });
```

- [ ] **Step 3: Build and verify API compiles**

Run: `pnpm --filter @donuttrade/api build`
Expected: Clean compile, no errors.

- [ ] **Step 4: Commit**

```bash
git add packages/api/src/routes/public/stats.ts packages/api/src/index.ts
git commit -m "feat: add public stats endpoint for landing page"
```

---

## Task 2: Restructure Next.js Layouts with Route Groups

**Files:**
- Modify: `packages/web/app/layout.tsx` — strip to bare HTML shell
- Create: `packages/web/app/(app)/layout.tsx` — authenticated layout with AuthProvider/Navbar/TimeoutBanner
- Create: `packages/web/app/(landing)/layout.tsx` — minimal public layout
- Delete: `packages/web/app/page.tsx` — replaced by route group
- Move: all existing page directories into `(app)/`

- [ ] **Step 1: Create the `(app)` route group layout**

Create `packages/web/app/(app)/layout.tsx`:

```tsx
import { AuthProvider } from '@/lib/auth';
import { Navbar } from '@/components/navbar';
import { TimeoutBanner } from '@/components/timeout-banner';

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <Navbar />
      <TimeoutBanner />
      {children}
    </AuthProvider>
  );
}
```

- [ ] **Step 2: Create the `(landing)` route group layout**

Create `packages/web/app/(landing)/layout.tsx`:

```tsx
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'DonutTrade — The trusted way to trade on DonutSMP',
  description: 'Secure escrow trading for Minecraft items on DonutSMP. Deposit, trade, and withdraw safely.',
  openGraph: {
    title: 'DonutTrade — The trusted way to trade on DonutSMP',
    description: 'Secure escrow trading for Minecraft items on DonutSMP.',
    siteName: 'DonutTrade',
  },
};

export default function LandingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
```

- [ ] **Step 3: Strip root layout to bare HTML shell**

Modify `packages/web/app/layout.tsx` to remove AuthProvider, Navbar, and TimeoutBanner — those now live in `(app)/layout.tsx`:

```tsx
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'DonutTrade',
  description: 'Minecraft trading escrow platform',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-[#0a0a0f] text-white antialiased`}>
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 4: Move all existing page directories into `(app)/`**

Move these directories from `packages/web/app/` into `packages/web/app/(app)/`:
- `admin/`
- `auth/`
- `dashboard/`
- `login/`
- `marketplace/`
- `orders/`
- `signup/`
- `verify/`

```bash
cd packages/web/app
mkdir -p "(app)"
# Move each directory (git mv preserves history)
git mv admin "(app)/admin"
git mv auth "(app)/auth"
git mv dashboard "(app)/dashboard"
git mv login "(app)/login"
git mv marketplace "(app)/marketplace"
git mv orders "(app)/orders"
git mv signup "(app)/signup"
git mv verify "(app)/verify"
```

- [ ] **Step 5: Delete old root page.tsx**

```bash
git rm packages/web/app/page.tsx
```

- [ ] **Step 6: Build and verify web compiles**

Run: `pnpm --filter @donuttrade/web build`
Expected: All existing pages still build at their same URLs. No route conflicts.

- [ ] **Step 7: Commit**

```bash
git add -A packages/web/app/
git commit -m "refactor: restructure app into (landing) and (app) route groups"
```

---

## Task 3: Build the Landing Page

**Files:**
- Create: `packages/web/app/(landing)/page.tsx`

- [ ] **Step 1: Create the landing page component**

Create `packages/web/app/(landing)/page.tsx` with all sections from the spec:

1. **Landing nav** — sticky top bar with "DonutTrade" logo and "Start Trading" button
2. **Hero** — amber gradient glow, grid overlay, ~25 animated floating particles, pill badge, headline, subtitle, CTA
3. **Stats strip** — fetches from `/public/stats`, shows dashes while loading, fails silently
4. **How it works** — 3 numbered step cards
5. **Why trust DonutTrade** — 3 trust cards with icons
6. **Marketplace preview** — static fake browser window with example order table
7. **Final CTA** — "Ready to trade?"
8. **Footer**

Key implementation details:
- `'use client'` directive (needs `useEffect`/`useState` for stats fetch and auth redirect)
- On mount: check `localStorage` for `dt_access_token` — if found, `router.push('/dashboard')`
- Stats fetch: `fetch` with `Content-Type: application/json` header (not `apiFetch` — no auth needed)
- CSS animations defined via Tailwind `@keyframes` in a `<style>` tag or inline styles
- `@media (prefers-reduced-motion: reduce)` disables all particle animations
- Responsive: 3-col grids → 1-col below `md`, stats strip → 2x2 grid on mobile

- [ ] **Step 2: Build and verify**

Run: `pnpm --filter @donuttrade/web build`
Expected: Landing page builds at `/`, all other pages still at their URLs.

- [ ] **Step 3: Commit**

```bash
git add packages/web/app/"(landing)"/page.tsx
git commit -m "feat: add landing page with hero, stats, and trust sections"
```

---

## Task 4: Docker Build and Verify

- [ ] **Step 1: Build both containers**

```powershell
docker compose build --no-cache api web
```

- [ ] **Step 2: Start containers**

```powershell
docker compose up -d
```

- [ ] **Step 3: Verify**

- Visit `moldo.go.ro:9443` — should show landing page (not redirect to `/login`)
- Stats strip should show live numbers (or dashes if no data yet)
- Click "Start Trading" → goes to `/login`
- If already logged in, visiting `/` should redirect to `/dashboard`
- All existing pages (`/dashboard`, `/marketplace`, `/admin`, etc.) still work
