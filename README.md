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
