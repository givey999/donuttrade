# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Install all workspace dependencies
pnpm install

# Development (local)
docker compose up -d                  # Start all services (dev)
docker compose logs -f                # Follow all logs
docker compose logs -f api            # Follow one service

# Production (on Droplet)
docker compose -f docker-compose.yml -f docker-compose.production.yml up -d --build

# Individual packages
pnpm --filter @donuttrade/api dev     # API with hot reload
pnpm --filter @donuttrade/web dev     # Web with hot reload
pnpm --filter @donuttrade/api db:generate  # Regenerate Prisma client
```

## Architecture

DonutTrade is a Minecraft trading platform. Players deposit/withdraw in-game money and items, then trade on a web marketplace. The system has 5 services orchestrated with Docker Compose.

### Services

| Service | Package | Port | Description |
|---------|---------|------|-------------|
| **API** | `packages/api/` | 3001 | Fastify REST API, Prisma ORM, PostgreSQL + Redis |
| **Web** | `packages/web/` | 3000 | Next.js 15 frontend (App Router, React 19, Tailwind) |
| **MC-Bot** | `packages/mc-bot/` | — | Mineflayer bot: payment verification, deposits, withdrawals |
| **Management-Bot** | `packages/management-bot/` | — | Discord.js bot: tickets, notifications, role assignment |
| **Caddy** | `Caddyfile` | 443/80 | Reverse proxy, auto Let's Encrypt TLS |

**Shared types** live in `packages/shared/` (TypeScript types + constants).

### Data Flow

```
User Browser ──→ Caddy ──→ Web (Next.js)     ← pages, SSR
                   │
                   └──→ API (Fastify)         ← JSON, SSE
                         │
               ┌─────────┼─────────┐
               ▼         ▼         ▼
           PostgreSQL   Redis    MC-Bot ──→ Minecraft Server
                         │
                         └──→ Management-Bot ──→ Discord
```

### Key Patterns

- **Internal routes** (`/internal/*`): Bot-to-API communication, authenticated with `BOT_WEBHOOK_SECRET` Bearer token. NOT exposed through Caddy — bots call `http://api:3001` directly on Docker network.
- **Content-Type routing**: Caddy routes `application/json` requests to API, everything else to Web frontend. No `/api/` prefix needed.
- **Event system**: Redis Pub/Sub for real-time notifications. API publishes, Management-Bot subscribes for Discord DMs, Web uses SSE (`/events/stream`).
- **Code signing**: Deposit/withdrawal codes use HMAC-SHA256 (`CODE_SIGNING_SECRET`).

### Database

PostgreSQL 16 via Prisma ORM. Schema at `packages/api/prisma/schema.prisma`.

Key tables: `users`, `sessions`, `transactions`, `withdrawals`, `catalog_items`, `inventory_items`, `item_deposits`, `item_withdrawals`, `orders`, `order_fills`, `audit_logs`, `platform_settings`, `user_cosmetics`.

### Configuration

Environment variables loaded from `.env` at project root. Templates:
- `.env.example` — local development (moldo.go.ro:9443)
- `.env.production.example` — production (donuttrade.com)

Config validated with Zod on startup (`packages/api/src/config/index.ts`).

### Deployment

- **Domain:** `donuttrade.com` (Namecheap)
- **Hosting:** DigitalOcean Droplet (Ubuntu 24.04, Docker Compose)
- **Dev domain:** `moldo.go.ro:9443` (local testing)
- **Production config:** `docker-compose.production.yml` overrides + `Caddyfile.production`
- **Deploy plan:** `docs/superpowers/plans/2026-03-30-digitalocean-deployment.md`
- **Repo:** GitHub (`givey999/donuttrade`), source-available under FSL 1.1

### Legacy Bot

The `src/` directory contains the original standalone Minecraft chat bot (pre-platform). It is superseded by `packages/mc-bot/` but kept for reference. The `ecosystem.config.js` (PM2) is for this legacy bot only.
