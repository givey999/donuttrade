import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { apiClient } from '../api-client.js';
import { formatVolume } from '../utils/format.js';

const BRAND_COLOR = 0x7C3AED;

export const statsCommandData = new SlashCommandBuilder()
  .setName('stats')
  .setDescription('View DonutTrade platform statistics');

export async function handleStatsCommand(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  try {
    const stats = await apiClient.getStats();

    const embed = new EmbedBuilder()
      .setTitle('DonutTrade Statistics')
      .setColor(BRAND_COLOR)
      .addFields(
        { name: 'Verified Traders', value: stats.totalTraders.toLocaleString(), inline: true },
        { name: 'Active Orders', value: stats.activeOrders.toLocaleString(), inline: true },
        { name: '24h Volume', value: `$${formatVolume(stats.volume24h)}`, inline: true },
        { name: 'Total Volume', value: `$${formatVolume(stats.totalVolume)}`, inline: true },
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    await interaction.editReply({ content: 'Failed to fetch stats. Please try again later.' });
  }
}

