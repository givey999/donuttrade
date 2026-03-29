import { Client, EmbedBuilder } from 'discord.js';
import { Redis } from 'ioredis';
import { config } from '../config.js';
import { apiClient } from '../api-client.js';

const BRAND_COLOR = 0x7C3AED;

interface UserEvent {
  id: string;
  type: string;
  data: Record<string, unknown>;
  timestamp: string;
}

// Volume thresholds for auto-role assignment
const VOLUME_TIERS = [
  { threshold: 1_000_000_000, roleKey: 'DISCORD_ROLE_ELITE_TRADER_ID' as const },
  { threshold: 100_000_000, roleKey: 'DISCORD_ROLE_TRUSTED_TRADER_ID' as const },
  { threshold: 10_000_000, roleKey: 'DISCORD_ROLE_ACTIVE_TRADER_ID' as const },
];

/**
 * Format event into a DM embed. Returns null if the event type is not DM-worthy.
 */
function buildDmEmbed(event: UserEvent): EmbedBuilder | null {
  const embed = new EmbedBuilder().setColor(BRAND_COLOR).setTimestamp();

  switch (event.type) {
    case 'order.filled': {
      const qty = event.data.quantity ?? '?';
      const item = event.data.itemName ?? 'items';
      const role = event.data.role ?? '';
      embed
        .setTitle('Order Filled')
        .setDescription(`Your ${role === 'buyer' ? 'buy' : 'sell'} order for **${qty}x ${item}** was filled!`);
      return embed;
    }
    case 'withdrawal.completed': {
      const amount = event.data.amount ?? '?';
      embed
        .setTitle('Withdrawal Sent')
        .setDescription(`Your withdrawal of **$${Number(amount).toLocaleString()}** has been sent in-game!`);
      return embed;
    }
    case 'item_withdrawal.completed': {
      const qty = event.data.quantity ?? '?';
      const item = event.data.itemName ?? 'items';
      embed
        .setTitle('Item Withdrawal Ready')
        .setDescription(`Your withdrawal of **${qty}x ${item}** is ready for pickup!`);
      return embed;
    }
    case 'deposit.confirmed': {
      const amount = event.data.amount ?? '?';
      embed
        .setTitle('Deposit Confirmed')
        .setDescription(`Your deposit of **$${Number(amount).toLocaleString()}** has been credited to your account!`);
      return embed;
    }
    default:
      return null;
  }
}

/**
 * Initialize the DM notification listener.
 * Subscribes to all user event channels via Redis PSUBSCRIBE
 * and sends DMs to users with linked Discord accounts.
 */
export function initDmNotifications(client: Client) {
  const subscriber = new Redis(config.REDIS_URL);

  subscriber.on('error', (err: Error) => {
    console.error('[DM Notifications] Redis error:', err.message);
  });

  // Pattern subscribe to all user notification channels
  subscriber.psubscribe('notifications:*').then(() => {
    console.log('[DM Notifications] Listening for events on notifications:*');
  }).catch((err: Error) => {
    console.error('[DM Notifications] Failed to subscribe:', err);
  });

  subscriber.on('pmessage', async (_pattern: string, channel: string, message: string) => {
    try {
      const userId = channel.replace('notifications:', '');
      const event: UserEvent = JSON.parse(message);

      // Look up discordId once for both DM and auto-role
      const embed = buildDmEmbed(event);
      const needsDiscord = embed || (event.type === 'order.filled' && event.data.tradingVolume);
      const discordId = needsDiscord ? await apiClient.getDiscordIdByUserId(userId) : null;

      // ── DM Notification ──────────────────────────────────
      if (embed && discordId) {
        try {
          const discordUser = await client.users.fetch(discordId);
          await discordUser.send({ embeds: [embed] });
        } catch {
          // User may have DMs disabled — silently skip
        }
      }

      // ── Auto-Role Assignment (on order.filled) ───────────
      if (event.type === 'order.filled' && event.data.tradingVolume && discordId) {
        await checkAndAssignVolumeRoles(client, discordId, Number(event.data.tradingVolume));
      }
    } catch (err) {
      console.error('[DM Notifications] Error processing event:', err);
    }
  });

  return subscriber;
}

/**
 * Check if a user has crossed a volume tier and assign the corresponding Discord role.
 */
async function checkAndAssignVolumeRoles(client: Client, discordId: string, tradingVolume: number) {
  const guild = client.guilds.cache.get(config.DISCORD_GUILD_ID);
  if (!guild) return;

  try {
    const member = await guild.members.fetch(discordId);

    for (const tier of VOLUME_TIERS) {
      const roleId = config[tier.roleKey];
      if (!roleId) continue;

      if (tradingVolume >= tier.threshold && !member.roles.cache.has(roleId)) {
        await member.roles.add(roleId);
        console.log(`[Auto-Role] Assigned role ${tier.roleKey} to ${member.user.tag} (volume: ${tradingVolume})`);
      }
    }
  } catch (err) {
    console.error('[Auto-Role] Failed to assign roles:', err);
  }
}
