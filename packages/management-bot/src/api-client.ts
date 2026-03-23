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
    const errMsg = json?.error || json?.message || `API error ${res.status}`;
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

  async setTicketChannel(type: 'deposit' | 'withdrawal', recordId: string, channelId: string) {
    return request('PATCH', '/ticket-channel', { type, recordId, channelId });
  },
};
