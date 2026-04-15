const DISCORD_INVITE_URL = process.env.NEXT_PUBLIC_DISCORD_INVITE_URL || '#';

export function Footer() {
  return (
    <footer className="border-t border-neutral-800 px-8 py-5">
      <div className="mx-auto flex max-w-[1100px] items-center justify-between font-vt323 text-[14px] text-neutral-500">
        <span className="tracking-wide">donuttrade.com</span>
        <div className="flex items-center gap-5">
          <a href="/rules" className="transition-colors hover:text-violet-400">rules</a>
          <a href="/transparency" className="transition-colors hover:text-violet-400">transparency</a>
          <a href="/terms" className="transition-colors hover:text-violet-400">terms</a>
          <a
            href={DISCORD_INVITE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors hover:text-violet-400"
          >
            discord
          </a>
        </div>
      </div>
    </footer>
  );
}
