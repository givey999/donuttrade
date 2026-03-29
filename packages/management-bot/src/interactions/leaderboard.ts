import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { apiClient } from '../api-client.js';
import { formatVolume } from '../utils/format.js';

const BRAND_COLOR = 0x7C3AED;

export const leaderboardCommandData = new SlashCommandBuilder()
  .setName('leaderboard')
  .setDescription('View top DonutTrade traders by volume');

export async function handleLeaderboardCommand(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  try {
    const entries = await apiClient.getLeaderboard();

    if (entries.length === 0) {
      await interaction.editReply({ content: 'No trading activity yet.' });
      return;
    }

    const medals = ['🥇', '🥈', '🥉'];
    const lines = entries.map((e) => {
      const prefix = medals[e.rank - 1] ?? `**#${e.rank}**`;
      return `${prefix} ${e.username} — $${formatVolume(e.volume)}`;
    });

    const embed = new EmbedBuilder()
      .setTitle('Trading Leaderboard')
      .setDescription(lines.join('\n'))
      .setColor(BRAND_COLOR)
      .setFooter({ text: 'Ranked by total trading volume' })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    await interaction.editReply({ content: 'Failed to fetch leaderboard. Please try again later.' });
  }
}

