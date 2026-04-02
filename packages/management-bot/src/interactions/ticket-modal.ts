import {
  ButtonInteraction,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ModalSubmitInteraction,
  ChannelType,
  PermissionFlagsBits,
} from 'discord.js';
import { EmbedBuilder } from 'discord.js';
import { apiClient } from '../api-client.js';
import { createTicketChannel } from '../services/ticket.js';
import { buildSupportWelcomeEmbed } from '../utils/embeds.js';
import { config } from '../config.js';

// Per-user cooldown: 1 modal per 10 seconds
const cooldowns = new Map<string, number>();
const COOLDOWN_MS = 10_000;

export async function handleTicketButton(interaction: ButtonInteraction) {
  const userId = interaction.user.id;

  // Rate limit check
  const lastUse = cooldowns.get(userId) || 0;
  if (Date.now() - lastUse < COOLDOWN_MS) {
    const remaining = Math.ceil((COOLDOWN_MS - (Date.now() - lastUse)) / 1000);
    await interaction.reply({ content: `Please wait ${remaining}s before creating another ticket.`, ephemeral: true });
    return;
  }
  cooldowns.set(userId, Date.now());

  const type = interaction.customId === 'ticket_deposit' ? 'deposit' : 'withdrawal';
  const prefix = type === 'deposit' ? 'DT-DEP-' : 'DT-WTH-';

  const modal = new ModalBuilder()
    .setCustomId(`modal_${type}`)
    .setTitle(type === 'deposit' ? 'Deposit Items' : 'Withdraw Items');

  const codeInput = new TextInputBuilder()
    .setCustomId('code_input')
    .setLabel('Paste your code from the DonutTrade website')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder(`${prefix}eyJ...`)
    .setRequired(true);

  modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(codeInput));
  await interaction.showModal(modal);
}

export async function handleModalSubmit(interaction: ModalSubmitInteraction) {
  await interaction.deferReply({ ephemeral: true });

  const code = interaction.fields.getTextInputValue('code_input').trim();
  const type = interaction.customId === 'modal_deposit' ? 'deposit' : 'withdrawal';

  try {
    const result = await apiClient.verifyCode(code);

    const channel = await createTicketChannel(interaction.guild!, {
      type,
      userId: interaction.user.id,
      recordId: result.data.recordId,
      username: result.data.username,
      itemName: result.data.catalogItemDisplayName,
      quantity: result.data.quantity,
    });

    await interaction.editReply({ content: `Ticket created: ${channel}` });
  } catch (err: any) {
    console.error('Ticket creation failed:', err);
    const message = err.message?.includes('expired') || err.message?.includes('Invalid')
      ? 'Invalid or expired code. Please generate a new one on the website.'
      : err.message?.includes('already been used')
        ? 'This code has already been used.'
        : 'Could not reach the platform. Please try again later.';

    await interaction.editReply({ content: message });
  }
}

// ─── Support Ticket ──────────────────────────────────────

export async function handleSupportButton(interaction: ButtonInteraction) {
  const userId = interaction.user.id;

  // Separate cooldown key so support doesn't block deposit/withdrawal and vice versa
  const cooldownKey = `${userId}:support`;
  const lastUse = cooldowns.get(cooldownKey) || 0;
  if (Date.now() - lastUse < COOLDOWN_MS) {
    const remaining = Math.ceil((COOLDOWN_MS - (Date.now() - lastUse)) / 1000);
    await interaction.reply({ content: `Please wait ${remaining}s before creating another ticket.`, ephemeral: true });
    return;
  }
  cooldowns.set(cooldownKey, Date.now());

  const modal = new ModalBuilder()
    .setCustomId('modal_support')
    .setTitle('Support Ticket');

  const subjectInput = new TextInputBuilder()
    .setCustomId('support_subject')
    .setLabel('What do you need help with?')
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder('Describe your issue or question...')
    .setRequired(true)
    .setMaxLength(500);

  modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(subjectInput));
  await interaction.showModal(modal);
}

export async function handleSupportModal(interaction: ModalSubmitInteraction) {
  await interaction.deferReply({ ephemeral: true });

  const subject = interaction.fields.getTextInputValue('support_subject').trim();

  if (!config.DISCORD_SUPPORT_CATEGORY_ID) {
    await interaction.editReply({ content: 'Support tickets are not configured. Please contact a moderator directly.' });
    return;
  }

  try {
    const number = await apiClient.getNextTicketNumber();
    const channelName = `support-${number}`;

    const guild = interaction.guild!;
    const supportRoleId = config.DISCORD_SUPPORT_ROLE_ID || config.DISCORD_MODERATOR_ROLE_ID;

    const permissionOverwrites = [
      {
        id: guild.id,
        deny: [PermissionFlagsBits.ViewChannel],
      },
      {
        id: interaction.user.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.AttachFiles,
        ],
      },
      {
        id: supportRoleId,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.ManageMessages,
          PermissionFlagsBits.AttachFiles,
        ],
      },
      {
        id: interaction.client.user!.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ManageChannels,
          PermissionFlagsBits.ReadMessageHistory,
        ],
      },
    ];

    const channel = await guild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      parent: config.DISCORD_SUPPORT_CATEGORY_ID,
      permissionOverwrites,
    });

    const embed = buildSupportWelcomeEmbed({
      number,
      userTag: interaction.user.toString(),
      subject,
    });

    await channel.send({
      content: `<@&${supportRoleId}>`,
      embeds: [embed],
    });

    await interaction.editReply({ content: `Ticket created: ${channel}` });
  } catch (err) {
    console.error('Support ticket creation failed:', err);
    await interaction.editReply({ content: 'Failed to create support ticket. Please try again later.' });
  }
}

// ─── Owner Ticket ───────────────────────────────────────

export async function handleOwnerButton(interaction: ButtonInteraction) {
  const userId = interaction.user.id;

  const cooldownKey = `${userId}:owner`;
  const lastUse = cooldowns.get(cooldownKey) || 0;
  if (Date.now() - lastUse < COOLDOWN_MS) {
    const remaining = Math.ceil((COOLDOWN_MS - (Date.now() - lastUse)) / 1000);
    await interaction.reply({ content: `Please wait ${remaining}s before creating another ticket.`, ephemeral: true });
    return;
  }
  cooldowns.set(cooldownKey, Date.now());

  if (!config.DISCORD_OWNER_CATEGORY_ID) {
    await interaction.reply({ content: 'Owner tickets are not configured.', ephemeral: true });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  try {
    const number = await apiClient.getNextTicketNumber();
    const channelName = `owner-${number}`;

    const guild = interaction.guild!;

    const permissionOverwrites = [
      {
        id: guild.id,
        deny: [PermissionFlagsBits.ViewChannel],
      },
      {
        id: interaction.user.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.AttachFiles,
        ],
      },
      {
        id: interaction.client.user!.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ManageChannels,
          PermissionFlagsBits.ReadMessageHistory,
        ],
      },
    ];

    const channel = await guild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      parent: config.DISCORD_OWNER_CATEGORY_ID,
      permissionOverwrites,
    });

    const embed = new EmbedBuilder()
      .setColor(0x7C3AED)
      .setTitle(`Owner Ticket #${number}`)
      .setDescription(
        'Welcome! Please describe what you\'re looking for\n' +
        '(ad placement, sponsorship, partnership, etc).\n\n' +
        '**meya420** or **givey** will respond as soon as\n' +
        'possible — this may take some time as we review\n' +
        'each inquiry personally.'
      )
      .setFooter({ text: 'Use /close to close this ticket' })
      .setTimestamp();

    await channel.send({ embeds: [embed] });

    await interaction.editReply({ content: `Ticket created: ${channel}` });
  } catch (err) {
    console.error('Owner ticket creation failed:', err);
    await interaction.editReply({ content: 'Failed to create ticket. Please try again later.' });
  }
}
