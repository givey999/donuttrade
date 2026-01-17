# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install          # Install dependencies
npm start            # Run the bot (production)
npm run dev          # Run with file watching (development)

# 24/7 operation with PM2
pm2 start ecosystem.config.js
pm2 logs miau-minecraft-bot
```

## Architecture

This is a Minecraft chat listener module built on Mineflayer. It connects to a Minecraft server, listens to chat, and can send commands.

### Core Components

**MinecraftChatBot** (`src/bot.js`) - Connection layer wrapping Mineflayer
- Manages connection lifecycle and Microsoft authentication
- Auto-reconnects with exponential backoff (5s initial → 5min max)
- Emits events: `connected`, `disconnected`, `kicked`, `error`, `chat`, `whisper`, `rawMessage`
- Exposes underlying `this.bot` (mineflayer instance) for direct access

**ChatHandler** (`src/chat.js`) - Higher-level chat interface
- Wraps MinecraftChatBot events, not mineflayer directly
- Command system with configurable prefix (default: `!`)
- Message filtering via `addFilter(fn)` before event emission
- Emits `message` objects with `{ username, message, type, timestamp }`

**PaymentHandler** (`src/payments.js`) - Payment tracking
- Parses incoming payments from system messages (`username paid you $amount`)
- Logs to `logs/payments-in.log` as JSON lines
- Handles K/M/B/T suffixes (e.g., `1.5K.` = 1500, `2M.` = 2000000)
- Note: Incoming amounts are approximate due to server rounding

**Console Input** (`src/index.js`) - Stdin command handler
- Type commands directly in console to send to Minecraft
- Outgoing `/pay` commands logged to `logs/payments-out.log`
- Parses K/M/B/T suffixes case-insensitively

### Data Flow

```
Minecraft Server → mineflayer → MinecraftChatBot → ChatHandler → your handlers
                                    (events)          (filtering, commands)
```

### Configuration

Config lives in `config/config.json` (copy from `config.example.json`). Required fields:
- `server.host` - Server address
- `auth.username` - Microsoft account email
- `auth.type` - Should be `"microsoft"` for authenticated servers

First run prompts for Microsoft OAuth in browser; tokens are cached in `%APPDATA%\.minecraft\nmp-cache\` (Windows).

### Log Files

- `logs/payments-in.log` - Incoming payments (JSON lines)
- `logs/payments-out.log` - Outgoing payments (JSON lines)

Log entry format:
```json
{"timestamp":"...","username":"player","amount":1000,"amountRaw":"1K."}
```
