import { Interaction } from 'discord.js';
import { handleTicketButton, handleModalSubmit } from '../interactions/ticket-modal.js';
import { handleCloseCommand } from '../interactions/ticket-close.js';
import { handleAnnounceCommand, handleAnnounceModal } from '../interactions/announce.js';

export async function onInteractionCreate(interaction: Interaction) {
  try {
    if (interaction.isButton()) {
      if (interaction.customId === 'ticket_deposit' || interaction.customId === 'ticket_withdraw') {
        return await handleTicketButton(interaction);
      }
    }

    if (interaction.isModalSubmit()) {
      if (interaction.customId === 'modal_deposit' || interaction.customId === 'modal_withdrawal') {
        return await handleModalSubmit(interaction);
      }
      if (interaction.customId.startsWith('announce_')) {
        return await handleAnnounceModal(interaction);
      }
    }

    if (interaction.isChatInputCommand()) {
      if (interaction.commandName === 'close') {
        return await handleCloseCommand(interaction);
      }
      if (interaction.commandName === 'announce') {
        return await handleAnnounceCommand(interaction);
      }
    }
  } catch (err) {
    console.error('Interaction handler error:', err);
    if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: 'An error occurred.', ephemeral: true }).catch(() => {});
    }
  }
}
