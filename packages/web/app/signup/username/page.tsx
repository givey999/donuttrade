'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

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
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight">DonutTrade</h1>
          <p className="mt-2 text-sm text-neutral-400">
            Enter your Minecraft username to continue
          </p>
        </div>

        {/* Username card */}
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-6 shadow-lg backdrop-blur-sm">
          <h2 className="mb-4 text-center text-lg font-semibold">Minecraft Username</h2>

          {/* Bedrock disclaimer */}
          <div className="mb-5 rounded-lg border border-amber-800/50 bg-amber-950/30 p-3">
            <p className="text-sm font-medium text-amber-400">Bedrock Edition</p>
            <p className="mt-1 text-xs text-amber-200/70">
              If you play on Bedrock Edition, write your username with a dot (.) in front.{' '}
              <span className="font-mono text-amber-300">.PlayerName</span>
            </p>
          </div>

          <form onSubmit={handleSubmit}>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Your Minecraft username"
              maxLength={17}
              className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-4 py-3 text-sm text-white placeholder-neutral-500 outline-none focus:border-neutral-500 transition-colors"
              autoFocus
              disabled={loading}
            />

            {error && (
              <p className="mt-3 text-sm text-red-400">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading || username.trim().length < 3}
              className="mt-4 w-full rounded-lg bg-white px-4 py-3 text-sm font-medium text-black transition-colors hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Continue'}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
