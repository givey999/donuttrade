# Minecraft Chat Listener Module Research

## Overview

This document summarizes research on creating a module capable of:
- Listening to chat feed from a Minecraft user connected to a server
- Running 24/7 reliably
- Sending chat commands and reading output

---

## Available Approaches

### 1. Mineflayer (JavaScript/Node.js) - Recommended

**GitHub**: https://github.com/PrismarineJS/mineflayer

Mineflayer is the most mature and actively maintained bot framework for Minecraft.

**Pros:**
- Supports Minecraft 1.8 to 1.21.8 (latest versions)
- High-level JavaScript API
- Active community with extensive plugins
- Built-in chat event handling: `bot.on("chat", (username, message) => {...})`
- Easy to send chat: `bot.chat("message")`
- Handles connection, encryption, authentication automatically
- Microsoft authentication support via `prismarine-auth`

**Cons:**
- Requires Node.js runtime
- JavaScript/TypeScript only (no native Python)

**Key Features:**
- Chat listening and sending
- Inventory management
- Movement and pathfinding (via plugins)
- Entity tracking
- Block interaction

**Chat Example:**
```javascript
const mineflayer = require('mineflayer');

const bot = mineflayer.createBot({
  host: 'localhost',
  username: 'Bot',
  auth: 'microsoft', // or 'offline' for cracked servers
});

bot.on('chat', (username, message) => {
  console.log(`${username}: ${message}`);
});

bot.chat('/command here');
```

---

### 2. Minecraft Console Client (MCC) - Alternative

**GitHub**: https://github.com/MCCTeam/Minecraft-Console-Client
**Docs**: https://mccteam.github.io/guide/

A lightweight .NET-based console client with scripting support.

**Pros:**
- Cross-platform (Windows, Linux, macOS)
- Supports Minecraft 1.4 through 1.20.4
- Built-in chat bots and automation
- C# scripting API
- Auto-reconnect built-in
- No Minecraft installation required

**Cons:**
- Requires .NET runtime
- Slightly behind on version support compared to Mineflayer
- Scripting in C# (less flexible than Node.js ecosystem)

**Built-in Bots:**
- Auto Relog (reconnect on disconnect)
- Auto Respond
- Chat Log
- Script Scheduler
- Remote Control

---

### 3. Python Libraries

#### pyCraft
**GitHub**: https://github.com/ammaraskar/pyCraft

- Implements Minecraft protocol in Python
- Supports chat packets
- Lower-level than Mineflayer
- May require more manual work

#### Quarry
**Docs**: https://quarry.readthedocs.io/en/latest/

- Full Minecraft protocol implementation
- Can create clients, servers, and proxies
- Good for custom protocol work

#### PyMChat
**GitHub**: https://github.com/MrKelpy/PyMChat

- Simple library for reading/interacting with Minecraft chat
- Works by reading log files (not direct connection)
- Simpler but less reliable for 24/7 operation

**Python Assessment:**
Python libraries are generally less mature than Mineflayer. If Python is required, `pyCraft` or `Quarry` are the best options, but expect more development effort.

---

## Microsoft Authentication

Since Minecraft now requires Microsoft accounts, authentication is critical.

### Token Lifecycle
- **Access tokens** expire after 24 hours
- **Refresh tokens** last 90 days (if used regularly)
- Libraries should handle automatic token refresh

### Recommended Libraries by Language

| Language | Library | Auto-Refresh |
|----------|---------|--------------|
| JavaScript | [prismarine-auth](https://github.com/PrismarineJS/prismarine-auth) | Yes |
| JavaScript | [MSMC](https://github.com/Hanro50/MSMC) | Yes (hourly) |
| Java | [MinecraftAuth](https://github.com/RaphiMC/MinecraftAuth) | Yes |
| Go | [gophertunnel](https://pkg.go.dev/github.com/sandertv/gophertunnel/minecraft/auth) | Yes |

### Offline/Cracked Servers
For servers without authentication (`online-mode=false`), you can use `auth: 'offline'` in Mineflayer, bypassing Microsoft auth entirely.

---

## 24/7 Operation Best Practices

### Connection Resilience

1. **Auto-Reconnect Logic**
   ```javascript
   bot.on('kicked', (reason) => {
     console.log('Kicked:', reason);
     setTimeout(reconnect, 5000);
   });

   bot.on('error', (err) => {
     console.log('Error:', err);
   });

   bot.on('end', () => {
     console.log('Disconnected');
     setTimeout(reconnect, 5000);
   });
   ```

2. **Exponential Backoff**
   - Start with short delays (5s)
   - Increase on repeated failures (5s, 10s, 30s, 60s, max 5min)
   - Reset on successful connection

3. **Keep-Alive**
   - Mineflayer handles protocol keep-alive automatically
   - Consider anti-AFK measures if server kicks idle players

### Process Management

- **PM2** (Node.js): Process manager with auto-restart
- **systemd** (Linux): System service for automatic startup
- **Docker**: Containerized deployment

### Monitoring

- Log chat messages to file/database
- Health checks (last message timestamp)
- Alert on extended disconnection

---

## Comparison Summary

| Feature | Mineflayer | MCC | pyCraft |
|---------|------------|-----|---------|
| Language | JavaScript | C# | Python |
| Latest MC Version | 1.21.8 | 1.20.4 | Varies |
| Ease of Use | High | Medium | Low |
| Chat Support | Excellent | Excellent | Good |
| Microsoft Auth | Yes | Yes | Manual |
| Plugin Ecosystem | Large | Medium | Small |
| 24/7 Reliability | High | High | Medium |
| Community Support | Very Active | Active | Limited |

---

## Recommendation

**Primary Choice: Mineflayer (Node.js)**

Reasons:
1. Best version support (up to 1.21.8)
2. Most active development and community
3. Excellent documentation
4. Easy chat handling
5. Built-in Microsoft authentication
6. Rich plugin ecosystem for extended functionality

**Alternative: Minecraft Console Client**

Use if:
- Prefer C# over JavaScript
- Need built-in scripting without additional code
- Running on older Minecraft versions

---

## Next Steps

1. **Decide on technology stack** (Node.js recommended)
2. **Determine authentication method** (Microsoft or offline)
3. **Design module architecture**:
   - Connection manager with auto-reconnect
   - Chat event handler
   - Command sender interface
   - Logging/persistence layer
4. **Set up process management** for 24/7 operation

---

## Sources

- [Mineflayer GitHub](https://github.com/PrismarineJS/mineflayer)
- [Mineflayer Website](https://mineflayer.com/)
- [Minecraft Console Client](https://github.com/MCCTeam/Minecraft-Console-Client)
- [MCC Documentation](https://mccteam.github.io/guide/)
- [pyCraft](https://github.com/ammaraskar/pyCraft)
- [Quarry Documentation](https://quarry.readthedocs.io/en/latest/)
- [MSMC (Microsoft Auth)](https://github.com/Hanro50/MSMC)
- [MinecraftAuth](https://github.com/RaphiMC/MinecraftAuth)
- [Minecraft Wiki - Microsoft Authentication](https://minecraft.wiki/w/Microsoft_authentication)
- [wiki.vg - Microsoft Authentication Scheme](https://wiki.vg/Microsoft_Authentication_Scheme)
