import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from 'discord.js';

const BRAND_COLOR = 0x7C3AED;

export const helpCommandData = new SlashCommandBuilder()
  .setName('help')
  .setDescription('Learn about DonutTrade and available commands');

export async function handleHelpCommand(interaction: ChatInputCommandInteraction) {
  const embed = new EmbedBuilder()
    .setTitle('DonutTrade')
    .setDescription('A secure Minecraft marketplace for buying and selling items with in-game currency.')
    .setColor(BRAND_COLOR)
    .addFields(
      {
        name: 'Getting Started',
        value: [
          '1. Sign up at **https://moldo.go.ro:9443**',
          '2. Set your Minecraft username',
          '3. Verify your account by sending a small payment to the bot in-game',
          '4. Deposit money or items to start trading',
        ].join('\n'),
      },
      {
        name: 'Commands',
        value: [
          '`/stats` — Platform statistics',
          '`/balance` — Your balance and inventory',
          '`/orders` — Your active orders',
          '`/leaderboard` — Top traders by volume',
          '`/help` — This message',
        ].join('\n'),
      },
      {
        name: 'Links',
        value: '[Website](https://moldo.go.ro:9443) · [Dashboard](https://moldo.go.ro:9443/dashboard) · [Marketplace](https://moldo.go.ro:9443/marketplace)',
      },
    )
    .setTimestamp();

  await interaction.reply({ embeds: [embed], ephemeral: true });
}
