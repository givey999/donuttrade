import { Client, REST, Routes } from 'discord.js';
import { config } from '../config.js';
import { ensurePanel } from '../interactions/ticket-panel.js';
import { closeCommandData } from '../interactions/ticket-close.js';

export async function onReady(client: Client<true>) {
  console.log(`Management bot logged in as ${client.user.tag}`);
  console.log(`Serving guild: ${config.DISCORD_GUILD_ID}`);

  // Register /close slash command (guild-scoped for instant availability)
  const rest = new REST({ version: '10' }).setToken(config.DISCORD_BOT_TOKEN);
  try {
    await rest.put(
      Routes.applicationGuildCommands(client.user.id, config.DISCORD_GUILD_ID),
      { body: [closeCommandData.toJSON()] },
    );
    console.log('Registered /close slash command');
  } catch (err) {
    console.error('Failed to register slash commands:', err);
  }

  // Ensure persistent panel exists
  await ensurePanel(client);
}
