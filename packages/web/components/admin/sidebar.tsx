'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api';

interface AdminStats {
  pendingDeposits: number;
  pendingWithdrawals: number;
}

const SECTIONS = [
  {
    label: 'Overview',
    links: [
      { href: '/admin', label: 'Dashboard', exact: true },
    ],
  },
  {
    label: 'Operations',
    links: [
      { href: '/admin/deposits', label: 'Item Deposits', badge: 'pendingDeposits' as const },
      { href: '/admin/withdrawals', label: 'Item Withdrawals', badge: 'pendingWithdrawals' as const },
      { href: '/admin/orders', label: 'Orders' },
    ],
  },
  {
    label: 'Management',
    links: [
      { href: '/admin/users', label: 'Users' },
      { href: '/admin/catalog', label: 'Catalog Items', adminOnly: true },
      { href: '/admin/audit-log', label: 'Audit Log' },
    ],
  },
  {
    label: 'Platform',
    links: [
      { href: '/admin/revenue', label: 'Revenue', adminOnly: true },
      { href: '/admin/settings', label: 'Settings', adminOnly: true },
    ],
  },
];

interface AdminSidebarProps {
  open?: boolean;
  onClose?: () => void;
}

export function AdminSidebar({ open = false, onClose }: AdminSidebarProps) {
  const pathname = usePathname();
  const { user } = useAuth();
  const [stats, setStats] = useState<AdminStats | null>(null);

  useEffect(() => {
    const fetchStats = () => {
      apiFetch<AdminStats>('/admin/stats')
        .then((data) => setStats(data))
        .catch(() => {});
    };

    fetchStats();
    const interval = setInterval(fetchStats, 30_000);
    return () => clearInterval(interval);
  }, []);

  // Auto-close mobile sidebar on navigation
  useEffect(() => {
    if (onClose) onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const sidebarContent = (
    <>
      {SECTIONS.map((section) => (
        <div key={section.label} className="mb-5">
          <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
            {section.label}
          </p>
          {section.links.map((link) => {
            if ('adminOnly' in link && link.adminOnly && user?.role !== 'admin') return null;

            const isActive = 'exact' in link && link.exact
              ? pathname === link.href
              : pathname === link.href || pathname.startsWith(link.href + '/');

            const badgeCount = 'badge' in link && link.badge && stats
              ? stats[link.badge]
              : 0;

            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center justify-between rounded-lg px-2 py-1.5 text-sm transition-all duration-200 ${
                  isActive
                    ? 'border border-amber-500/20 bg-amber-500/[0.06] text-amber-500'
                    : 'text-neutral-400 hover:bg-white/[0.04] hover:text-neutral-200'
                }`}
              >
                <span>{link.label}</span>
                {badgeCount > 0 && (
                  <span className="rounded-full border border-amber-500/30 bg-amber-500/[0.08] px-1.5 py-0.5 text-[10px] font-medium text-amber-400">
                    {badgeCount}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      ))}
    </>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:block sticky top-14 h-[calc(100vh-3.5rem)] w-56 shrink-0 overflow-y-auto border-r border-[#1a1a1a] bg-[#0a0a0f] px-3 py-4">
        {sidebarContent}
      </aside>

      {/* Mobile overlay */}
      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={onClose} />
          <aside className="absolute left-0 top-0 h-full w-56 overflow-y-auto border-r border-[#1a1a1a] bg-[#0a0a0f] px-3 py-4">
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  );
}
