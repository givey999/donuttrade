/**
 * WebhookClient — HTTP client for reporting payments to the API.
 */
export class WebhookClient {
  private apiUrl: string;
  private secret: string;

  constructor(apiUrl: string, secret: string) {
    this.apiUrl = apiUrl;
    this.secret = secret;
  }

  /**
   * Report a payment to the API verification webhook.
   * Returns whether the payment matched a pending verification.
   */
  async reportPayment(username: string, amount: number): Promise<boolean> {
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
        console.error(`[Webhook] API returned ${res.status}: ${await res.text()}`);
        return false;
      }

      const data = await res.json() as { success: boolean; data: { verified: boolean } };

      if (data.data.verified) {
        console.log(`[Webhook] Payment matched verification for ${username}`);
      }

      return data.data.verified;
    } catch (err) {
      console.error(`[Webhook] Failed to report payment:`, (err as Error).message);
      return false;
    }
  }
}
