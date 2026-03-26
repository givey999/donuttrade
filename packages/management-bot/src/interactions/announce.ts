import {
  ChatInputCommandInteraction,
  TextChannel,
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
} from 'discord.js';
import { config } from '../config.js';

const COLOR_CHOICES = [
  { name: 'Purple (default)', value: '7C3AED' },
  { name: 'Green', value: '57F287' },
  { name: 'Red', value: 'ED4245' },
  { name: 'Blue', value: '5865F2' },
  { name: 'Yellow', value: 'FEE75C' },
  { name: 'White', value: 'FFFFFF' },
];

export const announceCommandData = new SlashCommandBuilder()
  .setName('announce')
  .setDescription('Post an embedded announcement in this channel')
  .addStringOption((opt) =>
    opt.setName('title')
      .setDescription('Announcement title')
      .setRequired(true)
  )
  .addStringOption((opt) =>
    opt.setName('message')
      .setDescription('Announcement body (supports Discord markdown)')
      .setRequired(true)
  )
  .addStringOption((opt) =>
    opt.setName('color')
      .setDescription('Embed color')
      .addChoices(...COLOR_CHOICES.map((c) => ({ name: c.name, value: c.value })))
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

  const title = interaction.options.getString('title', true);
  const message = interaction.options.getString('message', true);
  const colorHex = interaction.options.getString('color') || '7C3AED';

  const embed = new EmbedBuilder()
    .setTitle(title)
    .setDescription(message)
    .setColor(parseInt(colorHex, 16))
    .setTimestamp();

  const channel = interaction.channel as TextChannel;
  await channel.send({ embeds: [embed] });

  await interaction.reply({ content: 'Announcement posted.', ephemeral: true });
}
