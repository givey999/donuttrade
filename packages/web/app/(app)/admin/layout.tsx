'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { AdminSidebar } from '@/components/admin/sidebar';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!loading && (!user || user.role === 'user')) {
      router.push('/dashboard');
    }
  }, [loading, user, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-neutral-400">Loading...</p>
      </div>
    );
  }

  if (!user || user.role === 'user') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-neutral-400">Redirecting...</p>
      </div>
    );
  }

  return (
    <>
      {/* Mobile admin header */}
      <div className="flex items-center gap-3 border-b border-[#1a1a1a] px-4 py-2 md:hidden">
        <button
          onClick={() => setSidebarOpen(true)}
          className="rounded-lg p-1.5 text-neutral-400 hover:bg-white/[0.06] hover:text-white"
          aria-label="Open admin menu"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M2 4.75A.75.75 0 012.75 4h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 4.75zM2 10a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 10zm0 5.25a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75a.75.75 0 01-.75-.75z" clipRule="evenodd" />
          </svg>
        </button>
        <span className="text-sm font-semibold text-neutral-300">Admin</span>
      </div>

      <div className="flex min-h-[calc(100vh-3.5rem)]">
        <AdminSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main className="flex-1 overflow-y-auto border-l border-[#1a1a1a] p-6">
          {children}
        </main>
      </div>
    </>
  );
}
