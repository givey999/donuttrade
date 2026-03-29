import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { apiClient, ApiRequestError } from '../api-client.js';
import { formatVolume } from '../utils/format.js';

const BRAND_COLOR = 0x7C3AED;

export const balanceCommandData = new SlashCommandBuilder()
  .setName('balance')
  .setDescription('Check your DonutTrade balance and inventory');

export async function handleBalanceCommand(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  try {
    const user = await apiClient.getUserByDiscordId(interaction.user.id);

    const inventoryText = user.inventory.length > 0
      ? user.inventory.map(i => `${i.item}: **${i.quantity}**${i.reserved > 0 ? ` (${i.reserved} reserved)` : ''}`).join('\n')
      : 'No items';

    const embed = new EmbedBuilder()
      .setTitle(`${user.minecraftUsername ?? 'Unknown'}'s Account`)
      .setColor(BRAND_COLOR)
      .addFields(
        { name: 'Balance', value: `$${Number(user.balance).toLocaleString('en-US', { minimumFractionDigits: 2 })}`, inline: true },
        { name: 'Trading Volume', value: `$${formatVolume(user.tradingVolume)}`, inline: true },
        { name: 'Status', value: user.verificationStatus, inline: true },
        { name: 'Inventory', value: inventoryText },
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    if (err instanceof ApiRequestError && err.statusCode === 404) {
      await interaction.editReply({
        content: '**Your Discord is not linked to a DonutTrade account.**\n\nTo use this command:\n1. Go to **https://moldo.go.ro:9443/dashboard**\n2. Find the **Accounts** section\n3. Click **Connect** next to Discord\n\nOnce linked, you can check your balance here!',
      });
    } else {
      await interaction.editReply({ content: 'Failed to fetch your balance. Please try again later.' });
    }
  }
}

