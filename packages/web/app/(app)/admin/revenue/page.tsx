'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { apiFetch } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { Table, Thead, Tbody, Th, Td } from '@/components/ui/table';
import { FadeIn } from '@/components/ui/animate';

interface RevenueData {
  totalCommission: string;
  weekCommission: string;
  monthCommission: string;
  byItem: Array<{
    catalogItemId: string;
    displayName: string;
    totalCommission: string;
    fillCount: number;
  }>;
}

function formatCurrency(value: string | number): string {
  const num = Number(value);
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-4">
      <p className="text-[10px] uppercase tracking-wider text-neutral-600">{label}</p>
      <p className="mt-1 text-2xl font-extrabold text-green-400">${value}</p>
    </Card>
  );
}

export default function AdminRevenuePage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<RevenueData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && user?.role !== 'admin' && user?.role !== 'leader') {
      router.push('/admin');
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    apiFetch<RevenueData>('/admin/revenue')
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (authLoading || loading) {
    return <p className="text-sm text-neutral-400">Loading revenue data...</p>;
  }

  if (user?.role !== 'admin' && user?.role !== 'leader') {
    return <p className="text-sm text-neutral-400">Redirecting...</p>;
  }

  if (!data) {
    return <p className="text-sm text-red-400">Failed to load revenue data.</p>;
  }

  return (
    <div className="max-w-4xl">
      <FadeIn>
        <PageHeader title="Revenue" subtitle="Commission earnings overview" />
      </FadeIn>

      <FadeIn delay={100}>
        <div className="mt-4 grid grid-cols-3 gap-3">
          <StatCard label="Total Commission" value={formatCurrency(data.totalCommission)} />
          <StatCard label="This Week" value={formatCurrency(data.weekCommission)} />
          <StatCard label="This Month" value={formatCurrency(data.monthCommission)} />
        </div>
      </FadeIn>

      {data.byItem.length > 0 && (
        <FadeIn delay={200}>
          <div className="mt-6">
            <h2 className="text-sm font-medium text-neutral-400">Top Items by Commission</h2>
            <div className="mt-2">
              <Table>
                <Thead>
                  <tr>
                    <Th>Item</Th>
                    <Th className="text-right">Commission</Th>
                    <Th className="text-right">Fills</Th>
                  </tr>
                </Thead>
                <Tbody>
                  {data.byItem.map((item) => (
                    <tr key={item.catalogItemId}>
                      <Td className="font-medium">{item.displayName}</Td>
                      <Td className="text-right text-green-400">
                        ${formatCurrency(item.totalCommission)}
                      </Td>
                      <Td className="text-right">{item.fillCount.toLocaleString()}</Td>
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
