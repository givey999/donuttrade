export default function TermsPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-2xl font-extrabold tracking-tight">Terms of Service</h1>
      <p className="mt-2 text-sm text-neutral-500">
        Last updated: March 31, 2026
      </p>

      <section className="mt-10">
        <h2 className="text-lg font-bold text-violet-400">1. What DonutTrade Is</h2>
        <p className="mt-3 text-sm leading-relaxed text-neutral-300">
          DonutTrade is a third-party trading platform for in-game items and currency on Minecraft servers. We provide an escrow service that holds funds and items during a trade so both parties are protected. DonutTrade is not affiliated with Mojang, Microsoft, or any Minecraft server.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-bold text-violet-400">2. Eligibility</h2>
        <p className="mt-3 text-sm leading-relaxed text-neutral-300">
          You must own a valid Minecraft account to use DonutTrade. You are responsible for keeping your account credentials secure. Each person may have a maximum of 5 accounts — additional alt accounts will be banned.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-bold text-violet-400">3. Deposits &amp; Withdrawals</h2>
        <p className="mt-3 text-sm leading-relaxed text-neutral-300">
          Deposits are processed by our in-game bot. Once a deposit is confirmed, the funds are credited to your DonutTrade balance. Withdrawals are sent to your Minecraft account via the in-game payment system. Processing times may vary depending on server load and bot availability.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-neutral-300">
          DonutTrade is not responsible for deposits sent to the wrong account, incorrect amounts, or payments made outside of the platform&apos;s deposit system.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-bold text-violet-400">4. Trading &amp; Escrow</h2>
        <p className="mt-3 text-sm leading-relaxed text-neutral-300">
          All marketplace trades are held in escrow until both parties fulfill their obligations. A commission fee is deducted from completed trades. Orders may expire if not filled within the specified time period. DonutTrade does not guarantee that your orders will be filled.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-bold text-violet-400">5. Virtual Currency &amp; Items</h2>
        <p className="mt-3 text-sm leading-relaxed text-neutral-300">
          All funds and items on DonutTrade are virtual and exist only within the context of the Minecraft server. They have no real-world monetary value. DonutTrade does not facilitate or support the exchange of in-game assets for real money.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-bold text-violet-400">6. Prohibited Conduct</h2>
        <p className="mt-3 text-sm leading-relaxed text-neutral-300">
          You may not use DonutTrade to scam, defraud, or deceive other users. You may not exploit bugs, dupe items or currency, manipulate the market, or abuse any platform feature. You may not attempt to circumvent bans or restrictions using alt accounts. See our <a href="/rules" className="text-violet-400 hover:underline">Rules</a> for the full list.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-bold text-violet-400">7. Account Termination</h2>
        <p className="mt-3 text-sm leading-relaxed text-neutral-300">
          We reserve the right to suspend, timeout, or permanently ban any account that violates these terms or our rules. In cases of fraud, duping, or severe rule violations, your balance and items may be frozen or removed. Decisions are made at the discretion of the moderation team.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-bold text-violet-400">8. Availability &amp; Liability</h2>
        <p className="mt-3 text-sm leading-relaxed text-neutral-300">
          DonutTrade is provided &quot;as is&quot; with no guarantees of uptime or availability. We may perform maintenance, updates, or shut down the platform at any time. We are not liable for any loss of virtual items, currency, or data resulting from server issues, bugs, exploits by other users, or circumstances outside our control.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-bold text-violet-400">9. Changes to These Terms</h2>
        <p className="mt-3 text-sm leading-relaxed text-neutral-300">
          We may update these terms at any time. Continued use of DonutTrade after changes are posted constitutes acceptance of the updated terms.
        </p>
      </section>

      <div className="mt-10 rounded-xl border border-neutral-800 bg-white/[0.02] px-5 py-4 text-sm text-neutral-400">
        Questions? Reach out on our <a href={process.env.NEXT_PUBLIC_DISCORD_INVITE_URL || '#'} target="_blank" rel="noopener noreferrer" className="text-violet-400 hover:underline">Discord server</a>.
      </div>
    </div>
  );
}
