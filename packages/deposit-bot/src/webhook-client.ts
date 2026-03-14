/**
 * Deposit confirmation response from the API.
 */
interface DepositResponse {
  deposited: boolean;
  refund?: boolean;
  refundAmount?: number;
  deposit?: {
    transactionId: string;
    amount: string;
    balanceBefore: string;
    balanceAfter: string;
  };
}

/**
 * Pending withdrawal from the API.
 */
interface PendingWithdrawal {
  id: string;
  username: string;
  amount: string;
}

/**
 * WebhookClient — HTTP client for communicating with the DonutTrade API.
 * Handles deposit reporting, withdrawal polling, and withdrawal confirmations.
 */
export class WebhookClient {
  private apiUrl: string;
  private secret: string;

  constructor(apiUrl: string, secret: string) {
    this.apiUrl = apiUrl;
    this.secret = secret;
  }

  /**
   * Report an incoming deposit to the API.
   * Returns the deposit result (whether to refund, etc.).
   */
  async reportDeposit(username: string, amount: number): Promise<DepositResponse | null> {
    try {
      const res = await fetch(`${this.apiUrl}/internal/deposit/confirm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.secret}`,
        },
        body: JSON.stringify({
          username,
          amount,
          timestamp: new Date().toISOString(),
        }),
      });

      if (!res.ok) {
        console.error(`[Webhook] Deposit API returned ${res.status}: ${await res.text()}`);
        return null;
      }

      const data = await res.json() as { success: boolean; data: DepositResponse };
      return data.data;
    } catch (err) {
      console.error(`[Webhook] Failed to report deposit:`, (err as Error).message);
      return null;
    }
  }

  /**
   * Fetch pending withdrawals from the API.
   */
  async fetchPendingWithdrawals(): Promise<PendingWithdrawal[]> {
    try {
      const res = await fetch(`${this.apiUrl}/internal/withdrawals/pending`, {
        headers: {
          'Authorization': `Bearer ${this.secret}`,
        },
      });

      if (!res.ok) {
        console.error(`[Webhook] Pending withdrawals API returned ${res.status}`);
        return [];
      }

      const data = await res.json() as { success: boolean; data: PendingWithdrawal[] };
      return data.data;
    } catch (err) {
      console.error(`[Webhook] Failed to fetch pending withdrawals:`, (err as Error).message);
      return [];
    }
  }

  /**
   * Claim a pending withdrawal for processing (prevents duplicate processing).
   */
  async claimWithdrawal(id: string): Promise<boolean> {
    try {
      const res = await fetch(`${this.apiUrl}/internal/withdrawals/${id}/claim`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.secret}`,
        },
      });

      if (!res.ok) {
        console.error(`[Webhook] Claim withdrawal API returned ${res.status}: ${await res.text()}`);
        return false;
      }

      return true;
    } catch (err) {
      console.error(`[Webhook] Failed to claim withdrawal:`, (err as Error).message);
      return false;
    }
  }

  /**
   * Confirm a withdrawal was successfully paid in-game.
   */
  async confirmWithdrawal(id: string): Promise<boolean> {
    try {
      const res = await fetch(`${this.apiUrl}/internal/withdrawals/${id}/confirm`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.secret}`,
        },
      });

      if (!res.ok) {
        console.error(`[Webhook] Confirm withdrawal API returned ${res.status}: ${await res.text()}`);
        return false;
      }

      return true;
    } catch (err) {
      console.error(`[Webhook] Failed to confirm withdrawal:`, (err as Error).message);
      return false;
    }
  }

  /**
   * Report a withdrawal failure to the API (triggers refund).
   */
  async failWithdrawal(id: string, reason: string): Promise<boolean> {
    try {
      const res = await fetch(`${this.apiUrl}/internal/withdrawals/${id}/fail`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.secret}`,
        },
        body: JSON.stringify({ reason }),
      });

      if (!res.ok) {
        console.error(`[Webhook] Fail withdrawal API returned ${res.status}: ${await res.text()}`);
        return false;
      }

      return true;
    } catch (err) {
      console.error(`[Webhook] Failed to report withdrawal failure:`, (err as Error).message);
      return false;
    }
  }
}
