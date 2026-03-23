import { Client, TextChannel } from 'discord.js';
import { config } from '../config.js';
import { buildPanelEmbed, buildPanelButtons } from '../utils/embeds.js';

/**
 * Ensure the persistent panel exists in the configured channel.
 * Scans recent messages; if none found from this bot with the right embed, sends a new one.
 */
export async function ensurePanel(client: Client<true>): Promise<void> {
  const channel = client.channels.cache.get(config.DISCORD_PANEL_CHANNEL_ID);
  if (!channel?.isTextBased()) {
    console.error(`Panel channel ${config.DISCORD_PANEL_CHANNEL_ID} not found or not text-based`);
    return;
  }

  const textChannel = channel as TextChannel;
  const messages = await textChannel.messages.fetch({ limit: 50 });
  const existingPanel = messages.find(
    (m) => m.author.id === client.user.id && m.embeds.some((e) => e.title === 'DonutTrade Support')
  );

  if (existingPanel) {
    console.log('Panel already exists, skipping creation');
    return;
  }

  const embed = buildPanelEmbed();
  const buttons = buildPanelButtons();
  await textChannel.send({ embeds: [embed], components: [buttons] });
  console.log('Persistent panel sent to #create-ticket');
}
