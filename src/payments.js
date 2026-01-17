const fs = require('fs');
const path = require('path');

class PaymentHandler {
  constructor(logPath) {
    this.logPath = logPath || path.join(__dirname, '..', 'logs', 'payments.log');
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
    // Remove commas and parse as float
    // Handle formats like "20", "1,000", "1.5", etc.
    const cleaned = amountStr.replace(/,/g, '').trim();
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? null : parsed;
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
