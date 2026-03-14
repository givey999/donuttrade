/**
 * Parsed payment data from an in-game chat message.
 */
export interface Payment {
  username: string;
  amountRaw: string;
  amount: number;
  timestamp: Date;
}

/**
 * PaymentHandler — parses incoming payment messages from Minecraft chat.
 * Same pattern as bot-bridge's payment handler.
 */
export class PaymentHandler {
  private paymentPattern = /^(.+?) paid you \$(.+)$/;

  /**
   * Try to parse a chat message as an incoming payment.
   * Returns null if the message doesn't match the payment pattern.
   */
  parsePayment(message: string): Payment | null {
    const match = message.match(this.paymentPattern);
    if (!match) return null;

    const username = match[1]!.trim();
    const amountRaw = match[2]!.trim();
    const amount = this.parseAmount(amountRaw);

    if (amount === null) return null;

    return { username, amountRaw, amount, timestamp: new Date() };
  }

  /**
   * Parse an amount string with K/M/B/T suffixes.
   * Format: "20.", "1.5K.", "127.43K.", "1.23M."
   */
  private parseAmount(amountStr: string): number | null {
    let cleaned = amountStr.replace(/,/g, '').trim();

    // Remove trailing period
    cleaned = cleaned.replace(/\.$/, '');

    // Check for K/M/B/T suffix (case-insensitive)
    let multiplier = 1;
    const lastChar = cleaned.slice(-1).toUpperCase();
    if (lastChar === 'K') {
      multiplier = 1_000;
      cleaned = cleaned.slice(0, -1);
    } else if (lastChar === 'M') {
      multiplier = 1_000_000;
      cleaned = cleaned.slice(0, -1);
    } else if (lastChar === 'B') {
      multiplier = 1_000_000_000;
      cleaned = cleaned.slice(0, -1);
    } else if (lastChar === 'T') {
      multiplier = 1_000_000_000_000;
      cleaned = cleaned.slice(0, -1);
    }

    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? null : parsed * multiplier;
  }
}
