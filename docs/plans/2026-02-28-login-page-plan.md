# DonutTrade Login Page Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Initialize the Next.js frontend in `packages/web/` and build a dark-themed login page with Microsoft OAuth.

**Architecture:** Next.js 15 App Router with Tailwind CSS v4 in the existing pnpm monorepo. The login page is a simple centered card that redirects to the Fastify API's `/auth/microsoft` endpoint. A callback page handles the post-OAuth redirect.

**Tech Stack:** Next.js 15, React 19, Tailwind CSS v4, TypeScript, pnpm workspaces

---

## Task 1: Initialize Next.js in packages/web/

**Files:**
- Rewrite: `packages/web/package.json`
- Create: `packages/web/next.config.ts`
- Create: `packages/web/tsconfig.json`
- Create: `packages/web/.env.local`
- Create: `packages/web/postcss.config.mjs`

**Step 1: Initialize Next.js project**

Replace `packages/web/package.json` with:

```json
{
  "name": "@donuttrade/web",
  "version": "1.0.0",
  "description": "DonutTrade web frontend",
  "private": true,
  "scripts": {
    "dev": "next dev --port 3000",
    "build": "next build",
    "start": "next start --port 3000",
    "lint": "next lint"
  },
  "dependencies": {
    "next": "^15.3.2",
    "react": "^19.1.0",
    "react-dom": "^19.1.0"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4.1.7",
    "@types/node": "^22.0.0",
    "@types/react": "^19.1.0",
    "@types/react-dom": "^19.1.0",
    "tailwindcss": "^4.1.7",
    "typescript": "^5.3.0"
  }
}
```

**Step 2: Create config files**

`packages/web/next.config.ts`:
```ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {};

export default nextConfig;
```

`packages/web/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

`packages/web/.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

`packages/web/postcss.config.mjs`:
```js
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
```

**Step 3: Install dependencies**

Run: `cd packages/web && pnpm install`

**Step 4: Commit**

```bash
git add packages/web/package.json packages/web/next.config.ts packages/web/tsconfig.json packages/web/.env.local packages/web/postcss.config.mjs packages/web/pnpm-lock.yaml
git commit -m "feat(web): initialize Next.js 15 with Tailwind CSS v4"
```

---

## Task 2: Root layout and global styles

**Files:**
- Create: `packages/web/app/globals.css`
- Create: `packages/web/app/layout.tsx`

**Step 1: Create global CSS with Tailwind import and dark theme**

`packages/web/app/globals.css`:
```css
@import "tailwindcss";
```

**Step 2: Create root layout**

`packages/web/app/layout.tsx`:
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

**Step 3: Verify dev server starts**

Run: `cd packages/web && pnpm dev`
Expected: Server starts on http://localhost:3000 (will show 404, that's fine — no pages yet)
Kill the dev server after verifying.

**Step 4: Commit**

```bash
git add packages/web/app/globals.css packages/web/app/layout.tsx
git commit -m "feat(web): add root layout with dark theme and Tailwind"
```

---

## Task 3: Login button component

**Files:**
- Create: `packages/web/components/auth/login-button.tsx`

**Step 1: Create the reusable OAuth login button**

`packages/web/components/auth/login-button.tsx`:
```tsx
import type { ReactNode } from 'react';

interface LoginButtonProps {
  href: string;
  icon: ReactNode;
  label: string;
  className?: string;
}

export function LoginButton({ href, icon, label, className = '' }: LoginButtonProps) {
  return (
    <a
      href={href}
      className={`flex w-full items-center justify-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors ${className}`}
    >
      {icon}
      {label}
    </a>
  );
}
```

**Step 2: Commit**

```bash
git add packages/web/components/auth/login-button.tsx
git commit -m "feat(web): add reusable LoginButton component"
```

---

## Task 4: Microsoft icon component

**Files:**
- Create: `packages/web/components/icons/microsoft.tsx`

**Step 1: Create Microsoft logo SVG component**

`packages/web/components/icons/microsoft.tsx`:
```tsx
export function MicrosoftIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 21 21" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="1" y="1" width="9" height="9" fill="#F25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
      <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
      <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
    </svg>
  );
}
```

**Step 2: Commit**

```bash
git add packages/web/components/icons/microsoft.tsx
git commit -m "feat(web): add Microsoft icon SVG component"
```

---

## Task 5: Login page

**Files:**
- Create: `packages/web/app/login/page.tsx`

**Step 1: Create the login page**

`packages/web/app/login/page.tsx`:
```tsx
import { LoginButton } from '@/components/auth/login-button';
import { MicrosoftIcon } from '@/components/icons/microsoft';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight">DonutTrade</h1>
          <p className="mt-2 text-sm text-neutral-400">
            Minecraft trading escrow platform
          </p>
        </div>

        {/* Login card */}
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-6 shadow-lg backdrop-blur-sm">
          <h2 className="mb-6 text-center text-lg font-semibold">Sign in</h2>

          {/* Microsoft OAuth */}
          <LoginButton
            href={`${API_URL}/auth/microsoft?redirect=${encodeURIComponent('/auth/callback')}`}
            icon={<MicrosoftIcon />}
            label="Sign in with Microsoft"
            className="bg-[#2f2f2f] text-white hover:bg-[#3a3a3a] border border-neutral-700"
          />

          {/* Future auth methods divider */}
          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-neutral-800" />
            <span className="text-xs text-neutral-500">more coming soon</span>
            <div className="h-px flex-1 bg-neutral-800" />
          </div>

          {/* Placeholder for future methods */}
          <div className="space-y-3">
            <button
              disabled
              className="flex w-full cursor-not-allowed items-center justify-center gap-3 rounded-lg border border-neutral-800 bg-neutral-800/30 px-4 py-3 text-sm text-neutral-600"
            >
              Discord (coming soon)
            </button>
            <button
              disabled
              className="flex w-full cursor-not-allowed items-center justify-center gap-3 rounded-lg border border-neutral-800 bg-neutral-800/30 px-4 py-3 text-sm text-neutral-600"
            >
              Email &amp; Password (coming soon)
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
```

**Step 2: Verify visually**

Run: `cd packages/web && pnpm dev`
Open: http://localhost:3000/login
Expected: Dark page with centered card, "DonutTrade" title, Microsoft sign-in button, two disabled placeholders.

**Step 3: Commit**

```bash
git add packages/web/app/login/page.tsx
git commit -m "feat(web): add login page with Microsoft OAuth button"
```

---

## Task 6: Auth callback page

**Files:**
- Create: `packages/web/app/auth/callback/page.tsx`

**Step 1: Create the callback page**

This page handles the redirect back from the API after OAuth completes. The API currently returns JSON (Phase 1), but this page is ready for when the API redirects with query params.

`packages/web/app/auth/callback/page.tsx`:
```tsx
'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import Link from 'next/link';

function CallbackContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get('error');
  const success = searchParams.get('success');

  if (error) {
    return (
      <div className="rounded-xl border border-red-900/50 bg-red-950/20 p-6 text-center">
        <h2 className="text-lg font-semibold text-red-400">Authentication failed</h2>
        <p className="mt-2 text-sm text-neutral-400">{error}</p>
        <Link
          href="/login"
          className="mt-4 inline-block rounded-lg bg-neutral-800 px-4 py-2 text-sm hover:bg-neutral-700 transition-colors"
        >
          Try again
        </Link>
      </div>
    );
  }

  if (success) {
    return (
      <div className="rounded-xl border border-green-900/50 bg-green-950/20 p-6 text-center">
        <h2 className="text-lg font-semibold text-green-400">Signed in successfully</h2>
        <p className="mt-2 text-sm text-neutral-400">Redirecting to dashboard...</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-6 text-center">
      <h2 className="text-lg font-semibold">Completing sign-in...</h2>
      <p className="mt-2 text-sm text-neutral-400">Please wait while we verify your account.</p>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <Suspense
          fallback={
            <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-6 text-center">
              <p className="text-sm text-neutral-400">Loading...</p>
            </div>
          }
        >
          <CallbackContent />
        </Suspense>
      </div>
    </main>
  );
}
```

**Step 2: Commit**

```bash
git add packages/web/app/auth/callback/page.tsx
git commit -m "feat(web): add OAuth callback page with success/error states"
```

---

## Task 7: Root page redirect and root-level scripts

**Files:**
- Create: `packages/web/app/page.tsx`
- Modify: `packages/web/package.json` (already done in Task 1)
- Modify: `R:\miau\package.json` — add web dev/build scripts

**Step 1: Create root page that redirects to /login**

`packages/web/app/page.tsx`:
```tsx
import { redirect } from 'next/navigation';

export default function Home() {
  redirect('/login');
}
```

**Step 2: Add web scripts to root package.json**

In `R:\miau\package.json`, add to `scripts`:
```json
"dev:web": "pnpm --filter @donuttrade/web dev",
"build:web": "pnpm --filter @donuttrade/web build"
```

**Step 3: Verify full flow**

Run: `cd packages/web && pnpm dev`
- Open http://localhost:3000 → should redirect to /login
- Login page renders with Microsoft button
- Microsoft button links to `http://localhost:3001/auth/microsoft?redirect=%2Fauth%2Fcallback`
- Open http://localhost:3000/auth/callback?error=test → shows error state
- Open http://localhost:3000/auth/callback?success=true → shows success state

**Step 4: Commit**

```bash
git add packages/web/app/page.tsx package.json
git commit -m "feat(web): add root redirect and monorepo web scripts"
```

---

## Task 8: Update Caddyfile and docker-compose for frontend

**Files:**
- Modify: `Caddyfile`
- Modify: `docker-compose.yml`

**Step 1: Update Caddyfile to route to both API and frontend**

Replace the `moldo.go.ro:9443` block in `Caddyfile` to route `/auth/*` and `/api/*` to the API, everything else to the web frontend:

```caddy
moldo.go.ro:9443 {
    # API routes
    handle /auth/* {
        reverse_proxy api:3001
    }

    # Future: explicit /api/* prefix
    handle /api/* {
        reverse_proxy api:3001
    }

    # Frontend
    handle {
        reverse_proxy web:3000
    }

    encode gzip

    log {
        output stdout
        format console
    }
}
```

**Step 2: Add web service to docker-compose.yml**

Add after the `api` service:

```yaml
  # Web Frontend
  web:
    build:
      context: .
      dockerfile: packages/web/Dockerfile
    container_name: donuttrade-web
    environment:
      - NODE_ENV=production
      - NEXT_PUBLIC_API_URL=https://moldo.go.ro:9443
    depends_on:
      - api
    restart: unless-stopped
```

**Step 3: Create a basic Dockerfile for the web package**

Create `packages/web/Dockerfile`:
```dockerfile
FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/web/package.json packages/web/
RUN pnpm --filter @donuttrade/web install --frozen-lockfile

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/web/node_modules ./packages/web/node_modules
COPY packages/web/ packages/web/
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm --filter @donuttrade/web build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/packages/web/.next/standalone ./
COPY --from=builder /app/packages/web/.next/static ./packages/web/.next/static
COPY --from=builder /app/packages/web/public ./packages/web/public
EXPOSE 3000
CMD ["node", "packages/web/server.js"]
```

Note: The standalone output requires `output: 'standalone'` in next.config.ts. Update:

`packages/web/next.config.ts`:
```ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
};

export default nextConfig;
```

**Step 4: Commit**

```bash
git add Caddyfile docker-compose.yml packages/web/Dockerfile packages/web/next.config.ts
git commit -m "feat: add web service to Caddy routing and Docker setup"
```

---

## Summary

| Task | What | Files |
|------|------|-------|
| 1 | Init Next.js + Tailwind | package.json, configs |
| 2 | Root layout + dark theme | layout.tsx, globals.css |
| 3 | LoginButton component | login-button.tsx |
| 4 | Microsoft icon | microsoft.tsx |
| 5 | Login page | login/page.tsx |
| 6 | Callback page | auth/callback/page.tsx |
| 7 | Root redirect + monorepo scripts | page.tsx, root package.json |
| 8 | Caddy + Docker setup | Caddyfile, docker-compose, Dockerfile |
