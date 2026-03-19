'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { setAccessToken } from '@/lib/api';

function CallbackContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const error = searchParams.get('error');
  const success = searchParams.get('success');

  // Token is in the URL hash fragment (not sent to servers, not logged)
  const [token, setTokenValue] = useState<string | null>(null);
  useEffect(() => {
    const hash = window.location.hash;
    if (hash.startsWith('#token=')) {
      setTokenValue(hash.slice('#token='.length));
      // Clear from address bar
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  }, []);

  // Store access token and redirect to dashboard after 3s
  useEffect(() => {
    if (success && token) {
      setAccessToken(token); // writes to both in-memory + localStorage
      const timer = setTimeout(() => {
        router.push('/dashboard');
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [success, token, router]);

  // Timeout: if callback page has no success/error after 10s, redirect to login
  useEffect(() => {
    if (success || error) return;
    const timer = setTimeout(() => {
      router.push('/login');
    }, 10_000);
    return () => clearTimeout(timer);
  }, [success, error, router]);

  if (error) {
    return (
      <div className="rounded-xl border border-red-900/50 bg-red-950/20 p-6 text-center">
        <h2 className="text-lg font-semibold text-red-400">Authentication failed</h2>
        <p className="mt-2 text-sm text-neutral-400">{error}</p>
        <Link
          href="/login"
          className="mt-4 inline-block rounded-lg bg-neutral-800 px-4 py-2 text-sm hover:bg-neutral-700 transition-colors"
        >
          Try again
        </Link>
      </div>
    );
  }

  if (success) {
    return (
      <div className="rounded-xl border border-green-900/50 bg-green-950/20 p-6 text-center">
        <h2 className="text-lg font-semibold text-green-400">Signed in successfully</h2>
        <p className="mt-3 text-sm text-neutral-300">Welcome to the DonutTrade Family</p>
        <p className="mt-2 text-sm text-neutral-400">Redirecting to dashboard...</p>
        <Link
          href="/dashboard"
          className="mt-4 inline-block text-xs text-neutral-500 underline hover:text-neutral-300 transition-colors"
        >
          Go now
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-6 text-center">
      <h2 className="text-lg font-semibold">Completing sign-in...</h2>
      <p className="mt-2 text-sm text-neutral-400">Please wait while we verify your account.</p>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <Suspense
          fallback={
            <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-6 text-center">
              <p className="text-sm text-neutral-400">Loading...</p>
            </div>
          }
        >
          <CallbackContent />
        </Suspense>
      </div>
    </main>
  );
}
