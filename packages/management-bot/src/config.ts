import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '..', '..', '..', '.env') });

const envSchema = z.object({
  DISCORD_BOT_TOKEN: z.string().min(1),
  DISCORD_GUILD_ID: z.string().min(1),
  DISCORD_DEPOSIT_CATEGORY_ID: z.string().min(1),
  DISCORD_WITHDRAWAL_CATEGORY_ID: z.string().min(1),
  DISCORD_MODERATOR_ROLE_ID: z.string().min(1),
  DISCORD_PANEL_CHANNEL_ID: z.string().min(1),
  DISCORD_LOGS_CHANNEL_ID: z.string().min(1),
  DISCORD_BOOST_CHANNEL_ID: z.string().min(1).optional(),
  DISCORD_BOOST_BENEFITS_CHANNEL_ID: z.string().min(1).optional(),
  DISCORD_VERIFY_CHANNEL_ID: z.string().min(1).optional(),
  DISCORD_VERIFIED_ROLE_ID: z.string().min(1).optional(),
  API_URL: z.string().url().default('http://api:3001'),
  BOT_WEBHOOK_SECRET: z.string().min(32),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  // Auto-role config (optional)
  DISCORD_ROLE_ACTIVE_TRADER_ID: z.string().min(1).optional(),
  DISCORD_ROLE_TRUSTED_TRADER_ID: z.string().min(1).optional(),
  DISCORD_ROLE_ELITE_TRADER_ID: z.string().min(1).optional(),
});

const result = envSchema.safeParse(process.env);
if (!result.success) {
  console.error('Invalid environment variables:', result.error.format());
  process.exit(1);
}

export const config = result.data;
