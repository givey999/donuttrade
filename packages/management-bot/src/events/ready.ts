import { Client, REST, Routes } from 'discord.js';
import { config } from '../config.js';
import { ensurePanel } from '../interactions/ticket-panel.js';
import { ensureVerifyPanel } from '../interactions/verify-gate.js';
import { closeCommandData } from '../interactions/ticket-close.js';
import { announceCommandData } from '../interactions/announce.js';
import { statsCommandData } from '../interactions/stats.js';
import { balanceCommandData } from '../interactions/balance.js';
import { ordersCommandData } from '../interactions/orders.js';
import { helpCommandData } from '../interactions/help.js';
import { leaderboardCommandData } from '../interactions/leaderboard.js';

export async function onReady(client: Client<true>) {
  console.log(`Management bot logged in as ${client.user.tag}`);
  console.log(`Serving guild: ${config.DISCORD_GUILD_ID}`);

  // Register all slash commands (guild-scoped for instant availability)
  const rest = new REST({ version: '10' }).setToken(config.DISCORD_BOT_TOKEN);
  try {
    const commands = [
      closeCommandData,
      announceCommandData,
      statsCommandData,
      balanceCommandData,
      ordersCommandData,
      helpCommandData,
      leaderboardCommandData,
    ];
    await rest.put(
      Routes.applicationGuildCommands(client.user.id, config.DISCORD_GUILD_ID),
      { body: commands.map(c => c.toJSON()) },
    );
    console.log(`Registered ${commands.length} slash commands`);
  } catch (err) {
    console.error('Failed to register slash commands:', err);
  }

  // Ensure persistent panels exist
  await ensurePanel(client);
  await ensureVerifyPanel(client);
}
