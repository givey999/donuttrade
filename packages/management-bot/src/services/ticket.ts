import {
  Guild,
  ChannelType,
  PermissionFlagsBits,
  TextChannel,
} from 'discord.js';
import { config } from '../config.js';
import { apiClient } from '../api-client.js';
import { buildTicketWelcomeEmbed } from '../utils/embeds.js';

export async function createTicketChannel(guild: Guild, opts: {
  type: 'deposit' | 'withdrawal';
  userId: string; // Discord user ID
  recordId: string;
  username: string;
  itemName: string;
  quantity: number;
}): Promise<TextChannel> {
  const number = await apiClient.getNextTicketNumber();
  const channelName = `${opts.type === 'deposit' ? 'deposit' : 'withdraw'}-${number}`;

  const channel = await guild.channels.create({
    name: channelName,
    type: ChannelType.GuildText,
    parent: opts.type === 'deposit' ? config.DISCORD_DEPOSIT_CATEGORY_ID : config.DISCORD_WITHDRAWAL_CATEGORY_ID,
    topic: opts.recordId, // Store record ID for /close lookup
    permissionOverwrites: [
      {
        id: guild.id, // @everyone
        deny: [PermissionFlagsBits.ViewChannel],
      },
      {
        id: opts.userId,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.AttachFiles,
        ],
      },
      {
        id: config.DISCORD_MODERATOR_ROLE_ID,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.ManageMessages,
        ],
      },
      {
        id: guild.members.me!.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ManageChannels,
          PermissionFlagsBits.ReadMessageHistory,
        ],
      },
    ],
  });

  // Store channel ID and label on the record
  await apiClient.setTicketChannel(opts.type, opts.recordId, channel.id, channelName);

  // Send welcome embed + ping moderator role for instant notification
  const embed = buildTicketWelcomeEmbed({
    type: opts.type,
    number,
    username: opts.username,
    itemName: opts.itemName,
    quantity: opts.quantity,
  });

  await channel.send({
    content: `<@&${config.DISCORD_MODERATOR_ROLE_ID}>`,
    embeds: [embed],
  });

  return channel;
}
