'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { NotificationBell } from '@/components/notification-bell';
import { SparkleLogo } from '@/components/sparkle-logo';

const NAV_LINKS = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/marketplace', label: 'Marketplace' },
  { href: '/orders', label: 'My Orders' },
];

export function Navbar() {
  const { user, isAuthenticated, logout } = useAuth();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Auto-close mobile menu on navigation
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  if (!isAuthenticated) return null;

  return (
    <nav className="sticky top-0 z-40 border-b border-[#1a1a1a] bg-[#0a0a0f]/90 backdrop-blur-xl">
      {/* Amber glow line */}
      <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-violet-600/20 to-transparent" />

      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        {/* Logo - always visible */}
        <SparkleLogo />

        {/* Desktop nav links - hidden on mobile */}
        <div className="hidden md:flex items-center gap-1">
          {NAV_LINKS.map((link) => {
            const isActive = pathname === link.href || pathname.startsWith(link.href + '/');
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-lg px-3 py-1.5 text-sm transition-all duration-200 ${
                  isActive
                    ? 'border border-violet-600/20 bg-violet-600/[0.06] text-violet-600'
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
                  ? 'border border-violet-600/20 bg-violet-600/[0.06] text-violet-600'
                  : 'text-violet-600/70 hover:bg-violet-600/[0.04] hover:text-violet-500'
              }`}
            >
              Admin
            </Link>
          )}
        </div>

        {/* Desktop user info - hidden on mobile */}
        <div className="hidden md:flex items-center gap-3">
          <NotificationBell />
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

        {/* Mobile controls - hidden on desktop */}
        <div className="flex md:hidden items-center gap-2">
          <NotificationBell />
          <button
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className="rounded-lg p-1.5 text-neutral-400 transition-colors hover:bg-white/[0.06] hover:text-white"
            aria-label="Menu"
          >
            {mobileMenuOpen ? (
              <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M2 4.75A.75.75 0 012.75 4h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 4.75zM2 10a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 10zm0 5.25a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75a.75.75 0 01-.75-.75z" clipRule="evenodd" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile menu panel */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-[#1a1a1a] bg-[#0d0d14]/95 px-4 py-3">
          <div className="flex flex-col gap-1">
            {NAV_LINKS.map((link) => {
              const isActive = pathname === link.href || pathname.startsWith(link.href + '/');
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`rounded-lg px-3 py-2 text-sm transition-all duration-200 ${
                    isActive
                      ? 'border border-violet-600/20 bg-violet-600/[0.06] text-violet-600'
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
                className={`rounded-lg px-3 py-2 text-sm transition-all duration-200 ${
                  pathname.startsWith('/admin')
                    ? 'border border-violet-600/20 bg-violet-600/[0.06] text-violet-600'
                    : 'text-violet-600/70 hover:bg-violet-600/[0.04] hover:text-violet-500'
                }`}
              >
                Admin
              </Link>
            )}
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-[#1a1a1a] pt-3">
            <span className="text-xs text-neutral-500">{user?.minecraftUsername}</span>
            <button
              onClick={logout}
              className="rounded-lg border border-[#1a1a1a] bg-white/[0.03] px-2.5 py-1 text-xs text-neutral-400 transition-all duration-200 hover:bg-white/[0.06] hover:text-white"
            >
              Logout
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}
