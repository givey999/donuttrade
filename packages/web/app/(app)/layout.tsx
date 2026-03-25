'use client';

import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from '@/lib/auth';
import { ToastProvider } from '@/lib/toast';
import { Navbar } from '@/components/navbar';
import { TimeoutBanner } from '@/components/timeout-banner';
import { MaintenanceScreen } from '@/components/maintenance-screen';
import { NotificationProvider } from '@/lib/notifications';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://moldo.go.ro:9443';

function ImpersonationBanner() {
  const { impersonating, stopImpersonating } = useAuth();
  if (!impersonating) return null;

  return (
    <div className="bg-purple-500/20 border-b border-purple-500/30 px-4 py-2 text-center text-sm text-purple-300">
      Viewing as <span className="font-semibold text-purple-200">{impersonating}</span>
      {' — '}
      <button
        onClick={stopImpersonating}
        className="font-semibold underline transition-colors hover:text-white"
      >
        Switch back to admin
      </button>
    </div>
  );
}

function MaintenanceGuard({ children }: { children: React.ReactNode }) {
  const { user, impersonating, stopImpersonating } = useAuth();
  const [maintenanceMessage, setMaintenanceMessage] = useState<string | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setMaintenanceMessage(detail || 'Platform is under maintenance');
    };
    window.addEventListener('maintenance', handler);
    // Check if already in maintenance from a previous request
    if (window.__maintenanceMessage) {
      setMaintenanceMessage(window.__maintenanceMessage);
    }

    // Proactively check maintenance status on mount
    fetch(`${API_URL}/public/settings/maintenance`)
      .then((res) => res.ok ? res.json() : null)
      .then((json) => {
        if (json?.data?.enabled) {
          const msg = json.data.message || 'Platform is under maintenance';
          window.__maintenanceMessage = msg;
          setMaintenanceMessage(msg);
        } else if (json?.data && !json.data.enabled) {
          // Maintenance was disabled — clear any stale state
          delete window.__maintenanceMessage;
          setMaintenanceMessage(null);
        }
      })
      .catch(() => {});

    return () => window.removeEventListener('maintenance', handler);
  }, []);

  if (maintenanceMessage && user?.role !== 'admin' && user?.role !== 'leader') {
    // ImpersonationBanner is rendered above MaintenanceGuard, so the
    // switch-back button is always accessible even on the maintenance screen.
    return <MaintenanceScreen message={maintenanceMessage} />;
  }

  return (
    <>
      {maintenanceMessage && (user?.role === 'admin' || user?.role === 'leader') && (
        <div className="bg-violet-500/20 border-b border-violet-500/30 px-4 py-2 text-center text-sm text-violet-300">
          Platform is in maintenance mode
        </div>
      )}
      {children}
    </>
  );
}

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <ToastProvider>
        <NotificationProvider>
          <ImpersonationBanner />
          <MaintenanceGuard>
            <Navbar />
            <TimeoutBanner />
            {children}
          </MaintenanceGuard>
        </NotificationProvider>
      </ToastProvider>
    </AuthProvider>
  );
}
