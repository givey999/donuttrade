import { Client, GatewayIntentBits, Events } from 'discord.js';
import { config } from './config.js';
import { onReady } from './events/ready.js';
import { onInteractionCreate } from './events/interactionCreate.js';
import { onGuildMemberUpdate } from './events/boostDetect.js';
import { initDmNotifications } from './services/dm-notifications.js';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});

let dmSubscriber: ReturnType<typeof initDmNotifications> | null = null;

client.once(Events.ClientReady, (readyClient) => {
  onReady(readyClient);
  // Start DM notifications after bot is ready
  dmSubscriber = initDmNotifications(client);
});

client.on(Events.InteractionCreate, onInteractionCreate);
client.on(Events.GuildMemberUpdate, onGuildMemberUpdate);

client.login(config.DISCORD_BOT_TOKEN);

// Graceful shutdown
function shutdown(signal: string) {
  console.log(`Received ${signal}. Shutting down...`);
  if (dmSubscriber) dmSubscriber.disconnect();
  client.destroy();
  process.exit(0);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
