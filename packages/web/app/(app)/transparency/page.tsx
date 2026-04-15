import type { Metadata } from 'next';
import Link from 'next/link';
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
            <span className="font-bold text-white">We don&apos;t want to store passwords — so we don&apos;t.</span>{' '}
            Sign-in goes through Microsoft or Discord OAuth. DonutTrade never sees your password. You&apos;ll notice scaffolding for an email+password sign-in path in the repo — we&apos;re intentionally not shipping it, precisely because we don&apos;t want to be in the business of storing credentials.
          </p>
        </div>
        <div className="mt-10 grid gap-6 md:grid-cols-2">
          <DataBlock
            title="What we store"
            items={[
              'Minecraft username (entered during sign-up)',
              'Microsoft account ID (if you sign in with Microsoft)',
              'Discord user ID + username (if you link or sign in with Discord)',
              'Email address (from Microsoft or Discord OAuth, when your account has one — stored in users.email, nullable)',
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
              <li>See your password — Microsoft and Discord handle sign-in entirely; we never receive your credentials</li>
              <li>Block a user&apos;s withdrawal on their own authority — all withdrawals require a recorded admin action</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Section 5 — Audit log */}
      <section className="mb-24">
        <SectionLabel>audit.log</SectionLabel>
        <SectionTitle>EVERY ACTION IS LOGGED</SectionTitle>
        <div className="mt-10 overflow-hidden rounded-xl border border-neutral-800 bg-[#05050a]">
          <div className="border-b border-neutral-800 bg-white/[0.02] px-4 py-[10px] text-[11px] text-neutral-600">
            audit.log — example entries
          </div>
          <table className="w-full font-vt323 text-[14px]">
            <thead>
              <tr className="border-b border-neutral-800 text-left text-[11px] uppercase tracking-wider text-neutral-600">
                <th className="px-5 py-3 font-normal">TIMESTAMP</th>
                <th className="px-5 py-3 font-normal">USER</th>
                <th className="px-5 py-3 font-normal">ACTION</th>
                <th className="px-5 py-3 font-normal">TARGET</th>
                <th className="px-5 py-3 font-normal">METADATA</th>
              </tr>
            </thead>
            <tbody className="text-neutral-400">
              <AuditRow ts="2026-04-14 14:32:01" user="xDarkKnight" action="deposit_code_issued" target="zombie_spawner ×3" meta="DT-DEP-xJk...Lm" />
              <AuditRow ts="2026-04-14 14:35:47" user="admin@platform" action="deposit_approved" target="DT-DEP-xJk...Lm" meta="verified_in_game" />
              <AuditRow ts="2026-04-14 14:40:12" user="xDarkKnight" action="order_created" target="order_id=42" meta="price=45000" />
              <AuditRow ts="2026-04-14 15:12:08" user="CraftMaster99" action="order_filled" target="order_id=42" meta="hmac=OK" />
              <AuditRow ts="2026-04-14 15:12:08" user="escrow.service" action="funds_released" target="CraftMaster99" meta="amount=44100" />
              <AuditRow ts="2026-04-14 15:45:30" user="CraftMaster99" action="withdrawal_requested" target="DT-WTH-p8Q...Rn" meta="amount=44100" />
              <AuditRow ts="2026-04-14 16:02:11" user="admin@platform" action="withdrawal_confirmed" target="DT-WTH-p8Q...Rn" meta="delivered_in_game" />
              <AuditRow ts="2026-04-14 16:02:12" user="system" action="trade_completed" target="order_id=42" meta="fee=900" />
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-[12px] leading-relaxed text-neutral-500">
          The audit log is append-only at the database level. Admins — including the platform owner — cannot edit or delete rows. Your real activity lives at <Link href="/dashboard" className="text-violet-400 hover:underline">/dashboard</Link>. Example rows shown above are illustrative.
          {/* TODO(followup): swap for real read-only query — see docs/superpowers/plans backlog */}
        </p>
      </section>

      {/* Section 6 — Dispute flow */}
      <section className="mb-24">
        <SectionLabel>dispute.flow</SectionLabel>
        <SectionTitle>IF SOMETHING GOES WRONG</SectionTitle>
        <ol className="mt-10 space-y-4 text-[13px] leading-relaxed text-neutral-300">
          <DisputeStep num="01">Open a ticket in our Discord.</DisputeStep>
          <DisputeStep num="02">An admin reviews the audit log for your account and the counterparty.</DisputeStep>
          <DisputeStep num="03">Decision rendered within 24 hours.</DisputeStep>
          <DisputeStep num="04">If you disagree, escalate to the platform owner in Discord — same 24-hour window.</DisputeStep>
          <DisputeStep num="05">Chargebacks and refunds are paid from the platform&apos;s reserve, not from other users&apos; escrow.</DisputeStep>
        </ol>
      </section>

      {/* Section 7 — Code signing math (collapsible) */}
      <section className="mb-24">
        <SectionLabel>crypto.math</SectionLabel>
        <details className="mt-6 rounded-xl border border-neutral-800 bg-white/[0.018]">
          <summary className="cursor-pointer px-6 py-5 font-vt323 text-[24px] tracking-wide text-white transition-colors hover:text-violet-400">
            HOW DEPOSIT CODES WORK <span className="text-[14px] text-neutral-600">(click to expand)</span>
          </summary>
          <div className="border-t border-neutral-800 px-6 py-6">
            <p className="mb-5 text-[13px] leading-relaxed text-neutral-400">
              Deposit and withdrawal codes are signed with HMAC-SHA256 using a secret that lives only on the server. Only the server can create a valid code. Even an admin, without the secret, cannot forge one.
            </p>
            <div className="mb-4 overflow-x-auto rounded-lg border border-neutral-800 bg-[#05050a] p-5">
              <pre className="font-vt323 text-[15px] leading-[1.6] text-neutral-300">
{`// packages/api/src/lib/deposit-code.ts
const payloadStr = Buffer.from(JSON.stringify(fullPayload)).toString('base64url');
const signature = createHmac('sha256', config.CODE_SIGNING_SECRET)
  .update(payloadStr)
  .digest('base64url');

return {
  code: \`\${prefix}\${payloadStr}.\${signature}\`,
  expiresAt,
};`}
              </pre>
            </div>
            <p className="text-[12px] leading-relaxed text-neutral-500">
              The full implementation (including <code>verifyCode</code> with timing-safe comparison) is in <code>packages/api/src/lib/deposit-code.ts</code> in the public repo.
            </p>
          </div>
        </details>
      </section>

      {/* Section 8 — How we make money */}
      <section className="mb-24">
        <SectionLabel>revenue.model</SectionLabel>
        <SectionTitle>HOW WE MAKE MONEY</SectionTitle>
        <div className="mt-10 space-y-5 text-[13px] leading-relaxed text-neutral-300">
          <div className="rounded-xl border border-neutral-800 bg-white/[0.018] p-6">
            <h3 className="mb-2 font-vt323 text-[20px] tracking-wide text-violet-400">TRADE FEES</h3>
            <p className="text-neutral-400">2% of each completed trade, shown in the UI at order creation. Split between buyer and seller.</p>
          </div>
          <div className="rounded-xl border border-neutral-800 bg-white/[0.018] p-6">
            <h3 className="mb-2 font-vt323 text-[20px] tracking-wide text-violet-400">SPONSORED LISTINGS — COMING SOON</h3>
            <p className="text-neutral-400">Item sellers will be able to pay for top placement on the marketplace. Sponsored rows will be tagged <code className="text-violet-400">SPONSORED</code>. Not yet live.</p>
          </div>
          <div className="rounded-xl border border-neutral-800 bg-white/[0.018] p-6">
            <h3 className="mb-2 font-vt323 text-[20px] tracking-wide text-violet-400">AD PLACEMENTS</h3>
            <p className="text-neutral-400">Occasional banner ads from DonutSMP-adjacent services, arranged through Discord tickets. Not programmatic; we know every advertiser.</p>
          </div>
          <p className="pt-2 text-center text-[12px] font-semibold uppercase tracking-[1px] text-neutral-500">
            We don&apos;t sell your data · We don&apos;t profile users · We don&apos;t tax trades hidden in the spread
          </p>
        </div>
      </section>

      {/* Section 9 — Who runs this */}
      <section className="mb-24">
        <SectionLabel>operator.id</SectionLabel>
        <SectionTitle>WHO RUNS THIS</SectionTitle>
        <div className="mt-10 rounded-xl border border-neutral-800 bg-white/[0.018] p-8 text-center">
          {/* TODO(user): supply real founder text. Until the operator provides text, this placeholder stays. */}
          <p className="text-[13px] leading-relaxed text-neutral-400">
            DonutTrade is run by <span className="font-bold text-white">givey999</span>. Reach out directly on Discord — the link is in the footer.
          </p>
        </div>
      </section>
    </div>
  );
}

function AuditRow({
  ts,
  user,
  action,
  target,
  meta,
}: {
  ts: string;
  user: string;
  action: string;
  target: string;
  meta: string;
}) {
  return (
    <tr className="border-b border-neutral-900">
      <td className="px-5 py-[10px] text-neutral-500">{ts}</td>
      <td className="px-5 py-[10px]">{user}</td>
      <td className="px-5 py-[10px] text-violet-400">{action}</td>
      <td className="px-5 py-[10px]">{target}</td>
      <td className="px-5 py-[10px] text-neutral-500">{meta}</td>
    </tr>
  );
}

function DisputeStep({ num, children }: { num: string; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-4 rounded-lg border border-neutral-800 bg-white/[0.018] p-5">
      <span className="font-vt323 text-[28px] leading-none text-violet-600">{num}</span>
      <span className="pt-[4px]">{children}</span>
    </li>
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
