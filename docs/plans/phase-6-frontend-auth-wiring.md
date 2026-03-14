# Plan: Wire Up Frontend Auth Layer (Phase 6 completion)

## Context

The DonutTrade backend has a complete auth system (Microsoft OAuth → payment verification → JWT sessions), but the frontend can't actually use it. The `/auth/callback` page stores an access token to `localStorage` and then... nothing. No page reads it back, no API calls send it, and `/dashboard` (the post-login destination) doesn't exist. This plan connects the frontend to the backend so the platform is usable end-to-end.

## Scope (7 files, ~100 minutes)

| # | File | Action | What |
|---|------|--------|------|
| 1 | `packages/api/src/routes/auth/session.ts` | **Edit** | Fix `POST /auth/refresh` to read refresh token from httpOnly cookie |
| 2 | `packages/web/package.json` | **Edit** | Add `@donuttrade/shared` workspace dependency |
| 3 | `packages/web/lib/api.ts` | **Create** | Fetch wrapper with Bearer header + auto-refresh on 401 |
| 4 | `packages/web/lib/auth.tsx` | **Create** | React context + `useAuth()` hook |
| 5 | `packages/web/lib/require-auth.tsx` | **Create** | Route protection wrapper component |
| 6 | `packages/web/app/layout.tsx` | **Edit** | Wrap children in `<AuthProvider>` |
| 7 | `packages/web/app/auth/callback/page.tsx` | **Edit** | Redirect to `/dashboard` after storing token |
| 8 | `packages/web/app/dashboard/page.tsx` | **Create** | Basic profile/balance page with logout button |

---

## Step 1 — Backend fix: cookie fallback for refresh endpoint

**File:** `packages/api/src/routes/auth/session.ts` (lines 48-58)

**Problem:** `POST /auth/refresh` requires `{ refreshToken }` in the JSON body, but the refresh token lives in an httpOnly cookie (`dt_refresh_token`) that JavaScript can't read. The frontend literally cannot call this endpoint.

**Fix:** Read from cookie if body is empty. ~3 lines changed:

```ts
// BEFORE (line 51):
const { refreshToken } = request.body || {};

// AFTER:
const refreshToken =
  (request.body as { refreshToken?: string } | null)?.refreshToken
  ?? request.cookies?.['dt_refresh_token'];
```

Also change the type annotation from `Body: { refreshToken: string }` to `Body: { refreshToken?: string }` so Fastify doesn't reject empty bodies.

`request.cookies` is already available — `@fastify/cookie` is registered in `packages/api/src/index.ts`.

---

## Step 2 — Add shared dependency to web package

**File:** `packages/web/package.json`

Add to `"dependencies"`:
```json
"@donuttrade/shared": "workspace:*"
```

Then run `pnpm install` from repo root. This gives the frontend access to `UserProfile`, `ApiResponse<T>`, etc.

---

## Step 3 — Create `packages/web/lib/api.ts`

Authenticated fetch wrapper. No `'use client'` needed — it's a plain TS module.

**Key behaviors:**
- Module-level `_accessToken` variable (in-memory singleton shared across all callers)
- `setAccessToken(token)` / `clearAccessToken()` to control token lifecycle
- `apiFetch<T>(path, init)` — attaches `Authorization: Bearer` header automatically
- On `401` with error code `TOKEN_EXPIRED`: calls `POST /auth/refresh` with `credentials: 'include'` (empty body — the httpOnly cookie carries the refresh token thanks to Step 1), saves the new access token, retries the original request once
- If refresh also fails: throws `ApiError` with code `REFRESH_FAILED` so the auth context can redirect to `/login`
- Keeps localStorage and in-memory token in sync at every mutation point

---

## Step 4 — Create `packages/web/lib/auth.tsx`

React context providing `{ user, loading, isAuthenticated, logout }`.

**`AuthProvider` behavior:**
- On mount: reads `localStorage.getItem('dt_access_token')`, calls `setAccessToken()`, then `apiFetch<UserProfile>('/auth/me')` to validate and hydrate user
- If token is expired, `apiFetch` transparently refreshes (Step 3 handles this)
- If refresh fails: clears token, sets `user = null`, redirects to `/login`
- `logout()`: calls `POST /auth/logout` (best-effort), clears localStorage + in-memory token, redirects to `/login`

**`useAuth()` hook:** throws if used outside `<AuthProvider>`.

---

## Step 5 — Create `packages/web/lib/require-auth.tsx`

Small `'use client'` wrapper component:
- Reads `useAuth()`
- While `loading`: shows a centered "Loading..." spinner
- If `!user` after loading: `router.push('/login')`
- If authenticated: renders `children`

Used by dashboard and any future protected pages.

---

## Step 6 — Update root layout

**File:** `packages/web/app/layout.tsx`

Add `import { AuthProvider } from '@/lib/auth'` and wrap `{children}` in `<AuthProvider>`. The layout stays a Server Component — Next.js handles the client component boundary automatically.

---

## Step 7 — Update callback page

**File:** `packages/web/app/auth/callback/page.tsx`

Two changes to the success branch:
1. Call `setAccessToken(token)` from `@/lib/api` (hydrates in-memory store immediately)
2. Call `router.push('/dashboard')` to redirect instead of staying on the "Welcome" dead-end

---

## Step 8 — Create dashboard page

**File:** `packages/web/app/dashboard/page.tsx`

Wrapped in `<RequireAuth>`. Shows:
- Player's Minecraft username as heading
- Verification status badge (green "Verified" / amber "Pending")
- Balance display
- Auth provider + member since
- Sign out button

Matches existing design language: dark cards, `rounded-xl border-neutral-800`, green accents for money/success.

---

## Verification

After implementing, test the full flow:

1. `pnpm install` from repo root (links shared package)
2. `pnpm --filter @donuttrade/shared build` (compile shared types)
3. Start the stack: `docker compose up` (or dev mode for API + web)
4. Go to `/login` → click "Sign in with Microsoft"
5. After OAuth, should land on `/dashboard` (not stuck on callback page)
6. Dashboard should show username, balance, verification status
7. Click "Sign out" → should redirect to `/login`
8. Go to `/dashboard` directly while logged out → should redirect to `/login`
9. Close tab, reopen `/dashboard` → should still be logged in (localStorage token + auto-refresh)
