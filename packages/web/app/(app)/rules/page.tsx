export default function RulesPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-2xl font-extrabold tracking-tight">Rules</h1>
      <p className="mt-2 text-sm text-neutral-500">
        By using DonutTrade, you agree to follow these rules. Violations may result in timeouts, bans, or permanent account removal without warning.
      </p>

      <section className="mt-10">
        <h2 className="text-lg font-bold text-violet-400">General Conduct</h2>
        <ul className="mt-4 space-y-2 text-sm text-neutral-300">
          <li className="flex gap-2"><span className="text-neutral-600">1.</span>No racism, homophobia, or any form of discrimination.</li>
          <li className="flex gap-2"><span className="text-neutral-600">2.</span>No identity theft, doxxing, or exposing personal information of others.</li>
          <li className="flex gap-2"><span className="text-neutral-600">3.</span>No NSFW or sexually explicit content of any kind.</li>
          <li className="flex gap-2"><span className="text-neutral-600">4.</span>No promoting other Discord servers or competing platforms.</li>
          <li className="flex gap-2"><span className="text-neutral-600">5.</span>No trolling, baiting, or deliberately provoking other users.</li>
          <li className="flex gap-2"><span className="text-neutral-600">6.</span>No harassment, threats, intimidation, or targeted abuse.</li>
          <li className="flex gap-2"><span className="text-neutral-600">7.</span>No submitting false evidence or fabricated reports against other users.</li>
          <li className="flex gap-2"><span className="text-neutral-600">8.</span>No spam, excessive pinging, message flooding, or disruptive behavior.</li>
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-bold text-violet-400">Trading &amp; Platform</h2>
        <ul className="mt-4 space-y-2 text-sm text-neutral-300">
          <li className="flex gap-2"><span className="text-neutral-600">1.</span>No scamming, fraudulent trades, or misrepresenting items or currency.</li>
          <li className="flex gap-2"><span className="text-neutral-600">2.</span>No duping, exploiting glitches, or using any method to generate illegitimate items or currency.</li>
          <li className="flex gap-2"><span className="text-neutral-600">3.</span>Maximum of 5 accounts per person. Excess alt accounts will be banned.</li>
          <li className="flex gap-2"><span className="text-neutral-600">4.</span>Use the ticket system only for deposits and withdrawals. Do not misuse tickets for unrelated issues.</li>
          <li className="flex gap-2"><span className="text-neutral-600">5.</span>Do not abuse the withdrawal system (e.g., rapid small withdrawals to disrupt the bot, or withdrawing duped funds).</li>
          <li className="flex gap-2"><span className="text-neutral-600">6.</span>Report bugs to staff instead of exploiting them. Exploiting a known bug is treated the same as cheating.</li>
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-bold text-violet-400">Voice Channels</h2>
        <div className="mt-4 space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-neutral-400">Open Channels</h3>
            <ul className="mt-2 space-y-2 text-sm text-neutral-300">
              <li className="flex gap-2"><span className="text-neutral-600">1.</span>Keep swearing within reason — don&apos;t direct it at other users.</li>
              <li className="flex gap-2"><span className="text-neutral-600">2.</span>No annoying voice changers or distorted audio.</li>
              <li className="flex gap-2"><span className="text-neutral-600">3.</span>No excessive soundboard usage.</li>
              <li className="flex gap-2"><span className="text-neutral-600">4.</span>No earrape, loud noises, or deliberately irritating sounds.</li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-neutral-400">Closed Channels</h3>
            <ul className="mt-2 space-y-2 text-sm text-neutral-300">
              <li className="flex gap-2"><span className="text-neutral-600">1.</span>Swearing and heated discussions are allowed.</li>
              <li className="flex gap-2"><span className="text-neutral-600">2.</span>NSFW content is still strictly banned.</li>
              <li className="flex gap-2"><span className="text-neutral-600">3.</span>Doxxing and exposing personal information is still banned.</li>
              <li className="flex gap-2"><span className="text-neutral-600">4.</span>Disrespecting staff members will not be tolerated.</li>
            </ul>
          </div>
        </div>
      </section>

      <div className="mt-10 rounded-xl border border-neutral-800 bg-white/[0.02] px-5 py-4 text-sm text-neutral-400">
        Moderators may timeout, ban, or permanently remove your account at any time depending on the severity of the violation. Repeated minor offenses will be treated as a major violation.
      </div>
    </div>
  );
}
