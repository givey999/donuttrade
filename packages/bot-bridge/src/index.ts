import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MinecraftChatBot } from './bot.js';
import { PaymentHandler } from './payment-handler.js';
import { WebhookClient } from './webhook-client.js';

// Load env from monorepo root .env
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '..', '..', '..', '.env') });

// Required env vars
const MC_SERVER_HOST = process.env.MC_SERVER_HOST;
const MC_BOT_USERNAME = process.env.MC_BOT_USERNAME;
const BOT_WEBHOOK_SECRET = process.env.BOT_WEBHOOK_SECRET;
const API_URL = process.env.API_URL || 'https://moldo.go.ro:9443';

if (!MC_SERVER_HOST || !MC_BOT_USERNAME || !BOT_WEBHOOK_SECRET) {
  console.error('[Bot Bridge] Missing required env vars: MC_SERVER_HOST, MC_BOT_USERNAME, BOT_WEBHOOK_SECRET');
  process.exit(1);
}

const bot = new MinecraftChatBot({
  server: {
    host: MC_SERVER_HOST,
    port: parseInt(process.env.MC_SERVER_PORT || '25565', 10),
    version: process.env.MC_SERVER_VERSION || false,
  },
  auth: {
    username: MC_BOT_USERNAME,
    type: 'microsoft',
  },
});

const paymentHandler = new PaymentHandler();
const webhookClient = new WebhookClient(API_URL, BOT_WEBHOOK_SECRET);

// Listen for system messages (position 'system') that may contain payments
bot.on('rawMessage', (text: string, position: string) => {
  // Only process system messages (payments appear as system messages)
  if (position !== 'system') return;

  const payment = paymentHandler.parsePayment(text);
  if (!payment) return;

  console.log(`[Payment] ${payment.username} paid $${payment.amountRaw} (parsed: ${payment.amount})`);

  // Report to API (fire and forget — errors logged internally)
  webhookClient.reportPayment(payment.username, payment.amount);
});

bot.on('connected', (username: string) => {
  console.log(`[Bot Bridge] Connected as ${username}, monitoring payments...`);
});

bot.on('error', (err: Error) => {
  console.error(`[Bot Bridge] Error: ${err.message}`);
});

// Start the bot
console.log(`[Bot Bridge] Starting verification bot → ${MC_SERVER_HOST}`);
bot.connect();

// Graceful shutdown
const shutdown = () => {
  console.log('[Bot Bridge] Shutting down...');
  bot.disconnect();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
