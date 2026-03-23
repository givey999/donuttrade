import {
  ButtonInteraction,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ModalSubmitInteraction,
} from 'discord.js';
import { apiClient } from '../api-client.js';
import { createTicketChannel } from '../services/ticket.js';

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
    const message = err.message?.includes('expired') || err.message?.includes('Invalid')
      ? 'Invalid or expired code. Please generate a new one on the website.'
      : err.message?.includes('already been used')
        ? 'This code has already been used.'
        : 'Could not reach the platform. Please try again later.';

    await interaction.editReply({ content: message });
  }
}
