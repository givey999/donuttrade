'use client';

import { useAuth } from '@/lib/auth';

export function TimeoutBanner() {
  const { user, isTimedOut } = useAuth();

  if (!isTimedOut || !user?.timedOutUntil) return null;

  const until = new Date(user.timedOutUntil);
  const reason = user.timeoutReason;

  return (
    <div className="border-b border-amber-900/50 bg-amber-950/30 px-4 py-2.5 text-center text-sm text-amber-400">
      <span className="font-medium">Your account is currently timed out</span>
      <span className="mx-2 text-amber-600">|</span>
      <span>Expires: {until.toLocaleString()}</span>
      {reason && (
        <>
          <span className="mx-2 text-amber-600">|</span>
          <span>Reason: {reason}</span>
        </>
      )}
    </div>
  );
}
