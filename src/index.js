const fs = require('fs');
const path = require('path');
const readline = require('readline');
const MinecraftChatBot = require('./bot');
const ChatHandler = require('./chat');
const PaymentHandler = require('./payments');

// Suppress known protodef PartialReadError spam (server sends non-standard packets)
const originalConsoleError = console.error;
console.error = (...args) => {
  const msg = args[0]?.toString() || '';
  if (msg.includes('PartialReadError') || msg.includes('Chunk size is')) return;
  originalConsoleError.apply(console, args);
};

// Outgoing payments log
const outgoingPaymentsLog = path.join(__dirname, '..', 'logs', 'payments-out.log');

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

// Create payment handler
const payments = new PaymentHandler();

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

  // Process potential payment messages
  payments.processMessage(text);
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

// Console input handler
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const outgoingPayPattern = /^\/pay\s+(\S+)\s+(\d+(?:\.\d+)?[kmbt]?)/i;

function parseOutgoingAmount(amountStr) {
  let cleaned = amountStr.toLowerCase();
  let multiplier = 1;

  if (cleaned.endsWith('k')) {
    multiplier = 1000;
    cleaned = cleaned.slice(0, -1);
  } else if (cleaned.endsWith('m')) {
    multiplier = 1000000;
    cleaned = cleaned.slice(0, -1);
  } else if (cleaned.endsWith('b')) {
    multiplier = 1000000000;
    cleaned = cleaned.slice(0, -1);
  } else if (cleaned.endsWith('t')) {
    multiplier = 1000000000000;
    cleaned = cleaned.slice(0, -1);
  }

  return parseFloat(cleaned) * multiplier;
}

function logOutgoingPayment(username, amountRaw) {
  const amount = parseOutgoingAmount(amountRaw);
  const logEntry = {
    timestamp: new Date().toISOString(),
    username,
    amount,
    amountRaw
  };

  const logLine = JSON.stringify(logEntry) + '\n';

  fs.appendFile(outgoingPaymentsLog, logLine, (err) => {
    if (err) {
      console.error('[Payments] Failed to write outgoing log:', err.message);
    }
  });

  console.log(`[Payment Out] Sent $${amountRaw} (${amount}) to ${username}`);
}

rl.on('line', (input) => {
  const trimmed = input.trim();
  if (!trimmed) return;

  // Check for outgoing payment command
  const payMatch = trimmed.match(outgoingPayPattern);
  if (payMatch) {
    const [, username, amount] = payMatch;
    logOutgoingPayment(username, amount);
  }

  // Send to Minecraft
  bot.sendChat(trimmed);
});

// Start the bot
console.log('Starting Minecraft Chat Bot...');
bot.connect();

// Export for external use
module.exports = { bot, chat, payments, MinecraftChatBot, ChatHandler, PaymentHandler };
