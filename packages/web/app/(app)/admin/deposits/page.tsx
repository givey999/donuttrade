'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '@/lib/api';
import { PageHeader } from '@/components/ui/page-header';
import { Tabs } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, Thead, Tbody, Th, Td } from '@/components/ui/table';
import { Pagination } from '@/components/ui/pagination';
import { FadeIn } from '@/components/ui/animate';
import type { PaginationMeta } from '@donuttrade/shared';

interface AdminDeposit {
  id: string;
  userId: string;
  username: string;
  catalogItemDisplayName: string;
  quantity: number;
  status: string;
  adminNotes: string | null;
  createdAt: string;
  completedAt: string | null;
}

const STATUS_TABS = [
  { label: 'Pending', value: 'pending' },
  { label: 'Confirmed', value: 'confirmed' },
  { label: 'Rejected', value: 'rejected' },
  { label: 'All', value: 'all' },
];

const STATUS_VARIANT: Record<string, string> = {
  pending: 'warning',
  confirmed: 'success',
  rejected: 'danger',
};

export default function AdminDepositsPage() {
  const [deposits, setDeposits] = useState<AdminDeposit[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [status, setStatus] = useState('pending');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchDeposits = useCallback(() => {
    setLoading(true);
    const statusParam = status !== 'all' ? `&status=${status}` : '';
    apiFetch<{ deposits: AdminDeposit[]; meta: PaginationMeta }>(`/admin/item-deposits?page=${page}&perPage=20${statusParam}`)
      .then((data) => { setDeposits(data.deposits); setMeta(data.meta); })
      .catch(() => { setDeposits([]); setMeta(null); })
      .finally(() => setLoading(false));
  }, [status, page]);

  useEffect(() => { fetchDeposits(); }, [fetchDeposits]);

  const handleConfirm = async (id: string) => {
    if (!confirm('Confirm this deposit?')) return;
    setActionLoading(id);
    try {
      await apiFetch(`/admin/item-deposits/${id}/confirm`, { method: 'PATCH' });
      fetchDeposits();
    } catch { /* error handled by apiFetch */ }
    setActionLoading(null);
  };

  const handleReject = async (id: string) => {
    const notes = prompt('Rejection reason (optional):');
    if (notes === null) return;
    setActionLoading(id);
    try {
      await apiFetch(`/admin/item-deposits/${id}/reject`, {
        method: 'PATCH',
        body: JSON.stringify({ notes }),
      });
      fetchDeposits();
    } catch { /* error handled by apiFetch */ }
    setActionLoading(null);
  };

  return (
    <div className="max-w-4xl">
      <FadeIn>
        <PageHeader title="Item Deposits" />
      </FadeIn>

      {/* Status tabs */}
      <FadeIn delay={100}>
        <div className="mt-4">
          <Tabs
            tabs={STATUS_TABS}
            value={status}
            onChange={(v) => { setStatus(v); setPage(1); }}
          />
        </div>
      </FadeIn>

      {loading ? (
        <p className="mt-4 text-sm text-neutral-400">Loading...</p>
      ) : deposits.length === 0 ? (
        <p className="mt-4 text-sm text-neutral-500">No deposits found.</p>
      ) : (
        <FadeIn delay={150}>
          <div className="mt-3">
            <Table>
              <Thead>
                <tr>
                  <Th>User</Th>
                  <Th>Item</Th>
                  <Th className="text-right">Qty</Th>
                  <Th>Status</Th>
                  <Th>Date</Th>
                  {status === 'pending' && <Th>Actions</Th>}
                </tr>
              </Thead>
              <Tbody>
                {deposits.map((d) => (
                  <tr key={d.id}>
                    <Td className="text-xs">{d.username}</Td>
                    <Td className="text-xs">{d.catalogItemDisplayName}</Td>
                    <Td className="text-right text-xs">{d.quantity}</Td>
                    <Td>
                      <Badge variant={STATUS_VARIANT[d.status] as 'warning'}>
                        {d.status}
                      </Badge>
                    </Td>
                    <Td className="whitespace-nowrap text-xs text-neutral-500">
                      {new Date(d.createdAt).toLocaleDateString()}
                    </Td>
                    {status === 'pending' && (
                      <Td>
                        <div className="flex gap-1">
                          <Button
                            variant="success"
                            size="sm"
                            onClick={() => handleConfirm(d.id)}
                            disabled={actionLoading === d.id}
                          >
                            Confirm
                          </Button>
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => handleReject(d.id)}
                            disabled={actionLoading === d.id}
                          >
                            Reject
                          </Button>
                        </div>
                      </Td>
                    )}
                  </tr>
                ))}
              </Tbody>
            </Table>
          </div>

          {meta && <Pagination page={meta.page} totalPages={meta.totalPages} onPageChange={setPage} />}
        </FadeIn>
      )}
    </div>
  );
}
