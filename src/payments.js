const fs = require('fs');
const path = require('path');

class PaymentHandler {
  constructor(logPath) {
    this.logPath = logPath || path.join(__dirname, '..', 'logs', 'payments-in.log');
    this.paymentPattern = /^(.+?) paid you \$(.+)$/;
  }

  parsePayment(message) {
    const match = message.match(this.paymentPattern);
    if (!match) return null;

    const [, username, amountStr] = match;

    return {
      username: username.trim(),
      amountRaw: amountStr.trim(),
      amount: this._parseAmount(amountStr),
      timestamp: new Date()
    };
  }

  _parseAmount(amountStr) {
    // Format: "20.", "1.5K.", "127.43K.", "1.23M."
    // K = thousands, M = millions, trailing period
    //
    // WARNING: Server displays rounded amounts, not exact values.
    // Example: "1.52K." could be 1520-1529, "1.23M." could be 1,230,000-1,239,999
    // Do not use for exact accounting.
    let cleaned = amountStr.replace(/,/g, '').trim();

    // Remove trailing period
    cleaned = cleaned.replace(/\.$/, '');

    // Check for K/M/B/T suffix
    let multiplier = 1;
    if (cleaned.endsWith('K')) {
      multiplier = 1000;
      cleaned = cleaned.slice(0, -1);
    } else if (cleaned.endsWith('M')) {
      multiplier = 1000000;
      cleaned = cleaned.slice(0, -1);
    } else if (cleaned.endsWith('B')) {
      multiplier = 1000000000;
      cleaned = cleaned.slice(0, -1);
    } else if (cleaned.endsWith('T')) {
      multiplier = 1000000000000;
      cleaned = cleaned.slice(0, -1);
    }

    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? null : parsed * multiplier;
  }

  logPayment(payment) {
    const logEntry = {
      timestamp: payment.timestamp.toISOString(),
      username: payment.username,
      amount: payment.amount,
      amountRaw: payment.amountRaw
    };

    const logLine = JSON.stringify(logEntry) + '\n';

    fs.appendFile(this.logPath, logLine, (err) => {
      if (err) {
        console.error('[Payments] Failed to write log:', err.message);
      }
    });

    console.log(`[Payment] ${payment.username} paid $${payment.amountRaw} at ${logEntry.timestamp}`);

    return logEntry;
  }

  processMessage(message) {
    const payment = this.parsePayment(message);
    if (payment) {
      return this.logPayment(payment);
    }
    return null;
  }
}

module.exports = PaymentHandler;
