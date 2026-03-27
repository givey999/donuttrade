import {
  Client,
  TextChannel,
  ButtonInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { config } from '../config.js';

const BRAND_COLOR = 0x7C3AED; // violet-600

function buildVerifyEmbed() {
  return new EmbedBuilder()
    .setTitle('⟢ Verification')
    .setDescription(
      'Welcome to **DonutTrade**!\n\n' +
      'Click the button below to verify yourself and gain access to the server.'
    )
    .setColor(BRAND_COLOR);
}

function buildVerifyButton() {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('verify_gate')
      .setLabel('Verify')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('\u2714'),
  );
}

/**
 * Ensure the verify panel exists in the configured channel.
 */
export async function ensureVerifyPanel(client: Client<true>): Promise<void> {
  const channelId = config.DISCORD_VERIFY_CHANNEL_ID;
  if (!channelId) return;

  const channel = client.channels.cache.get(channelId);
  if (!channel?.isTextBased()) {
    console.error(`Verify channel ${channelId} not found or not text-based`);
    return;
  }

  const textChannel = channel as TextChannel;
  const messages = await textChannel.messages.fetch({ limit: 50 });
  const existing = messages.find(
    (m) => m.author.id === client.user.id && m.embeds.some((e) => e.title === '⟢ Verification')
  );

  if (existing) {
    console.log('Verify panel already exists, skipping creation');
    return;
  }

  await textChannel.send({ embeds: [buildVerifyEmbed()], components: [buildVerifyButton()] });
  console.log('Verify panel sent to #verify');
}

/**
 * Handle verify button click — assign the verified role.
 */
export async function handleVerifyButton(interaction: ButtonInteraction): Promise<void> {
  const roleId = config.DISCORD_VERIFIED_ROLE_ID;
  if (!roleId) {
    await interaction.reply({ content: 'Verification is not configured.', flags: 64 });
    return;
  }

  const member = interaction.guild!.members.cache.get(interaction.user.id)
    || await interaction.guild!.members.fetch(interaction.user.id);

  if (member.roles.cache.has(roleId)) {
    await interaction.reply({ content: 'You are already verified!', flags: 64 });
    return;
  }

  try {
    await member.roles.add(roleId);
    await interaction.reply({ content: 'You have been verified! Welcome to DonutTrade.', flags: 64 });
  } catch (err) {
    console.error('Failed to assign verified role:', err);
    await interaction.reply({ content: 'Something went wrong. Please contact a moderator.', flags: 64 });
  }
}
