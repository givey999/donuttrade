import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

const BRAND_COLOR = 0x7C3AED; // violet-600

export function buildPanelEmbed() {
  return new EmbedBuilder()
    .setTitle('DonutTrade Support')
    .setDescription('Need to deposit or withdraw items?\nClick below to create a ticket.')
    .setColor(BRAND_COLOR);
}

export function buildPanelButtons() {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('ticket_deposit')
      .setLabel('Deposit Items')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('\u{1F4E5}'),
    new ButtonBuilder()
      .setCustomId('ticket_withdraw')
      .setLabel('Withdraw Items')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('\u{1F4E4}'),
  );
}

export function buildTicketWelcomeEmbed(opts: {
  type: 'deposit' | 'withdrawal';
  number: number;
  username: string;
  itemName: string;
  quantity: number;
}) {
  const title = opts.type === 'deposit' ? `Deposit #${opts.number}` : `Withdrawal #${opts.number}`;
  return new EmbedBuilder()
    .setTitle(title)
    .setColor(opts.type === 'deposit' ? 0x57F287 : 0xED4245)
    .addFields(
      { name: 'Player', value: opts.username, inline: true },
      { name: 'Item', value: opts.itemName, inline: true },
      { name: 'Quantity', value: opts.quantity.toString(), inline: true },
    )
    .setDescription('A moderator will coordinate the in-game handoff with you.')
    .setFooter({ text: 'Moderators: use /close when the handoff is complete' })
    .setTimestamp();
}

export function buildTranscriptEmbed(opts: {
  channelName: string;
  type: 'deposit' | 'withdrawal';
  username: string;
  itemName: string;
  quantity: number;
  result: 'confirmed' | 'rejected';
  closedBy: string;
  openedAt: Date;
}) {
  return new EmbedBuilder()
    .setTitle(opts.channelName)
    .setColor(opts.result === 'confirmed' ? 0x57F287 : 0xED4245)
    .addFields(
      { name: 'Player', value: opts.username, inline: true },
      { name: 'Item', value: opts.itemName, inline: true },
      { name: 'Quantity', value: opts.quantity.toString(), inline: true },
      { name: 'Result', value: opts.result, inline: true },
      { name: 'Closed by', value: opts.closedBy, inline: true },
      { name: 'Opened', value: `<t:${Math.floor(opts.openedAt.getTime() / 1000)}:R>`, inline: true },
    )
    .setTimestamp();
}
