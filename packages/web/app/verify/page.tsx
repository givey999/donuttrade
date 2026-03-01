'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

type VerifyState = 'loading' | 'pending' | 'verified' | 'expired' | 'error';

export default function VerifyPage() {
  const router = useRouter();
  const [state, setState] = useState<VerifyState>('loading');
  const [amount, setAmount] = useState<number | null>(null);
  const [botUsername, setBotUsername] = useState('');
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [timeLeft, setTimeLeft] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimers = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  // Format remaining time as mm:ss
  const formatTimeLeft = useCallback((expiry: Date) => {
    const diff = expiry.getTime() - Date.now();
    if (diff <= 0) return null;
    const mins = Math.floor(diff / 60000);
    const secs = Math.floor((diff % 60000) / 1000);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }, []);

  // Poll verification status
  const pollStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/auth/verification/status`, {
        credentials: 'include',
      });
      if (!res.ok) return;
      const json = await res.json();
      const { status, amount: amt, expiresAt: exp, botUsername: bot } = json.data;

      if (status === 'verified') {
        clearTimers();
        setState('verified');
        // Re-authenticate via OAuth to get a full session (Branch A of callback)
        setTimeout(() => {
          window.location.href = `${API_URL}/auth/microsoft?redirect=${encodeURIComponent('/auth/callback')}`;
        }, 1500);
        return;
      }

      if (status === 'expired') {
        clearTimers();
        setState('expired');
        return;
      }

      // Update pending state data
      if (amt) setAmount(amt);
      if (bot) setBotUsername(bot);
      if (exp) setExpiresAt(new Date(exp));
    } catch {
      // Silently ignore polling errors — next poll will retry
    }
  }, [clearTimers, router]);

  // Start verification on mount
  useEffect(() => {
    let cancelled = false;

    async function start() {
      try {
        const res = await fetch(`${API_URL}/auth/verification/start`, {
          method: 'POST',
          credentials: 'include',
        });

        if (cancelled) return;

        if (!res.ok) {
          const json = await res.json();
          setErrorMsg(json.error?.message || 'Failed to start verification');
          setState('error');
          return;
        }

        const json = await res.json();
        setAmount(json.data.amount);
        setBotUsername(json.data.botUsername);
        setExpiresAt(new Date(json.data.expiresAt));
        setState('pending');
      } catch {
        if (!cancelled) {
          setErrorMsg('Network error. Please try again.');
          setState('error');
        }
      }
    }

    start();
    return () => { cancelled = true; };
  }, []);

  // Polling interval (every 3s when pending)
  useEffect(() => {
    if (state !== 'pending') return;

    pollRef.current = setInterval(pollStatus, 3000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [state, pollStatus]);

  // Countdown timer (every 1s when pending)
  useEffect(() => {
    if (state !== 'pending' || !expiresAt) return;

    const tick = () => {
      const left = formatTimeLeft(expiresAt);
      if (left === null) {
        clearTimers();
        setState('expired');
        return;
      }
      setTimeLeft(left);
    };

    tick();
    timerRef.current = setInterval(tick, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [state, expiresAt, formatTimeLeft, clearTimers]);

  // Cleanup on unmount
  useEffect(() => clearTimers, [clearTimers]);

  const handleRetry = async () => {
    setState('loading');
    setErrorMsg('');

    try {
      const res = await fetch(`${API_URL}/auth/verification/retry`, {
        method: 'POST',
        credentials: 'include',
      });

      if (!res.ok) {
        const json = await res.json();
        setErrorMsg(json.error?.message || 'Failed to retry');
        setState('error');
        return;
      }

      const json = await res.json();
      setAmount(json.data.amount);
      setBotUsername(json.data.botUsername);
      setExpiresAt(new Date(json.data.expiresAt));
      setState('pending');
    } catch {
      setErrorMsg('Network error. Please try again.');
      setState('error');
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight">DonutTrade</h1>
          <p className="mt-2 text-sm text-neutral-400">
            Verify your Minecraft account
          </p>
        </div>

        {/* Loading */}
        {state === 'loading' && (
          <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-6 text-center">
            <p className="text-sm text-neutral-400">Starting verification...</p>
          </div>
        )}

        {/* Pending — waiting for payment */}
        {state === 'pending' && (
          <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-6 shadow-lg backdrop-blur-sm">
            <h2 className="mb-4 text-center text-lg font-semibold">Pay to Verify</h2>

            <p className="text-center text-sm text-neutral-400">
              Send exactly this amount to the bot in-game:
            </p>

            {/* Amount display */}
            <div className="my-4 rounded-lg border border-neutral-700 bg-neutral-800 p-4 text-center">
              <span className="text-3xl font-bold text-green-400">${amount}</span>
              <p className="mt-1 text-xs text-neutral-500">to {botUsername}</p>
            </div>

            {/* Command to copy */}
            <div className="mb-4 rounded-lg border border-neutral-700 bg-neutral-800 px-4 py-3">
              <p className="mb-1 text-xs text-neutral-500">Run this command in-game:</p>
              <code className="text-sm font-mono text-neutral-200">
                /pay {botUsername} {amount}
              </code>
            </div>

            {/* Countdown */}
            <div className="text-center">
              <span className="text-xs text-neutral-500">Expires in </span>
              <span className="font-mono text-sm text-neutral-300">{timeLeft}</span>
            </div>

            <p className="mt-4 text-center text-xs text-neutral-600">
              Checking for payment automatically...
            </p>
          </div>
        )}

        {/* Verified */}
        {state === 'verified' && (
          <div className="rounded-xl border border-green-900/50 bg-green-950/20 p-6 text-center">
            <h2 className="text-lg font-semibold text-green-400">Verified!</h2>
            <p className="mt-2 text-sm text-neutral-400">
              Your Minecraft account has been verified. Redirecting...
            </p>
          </div>
        )}

        {/* Expired */}
        {state === 'expired' && (
          <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-6 text-center">
            <h2 className="text-lg font-semibold text-neutral-300">Verification Expired</h2>
            <p className="mt-2 text-sm text-neutral-400">
              The verification window has closed. Please try again.
            </p>
            <button
              onClick={handleRetry}
              className="mt-4 rounded-lg bg-white px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-neutral-200"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Error */}
        {state === 'error' && (
          <div className="rounded-xl border border-red-900/50 bg-red-950/20 p-6 text-center">
            <h2 className="text-lg font-semibold text-red-400">Something went wrong</h2>
            <p className="mt-2 text-sm text-neutral-400">{errorMsg}</p>
            <button
              onClick={handleRetry}
              className="mt-4 rounded-lg bg-neutral-800 px-4 py-2 text-sm hover:bg-neutral-700 transition-colors"
            >
              Try Again
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
