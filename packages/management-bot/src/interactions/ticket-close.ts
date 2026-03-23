import {
  ChatInputCommandInteraction,
  TextChannel,
  SlashCommandBuilder,
  PermissionFlagsBits,
} from 'discord.js';
import { config } from '../config.js';
import { apiClient } from '../api-client.js';
import { generateTranscript } from '../services/transcript.js';
import { buildTranscriptEmbed } from '../utils/embeds.js';

export const closeCommandData = new SlashCommandBuilder()
  .setName('close')
  .setDescription('Close a ticket channel')
  .addStringOption((opt) =>
    opt.setName('action')
      .setDescription('Confirm or reject the deposit/withdrawal')
      .addChoices(
        { name: 'confirm', value: 'confirm' },
        { name: 'reject', value: 'reject' },
      )
  )
  .addStringOption((opt) =>
    opt.setName('reason')
      .setDescription('Reason for rejection (required when rejecting)')
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels);

export async function handleCloseCommand(interaction: ChatInputCommandInteraction) {
  // Check moderator role
  const member = interaction.guild!.members.cache.get(interaction.user.id)
    || await interaction.guild!.members.fetch(interaction.user.id);
  if (!member.roles.cache.has(config.DISCORD_MODERATOR_ROLE_ID)) {
    await interaction.reply({ content: 'Only moderators can close tickets.', ephemeral: true });
    return;
  }

  const channel = interaction.channel as TextChannel;
  const channelName = channel.name;
  const action = interaction.options.getString('action') || 'confirm';
  const reason = interaction.options.getString('reason') || '';

  if (action === 'reject' && !reason) {
    await interaction.reply({ content: 'Please provide a reason for rejection.', ephemeral: true });
    return;
  }

  // Determine type from channel name
  let type: 'deposit' | 'withdrawal';
  if (channelName.startsWith('deposit-')) {
    type = 'deposit';
  } else if (channelName.startsWith('withdraw-')) {
    type = 'withdrawal';
  } else {
    await interaction.reply({ content: 'This command can only be used in a ticket channel.', ephemeral: true });
    return;
  }

  await interaction.deferReply();

  try {
    // Read record ID from channel topic (set during channel creation)
    const recordId = channel.topic;
    if (!recordId) {
      await interaction.editReply({ content: 'Could not find the ticket record for this channel.' });
      return;
    }

    const closedBy = interaction.user.username;

    // Confirm or reject via API
    if (action === 'confirm') {
      if (type === 'deposit') {
        await apiClient.confirmDeposit(recordId, closedBy);
      } else {
        await apiClient.confirmWithdrawal(recordId, closedBy);
      }
    } else {
      if (type === 'deposit') {
        await apiClient.rejectDeposit(recordId, closedBy, reason);
      } else {
        await apiClient.rejectWithdrawal(recordId, closedBy, reason);
      }
    }

    // Extract ticket info from welcome embed
    const messages = await channel.messages.fetch({ limit: 10 });
    const welcomeMsg = messages.find(
      (m) => m.author.id === interaction.client.user!.id && m.embeds.length > 0
    );
    const fields = welcomeMsg?.embeds[0]?.fields;
    const username = fields?.find((f) => f.name === 'Player')?.value ?? '(unknown)';
    const itemName = fields?.find((f) => f.name === 'Item')?.value ?? '(unknown)';
    const quantity = parseInt(fields?.find((f) => f.name === 'Quantity')?.value ?? '0', 10);

    // Generate transcript
    const transcript = await generateTranscript(channel);

    // Send to ticket-logs
    const logsChannel = interaction.guild!.channels.cache.get(config.DISCORD_LOGS_CHANNEL_ID) as TextChannel;
    if (logsChannel) {
      const embed = buildTranscriptEmbed({
        channelName,
        type,
        username,
        itemName,
        quantity,
        result: action === 'confirm' ? 'confirmed' : 'rejected',
        closedBy,
        openedAt: channel.createdAt || new Date(),
      });

      await logsChannel.send({ embeds: [embed], files: [transcript] });
    }

    await interaction.editReply({ content: `Ticket ${action}ed. Deleting channel in 5 seconds...` });

    // Delete channel after brief delay
    setTimeout(async () => {
      try {
        await channel.delete();
      } catch (e) {
        console.error('Failed to delete ticket channel:', e);
      }
    }, 5000);

  } catch (err: any) {
    const message = err.message?.includes('already been closed')
      ? 'This ticket has already been closed.'
      : `Error closing ticket: ${err.message}`;
    await interaction.editReply({ content: message });
  }
}
