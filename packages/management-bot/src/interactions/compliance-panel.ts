import { Client, TextChannel, EmbedBuilder, AttachmentBuilder } from 'discord.js';
import { config } from '../config.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const BRAND_COLOR = 0x7C3AED;
const GREEN = 0x57F287;

// ── Embed Builders ──────────────────────────────────────────────────────

function buildHeaderEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(BRAND_COLOR)
    .setTitle('── Rule Compliance ──')
    .setDescription(
      'DonutTrade was built with one principle in mind:\n' +
      '**play fair, trade safe.**\n\n' +
      'This channel provides a full breakdown of how\n' +
      'our platform operates within DonutSMP\'s rules\n' +
      '— with evidence to back it up.\n\n' +
      '▼  Read below for details'
    );
}

function buildRulesEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(BRAND_COLOR)
    .setTitle('Official DonutSMP Rules')
    .setImage('attachment://rules.png')
    .setDescription(
      'Above are the official DonutSMP server rules.\n' +
      'Below is a full breakdown of every rule that\n' +
      'could relate to a trading platform — and how\n' +
      'we handle each one.'
    )
    .addFields(
      {
        name: '⚬  No Macros or Scripts',
        value:
          'Our platform does not execute any macros or ' +
          'scripts on the Minecraft server. The console ' +
          'client only reads chat messages and sends ' +
          'manual /pay commands — each one triggered ' +
          'by a real moderator clicking "Approve."',
      },
      {
        name: '⚬  No Auto Clicker',
        value:
          'Nothing on our platform clicks anything. ' +
          'There is no mouse simulation, no automated ' +
          'inputs, no interaction with the game world. ' +
          'The console client is text-only.',
      },
      {
        name: '⚬  No Abusing Bugs',
        value:
          'We do not exploit any server bugs or glitches. ' +
          'All transactions use the standard /pay command ' +
          'that DonutSMP provides to all players.',
      },
      {
        name: '⚬  No IRL Trading',
        value:
          'We do not facilitate IRL trading.\n' +
          'See the dedicated section below for\n' +
          'a full explanation. ▼',
      },
    );
}

function buildIrlTradingEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(GREEN)
    .setTitle('In-Game Only — Not IRL Trading')
    .setDescription(
      'The "No IRL Trading" rule exists to prevent\n' +
      'players from selling in-game items or currency\n' +
      'for real-world money (PayPal, crypto, gift\n' +
      'cards, etc).\n\n' +
      'DonutTrade does not involve real money\n' +
      'in any way when it comes to trading.'
    )
    .addFields(
      {
        name: 'What We Do',
        value:
          '◈  In-game money  →  in-game items\n' +
          '◈  In-game items  →  in-game money\n' +
          '◈  Everything stays in the game economy',
      },
      {
        name: 'What We Don\'t Do',
        value:
          '✕  No real money accepted or paid out\n' +
          '✕  No PayPal, crypto, or gift cards\n' +
          '✕  No external transactions of any kind',
      },
      {
        name: 'Why This Is Allowed',
        value:
          'Trading items for in-game currency is ' +
          'something every player already does.\n\n' +
          'DonutTrade simply provides a safer way ' +
          'to do it — with escrow protection, fair ' +
          'pricing, and no risk of being scammed.\n\n' +
          'If trading items for in-game money was ' +
          'against the rules, the /pay command ' +
          'wouldn\'t exist.',
      },
      {
        name: 'A Note About Ads',
        value:
          'Our website displays advertisements to ' +
          'help cover hosting costs. This is entirely ' +
          'separate from the server\'s economy — no ' +
          'in-game items or currency are involved.\n\n' +
          'Many other DonutSMP community servers ' +
          'and platforms do the same.',
      },
    );
}

function buildProofEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(BRAND_COLOR)
    .setTitle('Console Clients Are Allowed')
    .setImage('attachment://proof.png')
    .setDescription(
      'A DonutSMP admin confirmed that console clients\n' +
      'are permitted on the server (see above).\n\n' +
      'DonutTrade uses a console client to connect\n' +
      '— the same type confirmed as allowed.\n\n' +
      'We do not run scripts, macros, or any form\n' +
      'of automation that would break the rules.'
    )
    .setFooter({ text: '📸 Credit: DonutSMP News Discord server' });
}

function buildHowItWorksEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(BRAND_COLOR)
    .setTitle('How Every Feature Works')
    .addFields(
      {
        name: '💰  Money Deposits',
        value:
          'A player sends a payment in-game. Our console ' +
          'client reads the chat message to detect it. ' +
          'No scripts, no macros — just receiving ' +
          'a message.',
      },
      {
        name: '💸  Money Withdrawals',
        value:
          'Every withdrawal is manually reviewed and ' +
          'approved by a moderator before anything ' +
          'is sent. Nothing is automated.',
      },
      {
        name: '📦  Item Deposits & Withdrawals',
        value:
          'All item transfers happen through Discord ' +
          'tickets. A moderator coordinates the handoff ' +
          'directly with the player — fully manual.',
      },
      {
        name: '🛒  Marketplace',
        value:
          'Orders are matched on our website. The actual ' +
          'transfers use the manual processes above. ' +
          'No automation touches the server.',
      },
    );
}

// ── Panel Initialization ────────────────────────────────────────────────

export async function ensureCompliancePanel(client: Client<true>): Promise<void> {
  const channelId = config.DISCORD_COMPLIANCE_CHANNEL_ID;
  if (!channelId) return;

  const channel = client.channels.cache.get(channelId);
  if (!channel?.isTextBased()) {
    console.error(`Compliance channel ${channelId} not found or not text-based`);
    return;
  }

  const textChannel = channel as TextChannel;
  const messages = await textChannel.messages.fetch({ limit: 50 });
  const existing = messages.find(
    (m) => m.author.id === client.user.id && m.embeds.some((e) => e.title === '── Rule Compliance ──')
  );

  if (existing) {
    console.log('Compliance panel already exists, skipping creation');
    return;
  }

  try {
    // Resolve image paths — in Docker: /app/packages/management-bot/assets/
    // Locally: relative to dist/interactions/
    const assetsDir = path.resolve(__dirname, '..', '..', 'assets');
    const rulesPath = path.join(assetsDir, 'rules.png');
    const proofPath = path.join(assetsDir, 'proof.png');

    const rulesAttachment = new AttachmentBuilder(rulesPath, { name: 'rules.png' });
    const proofAttachment = new AttachmentBuilder(proofPath, { name: 'proof.png' });

    // Message 1: Header + Rules (with rules.png)
    await textChannel.send({
      embeds: [buildHeaderEmbed(), buildRulesEmbed()],
      files: [rulesAttachment],
    });

    // Message 2: IRL Trading + Proof (with proof.png)
    await textChannel.send({
      embeds: [buildIrlTradingEmbed(), buildProofEmbed()],
      files: [proofAttachment],
    });

    // Message 3: How It Works
    await textChannel.send({
      embeds: [buildHowItWorksEmbed()],
    });

    console.log('Compliance panel sent');
  } catch (err) {
    console.error('Failed to send compliance panel (check bot permissions in channel):', (err as Error).message);
  }
}
