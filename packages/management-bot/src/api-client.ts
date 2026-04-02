import { config } from './config.js';

const headers = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${config.BOT_WEBHOOK_SECRET}`,
};

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const url = `${config.API_URL}/internal/management-bot${path}`;
  const reqHeaders: Record<string, string> = { ...headers };
  if (!body) delete reqHeaders['Content-Type'];
  const res = await fetch(url, {
    method,
    headers: reqHeaders,
    body: body ? JSON.stringify(body) : undefined,
  });

  const json = await res.json() as any;

  if (!res.ok) {
    const errMsg = json?.message || (typeof json?.error === 'string' ? json.error : json?.error?.message) || `API error ${res.status}`;
    throw new Error(errMsg);
  }

  return json as T;
}

export interface VerifyCodeResult {
  success: boolean;
  data: {
    type: 'deposit' | 'withdrawal';
    recordId: string;
    userId: string;
    username: string;
    catalogItemDisplayName: string;
    quantity: number;
  };
}

export class ApiRequestError extends Error {
  constructor(message: string, public statusCode: number) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

// Generic request for discord-bot internal endpoints
async function discordBotRequest<T>(method: string, path: string): Promise<T> {
  const url = `${config.API_URL}/internal/discord-bot${path}`;
  const res = await fetch(url, {
    method,
    headers: { 'Authorization': `Bearer ${config.BOT_WEBHOOK_SECRET}` },
  });
  const json = await res.json() as any;
  if (!res.ok) {
    const errMsg = json?.message || `API error ${res.status}`;
    throw new ApiRequestError(errMsg, res.status);
  }
  return json as T;
}

export interface DiscordBotUser {
  id: string;
  minecraftUsername: string | null;
  balance: string;
  tradingVolume: string;
  verificationStatus: string;
  role: string;
  inventory: Array<{ item: string; quantity: number; reserved: number }>;
}

export interface DiscordBotOrder {
  id: string;
  type: 'buy' | 'sell';
  item: string;
  quantity: number;
  filled: number;
  pricePerUnit: string;
  expiresAt: string;
}

export interface DiscordBotStats {
  totalTraders: number;
  activeOrders: number;
  volume24h: string;
  totalVolume: string;
}

export interface LeaderboardEntry {
  rank: number;
  username: string;
  volume: string;
}

export const apiClient = {
  async verifyCode(code: string): Promise<VerifyCodeResult> {
    return request('POST', '/verify-code', { code });
  },

  async confirmDeposit(id: string, closedBy: string) {
    return request('POST', `/confirm-deposit/${id}`, { closedBy });
  },

  async confirmWithdrawal(id: string, closedBy: string) {
    return request('POST', `/confirm-withdrawal/${id}`, { closedBy });
  },

  async rejectDeposit(id: string, closedBy: string, reason: string) {
    return request('POST', `/reject-deposit/${id}`, { closedBy, reason });
  },

  async rejectWithdrawal(id: string, closedBy: string, reason: string) {
    return request('POST', `/reject-withdrawal/${id}`, { closedBy, reason });
  },

  async getNextTicketNumber(): Promise<number> {
    const result = await request<{ success: boolean; data: { number: number } }>('POST', '/ticket-counter');
    return result.data.number;
  },

  async setTicketChannel(type: 'deposit' | 'withdrawal', recordId: string, channelId: string, ticketLabel: string) {
    return request('PATCH', '/ticket-channel', { type, recordId, channelId, ticketLabel });
  },

  // ─── Discord bot endpoints ──────────────────────────────

  async getUserByDiscordId(discordId: string): Promise<DiscordBotUser> {
    const res = await discordBotRequest<{ data: DiscordBotUser }>('GET', `/user/${discordId}`);
    return res.data;
  },

  async getUserOrders(discordId: string): Promise<DiscordBotOrder[]> {
    const res = await discordBotRequest<{ data: DiscordBotOrder[] }>('GET', `/user/${discordId}/orders`);
    return res.data;
  },

  async getStats(): Promise<DiscordBotStats> {
    const res = await discordBotRequest<{ data: DiscordBotStats }>('GET', '/stats');
    return res.data;
  },

  async getLeaderboard(): Promise<LeaderboardEntry[]> {
    const res = await discordBotRequest<{ data: LeaderboardEntry[] }>('GET', '/leaderboard');
    return res.data;
  },

  async getDiscordIdByUserId(userId: string): Promise<{ discordId: string; dmNotifications: boolean } | null> {
    try {
      const res = await discordBotRequest<{ data: { discordId: string; dmNotifications: boolean } }>('GET', `/discord-id/${userId}`);
      return res.data;
    } catch {
      return null;
    }
  },

  async disableDmNotifications(userId: string): Promise<void> {
    const url = `${config.API_URL}/internal/discord-bot/dm-notifications/${userId}`;
    const res = await fetch(url, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.BOT_WEBHOOK_SECRET}`,
      },
      body: JSON.stringify({ enabled: false }),
    });
    if (!res.ok) {
      console.error(`[API] Failed to disable DM notifications: ${res.status}`);
    }
  },
};
