import { Interaction } from 'discord.js';
import { handleTicketButton, handleModalSubmit, handleSupportButton, handleSupportModal, handleOwnerButton } from '../interactions/ticket-modal.js';
import { handleCloseCommand } from '../interactions/ticket-close.js';
import { handleAnnounceCommand, handleAnnounceModal } from '../interactions/announce.js';
import { handleVerifyButton } from '../interactions/verify-gate.js';
import { handleStatsCommand } from '../interactions/stats.js';
import { handleBalanceCommand } from '../interactions/balance.js';
import { handleOrdersCommand } from '../interactions/orders.js';
import { handleHelpCommand } from '../interactions/help.js';
import { handleLeaderboardCommand } from '../interactions/leaderboard.js';
import { apiClient } from '../api-client.js';

export async function onInteractionCreate(interaction: Interaction) {
  try {
    if (interaction.isButton()) {
      if (interaction.customId === 'ticket_deposit' || interaction.customId === 'ticket_withdraw') {
        return await handleTicketButton(interaction);
      }
      if (interaction.customId === 'ticket_support') {
        return await handleSupportButton(interaction);
      }
      if (interaction.customId === 'ticket_owner') {
        return await handleOwnerButton(interaction);
      }
      if (interaction.customId === 'verify_gate') {
        return await handleVerifyButton(interaction);
      }
      if (interaction.customId.startsWith('dm_unsubscribe:')) {
        const userId = interaction.customId.split(':')[1]!;
        try {
          await apiClient.disableDmNotifications(userId);
          await interaction.update({
            content: 'You have been unsubscribed from notifications.',
            embeds: [],
            components: [],
          });
        } catch {
          await interaction.reply({ content: 'Failed to unsubscribe. Please try again.', ephemeral: true });
        }
        return;
      }
    }

    if (interaction.isModalSubmit()) {
      if (interaction.customId === 'modal_deposit' || interaction.customId === 'modal_withdrawal') {
        return await handleModalSubmit(interaction);
      }
      if (interaction.customId === 'modal_support') {
        return await handleSupportModal(interaction);
      }
      if (interaction.customId.startsWith('announce_')) {
        return await handleAnnounceModal(interaction);
      }
    }

    if (interaction.isChatInputCommand()) {
      switch (interaction.commandName) {
        case 'close': return await handleCloseCommand(interaction);
        case 'announce': return await handleAnnounceCommand(interaction);
        case 'stats': return await handleStatsCommand(interaction);
        case 'balance': return await handleBalanceCommand(interaction);
        case 'orders': return await handleOrdersCommand(interaction);
        case 'help': return await handleHelpCommand(interaction);
        case 'leaderboard': return await handleLeaderboardCommand(interaction);
      }
    }
  } catch (err) {
    console.error('Interaction handler error:', err);
    if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: 'An error occurred.', ephemeral: true }).catch(() => {});
    }
  }
}
