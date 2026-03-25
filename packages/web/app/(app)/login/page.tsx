'use client';

import { useEffect } from 'react';
import { LoginButton } from '@/components/auth/login-button';
import { MicrosoftIcon } from '@/components/icons/microsoft';
import { DiscordIcon } from '@/components/icons/discord';
import { clearAccessToken } from '@/lib/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://moldo.go.ro:9443';

export default function LoginPage() {
  // Clear any stale access token so the AuthProvider doesn't try to use it
  // during the OAuth callback flow and race-redirect to /login
  useEffect(() => {
    clearAccessToken();
  }, []);

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4">
      {/* Gradient glow */}
      <div
        className="pointer-events-none absolute -top-28 left-1/2 h-[500px] w-[800px] -translate-x-1/2"
        style={{ background: 'radial-gradient(ellipse, rgba(124,58,237,0.10) 0%, rgba(124,58,237,0.03) 40%, transparent 70%)' }}
      />
      {/* Grid */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)', backgroundSize: '56px 56px' }}
      />

      <div className="relative z-10 w-full max-w-sm animate-fade-in">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mb-4 inline-block rounded-full border border-violet-600/30 bg-violet-600/[0.06] px-4 py-1 text-[11px] font-medium text-violet-600">
            DonutSMP Trading Platform
          </div>
          <h1 className="text-[28px] font-extrabold tracking-tight">DonutTrade</h1>
          <p className="mt-2 text-sm text-neutral-500">
            Minecraft trading escrow platform
          </p>
        </div>

        {/* Login card */}
        <div className="rounded-xl border border-[#1a1a1a] bg-white/[0.02] p-6 shadow-lg backdrop-blur-sm">
          <h2 className="mb-6 text-center text-lg font-semibold">Sign in</h2>

          {/* Microsoft OAuth */}
          <LoginButton
            href={`${API_URL}/auth/microsoft?redirect=${encodeURIComponent('/auth/callback')}`}
            icon={<MicrosoftIcon />}
            label="Sign in with Microsoft"
            className="bg-violet-600 text-[#0a0a0f] font-semibold hover:bg-violet-700 hover:shadow-[0_0_20px_rgba(124,58,237,0.15)]"
          />

          {/* Divider */}
          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-[#1a1a1a]" />
            <span className="text-xs text-neutral-500">or</span>
            <div className="h-px flex-1 bg-[#1a1a1a]" />
          </div>

          {/* Discord OAuth */}
          <LoginButton
            href={`${API_URL}/auth/discord?redirect=${encodeURIComponent('/auth/callback')}`}
            icon={<DiscordIcon />}
            label="Sign in with Discord"
            className="border border-[#5865F2] bg-[#5865F2] text-white font-semibold hover:bg-[#4752C4]"
          />

          {/* Future auth methods */}
          <div className="mt-3">
            <button
              disabled
              className="flex w-full cursor-not-allowed items-center justify-center gap-3 rounded-lg border border-[#1a1a1a] bg-white/[0.02] px-4 py-3 text-sm text-neutral-600"
            >
              Email &amp; Password (coming soon)
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
