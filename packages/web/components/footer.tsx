const DISCORD_INVITE_URL = process.env.NEXT_PUBLIC_DISCORD_INVITE_URL || '#';

export function Footer() {
  return (
    <footer className="px-6 pb-8 pt-16">
      <div className="mx-auto max-w-md rounded-2xl border border-[#1a1a1a] bg-white/[0.02] px-6 py-4">
        <div className="flex items-center justify-center gap-4 text-xs text-neutral-500">
          <a
            href={DISCORD_INVITE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors hover:text-violet-400"
          >
            Discord
          </a>
          <span className="text-neutral-700">·</span>
          <a href="/terms" className="transition-colors hover:text-violet-400">Terms</a>
          <span className="text-neutral-700">·</span>
          <a href="/rules" className="transition-colors hover:text-violet-400">Rules</a>
        </div>
        <p className="mt-2 text-center text-[10px] text-neutral-700">
          &copy; 2026 DonutTrade
        </p>
      </div>
    </footer>
  );
}
