'use client';

import { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { Table, Thead, Tbody, Th, Td } from '@/components/ui/table';
import { FadeIn } from '@/components/ui/animate';

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
    <Card className="p-4">
      <p className="text-[10px] uppercase tracking-wider text-neutral-600">{label}</p>
      <p className={`mt-1 text-2xl font-extrabold ${color}`}>{value.toLocaleString()}</p>
    </Card>
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
      <FadeIn>
        <PageHeader title="Admin Dashboard" />
      </FadeIn>

      <FadeIn delay={100}>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Total Users" value={stats.totalUsers} color="text-white" />
          <StatCard label="Pending Deposits" value={stats.pendingDeposits} color="text-amber-400" />
          <StatCard label="Pending Withdrawals" value={stats.pendingWithdrawals} color="text-amber-400" />
          <StatCard label="Active Orders" value={stats.activeOrders} color="text-green-400" />
        </div>
      </FadeIn>

      {stats.volumeByItem.length > 0 && (
        <FadeIn delay={200}>
          <div className="mt-6">
            <h2 className="text-sm font-medium text-neutral-400">Trading Volume by Item</h2>
            <div className="mt-2">
              <Table>
                <Thead>
                  <tr>
                    <Th>Item</Th>
                    <Th className="text-right">Units Traded</Th>
                    <Th className="text-right">Total Volume</Th>
                  </tr>
                </Thead>
                <Tbody>
                  {stats.volumeByItem.map((item) => (
                    <tr key={item.id}>
                      <Td className="font-medium">{item.displayName}</Td>
                      <Td className="text-right">{item.totalTraded.toLocaleString()}</Td>
                      <Td className="text-right text-green-400">
                        ${Number(item.totalVolume).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </Td>
                    </tr>
                  ))}
                </Tbody>
              </Table>
            </div>
          </div>
        </FadeIn>
      )}
    </div>
  );
}
