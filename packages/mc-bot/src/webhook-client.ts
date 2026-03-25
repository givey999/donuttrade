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
 * Handles verification, deposit reporting, withdrawal polling, and withdrawal confirmations.
 */
export class WebhookClient {
  private apiUrl: string;
  private secret: string;

  constructor(apiUrl: string, secret: string) {
    this.apiUrl = apiUrl;
    this.secret = secret;
  }

  /**
   * Sleep helper for retry backoff.
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Report a payment to the verification API.
   * Returns whether the payment matched a pending verification.
   */
  async reportVerification(username: string, amount: number): Promise<boolean> {
    try {
      const res = await fetch(`${this.apiUrl}/internal/verification/confirm`, {
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
        console.error(`[Webhook] Verification API returned ${res.status}: ${await res.text()}`);
        return false;
      }

      const data = await res.json() as { success: boolean; data: { verified: boolean } };

      if (data.data.verified) {
        console.log(`[Webhook] Payment matched verification for ${username}`);
      }

      return data.data.verified;
    } catch (err) {
      console.error(`[Webhook] Failed to report verification:`, (err as Error).message);
      return false;
    }
  }

  /**
   * Report an incoming deposit to the API.
   * Retries up to 3 times with exponential backoff (1s, 2s, 4s) to avoid
   * losing deposits during transient API downtime.
   */
  async reportDeposit(username: string, amount: number): Promise<DepositResponse | null> {
    const maxAttempts = 3;
    const body = JSON.stringify({
      username,
      amount,
      timestamp: new Date().toISOString(),
    });

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const res = await fetch(`${this.apiUrl}/internal/deposit/confirm`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.secret}`,
          },
          body,
        });

        if (res.ok) {
          const data = await res.json() as { success: boolean; data: DepositResponse };
          return data.data;
        }

        // 4xx errors (except 429) are not retryable — bad request won't improve
        if (res.status >= 400 && res.status < 500 && res.status !== 429) {
          console.error(`[Webhook] Deposit API returned ${res.status}: ${await res.text()}`);
          return null;
        }

        console.error(`[Webhook] Deposit API returned ${res.status} (attempt ${attempt}/${maxAttempts})`);
      } catch (err) {
        console.error(`[Webhook] Deposit request failed (attempt ${attempt}/${maxAttempts}):`, (err as Error).message);
      }

      if (attempt < maxAttempts) {
        const backoffMs = 1000 * Math.pow(2, attempt - 1); // 1s, 2s, 4s
        console.log(`[Webhook] Retrying deposit in ${backoffMs}ms...`);
        await this.sleep(backoffMs);
      }
    }

    console.error(`[Webhook] Deposit failed after ${maxAttempts} attempts for ${username} ($${amount})`);
    return null;
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
