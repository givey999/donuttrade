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
    <nav className="sticky top-0 z-40 border-b border-neutral-800 bg-[#0a0a0f]/90 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        {/* Logo */}
        <Link href="/dashboard" className="text-lg font-bold tracking-tight text-white">
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
                className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
                  isActive
                    ? 'bg-neutral-800 text-white'
                    : 'text-neutral-400 hover:bg-neutral-800/50 hover:text-neutral-200'
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </div>

        {/* User info + logout */}
        <div className="flex items-center gap-3">
          <span className="text-xs text-neutral-500">
            {user?.minecraftUsername}
          </span>
          <button
            onClick={logout}
            className="rounded-lg border border-neutral-800 px-2.5 py-1 text-xs text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-white"
          >
            Logout
          </button>
        </div>
      </div>
    </nav>
  );
}
