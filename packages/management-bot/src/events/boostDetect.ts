import { GuildMember, PartialGuildMember, TextChannel, EmbedBuilder } from 'discord.js';
import { config } from '../config.js';

const BRAND_COLOR = 0x7C3AED; // violet-600

export async function onGuildMemberUpdate(oldMember: GuildMember | PartialGuildMember, newMember: GuildMember) {
  // Only process in our guild
  if (newMember.guild.id !== config.DISCORD_GUILD_ID) return;

  // Detect new boost: premiumSince was null, now is set
  if (oldMember.premiumSince || !newMember.premiumSince) return;

  const channelId = config.DISCORD_BOOST_CHANNEL_ID;
  if (!channelId) return;

  const channel = newMember.guild.channels.cache.get(channelId) as TextChannel | undefined;
  if (!channel) return;

  const embed = new EmbedBuilder()
    .setColor(BRAND_COLOR)
    .setDescription(
      `⟢ We have a new booster!\n\n` +
      `・Thank you for boosting!\n\n` +
      `・See the benefits in <#${config.DISCORD_BOOST_BENEFITS_CHANNEL_ID || channelId}>`
    );

  try {
    await channel.send({
      content: `<@${newMember.id}> is very rich!`,
      embeds: [embed],
    });
  } catch (err) {
    console.error('Failed to send boost notification:', err);
  }
}
