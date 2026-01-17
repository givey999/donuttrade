# Miau - Minecraft Chat Bot

A Node.js module for listening to Minecraft server chat, sending commands, and tracking payments. Built with [Mineflayer](https://github.com/PrismarineJS/mineflayer) for 24/7 operation.

## Features

- **Chat Listening** - Monitor all chat messages, whispers, and system messages
- **Command Sending** - Send chat messages and commands via console input
- **Payment Tracking** - Log incoming and outgoing payments with timestamps
- **Microsoft Authentication** - Secure login with automatic token refresh
- **Auto-Reconnect** - Exponential backoff reconnection (5s to 5min)
- **24/7 Operation** - PM2 configuration for continuous uptime

## Installation

```bash
git clone <repository-url>
cd miau
npm install
```

## Configuration

1. Copy the example config:
   ```bash
   cp config/config.example.json config/config.json
   ```

2. Edit `config/config.json`:
   ```json
   {
     "server": {
       "host": "your-server.example.com",
       "port": 25565,
       "version": "1.21.4"
     },
     "auth": {
       "type": "microsoft",
       "username": "your-email@example.com"
     },
     "reconnect": {
       "enabled": true,
       "initialDelay": 5000,
       "maxDelay": 300000
     }
   }
   ```

3. On first run, you'll be prompted to authenticate via browser with Microsoft.

## Usage

### Start the Bot

```bash
npm start        # Production
npm run dev      # Development (auto-reload)
```

### Console Commands

Once running, type directly in the console to send commands to Minecraft:

```
/pay username 1000      # Pay a player
/msg username Hello     # Send a message
/any-command            # Any Minecraft command
```

### 24/7 Operation with PM2

```bash
npm install -g pm2
pm2 start ecosystem.config.js
pm2 save
pm2 startup              # Enable auto-start on boot
```

## Payment Tracking

The bot automatically tracks payments in JSON log files.

### Incoming Payments

When someone pays you, it's logged to `logs/payments-in.log`:

```json
{"timestamp":"2026-01-17T12:30:00.000Z","username":".givey3917","amount":1500,"amountRaw":"1.5K."}
```

### Outgoing Payments

When you send `/pay` commands, they're logged to `logs/payments-out.log`:

```json
{"timestamp":"2026-01-17T12:35:00.000Z","username":"someuser","amount":1000000,"amountRaw":"1m"}
```

### Amount Format

Supports shorthand notation (case-insensitive):

| Suffix | Multiplier | Example |
|--------|------------|---------|
| K | 1,000 | `1.5k` = 1,500 |
| M | 1,000,000 | `2m` = 2,000,000 |
| B | 1,000,000,000 | `1b` = 1,000,000,000 |
| T | 1,000,000,000,000 | `1t` = 1,000,000,000,000 |

### Known Limitation

Incoming payment amounts are approximate due to server-side rounding:

| Displayed | Logged | Actual |
|-----------|--------|--------|
| `1.52K.` | 1,520 | 1,525 |
| `127.43K.` | 127,430 | 127,437 |
| `1.23M.` | 1,230,000 | 1,234,567 |

**Do not use incoming payment logs for exact accounting.**

## Project Structure

```
miau/
├── src/
│   ├── index.js       # Entry point, console input handler
│   ├── bot.js         # Connection and auto-reconnect logic
│   ├── chat.js        # Chat event handling
│   └── payments.js    # Payment parsing and logging
├── config/
│   └── config.example.json
├── logs/
│   ├── payments-in.log
│   └── payments-out.log
├── docs/
├── ecosystem.config.js  # PM2 configuration
└── package.json
```

## API Usage

The bot can also be used programmatically:

```javascript
const { MinecraftChatBot, ChatHandler, PaymentHandler } = require('./src/index');

const bot = new MinecraftChatBot({
  server: { host: 'mc.example.com' },
  auth: { type: 'microsoft', username: 'email@example.com' }
});

const chat = new ChatHandler(bot);

// Listen to chat messages
chat.on('message', ({ username, message, type, timestamp }) => {
  console.log(`${username}: ${message}`);
});

// Register custom commands (triggered by !commandname in chat)
chat.registerCommand('hello', (username, args, type) => {
  chat.send(`Hello, ${username}!`);
});

bot.connect();
```

## Clearing Auth Token

To log in with a different Microsoft account, delete the cached tokens:

```bash
# Windows
rmdir /s /q "%APPDATA%\.minecraft\nmp-cache"

# Linux/Mac
rm -rf ~/.minecraft/nmp-cache
```

## License

ISC
