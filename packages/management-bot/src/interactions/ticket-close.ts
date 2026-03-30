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
  // Check moderator or support role
  const member = interaction.guild!.members.cache.get(interaction.user.id)
    || await interaction.guild!.members.fetch(interaction.user.id);
  const hasModRole = member.roles.cache.has(config.DISCORD_MODERATOR_ROLE_ID);
  const hasSupportRole = config.DISCORD_SUPPORT_ROLE_ID ? member.roles.cache.has(config.DISCORD_SUPPORT_ROLE_ID) : false;
  if (!hasModRole && !hasSupportRole) {
    await interaction.reply({ content: 'Only moderators or support staff can close tickets.', ephemeral: true });
    return;
  }

  const channel = interaction.channel as TextChannel;
  const channelName = channel.name;

  // Determine type from channel name
  const isSupport = channelName.startsWith('support-');
  let type: 'deposit' | 'withdrawal' | 'support';
  if (channelName.startsWith('deposit-')) {
    type = 'deposit';
  } else if (channelName.startsWith('withdraw-')) {
    type = 'withdrawal';
  } else if (isSupport) {
    type = 'support';
  } else {
    await interaction.reply({ content: 'This command can only be used in a ticket channel.', ephemeral: true });
    return;
  }

  await interaction.deferReply();

  try {
    const closedBy = interaction.user.username;
    const action = type !== 'support' ? (interaction.options.getString('action') || 'confirm') : 'confirm';
    const reason = type !== 'support' ? (interaction.options.getString('reason') || '') : '';

    // For deposit/withdrawal tickets, confirm or reject via API
    if (type !== 'support') {
      if (action === 'reject' && !reason) {
        await interaction.editReply({ content: 'Please provide a reason for rejection.' });
        return;
      }

      const recordId = channel.topic;
      if (!recordId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(recordId)) {
        await interaction.editReply({ content: 'Could not find a valid ticket record for this channel.' });
        return;
      }

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
    }

    // Transcript and cleanup
    try {
      const { transcript, allMessages } = await generateTranscript(channel);

      const logsChannel = interaction.guild!.channels.cache.get(config.DISCORD_LOGS_CHANNEL_ID) as TextChannel;
      if (logsChannel) {
        if (type === 'support') {
          // Simple log for support tickets
          const { EmbedBuilder } = await import('discord.js');
          const embed = new EmbedBuilder()
            .setTitle(channelName)
            .setColor(0x7C3AED)
            .addFields(
              { name: 'Type', value: 'Support', inline: true },
              { name: 'Closed by', value: closedBy, inline: true },
              { name: 'Opened', value: `<t:${Math.floor((channel.createdAt || new Date()).getTime() / 1000)}:R>`, inline: true },
            )
            .setTimestamp();
          await logsChannel.send({ content: channelName, embeds: [embed], files: [transcript] });
        } else {
          // Full transcript embed for deposit/withdrawal
          const welcomeMsg = allMessages.find(
            (m) => m.author.id === interaction.client.user!.id && m.embeds.length > 0
          );
          const fields = welcomeMsg?.embeds[0]?.fields;
          const username = fields?.find((f) => f.name === 'Player')?.value ?? '(unknown)';
          const itemName = fields?.find((f) => f.name === 'Item')?.value ?? '(unknown)';
          const quantity = parseInt(fields?.find((f) => f.name === 'Quantity')?.value ?? '0', 10);

          const embed = buildTranscriptEmbed({
            channelName,
            type: type as 'deposit' | 'withdrawal',
            username,
            itemName,
            quantity,
            result: action === 'confirm' ? 'confirmed' : 'rejected',
            closedBy,
            openedAt: channel.createdAt || new Date(),
          });
          await logsChannel.send({ content: channelName, embeds: [embed], files: [transcript] });
        }

        // Forward messages that have attachments to preserve them
        const messagesWithAttachments = allMessages.filter((m) => m.attachments.size > 0);
        for (const msg of messagesWithAttachments) {
          try {
            await msg.forward(logsChannel);
          } catch (fwdErr) {
            console.error(`Failed to forward message ${msg.id}:`, fwdErr);
          }
        }
      }
    } catch (transcriptErr) {
      console.error('Failed to generate/send transcript:', transcriptErr);
    }

    const closeMsg = isSupport
      ? 'Support ticket closed. Deleting channel in 5 seconds...'
      : 'Ticket closed. Deleting channel in 5 seconds...';
    await interaction.editReply({ content: closeMsg });

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
