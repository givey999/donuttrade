# Initial Build Summary

## Project Overview

**Name:** miau - Minecraft Chat Listener Module
**Created:** January 2026
**Technology:** Node.js + Mineflayer

A module capable of listening to Minecraft server chat, sending commands, and running 24/7 with automatic reconnection.

---

## Project Structure

```
miau/
├── src/
│   ├── index.js          # Entry point with example usage
│   ├── bot.js            # Bot connection with auto-reconnect
│   └── chat.js           # Chat event handling
├── config/
│   └── config.example.json
├── docs/
│   ├── minecraft-chat-listener-research.md
│   └── initial-build-summary.md
├── logs/
├── package.json
├── ecosystem.config.js   # PM2 24/7 config
└── .gitignore
```

---

## Components

### 1. MinecraftChatBot (`src/bot.js`)

Core bot class handling connection and reconnection logic.

**Features:**
- Mineflayer-based connection
- Microsoft authentication support
- Auto-reconnect with exponential backoff (5s initial, 5min max)
- Event emission for connection states

**Events emitted:**
- `connected` - Bot spawned in server
- `disconnected` - Connection lost
- `kicked` - Kicked by server
- `error` - Connection error
- `chat` - Chat message received
- `whisper` - Whisper received
- `rawMessage` - Raw server message

**Methods:**
- `connect()` - Connect to server
- `disconnect()` - Manual disconnect
- `sendChat(message)` - Send chat message
- `sendCommand(command)` - Send server command
- `isConnected()` - Check connection status
- `getUsername()` - Get bot's username

### 2. ChatHandler (`src/chat.js`)

Higher-level chat interface with command support.

**Features:**
- Message filtering
- Command registration with customizable prefix
- Whisper support

**Methods:**
- `send(message)` - Send chat message
- `whisper(username, message)` - Send private message
- `command(cmd)` - Execute server command
- `registerCommand(name, handler)` - Register command handler
- `setCommandPrefix(prefix)` - Change command prefix (default: `!`)
- `addFilter(filterFn)` - Add message filter

### 3. Entry Point (`src/index.js`)

Main application entry with:
- Configuration loading
- Bot and chat handler initialization
- Example command (`!ping`)
- Graceful shutdown handling (SIGINT, SIGTERM)

---

## Configuration

**File:** `config/config.json`

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

---

## Usage

### Basic Usage

```bash
# Install dependencies
npm install

# Copy and configure
cp config/config.example.json config/config.json
# Edit config/config.json with your settings

# Run
npm start
```

### Programmatic Usage

```javascript
const MinecraftChatBot = require('./src/bot');
const ChatHandler = require('./src/chat');

const bot = new MinecraftChatBot({
  server: { host: 'mc.example.com' },
  auth: { type: 'microsoft', username: 'email@example.com' }
});

const chat = new ChatHandler(bot);

chat.on('message', ({ username, message }) => {
  console.log(`${username}: ${message}`);
});

chat.registerCommand('hello', (username) => {
  chat.send(`Hello, ${username}!`);
});

bot.connect();
```

### 24/7 Operation with PM2

```bash
# Install PM2 globally
npm install -g pm2

# Start with PM2
pm2 start ecosystem.config.js

# Save process list
pm2 save

# Enable startup on system boot
pm2 startup
```

---

## Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| mineflayer | ^4.33.0 | Minecraft bot framework |

---

## Authentication

On first run with Microsoft authentication:
1. Bot will display a URL and code
2. Open URL in browser
3. Enter the code
4. Sign in with Microsoft account
5. Token is cached for future sessions

Token refresh is handled automatically by prismarine-auth.

---

## Payment Tracking

The `PaymentHandler` (`src/payments.js`) monitors chat for payment messages and logs them to `logs/payments.log`.

**Message format parsed:** `username paid you $amount`

**Amount suffixes:**
- No suffix: raw number (e.g., `20.` = $20)
- `K`: thousands (e.g., `1.5K.` = $1,500)
- `M`: millions (e.g., `1.23M.` = $1,230,000)
- `B`: billions (e.g., `2.5B.` = $2,500,000,000)
- `T`: trillions (e.g., `1.0T.` = $1,000,000,000,000)

### Known Limitation: Amounts Are Approximate

The server displays rounded amounts, not exact values. The logged `amount` field is an approximation.

| Displayed | Parsed | Actual |
|-----------|--------|--------|
| `1.52K.` | 1,520 | 1,525 |
| `127.43K.` | 127,430 | 127,437 |
| `1.23M.` | 1,230,000 | 1,234,567 |

**Warning:** Do not use logged amounts for exact accounting. The precision loss increases with larger amounts.

---

## Next Steps

Potential enhancements:
- [ ] Add logging to file with rotation
- [ ] Add webhook/API for external integrations
- [ ] Add database storage for chat history
- [ ] Add more built-in commands
- [ ] Add player join/leave tracking
- [ ] Add configuration hot-reload
