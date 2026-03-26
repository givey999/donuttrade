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
 * Escape a string for safe use inside a RegExp.
 */
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * MinecraftBot — unified connection layer wrapping Mineflayer.
 * Handles verification payments, deposits, and withdrawal payouts.
 */
export class MinecraftBot extends EventEmitter {
  private config: BotConfig;
  private bot: mineflayer.Bot | null = null;
  private reconnectAttempts = 0;
  private reconnectDelay: number;
  private maxReconnectDelay: number;
  private isConnecting = false;
  private isAlive = false;
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
      this.isAlive = true;
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
      // Don't call handleDisconnect here — the 'end' event always fires after 'kicked'
    });

    this.bot.on('error', (err) => {
      console.error(`[Bot] Error: ${err.message}`);
      this.emit('error', err);
    });

    this.bot.on('end', (reason) => {
      console.log(`[Bot] Disconnected: ${reason || 'unknown reason'}`);
      this.isConnecting = false;
      this.isAlive = false;
      this.bot = null;
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

  /**
   * Send a chat message to the server.
   */
  sendChat(message: string): void {
    if (!this.bot) {
      console.error('[Bot] Cannot send chat — not connected');
      return;
    }
    this.bot.chat(message);
  }

  /**
   * Send a command to the server (e.g., /pay username amount).
   */
  sendCommand(command: string): void {
    this.sendChat(command);
  }

  /**
   * Send a /pay command and wait for the server's response message.
   * Returns { success: true } if the server confirms payment,
   * or { success: false, reason } if the server rejects it or times out.
   */
  async sendPayAndWait(
    username: string,
    amount: string,
    timeoutMs = 10000,
  ): Promise<{ success: boolean; reason?: string }> {
    if (!this.bot) {
      return { success: false, reason: 'Not connected' };
    }

    // Escape username for safe regex interpolation
    const safeUsername = escapeRegExp(username);

    return new Promise((resolve) => {
      let settled = false;

      const onMessage = (_jsonMsg: any, _position: string) => {
        if (settled) return;

        const text = _jsonMsg.toString();
        if (!text) return;

        // Common EssentialsX / server pay success patterns
        const successPatterns = [
          new RegExp(`paid.*${safeUsername}`, 'i'),
          new RegExp(`sent.*\\$.*to.*${safeUsername}`, 'i'),
          new RegExp(`\\$.*has been paid to.*${safeUsername}`, 'i'),
          new RegExp(`You have paid.*${safeUsername}`, 'i'),
        ];

        // Common failure patterns — anchored to specific server responses
        const failurePatterns = [
          { pattern: /cannot be found/i, reason: 'Player not found' },
          { pattern: /not found/i, reason: 'Player not found' },
          { pattern: /not online/i, reason: 'Player not online' },
          { pattern: /don'?t have enough/i, reason: 'Bot has insufficient funds' },
          { pattern: /not enough money/i, reason: 'Bot has insufficient funds' },
          { pattern: /cannot pay yourself/i, reason: 'Cannot pay self' },
          { pattern: /invalid (amount|payment|number)/i, reason: 'Invalid payment' },
        ];

        for (const p of successPatterns) {
          if (p.test(text)) {
            settled = true;
            cleanup();
            resolve({ success: true });
            return;
          }
        }

        for (const { pattern, reason } of failurePatterns) {
          if (pattern.test(text)) {
            settled = true;
            cleanup();
            resolve({ success: false, reason });
            return;
          }
        }
      };

      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          cleanup();
          resolve({ success: false, reason: 'Timeout waiting for server response' });
        }
      }, timeoutMs);

      const cleanup = () => {
        this.bot?.removeListener('message', onMessage);
        clearTimeout(timer);
      };

      // Listen for any message from the server
      this.bot!.on('message', onMessage);

      // Send the /pay command
      this.bot!.chat(`/pay ${username} ${amount}`);
    });
  }

  disconnect(): void {
    this.shouldReconnect = false;
    this.isAlive = false;
    if (this.bot) {
      this.bot.quit();
      this.bot = null;
    }
    console.log('[Bot] Disconnected (manual)');
  }

  getUsername(): string | null {
    return this.bot?.username ?? null;
  }

  isConnectedNow(): boolean {
    return this.isAlive && this.bot !== null && !this.isConnecting;
  }
}
