import { marketplaceService } from './marketplace.service.js';
import { logger } from '../lib/logger.js';

const expiryLogger = logger.module('order-expiry');

let intervalId: ReturnType<typeof setInterval> | null = null;

/**
 * Start the background job that processes expired orders every 60 seconds.
 */
export function startOrderExpiryJob() {
  if (intervalId) return;

  expiryLogger.info('start', 'Order expiry job started (every 60s)');

  const interval = setInterval(async () => {
    try {
      await marketplaceService.processExpiredOrders();
    } catch (error) {
      expiryLogger.error('tick.failed', 'Order expiry tick failed', error);
    }
  }, 60_000);
  interval.unref();
  intervalId = interval;
}

/**
 * Stop the background job.
 */
export function stopOrderExpiryJob() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    expiryLogger.info('stop', 'Order expiry job stopped');
  }
}
