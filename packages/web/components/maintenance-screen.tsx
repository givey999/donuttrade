'use client';

export function MaintenanceScreen({ message }: { message: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#0a0a0a] px-4">
      <div className="mx-auto w-full max-w-md rounded-2xl border border-[#1a1a1a] bg-[#111] p-8 text-center shadow-2xl">
        {/* Icon */}
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-violet-500/10">
          <svg className="h-7 w-7 text-violet-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>

        <h1 className="mt-5 text-xl font-bold text-white">
          DonutTrade is currently under maintenance
        </h1>

        {message && (
          <div className="mt-4 rounded-lg border border-violet-500/20 bg-violet-500/[0.05] px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wider text-violet-500/70">Reason</p>
            <p className="mt-1 text-sm text-neutral-300">{message}</p>
          </div>
        )}

        <p className="mt-4 text-xs text-neutral-500">Please check back later.</p>

        <button
          onClick={() => window.location.reload()}
          className="mt-5 w-full rounded-lg border border-[#1a1a1a] bg-white/[0.05] px-4 py-2.5 text-sm text-white transition-colors hover:bg-white/[0.1]"
        >
          Check again
        </button>
      </div>
    </div>
  );
}
