import {
  ChatInputCommandInteraction,
  TextChannel,
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ModalSubmitInteraction,
} from 'discord.js';
import { config } from '../config.js';

export const announceCommandData = new SlashCommandBuilder()
  .setName('announce')
  .setDescription('Post an embedded announcement in this channel')
  .addStringOption((opt) =>
    opt.setName('color')
      .setDescription('Embed color')
      .addChoices(
        { name: 'Purple (default)', value: '7C3AED' },
        { name: 'Green', value: '57F287' },
        { name: 'Red', value: 'ED4245' },
        { name: 'Blue', value: '5865F2' },
        { name: 'Yellow', value: 'FEE75C' },
        { name: 'White', value: 'FFFFFF' },
      )
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages);

export async function handleAnnounceCommand(interaction: ChatInputCommandInteraction) {
  // Check moderator role
  const member = interaction.guild!.members.cache.get(interaction.user.id)
    || await interaction.guild!.members.fetch(interaction.user.id);
  if (!member.roles.cache.has(config.DISCORD_MODERATOR_ROLE_ID)) {
    await interaction.reply({ content: 'Only moderators can use this command.', ephemeral: true });
    return;
  }

  const colorHex = interaction.options.getString('color') || '7C3AED';

  const modal = new ModalBuilder()
    .setCustomId(`announce_${colorHex}`)
    .setTitle('Create Announcement');

  const titleInput = new TextInputBuilder()
    .setCustomId('announce_title')
    .setLabel('Title')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(256);

  const messageInput = new TextInputBuilder()
    .setCustomId('announce_message')
    .setLabel('Message')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setPlaceholder('Supports Discord markdown and line breaks');

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(titleInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(messageInput),
  );

  await interaction.showModal(modal);
}

export async function handleAnnounceModal(interaction: ModalSubmitInteraction) {
  const colorHex = interaction.customId.replace('announce_', '');
  const title = interaction.fields.getTextInputValue('announce_title');
  const message = interaction.fields.getTextInputValue('announce_message');

  const embed = new EmbedBuilder()
    .setTitle(title)
    .setDescription(message)
    .setColor(parseInt(colorHex, 16));

  const channel = interaction.channel as TextChannel;
  await channel.send({ embeds: [embed] });

  await interaction.reply({ content: 'Announcement posted.', ephemeral: true });
}
