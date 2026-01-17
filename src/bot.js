const mineflayer = require('mineflayer');
const EventEmitter = require('events');

class MinecraftChatBot extends EventEmitter {
  constructor(config) {
    super();
    this.config = config;
    this.bot = null;
    this.reconnectAttempts = 0;
    this.reconnectDelay = config.reconnect?.initialDelay || 5000;
    this.maxReconnectDelay = config.reconnect?.maxDelay || 300000;
    this.isConnecting = false;
    this.shouldReconnect = config.reconnect?.enabled !== false;
  }

  connect() {
    if (this.isConnecting) {
      console.log('[Bot] Connection already in progress');
      return;
    }

    this.isConnecting = true;
    console.log(`[Bot] Connecting to ${this.config.server.host}:${this.config.server.port || 25565}...`);

    const botOptions = {
      host: this.config.server.host,
      port: this.config.server.port || 25565,
      username: this.config.auth.username,
      auth: this.config.auth.type || 'microsoft',
      version: this.config.server.version || false,
    };

    this.bot = mineflayer.createBot(botOptions);
    this._setupEventHandlers();
  }

  _setupEventHandlers() {
    this.bot.on('spawn', () => {
      this.isConnecting = false;
      this.reconnectAttempts = 0;
      this.reconnectDelay = this.config.reconnect?.initialDelay || 5000;
      console.log(`[Bot] Spawned in server as ${this.bot.username}`);
      this.emit('connected', this.bot.username);
    });

    this.bot.on('chat', (username, message) => {
      if (username === this.bot.username) return;
      console.log(`[Chat] ${username}: ${message}`);
      this.emit('chat', username, message);
    });

    this.bot.on('whisper', (username, message) => {
      console.log(`[Whisper] ${username}: ${message}`);
      this.emit('whisper', username, message);
    });

    this.bot.on('message', (jsonMsg, position) => {
      const text = jsonMsg.toString();
      if (text) {
        this.emit('rawMessage', text, position);
      }
    });

    this.bot.on('kicked', (reason, loggedIn) => {
      const reasonText = typeof reason === 'object' ? JSON.stringify(reason) : reason;
      console.log(`[Bot] Kicked: ${reasonText}`);
      this.emit('kicked', reasonText, loggedIn);
      this._handleDisconnect();
    });

    this.bot.on('error', (err) => {
      console.error(`[Bot] Error: ${err.message}`);
      this.emit('error', err);
    });

    this.bot.on('end', (reason) => {
      console.log(`[Bot] Disconnected: ${reason || 'unknown reason'}`);
      this.isConnecting = false;
      this.emit('disconnected', reason);
      this._handleDisconnect();
    });
  }

  _handleDisconnect() {
    if (!this.shouldReconnect) {
      console.log('[Bot] Auto-reconnect disabled');
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(
      this.reconnectDelay * Math.pow(1.5, this.reconnectAttempts - 1),
      this.maxReconnectDelay
    );

    console.log(`[Bot] Reconnecting in ${delay / 1000}s (attempt ${this.reconnectAttempts})...`);

    setTimeout(() => {
      this.connect();
    }, delay);
  }

  sendChat(message) {
    if (!this.bot) {
      console.error('[Bot] Not connected');
      return false;
    }
    this.bot.chat(message);
    console.log(`[Bot] Sent: ${message}`);
    return true;
  }

  sendCommand(command) {
    return this.sendChat(command.startsWith('/') ? command : `/${command}`);
  }

  disconnect() {
    this.shouldReconnect = false;
    if (this.bot) {
      this.bot.quit();
      this.bot = null;
    }
    console.log('[Bot] Disconnected (manual)');
  }

  isConnected() {
    return this.bot !== null && !this.isConnecting;
  }

  getUsername() {
    return this.bot?.username || null;
  }
}

module.exports = MinecraftChatBot;
