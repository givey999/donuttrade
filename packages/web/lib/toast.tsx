'use client';

import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from 'react';
import { ToastContainer } from '@/components/ui/toast';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [leaving, setLeaving] = useState<Set<string>>(new Set());
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    // Clear auto-dismiss timer if it exists
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }

    // Add to leaving set for exit animation
    setLeaving((prev) => new Set(prev).add(id));

    // Remove from array after animation completes
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
      setLeaving((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, 200);
  }, []);

  const toast = useCallback((message: string, type: ToastType = 'info') => {
    const id = crypto.randomUUID();
    const newToast: Toast = { id, message, type };

    setToasts((prev) => {
      const updated = [newToast, ...prev];
      // If more than 5, remove the oldest (last in array since newest is prepended)
      if (updated.length > 5) {
        const removed = updated.slice(5);
        for (const t of removed) {
          const timer = timersRef.current.get(t.id);
          if (timer) {
            clearTimeout(timer);
            timersRef.current.delete(t.id);
          }
        }
        return updated.slice(0, 5);
      }
      return updated;
    });

    // Auto-dismiss after 5 seconds
    const timer = setTimeout(() => {
      timersRef.current.delete(id);
      dismiss(id);
    }, 5000);
    timersRef.current.set(id, timer);
  }, [dismiss]);

  return (
    <ToastContext value={{ toast, dismiss }}>
      {children}
      <ToastContainer toasts={toasts} leaving={leaving} onDismiss={dismiss} />
    </ToastContext>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return ctx;
}
