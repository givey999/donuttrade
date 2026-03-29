import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { apiClient, ApiRequestError } from '../api-client.js';

const BRAND_COLOR = 0x7C3AED;

export const ordersCommandData = new SlashCommandBuilder()
  .setName('orders')
  .setDescription('View your active DonutTrade orders');

export async function handleOrdersCommand(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  try {
    const orders = await apiClient.getUserOrders(interaction.user.id);

    if (orders.length === 0) {
      await interaction.editReply({ content: 'You have no active orders.' });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle('Your Active Orders')
      .setColor(BRAND_COLOR)
      .setTimestamp();

    for (const order of orders) {
      const remaining = timeRemaining(order.expiresAt);
      const price = Number(order.pricePerUnit).toLocaleString();
      embed.addFields({
        name: `${order.type.toUpperCase()} — ${order.item}`,
        value: `${order.filled}/${order.quantity} filled · $${price}/unit · ${remaining}`,
        inline: false,
      });
    }

    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    if (err instanceof ApiRequestError && err.statusCode === 404) {
      await interaction.editReply({
        content: '**Your Discord is not linked to a DonutTrade account.**\n\nTo use this command:\n1. Go to **https://moldo.go.ro:9443/dashboard**\n2. Find the **Accounts** section\n3. Click **Connect** next to Discord\n\nOnce linked, you can view your orders here!',
      });
    } else {
      await interaction.editReply({ content: 'Failed to fetch orders. Please try again later.' });
    }
  }
}

function timeRemaining(expiresAt: string): string {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return 'Expired';
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return `${h}h ${m}m left`;
}
