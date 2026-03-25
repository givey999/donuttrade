'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://moldo.go.ro:9443';

export default function UsernamePage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/auth/set-username`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username: username.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error?.message || 'Something went wrong');
        return;
      }

      router.push('/verify');
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4">
      {/* Gradient glow */}
      <div
        className="pointer-events-none absolute -top-28 left-1/2 h-[500px] w-[800px] -translate-x-1/2"
        style={{ background: 'radial-gradient(ellipse, rgba(139,92,246,0.10) 0%, rgba(139,92,246,0.03) 40%, transparent 70%)' }}
      />
      {/* Grid */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)', backgroundSize: '56px 56px' }}
      />

      <div className="relative z-10 w-full max-w-sm animate-fade-in">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-[28px] font-extrabold tracking-tight">DonutTrade</h1>
          <p className="mt-2 text-sm text-neutral-500">
            Enter your Minecraft username to continue
          </p>
        </div>

        {/* Username card */}
        <div className="rounded-xl border border-[#1a1a1a] bg-white/[0.02] p-6 shadow-lg backdrop-blur-sm">
          <h2 className="mb-4 text-center text-lg font-semibold">Minecraft Username</h2>

          {/* Bedrock disclaimer */}
          <div className="mb-5 rounded-lg border border-violet-500/20 bg-violet-500/[0.06] p-3">
            <p className="text-sm font-medium text-violet-400">Bedrock Edition</p>
            <p className="mt-1 text-xs text-violet-200/70">
              If you play on Bedrock Edition, write your username with a dot (.) in front.{' '}
              <span className="font-mono text-violet-300">.PlayerName</span>
            </p>
          </div>

          <form onSubmit={handleSubmit}>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Your Minecraft username"
              maxLength={17}
              className="w-full rounded-lg border border-[#1a1a1a] bg-white/[0.03] px-4 py-3 text-sm text-white placeholder-neutral-600 outline-none transition-colors focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/30"
              autoFocus
              disabled={loading}
            />

            {error && (
              <p className="mt-3 text-sm text-red-400">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading || username.trim().length < 3}
              className="mt-4 w-full rounded-lg bg-violet-500 px-4 py-3 text-sm font-semibold text-[#0a0a0f] transition-all duration-200 hover:bg-violet-600 hover:shadow-[0_0_20px_rgba(139,92,246,0.15)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Continue'}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
