const fs = require('fs');
const path = require('path');
const MinecraftChatBot = require('./bot');
const ChatHandler = require('./chat');

// Load configuration
const configPath = path.join(__dirname, '..', 'config', 'config.json');

if (!fs.existsSync(configPath)) {
  console.error('Error: config/config.json not found');
  console.error('Please copy config/config.example.json to config/config.json and fill in your settings');
  process.exit(1);
}

const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

// Create bot instance
const bot = new MinecraftChatBot(config);

// Create chat handler
const chat = new ChatHandler(bot);

// Event handlers
bot.on('connected', (username) => {
  console.log(`Successfully connected as ${username}`);
});

bot.on('disconnected', (reason) => {
  console.log(`Bot disconnected: ${reason}`);
});

bot.on('error', (err) => {
  console.error('Bot error:', err);
});

// Chat message handler
chat.on('message', ({ username, message, type, timestamp }) => {
  const timeStr = timestamp.toISOString();
  console.log(`[${timeStr}] [${type}] ${username}: ${message}`);
});

// Raw message handler (system messages, etc.)
chat.on('raw', (text, position) => {
  if (position === 'system') {
    console.log(`[System] ${text}`);
  }
});

// Example command handler
chat.registerCommand('ping', (username, args, type) => {
  chat.send(`Pong, ${username}!`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down...');
  bot.disconnect();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\nReceived SIGTERM, shutting down...');
  bot.disconnect();
  process.exit(0);
});

// Start the bot
console.log('Starting Minecraft Chat Bot...');
bot.connect();

// Export for external use
module.exports = { bot, chat, MinecraftChatBot, ChatHandler };
