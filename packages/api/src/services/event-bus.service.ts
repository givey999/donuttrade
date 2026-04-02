import { createSubscriberClient } from './redis.js';
import { redis } from './redis.js';
import { logger } from '../lib/logger.js';
import type { Redis as RedisClient } from 'ioredis';

const ebLogger = logger.module('event-bus');

export type EventType =
  | 'order.filled'
  | 'order.cancelled'
  | 'order.expired'
  | 'deposit.confirmed'
  | 'withdrawal.completed'
  | 'withdrawal.denied'
  | 'item_withdrawal.completed'
  | 'order.price_updated';

export interface UserEvent {
  id: string;
  type: EventType;
  data: Record<string, unknown>;
  timestamp: string;
}

type EventCallback = (event: UserEvent) => void;

class EventBus {
  private listeners = new Map<string, Set<EventCallback>>();
  private subscriber: RedisClient | null = null;
  private initialized = false;

  /**
   * Initialize the subscriber connection and message handler.
   * Called once on first subscribe.
   */
  private init() {
    if (this.initialized) return;
    this.subscriber = createSubscriberClient();

    this.subscriber.on('message', (channel: string, message: string) => {
      // Channel format: notifications:{userId}
      const userId = channel.replace('notifications:', '');
      const callbacks = this.listeners.get(userId);
      if (!callbacks || callbacks.size === 0) return;

      try {
        const event: UserEvent = JSON.parse(message);
        for (const cb of callbacks) {
          try {
            cb(event);
          } catch (err) {
            ebLogger.error('callback.error', 'Event callback error', err);
          }
        }
      } catch (err) {
        ebLogger.error('parse.error', 'Failed to parse event message', err);
      }
    });

    this.initialized = true;
    ebLogger.info('init', 'Event bus initialized');
  }

  /**
   * Publish an event to a user's channel.
   */
  async publish(userId: string, type: EventType, data: Record<string, unknown>): Promise<void> {
    const event: UserEvent = {
      id: crypto.randomUUID(),
      type,
      data,
      timestamp: new Date().toISOString(),
    };

    const channel = `notifications:${userId}`;
    await redis.publish(channel, JSON.stringify(event));

    ebLogger.debug('publish', 'Event published', { userId, type, eventId: event.id });
  }

  /**
   * Subscribe to events for a specific user.
   */
  async subscribe(userId: string, callback: EventCallback): Promise<void> {
    this.init();

    if (!this.listeners.has(userId)) {
      this.listeners.set(userId, new Set());
      const channel = `notifications:${userId}`;
      await this.subscriber!.subscribe(channel);
      ebLogger.debug('subscribe', 'Subscribed to channel', { channel });
    }

    this.listeners.get(userId)!.add(callback);
  }

  /**
   * Unsubscribe a callback for a user.
   */
  async unsubscribe(userId: string, callback: EventCallback): Promise<void> {
    const callbacks = this.listeners.get(userId);
    if (!callbacks) return;

    callbacks.delete(callback);

    if (callbacks.size === 0) {
      this.listeners.delete(userId);
      const channel = `notifications:${userId}`;
      await this.subscriber?.unsubscribe(channel);
      ebLogger.debug('unsubscribe', 'Unsubscribed from channel', { channel });
    }
  }
}

export const eventBus = new EventBus();
