'use client';

import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from '@/lib/auth';
import { Navbar } from '@/components/navbar';
import { TimeoutBanner } from '@/components/timeout-banner';
import { MaintenanceScreen } from '@/components/maintenance-screen';

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
    return () => window.removeEventListener('maintenance', handler);
  }, []);

  if (maintenanceMessage && user?.role !== 'admin') {
    // ImpersonationBanner is rendered above MaintenanceGuard, so the
    // switch-back button is always accessible even on the maintenance screen.
    return <MaintenanceScreen message={maintenanceMessage} />;
  }

  return (
    <>
      {maintenanceMessage && user?.role === 'admin' && (
        <div className="bg-amber-500/20 border-b border-amber-500/30 px-4 py-2 text-center text-sm text-amber-300">
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
      <ImpersonationBanner />
      <MaintenanceGuard>
        <Navbar />
        <TimeoutBanner />
        {children}
      </MaintenanceGuard>
    </AuthProvider>
  );
}
