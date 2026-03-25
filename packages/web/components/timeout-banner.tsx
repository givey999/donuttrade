'use client';

import { useAuth } from '@/lib/auth';

export function TimeoutBanner() {
  const { user, isTimedOut } = useAuth();

  if (!isTimedOut || !user?.timedOutUntil) return null;

  const until = new Date(user.timedOutUntil);
  const reason = user.timeoutReason;

  return (
    <div className="border-b border-violet-600/20 bg-violet-600/[0.04] px-4 py-2.5 text-center text-sm text-violet-500">
      <span className="font-medium">Your account is currently timed out</span>
      <span className="mx-2 text-violet-700">|</span>
      <span>Expires: {until.toLocaleString()}</span>
      {reason && (
        <>
          <span className="mx-2 text-violet-700">|</span>
          <span>Reason: {reason}</span>
        </>
      )}
    </div>
  );
}
