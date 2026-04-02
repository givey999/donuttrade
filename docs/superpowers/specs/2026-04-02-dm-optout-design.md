# Discord DM Opt-Out — Design Spec

**Date:** 2026-04-02
**Goal:** Let users permanently unsubscribe from Discord DM notifications via a button on every DM embed.

## Overview

Every Discord DM notification (order fills, deposits, withdrawals, denials) will include an "Unsubscribe" button. Clicking it permanently disables all DM notifications for that user. There is no re-subscribe mechanism.

## Database

Add a `dmNotifications` boolean column to the User model:

```prisma
dmNotifications Boolean @default(true) @map("dm_notifications")
```

Default `true` — existing users keep getting DMs. When set to `false`, all DMs are skipped.

**Migration required:** `ALTER TABLE users ADD COLUMN dm_notifications BOOLEAN NOT NULL DEFAULT true;`

## Changes by Component

### 1. API — Internal Discord Bot Route (`packages/api/src/routes/internal/discord-bot.ts`)

**Modified endpoint:**

- `GET /internal/discord-bot/discord-id/:userId` — Currently returns `{ discordId }`. Add `dmNotifications` to the select and response: `{ discordId, dmNotifications }`.

**New endpoint:**

- `PATCH /internal/discord-bot/dm-notifications/:userId` — Body: `{ enabled: boolean }`. Updates the `dmNotifications` field on the user. Returns `{ success: true }`. Authenticated with `BOT_WEBHOOK_SECRET` like all internal routes.

### 2. Management Bot — API Client (`packages/management-bot/src/api-client.ts`)

**Modified method:**

- `getDiscordIdByUserId(userId)` — Return type changes to `{ discordId: string; dmNotifications: boolean } | null`. The caller in dm-notifications.ts will use `dmNotifications` to decide whether to send the DM.

**New method:**

- `disableDmNotifications(userId)` — Calls `PATCH /internal/discord-bot/dm-notifications/:userId` with `{ enabled: false }`.

### 3. Management Bot — DM Notifications (`packages/management-bot/src/services/dm-notifications.ts`)

**Modified:**

- `getDiscordIdByUserId` now returns `dmNotifications` too. Before sending a DM, check if `dmNotifications === false` — if so, skip entirely.
- Every `discordUser.send()` call now includes a `components` array with an `ActionRowBuilder` containing an "Unsubscribe" button:

```typescript
import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

const unsubscribeRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
  new ButtonBuilder()
    .setCustomId(`dm_unsubscribe:${userId}`)
    .setLabel('Unsubscribe')
    .setStyle(ButtonStyle.Secondary)
);

await discordUser.send({ embeds: [embed], components: [unsubscribeRow] });
```

The custom ID includes the userId so the interaction handler knows which user to update.

**Important:** The `dmNotifications` flag only controls DM messages. Auto-role assignment (volume tiers) still happens regardless of this flag — it's a server role, not a notification.

### 4. Management Bot — Interaction Handler (`packages/management-bot/src/events/interactionCreate.ts`)

**New button handler:**

When `interaction.customId` starts with `dm_unsubscribe:`, extract the userId, call `apiClient.disableDmNotifications(userId)`, and update the message:

```typescript
if (interaction.customId.startsWith('dm_unsubscribe:')) {
  const userId = interaction.customId.split(':')[1];
  await apiClient.disableDmNotifications(userId);
  await interaction.update({
    content: 'You have been unsubscribed from notifications.',
    embeds: [],
    components: [],
  });
}
```

This replaces the entire message with a simple confirmation text, removing the embed and button.

### 5. Prisma Schema (`packages/api/prisma/schema.prisma`)

Add `dmNotifications` field to User model (between `banReason` and `tradingVolume`, in the Account state section).

## Files to Modify

| File | Change |
|------|--------|
| `packages/api/prisma/schema.prisma` | Add `dmNotifications` Boolean field to User |
| `packages/api/src/routes/internal/discord-bot.ts` | Return `dmNotifications` in discord-id lookup; add PATCH endpoint |
| `packages/management-bot/src/api-client.ts` | Update `getDiscordIdByUserId` return type; add `disableDmNotifications` |
| `packages/management-bot/src/services/dm-notifications.ts` | Check opt-out flag; add Unsubscribe button to all embeds |
| `packages/management-bot/src/events/interactionCreate.ts` | Handle `dm_unsubscribe` button click |

## Out of Scope

- Re-subscribe mechanism
- Per-category notification preferences
- Settings page toggle
