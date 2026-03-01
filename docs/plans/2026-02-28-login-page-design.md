# DonutTrade Login Page Design

**Date:** 2026-02-28
**Status:** Approved

## Overview

A login page for the DonutTrade platform, initializing the Next.js frontend (`packages/web/`) with Microsoft OAuth as the first sign-in method. Future auth methods (Discord, email/password) will be added later.

## Decisions

- **Framework:** Next.js 15, App Router
- **Styling:** Tailwind CSS v4, dark gaming theme
- **OAuth flow:** Direct redirect (click button -> navigate to API -> Microsoft -> callback)
- **No client-side state management** — just a static page with an OAuth link
- **API URL** configurable via `NEXT_PUBLIC_API_URL` env var (default `http://localhost:3001`)

## Architecture

```
packages/web/
├── app/
│   ├── layout.tsx              # Root layout (dark theme, fonts)
│   ├── page.tsx                # Redirect to /login
│   ├── login/
│   │   └── page.tsx            # Login page
│   └── auth/
│       └── callback/
│           └── page.tsx        # Post-OAuth landing (success/error)
├── components/
│   └── auth/
│       └── login-button.tsx    # Reusable OAuth button component
├── tailwind.config.ts
├── next.config.ts
├── package.json
└── tsconfig.json
```

## Login Page Layout

Centered card on dark background (`~#0a0a0f`):

1. DonutTrade logo/title
2. "Sign in to DonutTrade" heading
3. "Sign in with Microsoft" button (Microsoft brand blue, Microsoft icon)
4. Divider with "More sign-in methods coming soon"
5. Placeholder space for future Discord + email/password

Responsive — works on mobile and desktop.

## Data Flow

1. User visits `/login`
2. Clicks "Sign in with Microsoft"
3. Browser navigates to `{API_URL}/auth/microsoft?redirect=/auth/callback`
4. API creates CSRF state, redirects to Microsoft
5. User authenticates with Microsoft
6. Microsoft redirects to API `/auth/microsoft/callback`
7. API processes tokens, sets cookies, redirects to frontend `/auth/callback?success=true` (or `?error=...`)
8. Callback page reads result, redirects to dashboard or shows error

## API Contract

Existing endpoints (no changes needed):

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/auth/microsoft` | GET | Initiate OAuth (accepts `?redirect=` param) |
| `/auth/microsoft/callback` | GET | Handle OAuth callback from Microsoft |
| `/auth/me` | GET | Get current user (requires JWT) |
| `/auth/refresh` | POST | Refresh access token |
| `/auth/logout` | POST | Logout current session |

## Environment Variables

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```
