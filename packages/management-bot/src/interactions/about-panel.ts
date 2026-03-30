import { Client, TextChannel, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { config } from '../config.js';

const BRAND_COLOR = 0x7C3AED;

function buildAboutEmbed(): EmbedBuilder[] {
  const main = new EmbedBuilder()
    .setColor(BRAND_COLOR)
    .setTitle('DonutTrade')
    .setDescription(
      '> A secure marketplace for buying and selling\n' +
      '> Minecraft items with in-game currency.\n\n' +
      'Trade spawners, rare items, and more — backed by an escrow system that protects both buyers and sellers.\n' +
      '\u200B'
    )
    .addFields(
      { name: '\u{1F680}  Getting Started', value: '\u200B', inline: false },
      {
        name: 'Step 1',
        value: 'Create an account on our website',
        inline: true,
      },
      {
        name: 'Step 2',
        value: 'Set your Minecraft username',
        inline: true,
      },
      {
        name: 'Step 3',
        value: 'Verify with a small in-game payment',
        inline: true,
      },
      { name: '\u200B', value: '\u200B', inline: false },
      {
        name: '\u{1F4B0}  Marketplace',
        value: 'Buy & sell orders with custom prices and partial fills',
        inline: true,
      },
      {
        name: '\u{1F512}  Escrow System',
        value: 'Funds held securely until trade is complete',
        inline: true,
      },
      {
        name: '\u{1F4E6}  Item Trading',
        value: 'Deposit and withdraw items via Discord tickets',
        inline: true,
      },
      {
        name: '\u{1F3A8}  Cosmetics',
        value: 'Customize listings with colors, fonts, and more',
        inline: true,
      },
      {
        name: '\u{1F4CA}  Price History',
        value: 'Track prices over time with interactive charts',
        inline: true,
      },
      {
        name: '\u{1F514}  Notifications',
        value: 'Get notified via website and Discord DMs',
        inline: true,
      },
      { name: '\u200B', value: '\u200B', inline: false },
      {
        name: '\u{1F916}  Bot Commands',
        value:
          '`/balance` — Your balance and inventory\n' +
          '`/orders` — Your active orders\n' +
          '`/stats` — Platform statistics\n' +
          '`/leaderboard` — Top traders\n' +
          '`/help` — Full command list',
        inline: false,
      },
    )
    .setFooter({ text: 'Link your Discord account on the website to use bot commands' });

  return [main];
}

function buildAboutButtons(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setLabel('Open Website')
      .setStyle(ButtonStyle.Link)
      .setURL('https://moldo.go.ro:9443')
      .setEmoji('\u{1F310}'),
    new ButtonBuilder()
      .setLabel('Marketplace')
      .setStyle(ButtonStyle.Link)
      .setURL('https://moldo.go.ro:9443/marketplace')
      .setEmoji('\u{1F6D2}'),
    new ButtonBuilder()
      .setLabel('Dashboard')
      .setStyle(ButtonStyle.Link)
      .setURL('https://moldo.go.ro:9443/dashboard')
      .setEmoji('\u{1F4CB}'),
  );
}

/**
 * Ensure the about panel exists in the configured channel.
 */
export async function ensureAboutPanel(client: Client<true>): Promise<void> {
  const channelId = config.DISCORD_ABOUT_CHANNEL_ID;
  if (!channelId) return;

  const channel = client.channels.cache.get(channelId);
  if (!channel?.isTextBased()) {
    console.error(`About channel ${channelId} not found or not text-based`);
    return;
  }

  const textChannel = channel as TextChannel;
  const messages = await textChannel.messages.fetch({ limit: 50 });
  const existing = messages.find(
    (m) => m.author.id === client.user.id && m.embeds.some((e) => e.title === 'DonutTrade')
  );

  if (existing) {
    console.log('About panel already exists, skipping creation');
    return;
  }

  try {
    const embeds = buildAboutEmbed();
    const buttons = buildAboutButtons();
    await textChannel.send({ embeds, components: [buttons] });
    console.log('About panel sent');
  } catch (err) {
    console.error('Failed to send about panel (check bot permissions in channel):', (err as Error).message);
  }
}
