import { Interaction } from 'discord.js';
import { handleTicketButton, handleModalSubmit } from '../interactions/ticket-modal.js';
import { handleCloseCommand } from '../interactions/ticket-close.js';

export async function onInteractionCreate(interaction: Interaction) {
  try {
    if (interaction.isButton()) {
      if (interaction.customId === 'ticket_deposit' || interaction.customId === 'ticket_withdraw') {
        return handleTicketButton(interaction);
      }
    }

    if (interaction.isModalSubmit()) {
      if (interaction.customId === 'modal_deposit' || interaction.customId === 'modal_withdrawal') {
        return handleModalSubmit(interaction);
      }
    }

    if (interaction.isChatInputCommand()) {
      if (interaction.commandName === 'close') {
        return handleCloseCommand(interaction);
      }
    }
  } catch (err) {
    console.error('Interaction handler error:', err);
    if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: 'An error occurred.', ephemeral: true }).catch(() => {});
    }
  }
}
