---
name: Landing + Transparency Redesign + Repo Opening
date: 2026-04-14
status: proposed
---

# Landing + Transparency Redesign + Repo Opening

## Summary

Three pieces of work, one spec, one PR:

1. **Rewrite the landing page** (`packages/web/app/(landing)/page.tsx`) in a new "V2 Terminal Display" visual identity — VT323 headlines, blinking purple block cursors, monospace section labels, no fake stats.
2. **Add a new `/transparency` page** documenting exactly how escrow, audits, and admin accountability work, including a link to the newly public source code.
3. **Open-source the repo** at `github.com/givey999/donuttrade` under **FSL 1.1** (2-year term, future license Apache 2.0).

The three are bundled because they share a narrative: replace "trust us" marketing with "verify us" infrastructure. Splitting them into separate PRs would leave the landing page pointing at a `/transparency` link that doesn't exist, or a transparency page referencing a repo that isn't public.

## Motivation

- **Current landing reads as AI-generated boilerplate.** Violet-on-black, glow hero, three trust cards, fake live stats, generic copy — matches every other indie SaaS dark template. A distinctive visual identity is essential for a product whose entire value prop is "trust."
- **Zero users today means we can't fake social proof.** Instead of inventing "147 active orders" and "23 filled / hour," we lean the opposite way: no stats at all, but a radically transparent explanation of exactly how the system works, backed by public source.
- **Open source as the trust signal.** A skeptical Minecraft player can't be convinced by marketing copy. They *can* be convinced by clicking through to a `/transparency` page that quotes real function names, then clicking through to GitHub and seeing those function names in the source.
- **Narrative handle for "how do we know you're legit":** send them to `/transparency`, let them verify.

## Non-goals

- Not changing the logged-in app (dashboard, marketplace, orders, admin). Only the public landing + a new transparency page.
- Not shipping a real-time live-data component on day 1 (no streaming order book, no live audit log query). Those are on the follow-up list.
- Not changing the palette, the brand name, the URL structure, or the auth flow.
- Not migrating to Tailwind v4, shadcn/ui, or any other framework change.
- Not a CMS. Transparency copy is hardcoded in the TSX file.
- Not open-sourcing the Caddy configs, the `.env.production.example` with hostnames, the Discord bot tokens, or anything else that would require rotation post-publication. See "Pre-public safety audit."

## Visual direction reference

Final mockup: `.superpowers/brainstorm/569-1776182293/content/full-page-v2-r4.html`
(Open http://localhost:52216 while the brainstorm server is running to preview.)

## 1 · Landing page redesign

### Section order
1. Nav
2. Hero
3. How it works
4. Why trust us
5. Still skeptical?
6. Final CTA
7. Footer

No stats strip. No marketplace preview.

### Typography
- **VT323** — headlines, section titles, logo wordmark, step numbers, footer status line
- **Inter** — body copy, kicker pills, button labels, secondary text
- Both loaded via `next/font/google` in `packages/web/app/layout.tsx` so every route has access without per-page imports

### Palette (unchanged from current)
| Token | Hex | Use |
|---|---|---|
| bg | `#0a0a0f` | Page background |
| border | `#1a1a1f`, `#2a2a30` | Card/section borders |
| text-primary | `#ffffff`, `#e5e7eb` | Headlines, primary text |
| text-secondary | `#737380`, `#8a8a94` | Body text |
| text-tertiary | `#6b7280`, `#4b5563` | Labels, placeholders |
| violet | `#7c3aed` | Primary brand, CTAs, cursor |
| violet-hover | `#a78bfa` | Accent, outlines, section labels |
| online | `#10b981` | Status dot (used sparingly — no fake liveness) |

### Shared components to extract
All new files live in `packages/web/components/landing/`:

- `<StarField density="hero" | "subtle">` — decorative floating purple particles. Used in hero and final CTA. Replaces the inline `<Particle>` sub-components in the current landing. **Check first** whether the existing `packages/web/components/background-stars.tsx` is reusable or needs replacement.
- `<PixelLogo size={n}>` — 8×8 CSS-grid donut mark. Used in nav and the OG image generator. **Check first** whether `packages/web/components/sparkle-logo.tsx` is the same thing or should be replaced.
- `<SectionLabel>` — small VT323 label like `// how_it_works.sh`
- `<SectionTitle>` — large VT323 heading
- `<TerminalCursor>` — blinking purple block cursor (reused in hero, step numbers, final CTA)

### Copy — verbatim

**Nav**
- Logo: pixel donut mark + `DONUTTRADE` wordmark in VT323 22px
- CTA: `Start Trading` (existing `ctaHref` logic — logged-in → `/dashboard`, logged-out → `/login`)

**Hero**
- Kicker pill: `DONUTSMP · ESCROW TRADING`
- H1: `TRADE SAFELY` / `ON DONUTSMP_` (two lines, "DONUTSMP" in violet, blinking cursor after)
- Subtitle: `Instant Item Swaps · Escrow Protected` (no green dot, no fake stats)
- Primary CTA: `Start Trading →`
- Secondary CTA: `View Marketplace` (ghost, links to `/marketplace`)

**How it works**
- Section label: `// how_it_works.sh`
- H2: `THREE STEPS`
- Subtitle: `Deposit · Trade · Withdraw`
- Card 1: `01_` `DEPOSIT` — "Send items to our account in-game. Your inventory is tracked and secured automatically."
- Card 2: `02_` `TRADE` — "Buy and sell on the marketplace. Funds are held in escrow until the order fills."
- Card 3: `03_` `WITHDRAW` — "Collect your items in-game. An admin confirms delivery and you're done."

**Why trust us**
- Section label: `// trust.log`
- H2: `WHY TRUST US`
- Subtitle: `Built from the ground up for safe trading`
- Card 1 (pixel lock icon): `ESCROW LOCKED` — "Every trade is backed by escrow. Funds and items are held until both sides fulfill — no scams."
- Card 2 (pixel check icon): `VERIFIED` — "All traders are verified through Microsoft authentication linked to their Minecraft account."
- Card 3 (pixel eye icon): `MONITORED` — "Our admin team reviews every deposit, withdrawal, and trade. Full audit trail on every action."

**Still skeptical**
- Section label: `// skeptical.check`
- H2: `STILL SKEPTICAL?` ("SKEPTICAL" in violet, blinking cursor after)
- Body: "**Good.** We wrote down exactly how escrow, audits, and admin approvals work — so you can verify instead of take our word for it."
- CTA: `> View Transparency Page` (outline button, VT323 font, violet border, links to `/transparency`)

**Final CTA**
- H2: `READY TO TRADE?` (blinking cursor)
- Subtitle: `Sign in with Microsoft · Start trading in seconds`
- CTA: `Start Trading →`

**Footer**
- Left: `donuttrade.com` (VT323, no fake "v2.0", no fake "online" dot)
- Right: `rules · transparency · terms · discord`

### "bot" → "our account"
Every instance of "bot" as user-facing copy on the landing page becomes "our account." This spec only covers the landing page. A separate future task can sweep the rest of the marketing copy site-wide if desired.

### Reduced motion
`prefers-reduced-motion: reduce` → particles freeze at opacity 0.2 with no animation. Cursor keeps blinking (it's semantic, not decorative). Carry forward the existing behavior from the current landing.

### Responsive
Breakpoint at ~700px:
- Hero H1: 78px → 52px
- Cursor height: 58px → 40px
- How-it-works / trust grids: 3 cols → 1 col
- Final CTA H2: 72px → 50px

### Files affected — landing
- **Rewrite**: `packages/web/app/(landing)/page.tsx`
- **Create**: `packages/web/components/landing/StarField.tsx`
- **Create**: `packages/web/components/landing/PixelLogo.tsx` (unless `sparkle-logo.tsx` can be reused)
- **Create**: `packages/web/components/landing/SectionLabel.tsx`
- **Create**: `packages/web/components/landing/SectionTitle.tsx`
- **Create**: `packages/web/components/landing/TerminalCursor.tsx`
- **Update**: `packages/web/app/layout.tsx` — add `next/font/google` loads for VT323 and Inter
- **Update**: `packages/web/components/footer.tsx` — restyle to terminal footer + add transparency link. Prefer restyling the existing footer so logged-in pages inherit the new look. Only create a separate `packages/web/components/landing/LandingFooter.tsx` if restyling would break the signed-in app chrome (implementer should check `rules`, `terms`, `dashboard`, `marketplace` for footer usage before deciding).

## 2 · `/transparency` page

### Route
Path: `packages/web/app/(app)/transparency/page.tsx`

Placed in the `(app)` route group for consistency with the existing `/rules` and `/terms` pages which are also public and live under `(app)`.

### Layout
Same shell as landing: dark background, shared nav (or unstyled marketing nav), terminal typography. Reuses `StarField` (subtle variant), `SectionLabel`, `SectionTitle`, `TerminalCursor`, `PixelLogo`.

### Sections

**Header**
- Kicker: `// sys.transparency`
- H1: `TRANSPARENCY_` with blinking cursor
- Tagline: "How escrow, audits, and admin accountability actually work."
- Star field (subtle variant) in background

**1 · Source code — announcement (opening section)**
- Section label: `// source.open`
- H2: `NOW SOURCE-OPEN`
- Body: "**We're happy to announce that DonutTrade is source-open.** The full platform — API, web frontend, bots, escrow logic, admin tooling — lives on GitHub under the Functional Source License (FSL 1.1). Every endpoint, every admin check, every cryptographic operation: all readable, all verifiable."
- Link: `→ github.com/givey999/donuttrade` (outline button, VT323 font, violet border)
- License subnote (small, tertiary text): "Available today for reading, learning, and non-commercial use. Auto-converts to Apache 2.0 two years after each release. See `LICENSE` in the repo for the exact terms."
- *Framing note*: this is the opening section of `/transparency` intentionally — it sets the tone that the rest of the page is "here's exactly what 'source-open' means in practice." Visually prominent: slightly larger H2, optional subtle violet glow behind the headline, generous padding above/below. The GitHub link should be the most clickable thing on the page at this point.

**2 · How we manage your data**
- Section label: `// data.policy`
- H2: `YOUR DATA`
- **Prominent callout above the grid** (violet-outlined box, full-width, single paragraph): "**We don't — and don't want to — store any passwords.** Sign-in goes through Microsoft OAuth. DonutTrade never sees your Microsoft password, and there is no DonutTrade password to set, forget, or leak."
- Four sub-blocks below the callout, laid out as a two-column grid on desktop (first two on left, last two on right) or stacked on mobile:

  **What we store**
  - Minecraft UUID + username (from Microsoft auth — proves you own the account)
  - Discord user ID (only if you link Discord for notifications)
  - Your server-side session token (short-lived, expires on logout)
  - Deposit, withdrawal, and trade history (required for the audit log)
  - Your current escrow inventory (required to know what's yours)
  - Notification preferences (DM opt-in / opt-out, etc.)

  **What we receive from Microsoft**
  - When you sign in with Microsoft, we receive your **Minecraft UUID** and **Minecraft username** — enough to prove you own the account.
  - We do **not** receive your Microsoft email, real name, profile picture, or any other Microsoft account data.
  - The Microsoft access token is used once at sign-in and never stored.

  **What we receive from Discord**
  - If you link Discord (optional, for DM notifications), we receive your **Discord user ID** and **username**. Nothing else.
  - We do not read your messages, your server list, your friend list, or any other Discord content.
  - You can unlink Discord at any time from `/dashboard`.

  **What we never touch**
  - Real names, addresses, phone numbers
  - Payment cards or real-money financial data — DonutTrade only handles in-game DonutSMP currency. We never custody fiat.
  - Browser fingerprints, tracking cookies, ad-targeting profiles
  - Your Microsoft password or account credentials (handled entirely by Microsoft)

- *Implementation note*: verify each claim above against `packages/api/prisma/schema.prisma` (user-related tables) and the actual OAuth scope requests in the Microsoft and Discord auth routes before shipping. If anything is stored that isn't listed here, either add it to the section or stop storing it. This section is the single most legally-sensitive part of the page — over-claim and you have a liability problem.

**3 · The escrow flow**
- Section label: `// escrow.flow`
- H2: `HOW AN ESCROW TRADE WORKS`
- Content: Sequential terminal trace styled as timestamped log lines. Target structure:
  ```
  [t=0]    buyer.submit_order(item=zombie_spawner, price=45000)
  [t=0.01] api.issue_code(order_id=42, hmac=sha256(order_id + CODE_SIGNING_SECRET))
  [t=0.02] escrow.lock_funds(buyer, amount=45000)
  [t=1h]   seller.submit_fill(order_id=42, code=<verified>)
  [t=1h]   escrow.verify_hmac(order_id, code) → OK
  [t=1h]   escrow.release_to_seller(amount=44100)   // -2% platform fee
  [t=1h]   escrow.deliver_item(buyer)
  [t=1h]   audit.log(action=trade_completed, order_id=42)
  ```
- Annotation below: "Every line above corresponds to a real function call. Grep `packages/api/src/` in the public repo to find them — starting with `packages/api/src/lib/deposit-code.ts` for the HMAC generation."
- *Implementation note*: the function names above are illustrative. During implementation, read the actual routes and update the trace to match real function names. Do not invent names that don't exist in code.

**4 · What admins can and can't do**
- Section label: `// admin.acl`
- H2: `ADMIN POWERS`
- Two columns:

  **Admins CAN:**
  - Approve deposits (verify items match the claimed amount)
  - Confirm withdrawals (deliver items in-game)
  - Resolve disputes (review audit log, render a decision)
  - Freeze accounts suspected of scamming
  - Adjust platform settings (fees, categories, limits)

  **Admins CANNOT:**
  - Move items a user didn't deposit
  - Edit or delete audit log rows (append-only)
  - Drain escrow without a matching order
  - See user passwords (stored as hashes)
  - Block a user's withdrawal on their own authority — all withdrawals require a recorded admin action

- *Implementation note*: verify each claim matches the actual RBAC in the admin routes before shipping. If a claim can't be verified in code, remove it or soften it.

**5 · The audit log (static mockup — day 1)**
- Section label: `// audit.log`
- H2: `EVERY ACTION IS LOGGED`
- Content: Static, terminal-table-styled mockup of an audit log. ~8 illustrative rows with realistic shape but clearly labeled "Example."
- Columns: `TIMESTAMP` · `USER` · `ACTION` · `TARGET` · `METADATA`
- Footnote: "The audit log is append-only at the database level. Admins — including the platform owner — cannot edit or delete rows. Your real activity lives at `/dashboard`."
- Inline comment in the TSX: `{/* TODO(followup): swap for real read-only query — see docs/superpowers/plans backlog */}`

**6 · Dispute process**
- Section label: `// dispute.flow`
- H2: `IF SOMETHING GOES WRONG`
- Numbered steps:
  1. Open a ticket in our Discord.
  2. An admin reviews the audit log for your account and the counterparty.
  3. Decision rendered within 24 hours.
  4. If you disagree, escalate to the platform owner in Discord — same 24-hour window.
  5. Chargebacks and refunds are paid from the platform's reserve, not from other users' escrow.
- *Implementation note*: confirm the "24 hours" claim is something the operator is willing to actually commit to. If not, soften to "usually within 24 hours" or "as quickly as we can."

**7 · The code signing math (collapsible)**
- Section label: `// crypto.math`
- H2: `HOW DEPOSIT CODES WORK` (collapsed by default, expandable — use a `<details>` element, no JS)
- Plain-English paragraph: "Deposit and withdrawal codes are signed with HMAC-SHA256 using a secret that lives only on the server. Only the server can create a valid code. Even an admin, without the secret, cannot forge one."
- Code snippet (illustrative, to be replaced with real code during implementation):
  ```ts
  // packages/api/src/lib/deposit-code.ts
  const code = crypto
    .createHmac('sha256', CODE_SIGNING_SECRET)
    .update(`${userId}:${itemId}:${expiresAt}`)
    .digest('hex')
    .slice(0, 12);
  ```
- Link: "See `packages/api/src/lib/deposit-code.ts` in the public repo."
- *Implementation note*: read the actual `deposit-code.ts` during implementation and paste the real snippet. Don't invent code.

**8 · How we make money**
- Section label: `// revenue.model`
- H2: `HOW WE MAKE MONEY`
- Content (honest, ads acknowledged):
  - **Trade fees:** 2% of each completed trade, shown in the UI at order creation. *(Implementation note: confirm 2% matches actual config value; pull from `platform_settings` if possible.)*
  - **Sponsored listings:** Item sellers can pay for top placement on the marketplace. Sponsored rows are tagged `SPONSORED`.
  - **Ad placements:** Occasional banner ads from DonutSMP-adjacent services, arranged through Discord tickets. Not programmatic; we know every advertiser.
- Tagline: "We don't sell your data. We don't profile users. We don't tax trades hidden in the spread."

**9 · Who runs this**
- Section label: `// operator.id`
- H2: `WHO RUNS THIS`
- Content: Short founder line — name or handle, one or two sentences, Discord contact.
- `TODO(user)`: placeholder comment in the TSX until the operator supplies real text.

**Footer** — same as landing, transparency link highlighted as the current page.

### Files affected — transparency
- **Create**: `packages/web/app/(app)/transparency/page.tsx`

## 3 · Repo opening

### Pre-public safety audit (BLOCKING — do not flip visibility until this passes)

Run, in order:

1. `gitleaks detect --source . --log-opts="--all"` — audits full git history. Install via `choco install gitleaks` on Windows or `brew install gitleaks` elsewhere.
2. Manual `git log -p | grep -iE 'password|secret|token|api[_-]?key|BOT_WEBHOOK_SECRET|CODE_SIGNING_SECRET|DATABASE_URL|DISCORD_BOT_TOKEN|MICROSOFT_CLIENT_SECRET'` spot check.
3. Confirm `.env`, `.env.local`, `.env.*.local` are in `.gitignore` (already present per current `.gitignore`).
4. Confirm `.env.example` and `.env.production.example` contain only placeholder values.
5. Confirm `config/config.json` is in `.gitignore` (already present — legacy bot config).

**If any real secret is found in history:**
- Rotate the secret in production **first** (before pushing any fix) — anyone who scraped the private repo at any past point already has it.
- Then rewrite history with `git filter-repo --replace-text secrets.txt` (or BFG Repo-Cleaner). Force-push the rewritten history.
- Then proceed to visibility flip.

### Add to `.gitignore` before first public push
- `.claude/` — developer-local Claude Code state (session hooks, permissions, custom agents). Equivalent to `.vscode/` or `.idea/`.
- `.superpowers/` — ephemeral brainstorm artifacts (this spec's mockups live there). Regenerated per session.

### Files to KEEP tracked and push publicly
- `CLAUDE.md` — project-level architecture documentation. Zero secrets, purely useful context. Consistent with the transparency pitch: anything we tell an AI to do, we're willing to tell a human.
- `docs/superpowers/` — design specs and implementation plans. Part of the transparency paper trail.
- All of `packages/**/*` source.
- `Caddyfile`, `docker-compose.yml`, `docker-compose.production.yml` (the production file has domain names but no secrets — double-check during audit).
- `README.md`, `LICENSE` (new).

### LICENSE file
- Path: `LICENSE` at repo root.
- Content: FSL 1.1 with parameters:
  - **Licensor**: `DonutTrade` (operator to supply legal entity name or personal name during implementation — placeholder `TODO(user)` until then)
  - **Change Date**: `2028-04-14` (two years from spec date)
  - **Change License**: `Apache License, Version 2.0`
- Source template: https://fsl.software/FSL-1.1-Apache-2.0.template.md
- FSL is a per-release license: each release has its own 2-year clock. For simplicity we keep a **single `LICENSE` file** at the repo root and bump the change date on each tagged release. Releases cut before the bump inherit the older change date via `git show <tag>:LICENSE`. See follow-up #5 for the release-time bump procedure.

### README updates
Keep the current README skeleton if it exists, and add:
- **What is this**: one paragraph on DonutTrade — Minecraft trading platform, escrow-based, DonutSMP.
- **License**: "Source-available under FSL 1.1. Auto-converts to Apache 2.0 on 2028-04-14. See LICENSE."
- **Why is this public?**: short link to `/transparency`. "Everything we claim on our public transparency page lives in this repo. Go verify."
- **Can I run my own?**: "Yes, for personal / non-commercial use. FSL 1.1 prohibits running a competing production service until the change date. After 2028-04-14, the license becomes Apache 2.0 — at which point you can do whatever you want."
- **Contribute**: PRs welcome. By contributing you agree your contributions are licensed under the same terms as the project.
- **Developer setup**: carry over from current README (or add basic `pnpm install` / `docker compose up -d` if missing).

No badges, no marketing flair, no emoji — dry and factual matches the transparency tone.

### GitHub repo settings
- **Visibility**: flip `github.com/givey999/donuttrade` from private → public (after safety audit passes).
- **Topics**: `minecraft`, `escrow`, `donutsmp`, `fsl-1-1`, `nextjs`, `fastify`
- **Issues**: enabled (bug reports welcome from readers)
- **Discussions**: off (can enable later if community forms)
- **Wiki**: off (docs live in `docs/superpowers/` in-tree)
- **Branch protection on `main`**: keep whatever is already configured; if none, add minimum: require PR reviews for direct pushes on `main`.

### Files affected — repo opening
- **Create**: `LICENSE` at repo root (FSL 1.1)
- **Update**: `README.md` at repo root
- **Update**: `.gitignore` — add `.claude/` and `.superpowers/`
- **Possibly rotate**: any secrets found during pre-public audit (coordinate with operator before rotating)

## 4 · SEO

### Per-page metadata
- `/`:
  - Title: `DonutTrade — Secure escrow trading for DonutSMP`
  - Description: `Instant item swaps, escrow protected. Trade Minecraft items safely on DonutSMP without the trust fall.`
- `/transparency`:
  - Title: `Transparency — How DonutTrade actually works`
  - Description: `How escrow, audits, and admin accountability work at DonutTrade. Source code is public on GitHub under FSL 1.1.`

### Open Graph images
- `/` OG image: `TRADE SAFELY / ON DONUTSMP` in VT323, violet cursor, dark background with a few stars. Exported from `packages/web/app/opengraph-image.tsx` (Next.js 15 convention — generated at build time).
- `/transparency` OG image: `TRANSPARENCY_` in VT323 with cursor, same dark background. `packages/web/app/(app)/transparency/opengraph-image.tsx`.
- Both 1200×630 PNG.

### robots.txt
- **Allow**: `/`, `/transparency`, `/rules`, `/terms`, `/marketplace`
- **Disallow**: `/dashboard`, `/admin/*`, `/orders/*`, `/signup/*`, `/verify`, `/login`, `/auth/*`

### Structured data (JSON-LD)
- `/`: `Organization` schema — name, URL, logo, sameAs (Discord, GitHub)
- `/`: `WebSite` schema (optional, defer if SearchAction not ready)
- `/transparency`: `AboutPage` schema (optional)

### Files affected — SEO
- **Create**: `packages/web/app/opengraph-image.tsx`
- **Create**: `packages/web/app/(app)/transparency/opengraph-image.tsx`
- **Update**: `packages/web/app/layout.tsx` — default `<title>` template, default description, default OG meta
- **Update**: `packages/web/app/(landing)/page.tsx` — per-page `export const metadata`
- **Update**: `packages/web/app/(app)/transparency/page.tsx` — per-page `export const metadata`
- **Create / update**: `packages/web/public/robots.txt`

## Testing / verification

Before merging the implementation PR:

1. `pnpm --filter @donuttrade/web dev` — landing renders, fonts load without FOUT, stars animate, cursor blinks, both CTAs work.
2. Visit `/transparency` — all nine sections render, no 404s, footer links work, collapsible crypto section opens.
3. `pnpm --filter @donuttrade/web build` — no TypeScript errors, no Tailwind purging issues, OG images generate at build time.
4. In browser devtools, force `prefers-reduced-motion: reduce` — particles freeze. Cursor may keep blinking (it's semantic).
5. Mobile viewport (375px wide) — hero H1 shrinks, 3-column grids collapse, nothing overflows.
6. Logged-in account: hero CTA → `/dashboard`. Logged-out account: hero CTA → `/login`.
7. `gitleaks detect --source . --log-opts="--all"` — passes clean.
8. Manual preview of both OG images in a URL-unfurl tester (e.g., Slack or Discord embed preview).
9. `robots.txt` accessible at `http://localhost:3000/robots.txt`.
10. Visual regression spot check: take screenshots of landing and transparency at desktop and mobile, compare against mockup.

## Follow-ups (separate PRs, not in this spec)

1. **Real audit log endpoint** — `GET /public/audit-log-sample` returning ~20 latest audit rows with usernames hashed, amounts redacted on personal transactions. Swap in for the static mockup on `/transparency`.
2. **License auto-open countdown** — small widget on `/transparency`: "X days until license auto-converts to Apache 2.0." Pulls from a constant, no runtime work.
3. **Recent commits feed** — static daily-build file pulled from `git log -n 20` during CI, embedded on `/transparency`.
4. **Site-wide "bot" → "account" copy sweep** — this spec only changes the landing. Dashboard, admin, onboarding text may still say "bot."
5. **Per-release LICENSE change-date refresh** — when we cut a new release, bump the change date in `LICENSE` by two years.

## Open questions

None. All questions from the brainstorm are resolved.

## Risks

- **CLAUDE.md goes public** and the user later regrets it. Mitigation: they've explicitly approved. It contains no secrets. Worst case, remove in a follow-up commit — but that won't remove it from history, so we should assume once pushed it's permanent.
- **Secrets leak during public flip.** Mitigation: gitleaks + manual grep + rotation plan above. Non-negotiable blocker before visibility flip.
- **FSL 1.1 auto-open text is a license commitment** — it's a one-way promise. Two years from each release, that release's code *will* be Apache 2.0. Operator should be comfortable with that.
- **"bot" → "our account" may conflict with in-game operator expectations** — if DonutSMP players already know the account as "the DonutTrade bot," the copy change could cause confusion. Low risk because the bot *is* a player account from Minecraft's perspective. If feedback comes back negative, revert or clarify copy.
- **Transparency claims that don't match code** will backfire harder than marketing claims. Mitigation: implementation-time verification — every technical claim on `/transparency` must be checked against the actual implementation before merge.

## Appendix: design decisions recorded

- **V2 Terminal Display** picked over three other visual directions (Live Terminal, Editorial Block, Premium Financial, Pixel Maximalist) during brainstorm. User wanted "D but simpler, in brand palette." V2 is D restrained to black + violet.
- **Stars kept** as a hard constraint per user direction — they're character, not template.
- **"Still Skeptical?"** wording chosen over "Don't Trust Us?" (too aggressive) and "Trust But Verify" (too policy-ish).
- **Audit log as static mockup (A1)** chosen over real API endpoint (A2) for day 1 — ship fast, upgrade in follow-up.
- **FSL 1.1 over AGPL, MIT, BSL, Elastic** — protects against cloning, short license text, clean 2-year auto-open narrative, proven by Sentry/Oxide/Keygen.
- **2-year term** (FSL default) over 1/3/5 — matches industry norm, signals real commitment, short enough to feel honest.
- **Apache 2.0 as future license** over MIT — explicit patent grants, more commercially friendly, industry standard.
- **CLAUDE.md pushed** over gitignored — consistency with transparency narrative, file contains no secrets, normalizes AI-assisted development.
- **Transparency page under `(app)` group** over `(landing)` — matches existing `/rules` and `/terms` which are also public static pages under `(app)`.
