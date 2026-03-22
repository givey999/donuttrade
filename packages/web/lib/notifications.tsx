'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useAuth } from '@/lib/auth';
import { getAccessToken } from '@/lib/api';
import { useToast } from '@/lib/toast';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://moldo.go.ro:9443';

// ── Types ──────────────────────────────────────────────────────────────

export interface Notification {
  id: string;
  type: string;
  message: string;
  data: Record<string, unknown>;
  timestamp: string;
  read: boolean;
  href?: string;
}

interface NotificationContextValue {
  notifications: Notification[];
  unreadCount: number;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearAll: () => void;
}

const NotificationContext = createContext<NotificationContextValue | undefined>(undefined);

// ── Event → human-readable helpers ─────────────────────────────────────

const EVENT_TYPES = [
  'order.filled',
  'order.cancelled',
  'order.expired',
  'deposit.confirmed',
  'withdrawal.completed',
  'item_withdrawal.completed',
  'order.price_updated',
] as const;

function eventToMessage(type: string, data: Record<string, unknown>): string {
  switch (type) {
    case 'order.filled':
      return `Your order for ${data.quantity}x ${data.itemName} was filled`;
    case 'order.cancelled':
      return data.adminCancelled
        ? 'Your order was cancelled by an admin'
        : 'Your order was cancelled';
    case 'order.expired':
      return 'Your order has expired';
    case 'deposit.confirmed':
      return `Deposit of $${data.amount} confirmed`;
    case 'withdrawal.completed':
      return `Withdrawal of $${data.amount} completed`;
    case 'item_withdrawal.completed':
      return `Item withdrawal completed (${data.quantity}x items)`;
    case 'order.price_updated':
      return `Order price updated to $${Number(data.newPrice).toLocaleString()}`;
    default:
      return 'New notification';
  }
}

function eventToHref(type: string, data: Record<string, unknown>): string | undefined {
  if (type.startsWith('order.') && data.orderId) {
    return `/orders/${data.orderId}`;
  }
  if (
    type.startsWith('deposit.') ||
    type.startsWith('withdrawal.') ||
    type.startsWith('item_withdrawal.')
  ) {
    return '/dashboard';
  }
  return undefined;
}

// ── localStorage helpers ───────────────────────────────────────────────

const STORAGE_KEY = 'dt_notifications';
const MAX_NOTIFICATIONS = 50;

function loadNotifications(): Notification[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveNotifications(notifications: Notification[]) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(notifications.slice(0, MAX_NOTIFICATIONS)),
    );
  } catch {
    // localStorage may be unavailable
  }
}

// ── Provider ───────────────────────────────────────────────────────────

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backoffRef = useRef(1000);
  const mountedRef = useRef(true);

  // Load from localStorage on mount
  useEffect(() => {
    setNotifications(loadNotifications());
  }, []);

  // Persist whenever notifications change (skip the initial empty render)
  const initializedRef = useRef(false);
  useEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true;
      return;
    }
    saveNotifications(notifications);
  }, [notifications]);

  const addNotification = useCallback(
    (n: Notification) => {
      setNotifications((prev) => [n, ...prev].slice(0, MAX_NOTIFICATIONS));
      toast(n.message, 'info');
    },
    [toast],
  );

  const connect = useCallback(() => {
    // Clean up any existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    const token = getAccessToken();
    if (!token) return;

    const es = new EventSource(`${API_URL}/events/stream?token=${encodeURIComponent(token)}`);
    eventSourceRef.current = es;

    // Register listeners for each event type
    for (const eventType of EVENT_TYPES) {
      es.addEventListener(eventType, (e: MessageEvent) => {
        if (!mountedRef.current) return;
        try {
          const payload = JSON.parse(e.data) as {
            id: string;
            type: string;
            data: Record<string, unknown>;
            timestamp: string;
          };
          const notification: Notification = {
            id: payload.id,
            type: payload.type,
            message: eventToMessage(payload.type, payload.data),
            data: payload.data,
            timestamp: payload.timestamp,
            read: false,
            href: eventToHref(payload.type, payload.data),
          };
          addNotification(notification);
        } catch {
          // Ignore malformed events
        }
      });
    }

    es.onopen = () => {
      // Reset backoff on successful connection
      backoffRef.current = 1000;
    };

    es.onerror = () => {
      if (!mountedRef.current) return;

      // If the connection is closed, attempt reconnection with backoff
      if (es.readyState === EventSource.CLOSED) {
        es.close();
        eventSourceRef.current = null;

        const delay = backoffRef.current;
        backoffRef.current = Math.min(backoffRef.current * 2, 30000);

        reconnectTimerRef.current = setTimeout(() => {
          if (mountedRef.current) {
            connect();
          }
        }, delay);
      }
    };
  }, [addNotification]);

  // Connect / disconnect based on authentication state
  useEffect(() => {
    mountedRef.current = true;

    if (isAuthenticated) {
      connect();
    } else {
      // Disconnect when logged out
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    }

    return () => {
      mountedRef.current = false;
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };
  }, [isAuthenticated, connect]);

  // ── Context actions ──────────────────────────────────────────────────

  const markAsRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
    );
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <NotificationContext.Provider
      value={{ notifications, unreadCount, markAsRead, markAllAsRead, clearAll }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications(): NotificationContextValue {
  const ctx = useContext(NotificationContext);
  if (ctx === undefined) {
    throw new Error('useNotifications must be used within a <NotificationProvider>');
  }
  return ctx;
}
