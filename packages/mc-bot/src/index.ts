import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MinecraftBot } from './bot.js';
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
const WITHDRAWAL_POLL_INTERVAL = parseInt(process.env.WITHDRAWAL_POLL_INTERVAL || '5000', 10);

// Amount threshold: payments under this go to verification, at or above go to deposit
const DEPOSIT_THRESHOLD = 1000;

if (!MC_SERVER_HOST || !MC_BOT_USERNAME || !BOT_WEBHOOK_SECRET) {
  console.error('[Bot] Missing required env vars: MC_SERVER_HOST, MC_BOT_USERNAME, BOT_WEBHOOK_SECRET');
  process.exit(1);
}

const bot = new MinecraftBot({
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

// Track whether we're currently processing withdrawals to avoid overlap
let processingWithdrawals = false;

// ─── Payment routing ────────────────────────────────────────────────────────────

bot.on('rawMessage', async (text: string, position: string) => {
  // Only process system messages (payments appear as system messages)
  if (position !== 'system') return;

  const payment = paymentHandler.parsePayment(text);
  if (!payment) return;

  if (payment.amount < DEPOSIT_THRESHOLD) {
    // Route to verification — amounts under $1,000
    console.log(`[Verification] ${payment.username} paid $${payment.amountRaw} (parsed: ${payment.amount})`);
    const matched = await webhookClient.reportVerification(payment.username, payment.amount);
    if (!matched) {
      console.log(`[Verification] No pending verification matched for ${payment.username} — ignored`);
    }
  } else {
    // Route to deposit — amounts $1,000+
    console.log(`[Deposit] ${payment.username} paid $${payment.amountRaw} (parsed: ${payment.amount})`);
    const result = await webhookClient.reportDeposit(payment.username, payment.amount);
    if (!result) {
      console.error(`[Deposit] Failed to report deposit from ${payment.username}`);
      return;
    }

    if (result.deposited) {
      console.log(`[Deposit] Credited $${result.deposit!.amount} to ${payment.username} (balance: $${result.deposit!.balanceAfter})`);
    } else if (result.refund) {
      console.log(`[Deposit] Refunding $${result.refundAmount} to ${payment.username} (deposit rejected)`);
      bot.sendCommand(`/pay ${payment.username} ${result.refundAmount}`);
    } else {
      console.log(`[Deposit] Ignored deposit from ${payment.username} (unknown/unverified user)`);
    }
  }
});

// ─── Withdrawal polling ────────────────────────────────────────────────────────

async function processWithdrawals() {
  if (processingWithdrawals) return;
  if (!bot.isConnectedNow()) return;

  processingWithdrawals = true;

  try {
    const pending = await webhookClient.fetchPendingWithdrawals();

    for (const withdrawal of pending) {
      console.log(`[Withdrawal] Processing: $${withdrawal.amount} to ${withdrawal.username} (id: ${withdrawal.id})`);

      try {
        // Claim the withdrawal first (mark as 'processing') to prevent duplicate processing
        const claimed = await webhookClient.claimWithdrawal(withdrawal.id);
        if (!claimed) {
          console.log(`[Withdrawal] Could not claim ${withdrawal.id} — already claimed or completed`);
          continue;
        }

        // Send /pay and wait for server to confirm or reject
        const payResult = await bot.sendPayAndWait(withdrawal.username, withdrawal.amount);

        if (payResult.success) {
          const confirmed = await webhookClient.confirmWithdrawal(withdrawal.id);
          if (confirmed) {
            console.log(`[Withdrawal] Completed: $${withdrawal.amount} to ${withdrawal.username}`);
          } else {
            console.error(`[Withdrawal] API failed to confirm withdrawal ${withdrawal.id}`);
          }
        } else {
          const reason = payResult.reason || 'Payment rejected by server';
          console.error(`[Withdrawal] Server rejected /pay for ${withdrawal.id}: ${reason}`);
          await webhookClient.failWithdrawal(withdrawal.id, reason);
        }
      } catch (err) {
        console.error(`[Withdrawal] Error processing ${withdrawal.id}:`, (err as Error).message);
        await webhookClient.failWithdrawal(withdrawal.id, (err as Error).message);
      }
    }
  } catch (err) {
    console.error('[Withdrawal] Polling error:', (err as Error).message);
  } finally {
    processingWithdrawals = false;
  }
}

// ─── Bot events ────────────────────────────────────────────────────────────────

let pollInterval: ReturnType<typeof setInterval> | null = null;

bot.on('connected', (username: string) => {
  console.log(`[Bot] Connected as ${username} — monitoring payments & processing withdrawals`);

  // Start polling for pending withdrawals
  if (pollInterval) clearInterval(pollInterval);
  pollInterval = setInterval(processWithdrawals, WITHDRAWAL_POLL_INTERVAL);
});

bot.on('disconnected', () => {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
});

bot.on('error', (err: Error) => {
  console.error(`[Bot] Error: ${err.message}`);
});

// Start the bot
console.log(`[Bot] Starting → ${MC_SERVER_HOST}`);
bot.connect();

// Graceful shutdown
const shutdown = () => {
  console.log('[Bot] Shutting down...');
  if (pollInterval) clearInterval(pollInterval);
  bot.disconnect();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
