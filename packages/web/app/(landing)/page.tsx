'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://moldo.go.ro:9443';

interface PublicStats {
  totalTraders: number;
  itemsTraded: number;
  totalVolume: string;
  activeOrders: number;
}

function formatVolume(v: string): string {
  const n = Number(v);
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toLocaleString()}`;
}

export default function LandingPage() {
  const [stats, setStats] = useState<PublicStats | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    try {
      const token = localStorage.getItem('dt_access_token');
      if (token) setIsLoggedIn(true);
    } catch {
      // localStorage unavailable
    }

    // Fetch public stats
    fetch(`${API_URL}/public/stats`, {
      headers: { 'Content-Type': 'application/json' },
    })
      .then((r) => r.json())
      .then((json) => { if (json.data) setStats(json.data); })
      .catch(() => {});
  }, []);

  const ctaHref = isLoggedIn ? '/dashboard' : '/login';

  return (
    <>
      <style>{`
        @keyframes float-up {
          0% { transform: translateY(0) translateX(0); opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { transform: translateY(-120px) translateX(20px); opacity: 0; }
        }
        @keyframes float-up-left {
          0% { transform: translateY(0) translateX(0); opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { transform: translateY(-100px) translateX(-30px); opacity: 0; }
        }
        @keyframes float-down {
          0% { transform: translateY(0) translateX(0); opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { transform: translateY(80px) translateX(-15px); opacity: 0; }
        }
        @keyframes drift-right {
          0% { transform: translateY(0) translateX(0); opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 0.8; }
          100% { transform: translateY(-60px) translateX(50px); opacity: 0; }
        }
        @keyframes drift-left {
          0% { transform: translateY(0) translateX(0); opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 0.8; }
          100% { transform: translateY(-80px) translateX(-40px); opacity: 0; }
        }
        @keyframes pulse-glow {
          0%, 100% { opacity: 0.15; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(1.3); }
        }
        @media (prefers-reduced-motion: reduce) {
          .particle { animation: none !important; opacity: 0.2 !important; }
        }
      `}</style>

      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-neutral-800 bg-[#0a0a0f]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-[1100px] items-center justify-between px-6">
          <span className="text-lg font-extrabold tracking-tight">DonutTrade</span>
          <Link
            href={ctaHref}
            className="rounded-lg bg-violet-600 px-5 py-2 text-sm font-semibold text-[#0a0a0f] transition-colors hover:bg-violet-700"
          >
            {isLoggedIn ? 'Go to Dashboard' : 'Start Trading'}
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden px-6 pb-20 pt-24 text-center md:pt-28">
        {/* Gradient glow */}
        <div
          className="pointer-events-none absolute -top-28 left-1/2 h-[500px] w-[800px] -translate-x-1/2"
          style={{ background: 'radial-gradient(ellipse, rgba(124,58,237,0.10) 0%, rgba(124,58,237,0.03) 40%, transparent 70%)' }}
        />
        {/* Grid */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)', backgroundSize: '56px 56px' }}
        />

        {/* Particles — left */}
        <Particle cls="float-up" top="70%" left="8%" size={4} opacity={0.35} delay={0} />
        <Particle cls="float-up-left" top="60%" left="15%" size={3} opacity={0.25} delay={1.2} />
        <Particle cls="drift-right" top="40%" left="5%" size={5} opacity={0.2} delay={2.5} />
        <Particle cls="float-up" top="80%" left="22%" size={3} opacity={0.3} delay={3.8} />
        <Particle cls="pulse-glow" top="30%" left="12%" size={6} opacity={0.15} delay={0.5} />
        <Particle cls="drift-left" top="50%" left="20%" size={4} opacity={0.2} delay={4.2} />
        <Particle cls="float-down" top="15%" left="10%" size={3} opacity={0.25} delay={1.8} />

        {/* Particles — right */}
        <Particle cls="float-up" top="65%" right="10%" size={5} opacity={0.3} delay={0.8} />
        <Particle cls="float-up-left" top="75%" right="18%" size={3} opacity={0.2} delay={2.0} />
        <Particle cls="drift-left" top="35%" right="8%" size={4} opacity={0.25} delay={3.0} />
        <Particle cls="float-up" top="85%" right="25%" size={4} opacity={0.35} delay={1.5} />
        <Particle cls="pulse-glow" top="25%" right="15%" size={7} opacity={0.12} delay={2.2} />
        <Particle cls="float-down" top="10%" right="20%" size={3} opacity={0.2} delay={4.5} />
        <Particle cls="drift-right" top="55%" right="5%" size={3} opacity={0.28} delay={0.3} />

        {/* Particles — center */}
        <Particle cls="float-up" top="90%" left="45%" size={3} opacity={0.2} delay={5.0} />
        <Particle cls="float-up-left" top="85%" left="55%" size={4} opacity={0.15} delay={3.5} />
        <Particle cls="pulse-glow" top="20%" left="40%" size={5} opacity={0.1} delay={1.0} />
        <Particle cls="float-up" top="75%" left="35%" size={3} opacity={0.22} delay={2.8} />
        <Particle cls="drift-right" top="45%" left="60%" size={3} opacity={0.18} delay={4.0} />
        <Particle cls="float-down" top="5%" left="50%" size={4} opacity={0.2} delay={5.5} />

        {/* Larger pulsing orbs */}
        <Particle cls="pulse-glow" top="50%" left="3%" size={12} opacity={0.06} delay={0} blur={4} />
        <Particle cls="pulse-glow" top="30%" right="6%" size={10} opacity={0.05} delay={2} blur={3} />
        <Particle cls="pulse-glow" top="70%" left="48%" size={14} opacity={0.04} delay={3.5} blur={5} />

        {/* Content */}
        <div className="relative z-10">
          <div className="mb-5 inline-block rounded-full border border-violet-600/30 bg-violet-600/[0.06] px-4 py-1 text-[11px] font-medium text-violet-600">
            DonutSMP Trading Platform
          </div>
          <h1 className="mx-auto max-w-2xl text-4xl font-extrabold leading-[1.08] tracking-tight md:text-[52px]">
            The trusted way to{' '}
            <br className="hidden md:block" />
            trade on <span className="text-violet-600">DonutSMP</span>
          </h1>
          <p className="mx-auto mt-4 max-w-md text-base leading-relaxed text-neutral-500 md:text-[16px]">
            Secure escrow trading for Minecraft items.
            <br />
            Deposit. Trade. Withdraw. Simple.
          </p>
          <Link
            href={ctaHref}
            className="mt-7 inline-block rounded-xl bg-violet-600 px-9 py-3.5 text-[15px] font-bold text-[#0a0a0f] transition-colors hover:bg-violet-700"
          >
            {isLoggedIn ? 'Go to Dashboard' : 'Start Trading'}
          </Link>
        </div>
      </section>

      {/* Stats Strip */}
      <div className="border-y border-[#1a1a1a] bg-white/[0.01]">
        <div className="mx-auto grid max-w-[700px] grid-cols-2 gap-4 px-6 py-7 md:grid-cols-4 md:gap-16">
          <StatItem value={stats ? stats.itemsTraded.toLocaleString() : '—'} label="Items Traded" />
          <StatItem value={stats ? formatVolume(stats.totalVolume) : '—'} label="Total Volume" />
          <StatItem value={stats ? stats.activeOrders.toLocaleString() : '—'} label="Active Orders" />
          <StatItem value={stats ? stats.totalTraders.toLocaleString() : '—'} label="Traders" />
        </div>
      </div>

      {/* How it works */}
      <section className="mx-auto max-w-[1000px] px-6 py-20">
        <h2 className="text-center text-[28px] font-extrabold tracking-tight">How it works</h2>
        <p className="mb-12 mt-2 text-center text-sm text-neutral-500">Three simple steps to start trading safely</p>
        <div className="grid gap-6 md:grid-cols-3">
          <StepCard num={1} title="Deposit" desc="Send items to our bot in-game. Your inventory is tracked and secured automatically." />
          <StepCard num={2} title="Trade" desc="Buy and sell on the marketplace. Funds are held in escrow until the order fills." />
          <StepCard num={3} title="Withdraw" desc="Collect your items in-game. An admin confirms delivery and you're done." />
        </div>
      </section>

      {/* Why trust DonutTrade */}
      <section className="mx-auto max-w-[1000px] px-6 py-20">
        <h2 className="text-center text-[28px] font-extrabold tracking-tight">Why trust DonutTrade?</h2>
        <p className="mb-12 mt-2 text-center text-sm text-neutral-500">Built from the ground up for safe, transparent trading</p>
        <div className="grid gap-6 md:grid-cols-3">
          <TrustCard icon="&#128274;" title="Escrow Protection" desc="Every trade is backed by escrow. Funds and items are locked until both sides are fulfilled — no chance of scams." />
          <TrustCard icon="&#9989;" title="Verified Players" desc="All traders are verified through Microsoft authentication linked to their Minecraft account." />
          <TrustCard icon="&#128065;" title="24/7 Monitoring" desc="Our admin team reviews every deposit, withdrawal, and trade. Full audit trail on every action." />
        </div>
      </section>

      {/* Marketplace Preview */}
      <section className="mx-auto max-w-[1000px] px-6 py-20">
        <h2 className="text-center text-[28px] font-extrabold tracking-tight">The marketplace</h2>
        <p className="mb-12 mt-2 text-center text-sm text-neutral-500">A real-time order book where buyers meet sellers</p>
        <div className="overflow-hidden rounded-xl border border-[#1a1a1a] bg-[#0d0d14]">
          {/* Title bar */}
          <div className="flex items-center gap-2 border-b border-[#1a1a1a] bg-white/[0.02] px-4 py-3">
            <div className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
            <div className="h-2.5 w-2.5 rounded-full bg-[#ffbd2e]" />
            <div className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
            <span className="ml-2 text-[11px] text-neutral-600">moldo.go.ro:9443/marketplace</span>
          </div>
          {/* Table */}
          <div className="overflow-x-auto p-5">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#1a1a1a] text-[10px] uppercase tracking-wider text-neutral-600">
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Item</th>
                  <th className="px-3 py-2">Qty</th>
                  <th className="px-3 py-2">Price/unit</th>
                  <th className="px-3 py-2">Trader</th>
                  <th className="px-3 py-2">Expires</th>
                </tr>
              </thead>
              <tbody className="text-neutral-400">
                <PreviewRow type="buy" item="Zombie Spawner" qty={3} price="$45,000" trader="xDarkKnight" expires="23h 14m" />
                <PreviewRow type="sell" item="Skeleton Spawner" qty={1} price="$38,500" trader="CraftMaster99" expires="11h 42m" />
                <PreviewRow type="buy" item="Blaze Spawner" qty={2} price="$72,000" trader="IronGolem_X" expires="47h 08m" />
                <PreviewRow type="sell" item="Cave Spider Spawner" qty={5} price="$22,000" trader="NetherWalker" expires="6h 31m" />
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="px-6 pb-24 pt-20 text-center">
        <h2 className="text-[32px] font-extrabold tracking-tight">Ready to trade?</h2>
        <p className="mb-7 mt-3 text-sm text-neutral-500">Sign in with your Microsoft account and start trading in seconds.</p>
        <Link
          href={ctaHref}
          className="inline-block rounded-xl bg-violet-600 px-9 py-3.5 text-[15px] font-bold text-[#0a0a0f] transition-colors hover:bg-violet-700"
        >
          {isLoggedIn ? 'Go to Dashboard' : 'Start Trading'}
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#1a1a1a] py-6 text-center text-xs text-neutral-600">
        &copy; 2026 DonutTrade. All rights reserved.
      </footer>
    </>
  );
}

/* ── Sub-components ── */

function Particle({ cls, top, left, right, size, opacity, delay, blur }: {
  cls: string; top: string; left?: string; right?: string;
  size: number; opacity: number; delay: number; blur?: number;
}) {
  const style: React.CSSProperties = {
    position: 'absolute', top, borderRadius: '50%', pointerEvents: 'none',
    width: size, height: size,
    background: `rgba(124,58,237,${opacity})`,
    animation: `${cls} ${cls.startsWith('pulse') ? 4 : cls.includes('drift') ? 8 : 7}s ease-in-out infinite`,
    animationDelay: `${delay}s`,
    ...(left ? { left } : {}),
    ...(right ? { right } : {}),
    ...(blur ? { filter: `blur(${blur}px)` } : {}),
  };
  return <div className="particle" style={style} />;
}

function StatItem({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center">
      <div className="text-2xl font-extrabold tracking-tight md:text-[28px]">{value}</div>
      <div className="mt-1 text-[10px] uppercase tracking-[1.5px] text-neutral-600">{label}</div>
    </div>
  );
}

function StepCard({ num, title, desc }: { num: number; title: string; desc: string }) {
  return (
    <div className="rounded-xl border border-[#1a1a1a] bg-white/[0.02] p-8 text-center">
      <div className="mx-auto mb-4 inline-flex h-9 w-9 items-center justify-center rounded-lg border border-violet-600/20 bg-violet-600/10 text-sm font-bold text-violet-600">
        {num}
      </div>
      <h3 className="mb-2 text-base font-bold">{title}</h3>
      <p className="text-[13px] leading-relaxed text-neutral-500">{desc}</p>
    </div>
  );
}

function TrustCard({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div className="rounded-xl border border-[#1a1a1a] bg-white/[0.02] p-8">
      <div
        className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg border border-violet-600/20 bg-violet-600/10 text-lg"
        dangerouslySetInnerHTML={{ __html: icon }}
      />
      <h3 className="mb-2 text-base font-bold">{title}</h3>
      <p className="text-[13px] leading-relaxed text-neutral-500">{desc}</p>
    </div>
  );
}

function PreviewRow({ type, item, qty, price, trader, expires }: {
  type: 'buy' | 'sell'; item: string; qty: number; price: string; trader: string; expires: string;
}) {
  return (
    <tr className="border-b border-[#111118]">
      <td className="px-3 py-2.5">
        <span className={`inline-block rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase ${
          type === 'buy'
            ? 'border-emerald-500/30 bg-emerald-500/[0.08] text-emerald-400'
            : 'border-violet-600/30 bg-violet-600/[0.08] text-violet-600'
        }`}>
          {type}
        </span>
      </td>
      <td className="px-3 py-2.5 text-neutral-200">{item}</td>
      <td className="px-3 py-2.5">{qty}</td>
      <td className="px-3 py-2.5 text-neutral-200">{price}</td>
      <td className="px-3 py-2.5">{trader}</td>
      <td className="px-3 py-2.5">{expires}</td>
    </tr>
  );
}
