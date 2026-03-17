'use client';

import { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api';

interface StatsData {
  totalUsers: number;
  pendingDeposits: number;
  pendingWithdrawals: number;
  activeOrders: number;
  volumeByItem: Array<{
    id: string;
    displayName: string;
    totalTraded: number;
    totalVolume: string;
  }>;
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-4">
      <p className="text-xs text-neutral-400">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${color}`}>{value.toLocaleString()}</p>
    </div>
  );
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<StatsData>('/admin/stats')
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-sm text-neutral-400">Loading dashboard...</p>;
  if (!stats) return <p className="text-sm text-red-400">Failed to load stats.</p>;

  return (
    <div className="max-w-4xl">
      <h1 className="text-xl font-bold">Admin Dashboard</h1>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Total Users" value={stats.totalUsers} color="text-white" />
        <StatCard label="Pending Deposits" value={stats.pendingDeposits} color="text-amber-400" />
        <StatCard label="Pending Withdrawals" value={stats.pendingWithdrawals} color="text-amber-400" />
        <StatCard label="Active Orders" value={stats.activeOrders} color="text-green-400" />
      </div>

      {stats.volumeByItem.length > 0 && (
        <div className="mt-6">
          <h2 className="text-sm font-medium text-neutral-400">Trading Volume by Item</h2>
          <div className="mt-2 overflow-x-auto rounded-lg border border-neutral-800">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-neutral-800 bg-neutral-950/50 text-xs text-neutral-400">
                <tr>
                  <th className="px-3 py-2">Item</th>
                  <th className="px-3 py-2 text-right">Units Traded</th>
                  <th className="px-3 py-2 text-right">Total Volume</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/50">
                {stats.volumeByItem.map((item) => (
                  <tr key={item.id} className="text-neutral-300">
                    <td className="px-3 py-2 font-medium">{item.displayName}</td>
                    <td className="px-3 py-2 text-right">{item.totalTraded.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right text-green-400">
                      ${Number(item.totalVolume).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
