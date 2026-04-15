import Link from 'next/link';
import { Footer } from '@/components/footer';
import { CtaButton } from '@/components/landing/CtaButton';
import { TerminalCursor } from '@/components/landing/TerminalCursor';
import { SectionLabel } from '@/components/landing/SectionLabel';
import { SectionTitle } from '@/components/landing/SectionTitle';
import { PixelLogo } from '@/components/landing/PixelLogo';

export default function LandingPage() {
  return (
    <div className="relative flex min-h-screen flex-col">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Organization',
            name: 'DonutTrade',
            url: 'https://donuttrade.com',
            logo: 'https://donuttrade.com/opengraph-image',
            description: 'Secure escrow trading for Minecraft items on DonutSMP.',
            sameAs: [
              'https://github.com/givey999/donuttrade',
              process.env.NEXT_PUBLIC_DISCORD_INVITE_URL || 'https://discord.gg/donuttrade',
            ],
          }),
        }}
      />
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-neutral-800 bg-[#0a0a0f]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-[1100px] items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-[10px]">
            <PixelLogo size={22} />
            <span className="font-vt323 text-[22px] tracking-wide text-white">DONUTTRADE</span>
          </Link>
          <CtaButton
            variant="primary"
            className="!px-5 !py-2 !text-sm"
            loggedInLabel="Go to Dashboard"
            loggedOutLabel="Start Trading"
          />
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden px-6 pb-24 pt-24 text-center md:pt-28">
        {/* Violet glow */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-20 left-1/2 h-[520px] w-[820px] -translate-x-1/2"
          style={{
            background:
              'radial-gradient(ellipse, rgba(124,58,237,0.12) 0%, rgba(124,58,237,0.03) 40%, transparent 70%)',
          }}
        />
        {/* Grid overlay */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)',
            backgroundSize: '56px 56px',
          }}
        />

        <div className="relative z-10">
          <div className="mb-7 inline-block rounded-full border border-violet-600/30 bg-violet-600/[0.07] px-3 py-[5px] text-[10px] font-semibold uppercase tracking-[2px] text-violet-400">
            DONUTSMP · ESCROW TRADING
          </div>
          <h1 className="mx-auto max-w-3xl font-vt323 text-[56px] leading-[0.9] text-white md:text-[78px]">
            TRADE SAFELY<br />
            ON <span className="text-violet-400">DONUTSMP</span>
            <TerminalCursor height={58} width={20} />
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-[12px] font-semibold uppercase tracking-[1.6px] text-neutral-500">
            Instant Item Swaps · Escrow Protected
          </p>
          <div className="mt-8">
            <CtaButton
              variant="primary"
              loggedInLabel="Go to Dashboard"
              loggedOutLabel="Start Trading →"
            />
            <Link
              href="/marketplace"
              className="ml-2 inline-block rounded-xl border border-neutral-800 bg-transparent px-7 py-3 text-[14px] font-bold text-violet-400 transition-colors hover:border-violet-600"
            >
              View Marketplace
            </Link>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-[1000px] px-6 py-20">
        <SectionLabel>how_it_works.sh</SectionLabel>
        <SectionTitle>THREE STEPS</SectionTitle>
        <p className="mb-12 text-center text-[12px] font-semibold uppercase tracking-[1.5px] text-neutral-500">
          Deposit · Trade · Withdraw
        </p>
        <div className="grid gap-4 md:grid-cols-3">
          <StepCard num="01" title="DEPOSIT" desc="Send items to our account in-game. Your inventory is tracked and secured automatically." />
          <StepCard num="02" title="TRADE" desc="Buy and sell on the marketplace. Funds are held in escrow until the order fills." />
          <StepCard num="03" title="WITHDRAW" desc="Collect your items in-game. An admin confirms delivery and you're done." />
        </div>
      </section>

      {/* Why trust us */}
      <section className="mx-auto max-w-[1000px] px-6 py-20">
        <SectionLabel>trust.log</SectionLabel>
        <SectionTitle>WHY TRUST US</SectionTitle>
        <p className="mb-12 text-center text-[12px] font-semibold uppercase tracking-[1.5px] text-neutral-500">
          Built from the ground up for safe trading
        </p>
        <div className="grid gap-4 md:grid-cols-3">
          <TrustCard title="ESCROW LOCKED" desc="Every trade is backed by escrow. Funds and items are held until both sides fulfill — no scams." />
          <TrustCard title="VERIFIED" desc="All traders are verified through Microsoft authentication linked to their Minecraft account." />
          <TrustCard title="MONITORED" desc="Our admin team reviews every deposit, withdrawal, and trade. Full audit trail on every action." />
        </div>
      </section>

      {/* Still skeptical */}
      <section className="relative border-y border-neutral-800 bg-violet-600/[0.03] px-6 py-16 text-center">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              'linear-gradient(rgba(124,58,237,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(124,58,237,0.04) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />
        <div className="relative z-10 mx-auto max-w-[640px]">
          <SectionLabel>skeptical.check</SectionLabel>
          <h2 className="mb-4 mt-2 font-vt323 text-[44px] leading-none tracking-wide text-white md:text-[56px]">
            STILL <span className="text-violet-400">SKEPTICAL</span>?
            <TerminalCursor height={42} width={16} />
          </h2>
          <p className="mx-auto mb-6 max-w-[520px] text-[13px] leading-relaxed text-neutral-400">
            <span className="font-bold text-white">Good.</span> We wrote down exactly how escrow, audits, and admin approvals work — so you can verify instead of take our word for it.
          </p>
          <Link
            href="/transparency"
            className="inline-block rounded-lg border-[1.5px] border-violet-600 bg-transparent px-6 py-[11px] font-vt323 text-[18px] tracking-wide text-violet-400 transition-colors hover:bg-violet-600/10"
          >
            <span className="text-violet-600">&gt; </span>View Transparency Page
          </Link>
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative overflow-hidden px-6 pb-28 pt-24 text-center">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-1/2 h-[340px] w-[680px] -translate-x-1/2 -translate-y-1/2"
          style={{
            background:
              'radial-gradient(ellipse, rgba(124,58,237,0.10) 0%, transparent 70%)',
          }}
        />
        <div className="relative z-10">
          <h2 className="mb-3 font-vt323 text-[56px] leading-[0.95] tracking-wide text-white md:text-[72px]">
            READY TO TRADE?
            <TerminalCursor height={52} width={18} />
          </h2>
          <p className="mb-7 text-[12px] font-semibold uppercase tracking-[1.5px] text-neutral-500">
            Sign in with Microsoft · Start trading in seconds
          </p>
          <CtaButton
            variant="primary"
            loggedInLabel="Go to Dashboard"
            loggedOutLabel="Start Trading →"
          />
        </div>
      </section>

      <div className="mt-auto">
        <Footer />
      </div>
    </div>
  );
}

function StepCard({ num, title, desc }: { num: string; title: string; desc: string }) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-white/[0.018] p-6">
      <div className="font-vt323 text-[32px] leading-none text-violet-600">
        {num}
        <span className="animate-cursor-blink">_</span>
      </div>
      <h3 className="mb-[6px] mt-[6px] font-vt323 text-[24px] tracking-wide text-white">{title}</h3>
      <p className="text-[12px] leading-relaxed text-neutral-500">{desc}</p>
    </div>
  );
}

function TrustCard({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-white/[0.018] p-6">
      <div className="mb-3 h-8 w-8 border border-violet-600/30 bg-violet-600/10" />
      <h3 className="mb-[6px] font-vt323 text-[22px] tracking-wide text-white">{title}</h3>
      <p className="text-[12px] leading-relaxed text-neutral-500">{desc}</p>
    </div>
  );
}
