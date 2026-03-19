import { LoginButton } from '@/components/auth/login-button';
import { MicrosoftIcon } from '@/components/icons/microsoft';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://moldo.go.ro:9443';

export default function LoginPage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4">
      {/* Gradient glow */}
      <div
        className="pointer-events-none absolute -top-28 left-1/2 h-[500px] w-[800px] -translate-x-1/2"
        style={{ background: 'radial-gradient(ellipse, rgba(245,158,11,0.10) 0%, rgba(245,158,11,0.03) 40%, transparent 70%)' }}
      />
      {/* Grid */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)', backgroundSize: '56px 56px' }}
      />

      <div className="relative z-10 w-full max-w-sm animate-fade-in">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mb-4 inline-block rounded-full border border-amber-500/30 bg-amber-500/[0.06] px-4 py-1 text-[11px] font-medium text-amber-500">
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
            className="bg-amber-500 text-[#0a0a0f] font-semibold hover:bg-amber-600 hover:shadow-[0_0_20px_rgba(245,158,11,0.15)]"
          />

          {/* Future auth methods divider */}
          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-[#1a1a1a]" />
            <span className="text-xs text-neutral-500">more coming soon</span>
            <div className="h-px flex-1 bg-[#1a1a1a]" />
          </div>

          {/* Placeholder for future methods */}
          <div className="space-y-3">
            <button
              disabled
              className="flex w-full cursor-not-allowed items-center justify-center gap-3 rounded-lg border border-[#1a1a1a] bg-white/[0.02] px-4 py-3 text-sm text-neutral-600"
            >
              Discord (coming soon)
            </button>
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
