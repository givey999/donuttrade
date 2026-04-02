# Compliance Panel — Design Spec

**Date:** 2026-04-02
**Goal:** Add a persistent compliance panel to a dedicated Discord channel that explains how DonutTrade operates within DonutSMP's rules, with evidence (screenshots).

## Overview

On bot startup, the management bot checks a configured Discord channel for existing compliance embeds. If none are found, it sends 5 embeds with two attached images. Follows the same "ensure panel" pattern as `about-panel.ts` and `ticket-panel.ts`.

## Configuration

New optional env var: `DISCORD_COMPLIANCE_CHANNEL_ID`. The user creates the channel manually and sets this ID. If not set, the panel is skipped.

## Embeds

All embeds use the same max-width trick (a consistent element in each embed to force Discord to render them at full width). The images (`docs/rules.png` and `docs/proof.png`) are copied into the management-bot package at build time or attached at runtime via `AttachmentBuilder`.

### Embed 1: Header
- **Color:** `#7C3AED` (brand violet)
- **Title:** `── Rule Compliance ──`
- **Description:**
  ```
  DonutTrade was built with one principle in mind:
  play fair, trade safe.

  This channel provides a full breakdown of how
  our platform operates within DonutSMP's rules
  — with evidence to back it up.

  ▼  Read below for details
  ```

### Embed 2: Server Rules
- **Color:** `#7C3AED`
- **Title:** `Official DonutSMP Rules`
- **Image:** `rules.png` (attached)
- **Description:**
  ```
  Above are the official DonutSMP server rules.
  Below is a full breakdown of every rule that
  could relate to a trading platform — and how
  we handle each one.
  ```
- **Fields:**
  - **⚬ No Macros or Scripts** — "Our platform does not execute any macros or scripts on the Minecraft server. The console client only reads chat messages and sends manual /pay commands — each one triggered by a real moderator clicking \"Approve.\""
  - **⚬ No Auto Clicker** — "Nothing on our platform clicks anything. There is no mouse simulation, no automated inputs, no interaction with the game world. The console client is text-only."
  - **⚬ No Abusing Bugs** — "We do not exploit any server bugs or glitches. All transactions use the standard /pay command that DonutSMP provides to all players."
  - **⚬ No IRL Trading** — "We do not facilitate IRL trading. See the dedicated section below for a full explanation. ▼"

### Embed 3: IRL Trading
- **Color:** `#57F287` (green)
- **Title:** `In-Game Only — Not IRL Trading`
- **Description:**
  ```
  The "No IRL Trading" rule exists to prevent
  players from selling in-game items or currency
  for real-world money (PayPal, crypto, gift
  cards, etc).

  DonutTrade does not involve real money
  in any way when it comes to trading.
  ```
- **Fields:**
  - **What We Do** — "◈  In-game money  →  in-game items\n◈  In-game items  →  in-game money\n◈  Everything stays in the game economy"
  - **What We Don't Do** — "✕  No real money accepted or paid out\n✕  No PayPal, crypto, or gift cards\n✕  No external transactions of any kind"
  - **Why This Is Allowed** — "Trading items for in-game currency is something every player already does.\n\nDonutTrade simply provides a safer way to do it — with escrow protection, fair pricing, and no risk of being scammed.\n\nIf trading items for in-game money was against the rules, the /pay command wouldn't exist."
  - **A Note About Ads** — "Our website displays advertisements to help cover hosting costs. This is entirely separate from the server's economy — no in-game items or currency are involved.\n\nMany other DonutSMP community servers and platforms do the same."

### Embed 4: Console Client Proof
- **Color:** `#7C3AED`
- **Title:** `Console Clients Are Allowed`
- **Image:** `proof.png` (attached)
- **Description:**
  ```
  A DonutSMP admin confirmed that console clients
  are permitted on the server (see above).

  DonutTrade uses a console client to connect
  — the same type confirmed as allowed.

  We do not run scripts, macros, or any form
  of automation that would break the rules.
  ```
- **Footer:** `📸 Credit: DonutSMP News Discord server`

### Embed 5: How It All Works
- **Color:** `#7C3AED`
- **Title:** `How Every Feature Works`
- **Fields:**
  - **💰 Money Deposits** — "A player sends a payment in-game. Our console client reads the chat message to detect it. No scripts, no macros — just receiving a message."
  - **💸 Money Withdrawals** — "Every withdrawal is manually reviewed and approved by a moderator before anything is sent. Nothing is automated."
  - **📦 Item Deposits & Withdrawals** — "All item transfers happen through Discord tickets. A moderator coordinates the handoff directly with the player — fully manual."
  - **🛒 Marketplace** — "Orders are matched on our website. The actual transfers use the manual processes above. No automation touches the server."

## Image Handling

The images (`rules.png` and `proof.png`) are stored in `docs/`. At runtime, the bot uses Discord.js `AttachmentBuilder` to attach them and references them in embeds via `attachment://rules.png` and `attachment://proof.png`. The images are copied into the management-bot Docker container at build time.

## Same-Width Trick

To ensure all embeds render at the same width in Discord, each embed without an image will include a zero-width field or a long enough description to force max width rendering.

## Detection Logic

On startup, the bot fetches the last 50 messages from the compliance channel. If any message from the bot contains an embed with title `── Rule Compliance ──`, it skips sending. Otherwise, it sends all 5 embeds as a single message (multiple embeds in one `send()` call, split across two messages since Discord allows max 10 embeds per message but we need to attach different images to different embeds).

**Message structure:**
- Message 1: Embed 1 (header) + Embed 2 (rules) with `rules.png` attachment
- Message 2: Embed 3 (IRL trading) + Embed 4 (console proof) with `proof.png` attachment
- Message 3: Embed 5 (how it works)

This split is necessary because each image attachment can only be used in one embed, and we want the images to appear in specific embeds.

## Files

| File | Change |
|------|--------|
| `packages/management-bot/src/interactions/compliance-panel.ts` | **New** — builds all 5 embeds + ensureCompliancePanel function |
| `packages/management-bot/src/config.ts` | Add optional `DISCORD_COMPLIANCE_CHANNEL_ID` env var |
| `packages/management-bot/src/events/ready.ts` | Call `ensureCompliancePanel` on startup |
| `packages/management-bot/Dockerfile` | Copy `docs/rules.png` and `docs/proof.png` into container |

## Out of Scope

- Interactive buttons on compliance embeds
- Automatic updates when rules change
- Localization
