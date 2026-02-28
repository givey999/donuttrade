'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import Link from 'next/link';

function CallbackContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get('error');
  const success = searchParams.get('success');

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
        <p className="mt-2 text-sm text-neutral-400">Welcome to DonutTrade!</p>
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
