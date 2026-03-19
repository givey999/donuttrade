'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth';

const NAV_LINKS = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/marketplace', label: 'Marketplace' },
  { href: '/orders', label: 'My Orders' },
];

export function Navbar() {
  const { user, isAuthenticated, logout } = useAuth();
  const pathname = usePathname();

  if (!isAuthenticated) return null;

  return (
    <nav className="sticky top-0 z-40 border-b border-[#1a1a1a] bg-[#0a0a0f]/90 backdrop-blur-xl">
      {/* Amber glow line */}
      <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-amber-500/20 to-transparent" />

      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        {/* Logo */}
        <Link href="/dashboard" className="text-lg font-extrabold tracking-tight text-white">
          DonutTrade
        </Link>

        {/* Nav links */}
        <div className="flex items-center gap-1">
          {NAV_LINKS.map((link) => {
            const isActive = pathname === link.href || pathname.startsWith(link.href + '/');
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-lg px-3 py-1.5 text-sm transition-all duration-200 ${
                  isActive
                    ? 'border border-amber-500/20 bg-amber-500/[0.06] text-amber-500'
                    : 'text-neutral-400 hover:bg-white/[0.04] hover:text-neutral-200'
                }`}
              >
                {link.label}
              </Link>
            );
          })}
          {user?.role && user.role !== 'user' && (
            <Link
              href="/admin"
              className={`rounded-lg px-3 py-1.5 text-sm transition-all duration-200 ${
                pathname.startsWith('/admin')
                  ? 'border border-amber-500/20 bg-amber-500/[0.06] text-amber-500'
                  : 'text-amber-500/70 hover:bg-amber-500/[0.04] hover:text-amber-400'
              }`}
            >
              Admin
            </Link>
          )}
        </div>

        {/* User info + logout */}
        <div className="flex items-center gap-3">
          <span className="text-xs text-neutral-500">
            {user?.minecraftUsername}
          </span>
          <button
            onClick={logout}
            className="rounded-lg border border-[#1a1a1a] bg-white/[0.03] px-2.5 py-1 text-xs text-neutral-400 transition-all duration-200 hover:bg-white/[0.06] hover:text-white"
          >
            Logout
          </button>
        </div>
      </div>
    </nav>
  );
}
