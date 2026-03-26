import { Client, GatewayIntentBits, Events } from 'discord.js';
import { config } from './config.js';
import { onReady } from './events/ready.js';
import { onInteractionCreate } from './events/interactionCreate.js';
import { onGuildMemberUpdate } from './events/boostDetect.js';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});

client.once(Events.ClientReady, onReady);
client.on(Events.InteractionCreate, onInteractionCreate);
client.on(Events.GuildMemberUpdate, onGuildMemberUpdate);

client.login(config.DISCORD_BOT_TOKEN);

// Graceful shutdown
function shutdown(signal: string) {
  console.log(`Received ${signal}. Shutting down...`);
  client.destroy();
  process.exit(0);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
