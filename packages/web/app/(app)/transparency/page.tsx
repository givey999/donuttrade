import type { Metadata } from 'next';
import { SectionLabel } from '@/components/landing/SectionLabel';
import { SectionTitle } from '@/components/landing/SectionTitle';
import { TerminalCursor } from '@/components/landing/TerminalCursor';

export const metadata: Metadata = {
  title: 'Transparency — How DonutTrade actually works',
  description:
    'How escrow, audits, and admin accountability work at DonutTrade. Source code is public on GitHub under FSL 1.1.',
  openGraph: {
    title: 'Transparency — How DonutTrade actually works',
    description:
      'How escrow, audits, and admin accountability work at DonutTrade. Source on GitHub under FSL 1.1.',
    siteName: 'DonutTrade',
  },
};

export default function TransparencyPage() {
  return (
    <div className="mx-auto max-w-[900px] px-6 py-16">
      {/* Header */}
      <header className="mb-20 text-center">
        <SectionLabel>sys.transparency</SectionLabel>
        <h1 className="mb-4 mt-2 font-vt323 text-[60px] leading-[0.95] tracking-wide text-white md:text-[80px]">
          TRANSPARENCY
          <TerminalCursor height={60} width={20} />
        </h1>
        <p className="mx-auto max-w-xl text-[13px] leading-relaxed text-neutral-400">
          How escrow, audits, and admin accountability actually work.
        </p>
      </header>

      {/* Section 1 — Source code announcement */}
      <section className="relative mb-24 overflow-hidden rounded-2xl border border-violet-600/30 bg-violet-600/[0.04] px-8 py-14 text-center">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-1/2 h-[280px] w-[500px] -translate-x-1/2 -translate-y-1/2"
          style={{
            background:
              'radial-gradient(ellipse, rgba(124,58,237,0.15) 0%, transparent 70%)',
          }}
        />
        <div className="relative z-10">
          <SectionLabel>source.open</SectionLabel>
          <SectionTitle className="!text-[44px] md:!text-[56px]">NOW SOURCE-OPEN</SectionTitle>
          <p className="mx-auto mb-6 max-w-[620px] text-[14px] leading-relaxed text-neutral-300">
            <span className="font-bold text-white">
              We&apos;re happy to announce that DonutTrade is source-open.
            </span>{' '}
            The full platform — API, web frontend, bots, escrow logic, admin tooling — lives on GitHub under the Functional Source License (FSL 1.1). Every endpoint, every admin check, every cryptographic operation: all readable, all verifiable.
          </p>
          <a
            href="https://github.com/givey999/donuttrade"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block rounded-lg border-[1.5px] border-violet-600 bg-transparent px-6 py-[11px] font-vt323 text-[18px] tracking-wide text-violet-400 transition-colors hover:bg-violet-600/10"
          >
            <span className="text-violet-600">&gt; </span>github.com/givey999/donuttrade
          </a>
          <p className="mx-auto mt-6 max-w-[560px] text-[11px] leading-relaxed text-neutral-600">
            Available today for reading, learning, and non-commercial use. Auto-converts to Apache 2.0 two years after each release. See <code className="text-neutral-500">LICENSE</code> in the repo for the exact terms.
          </p>
        </div>
      </section>

      {/* Section 2 — Your data */}
      <section className="mb-24">
        <SectionLabel>data.policy</SectionLabel>
        <SectionTitle>YOUR DATA</SectionTitle>
        <div className="mt-6 rounded-xl border border-violet-600/30 bg-violet-600/[0.04] px-6 py-4 text-center">
          <p className="text-[13px] leading-relaxed text-neutral-300">
            <span className="font-bold text-white">Sign-in is handled by OAuth — no DonutTrade-specific password is required.</span>{' '}
            You can sign in with Microsoft, Discord, or email. For OAuth paths, DonutTrade never sees your Microsoft or Discord password. If you use the email path, your password is stored as a bcrypt hash — never in plaintext. Either way, we don&apos;t want your credentials.
          </p>
        </div>
        <div className="mt-10 grid gap-6 md:grid-cols-2">
          <DataBlock
            title="What we store"
            items={[
              'Minecraft username (entered during sign-up)',
              'Microsoft account ID (if you sign in with Microsoft)',
              'Discord user ID + username (if you link or sign in with Discord)',
              'Email address (if you sign in with email, or if Microsoft/Discord provides one during OAuth)',
              'bcrypt password hash (only if you use the email sign-in path — never for OAuth users)',
              'Your server-side session token, IP address, and user-agent (short-lived, expires on logout)',
              'Deposit, withdrawal, and trade history (required for the audit log)',
              'Your current escrow inventory (required to know what\u2019s yours)',
              'Notification preferences (DM opt-in / opt-out)',
            ]}
          />
          <DataBlock
            title="What we receive from Microsoft"
            paragraphs={[
              'When you sign in with Microsoft, we request the openid, email, profile, and offline_access scopes. From the returned ID token we extract your Microsoft account ID and, if present, your email address.',
              'We store the Microsoft account ID to identify you on future logins, and the email address in the users table (nullable — not all Microsoft accounts include one).',
              'The Microsoft access token is used once at sign-in and never stored.',
            ]}
          />
          <DataBlock
            title="What we receive from Discord"
            paragraphs={[
              'If you link or sign in with Discord, we request the identify and email scopes. From /users/@me we receive your Discord user ID, username, and email address (if your Discord account has one verified).',
              'We store your Discord user ID and username. The email is stored in the shared users.email field.',
              'We do not read your messages, server list, friend list, or any other Discord content.',
              'You can unlink Discord at any time from /dashboard.',
            ]}
          />
          <DataBlock
            title="What we never touch"
            items={[
              'Real names or physical addresses',
              'Phone numbers',
              'Payment cards or real-money financial data — DonutTrade only handles in-game DonutSMP currency',
              'Browser fingerprints or ad-targeting profiles',
              'Your Microsoft or Discord password (handled entirely by those providers)',
            ]}
          />
        </div>
      </section>

      {/* Section 3 — The escrow flow */}
      <section className="mb-24">
        <SectionLabel>escrow.flow</SectionLabel>
        <SectionTitle>HOW AN ESCROW TRADE WORKS</SectionTitle>
        <div className="mt-10 overflow-hidden rounded-xl border border-neutral-800 bg-[#05050a]">
          <div className="border-b border-neutral-800 bg-white/[0.02] px-4 py-[10px] text-[11px] text-neutral-600">
            escrow.flow — example trade
          </div>
          <pre className="overflow-x-auto px-5 py-5 font-vt323 text-[16px] leading-[1.6] text-neutral-300">
{`[t=0]    buyer.submit_order(item=zombie_spawner, price=45000)
[t=0.01] api.issue_code(order_id=42, hmac=sha256(payload + CODE_SIGNING_SECRET))
[t=0.02] escrow.lock_funds(buyer, amount=45000)
[t=1h]   seller.submit_fill(order_id=42, code=<verified>)
[t=1h]   escrow.verify_hmac(order_id, code) → OK
[t=1h]   escrow.release_to_seller(amount=44100)   // -2% platform fee
[t=1h]   escrow.deliver_item(buyer)
[t=1h]   audit.log(action=trade_completed, order_id=42)`}
          </pre>
        </div>
        <p className="mt-4 text-[12px] leading-relaxed text-neutral-500">
          Every line above corresponds to a real function call. Grep <code>packages/api/src/</code> in the public repo to find them — starting with <code>packages/api/src/lib/deposit-code.ts</code> for the HMAC generation.
        </p>
      </section>

      {/* Section 4 — Admin ACL */}
      <section className="mb-24">
        <SectionLabel>admin.acl</SectionLabel>
        <SectionTitle>ADMIN POWERS</SectionTitle>
        <div className="mt-10 grid gap-6 md:grid-cols-2">
          <div className="rounded-xl border border-neutral-800 bg-white/[0.018] p-6">
            <h3 className="mb-4 font-vt323 text-[22px] tracking-wide text-violet-400">ADMINS CAN</h3>
            <ul className="space-y-[10px] text-[13px] leading-relaxed text-neutral-300">
              <li>Approve deposits (verify items match the claimed amount)</li>
              <li>Confirm withdrawals (deliver items in-game)</li>
              <li>Resolve disputes (review audit log, render a decision)</li>
              <li>Freeze accounts suspected of scamming</li>
              <li>Adjust platform settings (fees, categories, limits)</li>
            </ul>
          </div>
          <div className="rounded-xl border border-neutral-800 bg-white/[0.018] p-6">
            <h3 className="mb-4 font-vt323 text-[22px] tracking-wide text-violet-400">ADMINS CANNOT</h3>
            <ul className="space-y-[10px] text-[13px] leading-relaxed text-neutral-300">
              <li>Move items a user didn&apos;t deposit</li>
              <li>Edit or delete audit log rows (append-only)</li>
              <li>Drain escrow without a matching order</li>
              <li>Read user passwords — OAuth users have none; email users have only a bcrypt hash</li>
              <li>Block a user&apos;s withdrawal on their own authority — all withdrawals require a recorded admin action</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Sections 5-9 added in Task 8 */}
    </div>
  );
}

function DataBlock({
  title,
  items,
  paragraphs,
}: {
  title: string;
  items?: string[];
  paragraphs?: string[];
}) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-white/[0.018] p-6">
      <h3 className="mb-4 font-vt323 text-[20px] tracking-wide text-violet-400">{title}</h3>
      {items && (
        <ul className="space-y-[8px] text-[12px] leading-relaxed text-neutral-400">
          {items.map((item, i) => (
            <li key={i} className="flex gap-2">
              <span className="text-neutral-700">·</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}
      {paragraphs && (
        <div className="space-y-[10px] text-[12px] leading-relaxed text-neutral-400">
          {paragraphs.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      )}
    </div>
  );
}
