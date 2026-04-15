'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface CtaButtonProps {
  variant?: 'primary' | 'ghost';
  className?: string;
  loggedInLabel?: string;
  loggedOutLabel?: string;
  loggedOutHref?: string;
  loggedInHref?: string;
}

export function CtaButton({
  variant = 'primary',
  className = '',
  loggedInLabel = 'Go to Dashboard',
  loggedOutLabel = 'Start Trading →',
  loggedOutHref = '/login',
  loggedInHref = '/dashboard',
}: CtaButtonProps) {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);

  useEffect(() => {
    try {
      const token = localStorage.getItem('dt_access_token');
      setIsLoggedIn(!!token);
    } catch {
      setIsLoggedIn(false);
    }
  }, []);

  const href = isLoggedIn ? loggedInHref : loggedOutHref;
  const label = isLoggedIn ? loggedInLabel : loggedOutLabel;

  // Render with the logged-out state first (server-rendered), hydrate to real state on mount.
  // This avoids layout shift by always rendering a button with the same structure.
  const base =
    variant === 'primary'
      ? 'inline-block rounded-xl bg-violet-600 px-9 py-3.5 text-[15px] font-bold text-[#0a0a0f] transition-colors hover:bg-violet-700'
      : 'ml-2 inline-block rounded-xl border border-neutral-800 bg-transparent px-7 py-3 text-[15px] font-bold text-violet-400 transition-colors hover:border-violet-600';

  return (
    <Link href={href} className={`${base} ${className}`}>
      {label}
    </Link>
  );
}
