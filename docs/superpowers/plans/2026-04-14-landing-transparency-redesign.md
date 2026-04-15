# Landing + Transparency Redesign + Repo Opening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite the public landing page in a new "V2 Terminal Display" visual identity, add a new `/transparency` page that explains exactly how the platform works, and open-source the repository under FSL 1.1.

**Architecture:** Landing page becomes a server component (auth-aware CTA split into a small client component). Transparency page is a plain server component under the existing `(app)` route group, inheriting nav/footer/background stars from the app layout. Five small shared presentational components (`TerminalCursor`, `SectionLabel`, `SectionTitle`, `PixelLogo`, `CtaButton`) live in `packages/web/components/landing/`. VT323 font is loaded globally in the root layout. The existing `<BackgroundStars />` component is reused — the landing layout gains it, the `(app)` layout already has it.

**Tech Stack:** Next.js 15.3 (App Router), React 19, TypeScript, Tailwind v4, `next/font/google`. No test framework in `packages/web` — verification via `pnpm --filter @donuttrade/web build` (TypeScript check) + manual visual check in `pnpm --filter @donuttrade/web dev`.

**Design spec:** `docs/superpowers/specs/2026-04-14-landing-transparency-redesign-design.md` (commits `3dbdebf` and `d95e98b`). Read it before starting.

**Commit identity (from project feedback memory):**
- Author: `givey999 <afk.givey@gmail.com>`
- **No** `Co-Authored-By: Claude` trailer on any commit
- Use per-command override: `git -c user.name=givey999 -c user.email=afk.givey@gmail.com commit -m "..."`

---

## File structure

### New files

```
packages/web/
  components/
    landing/
      TerminalCursor.tsx      # Blinking purple block cursor (reused in hero, step numbers, CTA headings)
      SectionLabel.tsx        # Small VT323 "// foo.bar" label above each section
      SectionTitle.tsx        # Large VT323 h2 used by landing + transparency
      PixelLogo.tsx           # 8×8 CSS-grid donut mark for nav and OG image
      CtaButton.tsx           # Auth-aware primary CTA (client component, localStorage check)
  app/
    opengraph-image.tsx       # Static OG image generator for the landing page
    (app)/
      transparency/
        page.tsx              # New transparency page (9 sections)
        opengraph-image.tsx   # Static OG image generator for /transparency
  public/
    robots.txt                # Crawl rules for prod

LICENSE                       # FSL 1.1 Apache 2.0 template at repo root (new file)
```

### Modified files

```
packages/web/app/layout.tsx              # Add VT323 font + update default metadata
packages/web/app/(landing)/layout.tsx    # Mount <BackgroundStars />, update metadata
packages/web/app/(landing)/page.tsx      # Rewrite — new copy, new structure, use shared components
packages/web/components/footer.tsx       # Restyle to terminal footer, add transparency link
packages/web/app/globals.css             # Add @keyframes cursor-blink (TerminalCursor animation)

README.md                                # New content: description, license, /transparency callout
.gitignore                                # Add .claude/ and .superpowers/
```

---

## Pre-flight: verify working tree

- [ ] **Verify you're on a clean branch**

Run:
```bash
git status
git log --oneline -3
```

Expected: latest commit is `d95e98b docs: reorder transparency page — source-open first, add data handling section`. If not, stop and sync.

- [ ] **Confirm the dev server starts before making any changes**

Run:
```bash
pnpm install
pnpm --filter @donuttrade/web dev
```

Expected: server listens on http://localhost:3000 and the current landing renders. Kill with Ctrl+C once confirmed.

- [ ] **Confirm the build passes before making any changes**

Run:
```bash
pnpm --filter @donuttrade/web build
```

Expected: build succeeds with no TypeScript errors. This is your baseline — any new errors after your changes are regressions you caused.

---

## Task 1: Add VT323 font + cursor-blink keyframe

**Files:**
- Modify: `packages/web/app/layout.tsx`
- Modify: `packages/web/app/globals.css`

- [ ] **Step 1: Update `packages/web/app/layout.tsx` to load VT323 alongside Inter**

Replace the file contents with:

```tsx
import type { Metadata } from 'next';
import { Inter, VT323 } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const vt323 = VT323({ subsets: ['latin'], weight: '400', variable: '--font-vt323' });

export const metadata: Metadata = {
  title: {
    default: 'DonutTrade — Secure escrow trading for DonutSMP',
    template: '%s · DonutTrade',
  },
  description:
    'Instant item swaps, escrow protected. Trade Minecraft items safely on DonutSMP without the trust fall.',
  metadataBase: new URL('https://donuttrade.com'),
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`dark ${inter.variable} ${vt323.variable}`}>
      <body className={`${inter.className} bg-[#0a0a0f] text-white antialiased`}>
        {children}
      </body>
    </html>
  );
}
```

Key changes: both fonts now expose CSS variables (`--font-inter`, `--font-vt323`) so you can reference them in Tailwind classes or inline styles. The default title uses a template so every child page becomes `<PageTitle> · DonutTrade`.

- [ ] **Step 2: Add the cursor-blink keyframe to `packages/web/app/globals.css`**

Append to the file:

```css
@keyframes cursor-blink {
  0%, 50% { opacity: 1; }
  50.01%, 100% { opacity: 0; }
}

.animate-cursor-blink {
  animation: cursor-blink 1s step-end infinite;
}

.font-vt323 {
  font-family: var(--font-vt323), 'VT323', ui-monospace, monospace;
}
```

- [ ] **Step 3: Type-check and build**

Run:
```bash
pnpm --filter @donuttrade/web build
```

Expected: build succeeds. If it fails with "VT323 is not exported", verify the import: `next/font/google` requires the weight prop for VT323 (which is why we added `weight: '400'`).

- [ ] **Step 4: Commit**

```bash
git add packages/web/app/layout.tsx packages/web/app/globals.css
git -c user.name=givey999 -c user.email=afk.givey@gmail.com commit -m "feat(web): add VT323 font + cursor-blink keyframe"
```

---

## Task 2: Create the four static landing primitives

**Files:**
- Create: `packages/web/components/landing/TerminalCursor.tsx`
- Create: `packages/web/components/landing/SectionLabel.tsx`
- Create: `packages/web/components/landing/SectionTitle.tsx`
- Create: `packages/web/components/landing/PixelLogo.tsx`

- [ ] **Step 1: Create `packages/web/components/landing/TerminalCursor.tsx`**

```tsx
interface TerminalCursorProps {
  height?: number;
  width?: number;
  className?: string;
}

export function TerminalCursor({ height = 58, width = 20, className = '' }: TerminalCursorProps) {
  return (
    <span
      className={`inline-block bg-violet-600 animate-cursor-blink ${className}`}
      style={{ width, height, verticalAlign: '-4px', marginLeft: 6 }}
      aria-hidden="true"
    />
  );
}
```

- [ ] **Step 2: Create `packages/web/components/landing/SectionLabel.tsx`**

```tsx
interface SectionLabelProps {
  children: React.ReactNode;
}

export function SectionLabel({ children }: SectionLabelProps) {
  return (
    <div className="text-center font-vt323 text-[14px] tracking-wide text-violet-400">
      <span className="text-neutral-600">// </span>
      {children}
    </div>
  );
}
```

- [ ] **Step 3: Create `packages/web/components/landing/SectionTitle.tsx`**

```tsx
interface SectionTitleProps {
  children: React.ReactNode;
  className?: string;
}

export function SectionTitle({ children, className = '' }: SectionTitleProps) {
  return (
    <h2
      className={`text-center font-vt323 text-[52px] tracking-wide text-white leading-none mt-1 mb-2 ${className}`}
    >
      {children}
    </h2>
  );
}
```

- [ ] **Step 4: Create `packages/web/components/landing/PixelLogo.tsx`**

```tsx
interface PixelLogoProps {
  size?: number;
}

// 8×8 pixel grid — each row is 8 booleans. `true` = filled violet pixel.
const GRID: boolean[][] = [
  [false, false, true,  true,  true,  true,  false, false],
  [false, true,  true,  false, false, true,  true,  false],
  [true,  true,  false, false, false, false, true,  true ],
  [true,  false, false, false, false, false, false, true ],
  [true,  false, false, false, false, false, false, true ],
  [true,  true,  false, false, false, false, true,  true ],
  [false, true,  true,  false, false, true,  true,  false],
  [false, false, true,  true,  true,  true,  false, false],
];

export function PixelLogo({ size = 22 }: PixelLogoProps) {
  return (
    <div
      className="grid"
      style={{
        width: size,
        height: size,
        gridTemplateColumns: 'repeat(8, 1fr)',
        gridTemplateRows: 'repeat(8, 1fr)',
      }}
      aria-hidden="true"
    >
      {GRID.flat().map((on, i) => (
        <span
          key={i}
          className={on ? 'bg-violet-600' : ''}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 5: Type-check and build**

Run:
```bash
pnpm --filter @donuttrade/web build
```

Expected: build succeeds. These four files are unused as of this task — they just need to type-check cleanly.

- [ ] **Step 6: Commit**

```bash
git add packages/web/components/landing/
git -c user.name=givey999 -c user.email=afk.givey@gmail.com commit -m "feat(web): add landing primitive components (cursor, labels, logo)"
```

---

## Task 3: Create the auth-aware CTA button (client component)

**Files:**
- Create: `packages/web/components/landing/CtaButton.tsx`

- [ ] **Step 1: Create `packages/web/components/landing/CtaButton.tsx`**

```tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface CtaButtonProps {
  variant?: 'primary' | 'ghost';
  className?: string;
  loggedInLabel?: string;
  loggedOutLabel?: string;
  loggedOutHref?: string;
  loggedInHref?: string;
}

export function CtaButton({
  variant = 'primary',
  className = '',
  loggedInLabel = 'Go to Dashboard',
  loggedOutLabel = 'Start Trading →',
  loggedOutHref = '/login',
  loggedInHref = '/dashboard',
}: CtaButtonProps) {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);

  useEffect(() => {
    try {
      const token = localStorage.getItem('dt_access_token');
      setIsLoggedIn(!!token);
    } catch {
      setIsLoggedIn(false);
    }
  }, []);

  const href = isLoggedIn ? loggedInHref : loggedOutHref;
  const label = isLoggedIn ? loggedInLabel : loggedOutLabel;

  // Render with the logged-out state first (server-rendered), hydrate to real state on mount.
  // This avoids layout shift by always rendering a button with the same structure.
  const base =
    variant === 'primary'
      ? 'inline-block rounded-xl bg-violet-600 px-9 py-3.5 text-[15px] font-bold text-[#0a0a0f] transition-colors hover:bg-violet-700'
      : 'ml-2 inline-block rounded-xl border border-neutral-800 bg-transparent px-7 py-3 text-[15px] font-bold text-violet-400 transition-colors hover:border-violet-600';

  return (
    <Link href={href} className={`${base} ${className}`}>
      {label}
    </Link>
  );
}
```

- [ ] **Step 2: Build check**

Run:
```bash
pnpm --filter @donuttrade/web build
```

Expected: build succeeds. The component is unused so far — this step only verifies it compiles.

- [ ] **Step 3: Commit**

```bash
git add packages/web/components/landing/CtaButton.tsx
git -c user.name=givey999 -c user.email=afk.givey@gmail.com commit -m "feat(web): add auth-aware CtaButton client component"
```

---

## Task 4: Update landing layout (stars + metadata)

**Files:**
- Modify: `packages/web/app/(landing)/layout.tsx`

- [ ] **Step 1: Replace `packages/web/app/(landing)/layout.tsx` contents with**

```tsx
import type { Metadata } from 'next';
import { BackgroundStars } from '@/components/background-stars';

export const metadata: Metadata = {
  title: 'DonutTrade — Secure escrow trading for DonutSMP',
  description:
    'Instant item swaps, escrow protected. Trade Minecraft items safely on DonutSMP without the trust fall.',
  openGraph: {
    title: 'DonutTrade — Secure escrow trading for DonutSMP',
    description: 'Instant item swaps, escrow protected. Trade Minecraft items safely on DonutSMP.',
    siteName: 'DonutTrade',
    type: 'website',
  },
};

export default function LandingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <BackgroundStars />
      {children}
    </>
  );
}
```

- [ ] **Step 2: Run dev server and visit the existing landing**

Run:
```bash
pnpm --filter @donuttrade/web dev
```

Open http://localhost:3000 — you should now see twinkle-star characters (✦ ✧ ⋆) floating behind the existing old landing. Kill the dev server with Ctrl+C.

- [ ] **Step 3: Commit**

```bash
git add packages/web/app/\(landing\)/layout.tsx
git -c user.name=givey999 -c user.email=afk.givey@gmail.com commit -m "feat(web): mount BackgroundStars in landing layout"
```

---

## Task 5: Rewrite the landing page

**Files:**
- Modify: `packages/web/app/(landing)/page.tsx` (full rewrite)

This is the biggest task. The new page is a server component — the client-side auth check moved into `<CtaButton>` in Task 3.

- [ ] **Step 1: Replace `packages/web/app/(landing)/page.tsx` entirely with the code below**

```tsx
import Link from 'next/link';
import { Footer } from '@/components/footer';
import { CtaButton } from '@/components/landing/CtaButton';
import { TerminalCursor } from '@/components/landing/TerminalCursor';
import { SectionLabel } from '@/components/landing/SectionLabel';
import { SectionTitle } from '@/components/landing/SectionTitle';
import { PixelLogo } from '@/components/landing/PixelLogo';

export default function LandingPage() {
  return (
    <div className="relative flex min-h-screen flex-col">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-neutral-800 bg-[#0a0a0f]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-[1100px] items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-[10px]">
            <PixelLogo size={22} />
            <span className="font-vt323 text-[22px] tracking-wide text-white">DONUTTRADE</span>
          </Link>
          <CtaButton
            variant="primary"
            className="!px-5 !py-2 !text-sm"
            loggedInLabel="Go to Dashboard"
            loggedOutLabel="Start Trading"
          />
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden px-6 pb-24 pt-24 text-center md:pt-28">
        {/* Violet glow */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-20 left-1/2 h-[520px] w-[820px] -translate-x-1/2"
          style={{
            background:
              'radial-gradient(ellipse, rgba(124,58,237,0.12) 0%, rgba(124,58,237,0.03) 40%, transparent 70%)',
          }}
        />
        {/* Grid overlay */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)',
            backgroundSize: '56px 56px',
          }}
        />

        <div className="relative z-10">
          <div className="mb-7 inline-block rounded-full border border-violet-600/30 bg-violet-600/[0.07] px-3 py-[5px] text-[10px] font-semibold uppercase tracking-[2px] text-violet-400">
            DONUTSMP · ESCROW TRADING
          </div>
          <h1 className="mx-auto max-w-3xl font-vt323 text-[56px] leading-[0.9] text-white md:text-[78px]">
            TRADE SAFELY<br />
            ON <span className="text-violet-400">DONUTSMP</span>
            <TerminalCursor height={58} width={20} />
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-[12px] font-semibold uppercase tracking-[1.6px] text-neutral-500">
            Instant Item Swaps · Escrow Protected
          </p>
          <div className="mt-8">
            <CtaButton
              variant="primary"
              loggedInLabel="Go to Dashboard"
              loggedOutLabel="Start Trading →"
            />
            <Link
              href="/marketplace"
              className="ml-2 inline-block rounded-xl border border-neutral-800 bg-transparent px-7 py-3 text-[14px] font-bold text-violet-400 transition-colors hover:border-violet-600"
            >
              View Marketplace
            </Link>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-[1000px] px-6 py-20">
        <SectionLabel>how_it_works.sh</SectionLabel>
        <SectionTitle>THREE STEPS</SectionTitle>
        <p className="mb-12 text-center text-[12px] font-semibold uppercase tracking-[1.5px] text-neutral-500">
          Deposit · Trade · Withdraw
        </p>
        <div className="grid gap-4 md:grid-cols-3">
          <StepCard num="01" title="DEPOSIT" desc="Send items to our account in-game. Your inventory is tracked and secured automatically." />
          <StepCard num="02" title="TRADE" desc="Buy and sell on the marketplace. Funds are held in escrow until the order fills." />
          <StepCard num="03" title="WITHDRAW" desc="Collect your items in-game. An admin confirms delivery and you're done." />
        </div>
      </section>

      {/* Why trust us */}
      <section className="mx-auto max-w-[1000px] px-6 py-20">
        <SectionLabel>trust.log</SectionLabel>
        <SectionTitle>WHY TRUST US</SectionTitle>
        <p className="mb-12 text-center text-[12px] font-semibold uppercase tracking-[1.5px] text-neutral-500">
          Built from the ground up for safe trading
        </p>
        <div className="grid gap-4 md:grid-cols-3">
          <TrustCard title="ESCROW LOCKED" desc="Every trade is backed by escrow. Funds and items are held until both sides fulfill — no scams." />
          <TrustCard title="VERIFIED" desc="All traders are verified through Microsoft authentication linked to their Minecraft account." />
          <TrustCard title="MONITORED" desc="Our admin team reviews every deposit, withdrawal, and trade. Full audit trail on every action." />
        </div>
      </section>

      {/* Still skeptical */}
      <section className="relative border-y border-neutral-800 bg-violet-600/[0.03] px-6 py-16 text-center">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              'linear-gradient(rgba(124,58,237,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(124,58,237,0.04) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />
        <div className="relative z-10 mx-auto max-w-[640px]">
          <SectionLabel>skeptical.check</SectionLabel>
          <h2 className="mb-4 mt-2 font-vt323 text-[44px] leading-none tracking-wide text-white md:text-[56px]">
            STILL <span className="text-violet-400">SKEPTICAL</span>?
            <TerminalCursor height={42} width={16} />
          </h2>
          <p className="mx-auto mb-6 max-w-[520px] text-[13px] leading-relaxed text-neutral-400">
            <span className="font-bold text-white">Good.</span> We wrote down exactly how escrow, audits, and admin approvals work — so you can verify instead of take our word for it.
          </p>
          <Link
            href="/transparency"
            className="inline-block rounded-lg border-[1.5px] border-violet-600 bg-transparent px-6 py-[11px] font-vt323 text-[18px] tracking-wide text-violet-400 transition-colors hover:bg-violet-600/10"
          >
            <span className="text-violet-600">&gt; </span>View Transparency Page
          </Link>
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative overflow-hidden px-6 pb-28 pt-24 text-center">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-1/2 h-[340px] w-[680px] -translate-x-1/2 -translate-y-1/2"
          style={{
            background:
              'radial-gradient(ellipse, rgba(124,58,237,0.10) 0%, transparent 70%)',
          }}
        />
        <div className="relative z-10">
          <h2 className="mb-3 font-vt323 text-[56px] leading-[0.95] tracking-wide text-white md:text-[72px]">
            READY TO TRADE?
            <TerminalCursor height={52} width={18} />
          </h2>
          <p className="mb-7 text-[12px] font-semibold uppercase tracking-[1.5px] text-neutral-500">
            Sign in with Microsoft · Start trading in seconds
          </p>
          <CtaButton
            variant="primary"
            loggedInLabel="Go to Dashboard"
            loggedOutLabel="Start Trading →"
          />
        </div>
      </section>

      <div className="mt-auto">
        <Footer />
      </div>
    </div>
  );
}

function StepCard({ num, title, desc }: { num: string; title: string; desc: string }) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-white/[0.018] p-6">
      <div className="font-vt323 text-[32px] leading-none text-violet-600">
        {num}
        <span className="animate-cursor-blink">_</span>
      </div>
      <h3 className="mb-[6px] mt-[6px] font-vt323 text-[24px] tracking-wide text-white">{title}</h3>
      <p className="text-[12px] leading-relaxed text-neutral-500">{desc}</p>
    </div>
  );
}

function TrustCard({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-white/[0.018] p-6">
      <div className="mb-3 h-8 w-8 border border-violet-600/30 bg-violet-600/10" />
      <h3 className="mb-[6px] font-vt323 text-[22px] tracking-wide text-white">{title}</h3>
      <p className="text-[12px] leading-relaxed text-neutral-500">{desc}</p>
    </div>
  );
}
```

Notes:
- This is a **server component** — no `'use client'` directive. Auth-awareness is delegated to `<CtaButton>`.
- The trust cards use a simple placeholder violet square for icons. If you want the real 8×8 pixel lock/check/eye icons from the mockup, that's a follow-up — visually cleaner to ship with placeholder squares and iterate.
- The floating particle positions and animations from the old landing are intentionally dropped. The page-wide `<BackgroundStars />` (mounted in Task 4 in the layout) supplies the stars now.

- [ ] **Step 2: Run the dev server and verify**

Run:
```bash
pnpm --filter @donuttrade/web dev
```

Open http://localhost:3000 and check:
- Nav shows pixel donut + `DONUTTRADE` in VT323
- Hero headline is `TRADE SAFELY / ON DONUTSMP` with blinking cursor
- "Instant Item Swaps · Escrow Protected" subtitle
- Step cards show `01_ 02_ 03_` with blinking underscore
- `STILL SKEPTICAL?` section between Why Trust and Final CTA
- "View Transparency Page" button links to `/transparency` (will 404 for now — next task creates the page)
- Background stars float behind everything
- Mobile viewport (resize browser to 375px) — grids collapse, headline shrinks

Kill dev with Ctrl+C.

- [ ] **Step 3: Build check**

Run:
```bash
pnpm --filter @donuttrade/web build
```

Expected: build succeeds with no errors.

- [ ] **Step 4: Commit**

```bash
git add packages/web/app/\(landing\)/page.tsx
git -c user.name=givey999 -c user.email=afk.givey@gmail.com commit -m "feat(web): rewrite landing page in V2 Terminal Display style"
```

---

## Task 6: Restyle footer + add transparency link

**Files:**
- Modify: `packages/web/components/footer.tsx`

- [ ] **Step 1: Replace `packages/web/components/footer.tsx` with**

```tsx
const DISCORD_INVITE_URL = process.env.NEXT_PUBLIC_DISCORD_INVITE_URL || '#';

export function Footer() {
  return (
    <footer className="border-t border-neutral-800 px-8 py-5">
      <div className="mx-auto flex max-w-[1100px] items-center justify-between font-vt323 text-[14px] text-neutral-500">
        <span className="tracking-wide">donuttrade.com</span>
        <div className="flex items-center gap-5">
          <a href="/rules" className="transition-colors hover:text-violet-400">rules</a>
          <a href="/transparency" className="transition-colors hover:text-violet-400">transparency</a>
          <a href="/terms" className="transition-colors hover:text-violet-400">terms</a>
          <a
            href={DISCORD_INVITE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors hover:text-violet-400"
          >
            discord
          </a>
        </div>
      </div>
    </footer>
  );
}
```

Key changes:
- Drops the rounded card inside a max-w-md — full-width thin status bar now
- VT323 typography to match the landing identity
- New `/transparency` link added
- Removed the `© 2026 DonutTrade` line — the rules/terms links already carry legal weight

- [ ] **Step 2: Verify the footer shows on every page that uses it**

Run:
```bash
pnpm --filter @donuttrade/web dev
```

Check:
- http://localhost:3000 (landing) — new footer shows
- http://localhost:3000/rules — same footer shows
- http://localhost:3000/terms — same footer shows

Kill dev with Ctrl+C.

- [ ] **Step 3: Build check**

Run:
```bash
pnpm --filter @donuttrade/web build
```

Expected: clean build.

- [ ] **Step 4: Commit**

```bash
git add packages/web/components/footer.tsx
git -c user.name=givey999 -c user.email=afk.givey@gmail.com commit -m "feat(web): restyle footer + add transparency link"
```

---

## Task 7: Create /transparency page — top half (sections 1–4)

**Files:**
- Create: `packages/web/app/(app)/transparency/page.tsx`

Before writing this task's content, the implementer **MUST** read:
- `packages/api/prisma/schema.prisma` — verify the "what we store" claims match the real `User`, `Session`, `Transaction`, `ItemDeposit`, `ItemWithdrawal`, `UserCosmetic` tables
- Any auth route files under `packages/api/src/routes/auth/` (or similar) — verify the Microsoft OAuth scopes and Discord OAuth scopes match the claims in section 2
- `packages/api/src/lib/deposit-code.ts` — the crypto section's code snippet must match this file exactly

If any claim in the sections below **does not match reality**, fix the copy in the page code before committing. Do not ship claims that don't match the code.

- [ ] **Step 1: Create `packages/web/app/(app)/transparency/page.tsx` with sections 1–4**

```tsx
import type { Metadata } from 'next';
import Link from 'next/link';
import { SectionLabel } from '@/components/landing/SectionLabel';
import { SectionTitle } from '@/components/landing/SectionTitle';
import { TerminalCursor } from '@/components/landing/TerminalCursor';

export const metadata: Metadata = {
  title: 'Transparency — How DonutTrade actually works',
  description:
    'How escrow, audits, and admin accountability work at DonutTrade. Source code is public on GitHub under FSL 1.1.',
  openGraph: {
    title: 'Transparency — How DonutTrade actually works',
    description:
      'How escrow, audits, and admin accountability work at DonutTrade. Source on GitHub under FSL 1.1.',
    siteName: 'DonutTrade',
  },
};

export default function TransparencyPage() {
  return (
    <div className="mx-auto max-w-[900px] px-6 py-16">
      {/* Header */}
      <header className="mb-20 text-center">
        <SectionLabel>sys.transparency</SectionLabel>
        <h1 className="mb-4 mt-2 font-vt323 text-[60px] leading-[0.95] tracking-wide text-white md:text-[80px]">
          TRANSPARENCY
          <TerminalCursor height={60} width={20} />
        </h1>
        <p className="mx-auto max-w-xl text-[13px] leading-relaxed text-neutral-400">
          How escrow, audits, and admin accountability actually work.
        </p>
      </header>

      {/* Section 1 — Source code announcement */}
      <section className="relative mb-24 overflow-hidden rounded-2xl border border-violet-600/30 bg-violet-600/[0.04] px-8 py-14 text-center">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-1/2 h-[280px] w-[500px] -translate-x-1/2 -translate-y-1/2"
          style={{
            background:
              'radial-gradient(ellipse, rgba(124,58,237,0.15) 0%, transparent 70%)',
          }}
        />
        <div className="relative z-10">
          <SectionLabel>source.open</SectionLabel>
          <SectionTitle className="!text-[44px] md:!text-[56px]">NOW SOURCE-OPEN</SectionTitle>
          <p className="mx-auto mb-6 max-w-[620px] text-[14px] leading-relaxed text-neutral-300">
            <span className="font-bold text-white">
              We&apos;re happy to announce that DonutTrade is source-open.
            </span>{' '}
            The full platform — API, web frontend, bots, escrow logic, admin tooling — lives on GitHub under the Functional Source License (FSL 1.1). Every endpoint, every admin check, every cryptographic operation: all readable, all verifiable.
          </p>
          <a
            href="https://github.com/givey999/donuttrade"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block rounded-lg border-[1.5px] border-violet-600 bg-transparent px-6 py-[11px] font-vt323 text-[18px] tracking-wide text-violet-400 transition-colors hover:bg-violet-600/10"
          >
            <span className="text-violet-600">&gt; </span>github.com/givey999/donuttrade
          </a>
          <p className="mx-auto mt-6 max-w-[560px] text-[11px] leading-relaxed text-neutral-600">
            Available today for reading, learning, and non-commercial use. Auto-converts to Apache 2.0 two years after each release. See <code className="text-neutral-500">LICENSE</code> in the repo for the exact terms.
          </p>
        </div>
      </section>

      {/* Section 2 — Your data */}
      <section className="mb-24">
        <SectionLabel>data.policy</SectionLabel>
        <SectionTitle>YOUR DATA</SectionTitle>
        <div className="mt-6 rounded-xl border border-violet-600/30 bg-violet-600/[0.04] px-6 py-4 text-center">
          <p className="text-[13px] leading-relaxed text-neutral-300">
            <span className="font-bold text-white">We don&apos;t — and don&apos;t want to — store any passwords.</span>{' '}
            Sign-in goes through Microsoft OAuth. DonutTrade never sees your Microsoft password, and there is no DonutTrade password to set, forget, or leak.
          </p>
        </div>
        <div className="mt-10 grid gap-6 md:grid-cols-2">
          <DataBlock
            title="What we store"
            items={[
              'Minecraft UUID + username (from Microsoft auth — proves you own the account)',
              'Discord user ID (only if you link Discord for notifications)',
              'Your server-side session token (short-lived, expires on logout)',
              'Deposit, withdrawal, and trade history (required for the audit log)',
              'Your current escrow inventory (required to know what\u2019s yours)',
              'Notification preferences (DM opt-in / opt-out, etc.)',
            ]}
          />
          <DataBlock
            title="What we receive from Microsoft"
            paragraphs={[
              'When you sign in with Microsoft, we receive your Minecraft UUID and Minecraft username — enough to prove you own the account.',
              'We do not receive your Microsoft email, real name, profile picture, or any other Microsoft account data.',
              'The Microsoft access token is used once at sign-in and never stored.',
            ]}
          />
          <DataBlock
            title="What we receive from Discord"
            paragraphs={[
              'If you link Discord (optional, for DM notifications), we receive your Discord user ID and username. Nothing else.',
              'We do not read your messages, your server list, your friend list, or any other Discord content.',
              'You can unlink Discord at any time from /dashboard.',
            ]}
          />
          <DataBlock
            title="What we never touch"
            items={[
              'Real names, addresses, phone numbers',
              'Payment cards or real-money financial data — DonutTrade only handles in-game DonutSMP currency',
              'Browser fingerprints, tracking cookies, ad-targeting profiles',
              'Your Microsoft password or account credentials (handled entirely by Microsoft)',
            ]}
          />
        </div>
      </section>

      {/* Section 3 — The escrow flow */}
      <section className="mb-24">
        <SectionLabel>escrow.flow</SectionLabel>
        <SectionTitle>HOW AN ESCROW TRADE WORKS</SectionTitle>
        <div className="mt-10 overflow-hidden rounded-xl border border-neutral-800 bg-[#05050a]">
          <div className="border-b border-neutral-800 bg-white/[0.02] px-4 py-[10px] text-[11px] text-neutral-600">
            escrow.flow — example trade
          </div>
          <pre className="overflow-x-auto px-5 py-5 font-vt323 text-[16px] leading-[1.6] text-neutral-300">
{`[t=0]    buyer.submit_order(item=zombie_spawner, price=45000)
[t=0.01] api.issue_code(order_id=42, hmac=sha256(payload + CODE_SIGNING_SECRET))
[t=0.02] escrow.lock_funds(buyer, amount=45000)
[t=1h]   seller.submit_fill(order_id=42, code=<verified>)
[t=1h]   escrow.verify_hmac(order_id, code) → OK
[t=1h]   escrow.release_to_seller(amount=44100)   // -2% platform fee
[t=1h]   escrow.deliver_item(buyer)
[t=1h]   audit.log(action=trade_completed, order_id=42)`}
          </pre>
        </div>
        <p className="mt-4 text-[12px] leading-relaxed text-neutral-500">
          Every line above corresponds to a real function call. Grep <code>packages/api/src/</code> in the public repo to find them — starting with <code>packages/api/src/lib/deposit-code.ts</code> for the HMAC generation.
        </p>
      </section>

      {/* Section 4 — Admin ACL */}
      <section className="mb-24">
        <SectionLabel>admin.acl</SectionLabel>
        <SectionTitle>ADMIN POWERS</SectionTitle>
        <div className="mt-10 grid gap-6 md:grid-cols-2">
          <div className="rounded-xl border border-neutral-800 bg-white/[0.018] p-6">
            <h3 className="mb-4 font-vt323 text-[22px] tracking-wide text-violet-400">ADMINS CAN</h3>
            <ul className="space-y-[10px] text-[13px] leading-relaxed text-neutral-300">
              <li>Approve deposits (verify items match the claimed amount)</li>
              <li>Confirm withdrawals (deliver items in-game)</li>
              <li>Resolve disputes (review audit log, render a decision)</li>
              <li>Freeze accounts suspected of scamming</li>
              <li>Adjust platform settings (fees, categories, limits)</li>
            </ul>
          </div>
          <div className="rounded-xl border border-neutral-800 bg-white/[0.018] p-6">
            <h3 className="mb-4 font-vt323 text-[22px] tracking-wide text-violet-400">ADMINS CANNOT</h3>
            <ul className="space-y-[10px] text-[13px] leading-relaxed text-neutral-300">
              <li>Move items a user didn&apos;t deposit</li>
              <li>Edit or delete audit log rows (append-only)</li>
              <li>Drain escrow without a matching order</li>
              <li>See user passwords (stored as hashes)</li>
              <li>Block a user&apos;s withdrawal on their own authority — all withdrawals require a recorded admin action</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Sections 5-9 added in Task 8 */}
    </div>
  );
}

function DataBlock({
  title,
  items,
  paragraphs,
}: {
  title: string;
  items?: string[];
  paragraphs?: string[];
}) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-white/[0.018] p-6">
      <h3 className="mb-4 font-vt323 text-[20px] tracking-wide text-violet-400">{title}</h3>
      {items && (
        <ul className="space-y-[8px] text-[12px] leading-relaxed text-neutral-400">
          {items.map((item, i) => (
            <li key={i} className="flex gap-2">
              <span className="text-neutral-700">·</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}
      {paragraphs && (
        <div className="space-y-[10px] text-[12px] leading-relaxed text-neutral-400">
          {paragraphs.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify transparency page renders**

Run:
```bash
pnpm --filter @donuttrade/web dev
```

Open http://localhost:3000/transparency. Check:
- Header `TRANSPARENCY` with cursor
- Source-open announcement card with github link (clicking opens GitHub — will 404 until the repo is public)
- "Your data" 2×2 grid with four blocks
- Escrow flow terminal trace with monospace styling
- Admin CAN / CANNOT two columns
- Note: page ends after Admin section (sections 5–9 come in Task 8)

Kill dev with Ctrl+C.

- [ ] **Step 3: Build check**

Run:
```bash
pnpm --filter @donuttrade/web build
```

Expected: clean build.

- [ ] **Step 4: Commit**

```bash
git add packages/web/app/\(app\)/transparency/page.tsx
git -c user.name=givey999 -c user.email=afk.givey@gmail.com commit -m "feat(web): add /transparency page with sections 1-4"
```

---

## Task 8: Add /transparency sections 5–9

**Files:**
- Modify: `packages/web/app/(app)/transparency/page.tsx`

- [ ] **Step 1: Before implementation — read the real deposit-code file**

Run:
```bash
cat packages/api/src/lib/deposit-code.ts
```

Look at the actual `generateCode` function. You will paste a short slice of its real code into Section 7 (code signing math) below — do NOT invent or approximate.

- [ ] **Step 2: Insert sections 5–9 before the closing `</div>` of the main wrapper**

Find this line in `packages/web/app/(app)/transparency/page.tsx`:
```tsx
      {/* Sections 5-9 added in Task 8 */}
    </div>
```

Replace with:

```tsx
      {/* Section 5 — Audit log */}
      <section className="mb-24">
        <SectionLabel>audit.log</SectionLabel>
        <SectionTitle>EVERY ACTION IS LOGGED</SectionTitle>
        <div className="mt-10 overflow-hidden rounded-xl border border-neutral-800 bg-[#05050a]">
          <div className="border-b border-neutral-800 bg-white/[0.02] px-4 py-[10px] text-[11px] text-neutral-600">
            audit.log — example entries
          </div>
          <table className="w-full font-vt323 text-[14px]">
            <thead>
              <tr className="border-b border-neutral-800 text-left text-[11px] uppercase tracking-wider text-neutral-600">
                <th className="px-5 py-3 font-normal">TIMESTAMP</th>
                <th className="px-5 py-3 font-normal">USER</th>
                <th className="px-5 py-3 font-normal">ACTION</th>
                <th className="px-5 py-3 font-normal">TARGET</th>
                <th className="px-5 py-3 font-normal">METADATA</th>
              </tr>
            </thead>
            <tbody className="text-neutral-400">
              <AuditRow ts="2026-04-14 14:32:01" user="xDarkKnight" action="deposit_code_issued" target="zombie_spawner ×3" meta="DT-DEP-xJk...Lm" />
              <AuditRow ts="2026-04-14 14:35:47" user="admin@platform" action="deposit_approved" target="DT-DEP-xJk...Lm" meta="verified_in_game" />
              <AuditRow ts="2026-04-14 14:40:12" user="xDarkKnight" action="order_created" target="order_id=42" meta="price=45000" />
              <AuditRow ts="2026-04-14 15:12:08" user="CraftMaster99" action="order_filled" target="order_id=42" meta="hmac=OK" />
              <AuditRow ts="2026-04-14 15:12:08" user="escrow.service" action="funds_released" target="CraftMaster99" meta="amount=44100" />
              <AuditRow ts="2026-04-14 15:45:30" user="CraftMaster99" action="withdrawal_requested" target="DT-WTH-p8Q...Rn" meta="amount=44100" />
              <AuditRow ts="2026-04-14 16:02:11" user="admin@platform" action="withdrawal_confirmed" target="DT-WTH-p8Q...Rn" meta="delivered_in_game" />
              <AuditRow ts="2026-04-14 16:02:12" user="system" action="trade_completed" target="order_id=42" meta="fee=900" />
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-[12px] leading-relaxed text-neutral-500">
          The audit log is append-only at the database level. Admins — including the platform owner — cannot edit or delete rows. Your real activity lives at <Link href="/dashboard" className="text-violet-400 hover:underline">/dashboard</Link>. Example rows shown above are illustrative.
          {/* TODO(followup): swap for real read-only query — see docs/superpowers/plans backlog */}
        </p>
      </section>

      {/* Section 6 — Dispute flow */}
      <section className="mb-24">
        <SectionLabel>dispute.flow</SectionLabel>
        <SectionTitle>IF SOMETHING GOES WRONG</SectionTitle>
        <ol className="mt-10 space-y-4 text-[13px] leading-relaxed text-neutral-300">
          <DisputeStep num="01">Open a ticket in our Discord.</DisputeStep>
          <DisputeStep num="02">An admin reviews the audit log for your account and the counterparty.</DisputeStep>
          <DisputeStep num="03">Decision rendered within 24 hours.</DisputeStep>
          <DisputeStep num="04">If you disagree, escalate to the platform owner in Discord — same 24-hour window.</DisputeStep>
          <DisputeStep num="05">Chargebacks and refunds are paid from the platform&apos;s reserve, not from other users&apos; escrow.</DisputeStep>
        </ol>
      </section>

      {/* Section 7 — Code signing math (collapsible) */}
      <section className="mb-24">
        <SectionLabel>crypto.math</SectionLabel>
        <details className="mt-6 rounded-xl border border-neutral-800 bg-white/[0.018]">
          <summary className="cursor-pointer px-6 py-5 font-vt323 text-[24px] tracking-wide text-white transition-colors hover:text-violet-400">
            HOW DEPOSIT CODES WORK <span className="text-[14px] text-neutral-600">(click to expand)</span>
          </summary>
          <div className="border-t border-neutral-800 px-6 py-6">
            <p className="mb-5 text-[13px] leading-relaxed text-neutral-400">
              Deposit and withdrawal codes are signed with HMAC-SHA256 using a secret that lives only on the server. Only the server can create a valid code. Even an admin, without the secret, cannot forge one.
            </p>
            <div className="mb-4 overflow-x-auto rounded-lg border border-neutral-800 bg-[#05050a] p-5">
              <pre className="font-vt323 text-[15px] leading-[1.6] text-neutral-300">
{/* IMPLEMENTER: replace the snippet below with the ACTUAL generateCode function body from packages/api/src/lib/deposit-code.ts. Do NOT invent code. */}
{`// packages/api/src/lib/deposit-code.ts
const payloadStr = Buffer.from(JSON.stringify(fullPayload)).toString('base64url');
const signature = createHmac('sha256', config.CODE_SIGNING_SECRET)
  .update(payloadStr)
  .digest('base64url');

return {
  code: \`\${prefix}\${payloadStr}.\${signature}\`,
  expiresAt,
};`}
              </pre>
            </div>
            <p className="text-[12px] leading-relaxed text-neutral-500">
              The full implementation (including <code>verifyCode</code> with timing-safe comparison) is in <code>packages/api/src/lib/deposit-code.ts</code> in the public repo.
            </p>
          </div>
        </details>
      </section>

      {/* Section 8 — How we make money */}
      <section className="mb-24">
        <SectionLabel>revenue.model</SectionLabel>
        <SectionTitle>HOW WE MAKE MONEY</SectionTitle>
        <div className="mt-10 space-y-5 text-[13px] leading-relaxed text-neutral-300">
          <div className="rounded-xl border border-neutral-800 bg-white/[0.018] p-6">
            <h3 className="mb-2 font-vt323 text-[20px] tracking-wide text-violet-400">TRADE FEES</h3>
            <p className="text-neutral-400">2% of each completed trade, shown in the UI at order creation. Split between buyer and seller.</p>
          </div>
          <div className="rounded-xl border border-neutral-800 bg-white/[0.018] p-6">
            <h3 className="mb-2 font-vt323 text-[20px] tracking-wide text-violet-400">SPONSORED LISTINGS</h3>
            <p className="text-neutral-400">Item sellers can pay for top placement on the marketplace. Sponsored rows are tagged <code className="text-violet-400">SPONSORED</code>.</p>
          </div>
          <div className="rounded-xl border border-neutral-800 bg-white/[0.018] p-6">
            <h3 className="mb-2 font-vt323 text-[20px] tracking-wide text-violet-400">AD PLACEMENTS</h3>
            <p className="text-neutral-400">Occasional banner ads from DonutSMP-adjacent services, arranged through Discord tickets. Not programmatic; we know every advertiser.</p>
          </div>
          <p className="pt-2 text-center text-[12px] font-semibold uppercase tracking-[1px] text-neutral-500">
            We don&apos;t sell your data · We don&apos;t profile users · We don&apos;t tax trades hidden in the spread
          </p>
        </div>
      </section>

      {/* Section 9 — Who runs this */}
      <section className="mb-24">
        <SectionLabel>operator.id</SectionLabel>
        <SectionTitle>WHO RUNS THIS</SectionTitle>
        <div className="mt-10 rounded-xl border border-neutral-800 bg-white/[0.018] p-8 text-center">
          {/* TODO(user): supply real founder text. Until the operator provides text, this placeholder stays. */}
          <p className="text-[13px] leading-relaxed text-neutral-400">
            DonutTrade is run by <span className="font-bold text-white">givey999</span>. Reach out directly on Discord — the link is in the footer.
          </p>
        </div>
      </section>
    </div>
  );
}

function AuditRow({
  ts,
  user,
  action,
  target,
  meta,
}: {
  ts: string;
  user: string;
  action: string;
  target: string;
  meta: string;
}) {
  return (
    <tr className="border-b border-neutral-900">
      <td className="px-5 py-[10px] text-neutral-500">{ts}</td>
      <td className="px-5 py-[10px]">{user}</td>
      <td className="px-5 py-[10px] text-violet-400">{action}</td>
      <td className="px-5 py-[10px]">{target}</td>
      <td className="px-5 py-[10px] text-neutral-500">{meta}</td>
    </tr>
  );
}

function DisputeStep({ num, children }: { num: string; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-4 rounded-lg border border-neutral-800 bg-white/[0.018] p-5">
      <span className="font-vt323 text-[28px] leading-none text-violet-600">{num}</span>
      <span className="pt-[4px]">{children}</span>
    </li>
  );
}
```

- [ ] **Step 3: Replace the crypto snippet with the REAL one**

Open `packages/api/src/lib/deposit-code.ts`. Copy the exact `generateCode` function body (the part that creates the payload string and signature). Paste it into the `<pre>` block in Section 7, replacing the illustrative snippet. Keep the comment above the pre that says `// packages/api/src/lib/deposit-code.ts`.

- [ ] **Step 4: Verify the full page**

Run:
```bash
pnpm --filter @donuttrade/web dev
```

Open http://localhost:3000/transparency. All nine sections should render:
1. NOW SOURCE-OPEN (announcement)
2. YOUR DATA (four blocks)
3. HOW AN ESCROW TRADE WORKS (terminal trace)
4. ADMIN POWERS (CAN / CANNOT)
5. EVERY ACTION IS LOGGED (audit table)
6. IF SOMETHING GOES WRONG (5 dispute steps)
7. HOW DEPOSIT CODES WORK (collapsible `<details>`)
8. HOW WE MAKE MONEY (fees / sponsored / ads)
9. WHO RUNS THIS (placeholder)

Click the collapsible section 7 — it should expand to show the real crypto snippet.

Kill dev with Ctrl+C.

- [ ] **Step 5: Build check**

```bash
pnpm --filter @donuttrade/web build
```

Expected: clean build.

- [ ] **Step 6: Commit**

```bash
git add packages/web/app/\(app\)/transparency/page.tsx
git -c user.name=givey999 -c user.email=afk.givey@gmail.com commit -m "feat(web): complete /transparency page sections 5-9"
```

---

## Task 9: Generate OG images for landing and transparency

**Files:**
- Create: `packages/web/app/opengraph-image.tsx`
- Create: `packages/web/app/(app)/transparency/opengraph-image.tsx`

These files use Next.js 15's `ImageResponse` API to generate 1200×630 PNGs at build time.

- [ ] **Step 1: Create `packages/web/app/opengraph-image.tsx`**

```tsx
import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'DonutTrade — Trade safely on DonutSMP';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          height: '100%',
          backgroundColor: '#0a0a0f',
          backgroundImage:
            'radial-gradient(ellipse at top, rgba(124,58,237,0.15) 0%, transparent 60%)',
          color: 'white',
          fontFamily: 'monospace',
          padding: 80,
        }}
      >
        <div
          style={{
            fontSize: 20,
            letterSpacing: 4,
            color: '#a78bfa',
            textTransform: 'uppercase',
            marginBottom: 28,
          }}
        >
          DONUTSMP · ESCROW TRADING
        </div>
        <div
          style={{
            fontSize: 150,
            fontWeight: 400,
            lineHeight: 0.9,
            textAlign: 'center',
            fontFamily: 'monospace',
          }}
        >
          TRADE SAFELY
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            fontSize: 150,
            fontWeight: 400,
            lineHeight: 0.9,
            fontFamily: 'monospace',
          }}
        >
          ON <span style={{ color: '#a78bfa', marginLeft: 32 }}>DONUTSMP</span>
          <div
            style={{
              width: 38,
              height: 118,
              backgroundColor: '#7c3aed',
              marginLeft: 12,
            }}
          />
        </div>
      </div>
    ),
    { ...size },
  );
}
```

Note: `ImageResponse` uses system/CDN-fetched fonts. For monospace we're relying on the system default — VT323 is not loadable in edge runtime without shipping the TTF file. This is acceptable: the OG image is for social previews, not the site itself, and a plain monospace reads as "terminal" anyway.

- [ ] **Step 2: Create `packages/web/app/(app)/transparency/opengraph-image.tsx`**

```tsx
import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'Transparency — How DonutTrade actually works';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          height: '100%',
          backgroundColor: '#0a0a0f',
          backgroundImage:
            'radial-gradient(ellipse at center, rgba(124,58,237,0.12) 0%, transparent 60%)',
          color: 'white',
          fontFamily: 'monospace',
          padding: 80,
        }}
      >
        <div
          style={{
            fontSize: 18,
            letterSpacing: 3,
            color: '#a78bfa',
            textTransform: 'uppercase',
            marginBottom: 30,
          }}
        >
          // sys.transparency
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            fontSize: 160,
            fontWeight: 400,
            lineHeight: 0.9,
            fontFamily: 'monospace',
          }}
        >
          TRANSPARENCY
          <div
            style={{
              width: 40,
              height: 124,
              backgroundColor: '#7c3aed',
              marginLeft: 14,
            }}
          />
        </div>
        <div
          style={{
            fontSize: 24,
            color: '#737380',
            marginTop: 40,
            textAlign: 'center',
          }}
        >
          How escrow, audits, and admin accountability actually work.
        </div>
      </div>
    ),
    { ...size },
  );
}
```

- [ ] **Step 3: Build and inspect OG images**

Run:
```bash
pnpm --filter @donuttrade/web build
```

Expected: build succeeds. The OG images are compiled into `.next/server/app/opengraph-image.jpg.js` (not raw PNGs — they're compiled routes).

Then run:
```bash
pnpm --filter @donuttrade/web dev
```

Open `http://localhost:3000/opengraph-image` — should render the landing OG PNG directly in the browser.
Open `http://localhost:3000/transparency/opengraph-image` — should render the transparency OG PNG.

Kill dev with Ctrl+C.

- [ ] **Step 4: Commit**

```bash
git add packages/web/app/opengraph-image.tsx packages/web/app/\(app\)/transparency/opengraph-image.tsx
git -c user.name=givey999 -c user.email=afk.givey@gmail.com commit -m "feat(web): add OG images for landing and transparency"
```

---

## Task 10: Create robots.txt + Organization JSON-LD

**Files:**
- Create: `packages/web/public/robots.txt`
- Modify: `packages/web/app/(landing)/page.tsx` (add JSON-LD script)

- [ ] **Step 1: Create `packages/web/public/robots.txt`**

```
User-agent: *
Allow: /
Allow: /transparency
Allow: /rules
Allow: /terms
Allow: /marketplace
Disallow: /dashboard
Disallow: /admin
Disallow: /orders
Disallow: /signup
Disallow: /verify
Disallow: /login
Disallow: /auth

Sitemap: https://donuttrade.com/sitemap.xml
```

Note: sitemap.xml is not created by this plan — it's a follow-up. Listing it here is forward-compatible and doesn't hurt.

- [ ] **Step 2: Add Organization JSON-LD to landing page**

In `packages/web/app/(landing)/page.tsx`, find the opening `<div className="relative flex min-h-screen flex-col">` and add a `<script>` element as its first child (before the `<nav>`):

```tsx
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Organization',
            name: 'DonutTrade',
            url: 'https://donuttrade.com',
            logo: 'https://donuttrade.com/opengraph-image',
            description: 'Secure escrow trading for Minecraft items on DonutSMP.',
            sameAs: [
              'https://github.com/givey999/donuttrade',
              process.env.NEXT_PUBLIC_DISCORD_INVITE_URL || 'https://discord.gg/donuttrade',
            ],
          }),
        }}
      />
```

Note on `dangerouslySetInnerHTML`: it's safe here because we control the content and JSON.stringify escapes any hostile input. React's JSX script warning is the reason.

- [ ] **Step 3: Build and verify**

```bash
pnpm --filter @donuttrade/web build
```

Expected: clean build.

```bash
pnpm --filter @donuttrade/web dev
```

Open http://localhost:3000/robots.txt — should return the text file.
View source of http://localhost:3000 and search for `application/ld+json` — should see the Organization block.

Kill dev with Ctrl+C.

- [ ] **Step 4: Commit**

```bash
git add packages/web/public/robots.txt packages/web/app/\(landing\)/page.tsx
git -c user.name=givey999 -c user.email=afk.givey@gmail.com commit -m "feat(web): add robots.txt and Organization JSON-LD"
```

---

## Task 11: Final landing + transparency smoke test

**Files:** (no file changes — verification only)

- [ ] **Step 1: Clean build**

```bash
pnpm --filter @donuttrade/web build
```

Expected: no TypeScript errors, no Tailwind warnings.

- [ ] **Step 2: Start dev server**

```bash
pnpm --filter @donuttrade/web dev
```

- [ ] **Step 3: Manual checklist — desktop**

Open http://localhost:3000 at 1400px viewport. Check:

- [ ] Background stars (Unicode ✦ ✧ ⋆) drift across the page
- [ ] Nav: pixel donut + DONUTTRADE wordmark + violet "Start Trading" button
- [ ] Hero: `TRADE SAFELY / ON DONUTSMP_` in VT323 with blinking cursor, violet glow behind
- [ ] Subtitle: `Instant Item Swaps · Escrow Protected`
- [ ] Two CTAs: "Start Trading →" (violet) + "View Marketplace" (ghost)
- [ ] How it works: three cards, `01_ 02_ 03_` with blinking underscore, DEPOSIT / TRADE / WITHDRAW
- [ ] Why trust: three cards, ESCROW LOCKED / VERIFIED / MONITORED
- [ ] Still skeptical: `STILL SKEPTICAL?` with cursor, "View Transparency Page" outline button
- [ ] Final CTA: `READY TO TRADE?` with cursor
- [ ] Footer: thin VT323 status bar with rules · transparency · terms · discord

Click "View Transparency Page" → navigates to `/transparency`.

On `/transparency`:
- [ ] TRANSPARENCY header with cursor
- [ ] NOW SOURCE-OPEN card with github link
- [ ] YOUR DATA 2×2 grid with four blocks
- [ ] Escrow flow terminal trace
- [ ] Admin CAN / CANNOT two columns
- [ ] Audit log table (8 rows)
- [ ] Dispute flow (5 numbered steps)
- [ ] HOW DEPOSIT CODES WORK — collapsible, expands to show real HMAC code
- [ ] HOW WE MAKE MONEY — fees / sponsored / ads
- [ ] WHO RUNS THIS — founder placeholder
- [ ] Footer shows, transparency link is visible

- [ ] **Step 4: Manual checklist — mobile**

Open devtools, set viewport to 375×667:
- [ ] Landing hero H1 shrinks (should wrap or reduce font-size)
- [ ] Landing step cards stack vertically
- [ ] Transparency YOUR DATA grid stacks to single column
- [ ] Transparency escrow trace scrolls horizontally without breaking layout
- [ ] Transparency admin CAN/CANNOT stacks

- [ ] **Step 5: Manual checklist — authenticated**

If you have a dev login, sign in. Then:
- [ ] Landing hero "Start Trading →" button changes to "Go to Dashboard"
- [ ] Clicking goes to `/dashboard`, not `/login`
- [ ] Existing dashboard, marketplace, orders, admin pages still render (smoke test — no regressions from the font/metadata changes)

Kill dev with Ctrl+C.

- [ ] **Step 6: Visual regression check on other pages**

```bash
pnpm --filter @donuttrade/web dev
```

Visit each of these at least briefly to check nothing broke:
- `/rules` — should show rules with the new terminal footer
- `/terms` — same
- `/dashboard` (if logged in) — navbar + content unchanged, new footer at bottom
- `/marketplace` — same

Kill dev with Ctrl+C.

- [ ] **Step 7: (No commit — this task is verification only)**

If all checkboxes pass, proceed to Task 12. If any fail, fix them in the relevant file and re-run the checks.

---

## Task 12: Update .gitignore

**Files:**
- Modify: `.gitignore` at repo root

- [ ] **Step 1: Append the following lines to `.gitignore`**

```
# Claude Code local state (not source)
.claude/

# Superpowers brainstorm artifacts (ephemeral)
.superpowers/
```

Do NOT remove any existing entries. Append at the end.

- [ ] **Step 2: Verify the ignore actually works**

```bash
git status --ignored
```

Expected: `.claude/` and `.superpowers/` show up under "Ignored files" section (or simply don't show at all, which also means they're ignored).

Run:
```bash
git check-ignore -v .claude/ .superpowers/
```

Expected: both paths report `.gitignore:<line>:<pattern>` showing they're matched.

- [ ] **Step 3: Commit**

```bash
git add .gitignore
git -c user.name=givey999 -c user.email=afk.givey@gmail.com commit -m "chore: gitignore .claude/ and .superpowers/ local state"
```

---

## Task 13: Add LICENSE file (FSL 1.1, Apache 2.0 future)

**Files:**
- Create: `LICENSE` at repo root

- [ ] **Step 1: Fetch the FSL 1.1 Apache 2.0 template text**

The canonical source is https://fsl.software/FSL-1.1-Apache-2.0.template.md. Either:
- Open it in a browser, copy the text
- Or download with `curl`:

```bash
curl -s https://fsl.software/FSL-1.1-Apache-2.0.template.md -o LICENSE
```

(If `curl` fails, fall back to copying from the browser.)

- [ ] **Step 2: Fill in the template placeholders**

Open `LICENSE` and replace:
- `Licensor` → `givey999`
- `Change Date` → `2028-04-14`
- `Change License` → `Apache License, Version 2.0`
- `Licensed Work` → `DonutTrade`

The template has these as angle-bracketed placeholders in the preamble. The rest of the FSL 1.1 text is the standardized license body — do not modify it.

- [ ] **Step 3: Verify the file contains the key strings**

Run:
```bash
grep -c "Functional Source License" LICENSE
grep -c "2028-04-14" LICENSE
grep -c "Apache License, Version 2.0" LICENSE
```

Each should return `≥ 1`.

- [ ] **Step 4: Commit**

```bash
git add LICENSE
git -c user.name=givey999 -c user.email=afk.givey@gmail.com commit -m "chore: add FSL 1.1 LICENSE (2-year term, Apache 2.0 future)"
```

---

## Task 14: Update README

**Files:**
- Modify: `README.md` at repo root

- [ ] **Step 1: Check the current README**

```bash
cat README.md
```

If it doesn't exist, create one. If it does, preserve any genuinely useful content (build instructions, service layout) and add the new sections below.

- [ ] **Step 2: Replace `README.md` with**

```markdown
# DonutTrade

Secure escrow trading platform for DonutSMP — a Minecraft server economy. Players deposit and withdraw in-game money and items through a signed-code bot system, then trade safely on a web marketplace with funds held in escrow.

## License

Source-available under the **Functional Source License 1.1 (FSL 1.1)** with Apache License 2.0 as the future license. Every release automatically converts to Apache 2.0 on the date two years after its publication (the current `LICENSE` file sets that date to **2028-04-14**).

- **Read, learn from, fork for personal/non-commercial use** — permitted today
- **Run a competing commercial service** — not permitted until the change date
- **Do anything** — permitted from 2028-04-14 onward (Apache 2.0 inherits)

See `LICENSE` for exact terms.

## Why is this public?

So you can verify what we say. Our [`/transparency`](https://donuttrade.com/transparency) page claims specific things — how escrow works, what admins can and can't do, what data we receive from Microsoft and Discord. Everything it claims lives in this repo.

If you find a discrepancy between the transparency page and the code, open an issue.

## Architecture

DonutTrade is a pnpm monorepo with five services orchestrated by Docker Compose:

| Service | Package | Description |
|---|---|---|
| **API** | `packages/api/` | Fastify REST, Prisma ORM, PostgreSQL + Redis |
| **Web** | `packages/web/` | Next.js 15 App Router, React 19, Tailwind v4 |
| **MC-Bot** | `packages/mc-bot/` | Mineflayer bot — payment verification, deposits, withdrawals |
| **Management-Bot** | `packages/management-bot/` | Discord bot — tickets, DM notifications |
| **Caddy** | `Caddyfile` | Reverse proxy with auto Let's Encrypt TLS |

Shared types live in `packages/shared/`.

## Development

```bash
pnpm install
docker compose up -d           # all services (dev)
docker compose logs -f         # follow logs
```

Or run individual packages with hot reload:

```bash
pnpm --filter @donuttrade/api dev
pnpm --filter @donuttrade/web dev
```

See `CLAUDE.md` for the full architecture notes and deployment flow.

## Contributing

Pull requests welcome. By contributing you agree that your contributions are licensed under the same FSL 1.1 terms as the project. Non-trivial contributions may be merged after review from @givey999.

## Credits

Run by [@givey999](https://github.com/givey999). Built on Next.js, Fastify, Prisma, Mineflayer, and Discord.js.
```

- [ ] **Step 3: Build check (sanity — README doesn't affect build, but confirm nothing else broke)**

```bash
pnpm --filter @donuttrade/web build
```

Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add README.md
git -c user.name=givey999 -c user.email=afk.givey@gmail.com commit -m "docs: rewrite README for public release (license, architecture, contrib)"
```

---

## Task 15: Pre-public secret audit (BLOCKING GATE before flipping visibility)

**Files:** (no file changes — audit only)

This task is the single most important step before making the repo public. A single leaked secret in git history is permanently exposed once the visibility flip happens.

- [ ] **Step 1: Install gitleaks if not present**

On Windows with Chocolatey:
```bash
choco install gitleaks
```

On macOS:
```bash
brew install gitleaks
```

On Linux: download the appropriate binary from https://github.com/gitleaks/gitleaks/releases.

Verify:
```bash
gitleaks version
```

Expected: prints version like `v8.x.x`.

- [ ] **Step 2: Run gitleaks across full history**

```bash
gitleaks detect --source . --log-opts="--all" --verbose
```

Expected: `no leaks found`.

**If leaks are found:**
1. **Stop immediately.** Do not proceed.
2. **Rotate every leaked secret in production first** — before you even look at git filter-repo. Anyone who scraped the private repo at any past point already has the leaked value.
3. After rotation is done, use `git filter-repo --replace-text secrets.txt` to rewrite history, where `secrets.txt` lists the values to redact.
4. Force-push the rewritten history to your private remote.
5. Re-run gitleaks to confirm. Only then proceed.

- [ ] **Step 3: Manual spot-check of sensitive patterns**

```bash
git log -p --all 2>/dev/null | grep -iE 'password|secret|token|api[_-]?key|CODE_SIGNING_SECRET|BOT_WEBHOOK_SECRET|DATABASE_URL|DISCORD_BOT_TOKEN|MICROSOFT_CLIENT_SECRET' | head -50
```

Expected: only matches are in `.env.example`, `.env.production.example`, `CLAUDE.md`, docs, or actual config files where the variable **names** appear — no actual values. If you see something like `CODE_SIGNING_SECRET=abc123def456...`, that's a real leak.

- [ ] **Step 4: Verify `.env*` files are in `.gitignore`**

```bash
grep -E '^\.env' .gitignore
```

Expected: shows `.env`, `.env.local`, `.env.*.local` — meaning live env files can't be committed. Confirm there are no `.env` files currently tracked:

```bash
git ls-files | grep -E '\.env$|\.env\.local$'
```

Expected: empty output (no tracked env files).

- [ ] **Step 5: Verify `.env.example` and `.env.production.example` contain only placeholders**

```bash
cat .env.example .env.production.example 2>/dev/null | grep -iE '=' | grep -vE '=$|=<|=example|=your-|=changeme|=placeholder|=\\$' | head -20
```

Expected: output should be empty or clearly placeholder-like. Any line that looks like a real secret (long random strings, base64 values, real URLs with credentials) is a red flag — investigate each.

- [ ] **Step 6: No commit. This is a gate, not a deliverable.**

If every step above passed cleanly, the repo is safe to flip public. If anything failed, stop and resolve before proceeding.

---

## Task 16: Historical identity rewrite (OPTIONAL — user decision gate)

**Files:** (rewrites git history — destructive, requires user go-ahead)

The existing git history has ~20+ commits authored by `givey420 <afk.givey@protonmail.com>` with `Co-Authored-By: Claude` trailers. Once the repo is public, that history is permanently visible.

**This task is OPTIONAL and requires explicit user approval before running.** Skip it if the user decides the history is fine as-is.

- [ ] **Step 0: User confirms they want to rewrite history**

Do not proceed without explicit "yes rewrite" from the user. If they say skip, jump to Task 17.

- [ ] **Step 1: Install git-filter-repo if not present**

```bash
pip install git-filter-repo
```

Or download from https://github.com/newren/git-filter-repo.

- [ ] **Step 2: Back up the repo before rewriting**

```bash
cd ..
cp -r donuttrade donuttrade-backup-before-rewrite
cd donuttrade
```

If anything goes wrong, `donuttrade-backup-before-rewrite/.git` is your escape hatch.

- [ ] **Step 3: Create a mailmap file**

Write a temp file `.mailmap-rewrite`:

```
givey999 <afk.givey@gmail.com> givey420 <afk.givey@protonmail.com>
givey999 <afk.givey@gmail.com> givey420 <afk.givey@gmail.com>
```

- [ ] **Step 4: Rewrite author + email in history**

```bash
git filter-repo --mailmap .mailmap-rewrite
```

Expected: filter-repo reports the number of commits rewritten.

- [ ] **Step 5: Strip `Co-Authored-By: Claude` trailers from all commit messages**

```bash
git filter-repo --message-callback '
return re.sub(rb"\nCo-Authored-By: Claude[^\n]*\n?", b"\n", message).rstrip() + b"\n"
' --force
```

(`--force` is required because filter-repo refuses to run twice on the same repo without it.)

- [ ] **Step 6: Verify**

```bash
git log --format="%an <%ae>" | sort -u
```

Expected: only `givey999 <afk.givey@gmail.com>` appears. No more `givey420` or protonmail.

```bash
git log --grep="Co-Authored-By: Claude" --oneline
```

Expected: empty output — no commits with the trailer.

- [ ] **Step 7: Force-push the rewritten history to the private remote**

```bash
git push --force-with-lease origin main
```

Note: `--force-with-lease` is safer than `--force` — it refuses the push if the remote has commits you haven't seen. Use this to avoid accidentally clobbering concurrent work.

- [ ] **Step 8: Clean up the mailmap file**

```bash
rm .mailmap-rewrite
```

(No commit needed — it's not tracked.)

- [ ] **Step 9: Remove backup once you're confident**

```bash
rm -rf ../donuttrade-backup-before-rewrite
```

Only do this after verifying the rewritten history is correct in Steps 6 and 7.

---

## Task 17: Flip the repo to public

**Files:** (GitHub operation, no file changes)

This is the irreversible one-way-door. Only proceed if Task 15 passed cleanly (and Task 16 ran if the user opted in).

- [ ] **Step 1: Final pre-public check — review what ships**

```bash
git log --oneline | head -20
git ls-files | wc -l
git ls-files | grep -iE '\.env$|credential|secret|token|key' | grep -v 'example'
```

Last command should be empty. Any files matching suspicious patterns (outside examples) must be audited before proceeding.

- [ ] **Step 2: Push all local commits to `origin/main`**

```bash
git push origin main
```

Expected: commits from this plan are now on the private remote.

- [ ] **Step 3: Flip visibility via GitHub CLI**

```bash
gh repo edit givey999/donuttrade --visibility public --accept-visibility-change-consequences
```

Expected: the repo is now public at https://github.com/givey999/donuttrade.

**If `gh` is not installed**, do it manually in the GitHub web UI: Settings → General → Danger Zone → Change visibility → Make public.

- [ ] **Step 4: Set repo metadata**

```bash
gh repo edit givey999/donuttrade \
  --description "Secure escrow trading platform for DonutSMP — source-available under FSL 1.1" \
  --homepage "https://donuttrade.com" \
  --add-topic minecraft \
  --add-topic escrow \
  --add-topic donutsmp \
  --add-topic fsl-1-1 \
  --add-topic nextjs \
  --add-topic fastify
```

- [ ] **Step 5: Verify visibility**

Open https://github.com/givey999/donuttrade in an incognito window. You should see the repo listing, README, LICENSE, and commit history. If you get a 404, GitHub is still propagating — wait a minute and retry.

- [ ] **Step 6: Confirm the `/transparency` github link now resolves**

Back on the site (either locally or production if deployed), click the GitHub link in the transparency page's NOW SOURCE-OPEN section. It should open the now-public repo, no 404.

- [ ] **Step 7: No commit — this task is a GitHub-side operation only.**

---

## Task 18: Final verification

**Files:** (no changes — final smoke test)

- [ ] **Step 1: Clean install and build**

```bash
pnpm install
pnpm --filter @donuttrade/web build
```

Expected: no errors.

- [ ] **Step 2: Linter**

```bash
pnpm --filter @donuttrade/web lint
```

Expected: no errors. Warnings about unused imports or `any` types are fine as long as they don't block.

- [ ] **Step 3: Git log sanity check**

```bash
git log --format="%h %an %ae | %s" -20
```

Expected: the most recent ~15 commits should all be authored `givey999 afk.givey@gmail.com`, none with Claude trailers, matching the existing `feat(web):` / `docs:` / `chore:` style.

- [ ] **Step 4: Close out**

All tasks complete. The landing is redesigned, the `/transparency` page is live, and the repo is public under FSL 1.1. Open follow-ups (from the spec):

- Real audit log endpoint (`GET /public/audit-log-sample`)
- License auto-open countdown widget
- Recent commits feed on `/transparency`
- Site-wide "bot" → "account" copy sweep (dashboard, admin, onboarding)
- Per-release LICENSE change-date refresh

None of these block the current work. File them as issues on the now-public repo.
