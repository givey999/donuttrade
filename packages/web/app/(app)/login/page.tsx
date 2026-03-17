import { LoginButton } from '@/components/auth/login-button';
import { MicrosoftIcon } from '@/components/icons/microsoft';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://moldo.go.ro:9443';

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight">DonutTrade</h1>
          <p className="mt-2 text-sm text-neutral-400">
            Minecraft trading escrow platform
          </p>
        </div>

        {/* Login card */}
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-6 shadow-lg backdrop-blur-sm">
          <h2 className="mb-6 text-center text-lg font-semibold">Sign in</h2>

          {/* Microsoft OAuth */}
          <LoginButton
            href={`${API_URL}/auth/microsoft?redirect=${encodeURIComponent('/auth/callback')}`}
            icon={<MicrosoftIcon />}
            label="Sign in with Microsoft"
            className="bg-[#2f2f2f] text-white hover:bg-[#3a3a3a] border border-neutral-700"
          />

          {/* Future auth methods divider */}
          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-neutral-800" />
            <span className="text-xs text-neutral-500">more coming soon</span>
            <div className="h-px flex-1 bg-neutral-800" />
          </div>

          {/* Placeholder for future methods */}
          <div className="space-y-3">
            <button
              disabled
              className="flex w-full cursor-not-allowed items-center justify-center gap-3 rounded-lg border border-neutral-800 bg-neutral-800/30 px-4 py-3 text-sm text-neutral-600"
            >
              Discord (coming soon)
            </button>
            <button
              disabled
              className="flex w-full cursor-not-allowed items-center justify-center gap-3 rounded-lg border border-neutral-800 bg-neutral-800/30 px-4 py-3 text-sm text-neutral-600"
            >
              Email &amp; Password (coming soon)
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
