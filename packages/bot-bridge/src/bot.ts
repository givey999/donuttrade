import mineflayer from 'mineflayer';
import { EventEmitter } from 'node:events';

export interface BotConfig {
  server: {
    host: string;
    port?: number;
    version?: string | false;
  };
  auth: {
    username: string;
    type?: string;
  };
  reconnect?: {
    enabled?: boolean;
    initialDelay?: number;
    maxDelay?: number;
  };
}

/**
 * MinecraftChatBot — connection layer wrapping Mineflayer.
 * TypeScript port of src/bot.js with the same EventEmitter pattern.
 */
export class MinecraftChatBot extends EventEmitter {
  private config: BotConfig;
  private bot: mineflayer.Bot | null = null;
  private reconnectAttempts = 0;
  private reconnectDelay: number;
  private maxReconnectDelay: number;
  private isConnecting = false;
  private shouldReconnect: boolean;

  constructor(config: BotConfig) {
    super();
    this.config = config;
    this.reconnectDelay = config.reconnect?.initialDelay ?? 5000;
    this.maxReconnectDelay = config.reconnect?.maxDelay ?? 300000;
    this.shouldReconnect = config.reconnect?.enabled !== false;
  }

  connect(): void {
    if (this.isConnecting) {
      console.log('[Bot] Connection already in progress');
      return;
    }

    this.isConnecting = true;
    const port = this.config.server.port ?? 25565;
    console.log(`[Bot] Connecting to ${this.config.server.host}:${port}...`);

    this.bot = mineflayer.createBot({
      host: this.config.server.host,
      port,
      username: this.config.auth.username,
      auth: (this.config.auth.type as 'microsoft' | 'offline') || 'microsoft',
      version: this.config.server.version || undefined,
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    if (!this.bot) return;

    this.bot.on('spawn', () => {
      this.isConnecting = false;
      this.reconnectAttempts = 0;
      this.reconnectDelay = this.config.reconnect?.initialDelay ?? 5000;
      console.log(`[Bot] Spawned in server as ${this.bot!.username}`);
      this.emit('connected', this.bot!.username);
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
      this.handleDisconnect();
    });

    this.bot.on('error', (err) => {
      console.error(`[Bot] Error: ${err.message}`);
      this.emit('error', err);
    });

    this.bot.on('end', (reason) => {
      console.log(`[Bot] Disconnected: ${reason || 'unknown reason'}`);
      this.isConnecting = false;
      this.emit('disconnected', reason);
      this.handleDisconnect();
    });
  }

  private handleDisconnect(): void {
    if (!this.shouldReconnect) {
      console.log('[Bot] Auto-reconnect disabled');
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(
      this.reconnectDelay * Math.pow(1.5, this.reconnectAttempts - 1),
      this.maxReconnectDelay,
    );

    console.log(`[Bot] Reconnecting in ${delay / 1000}s (attempt ${this.reconnectAttempts})...`);

    setTimeout(() => {
      this.connect();
    }, delay);
  }

  disconnect(): void {
    this.shouldReconnect = false;
    if (this.bot) {
      this.bot.quit();
      this.bot = null;
    }
    console.log('[Bot] Disconnected (manual)');
  }

  getUsername(): string | null {
    return this.bot?.username ?? null;
  }
}
