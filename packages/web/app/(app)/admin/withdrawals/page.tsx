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

interface AdminWithdrawal {
  id: string;
  userId: string;
  username: string;
  catalogItemDisplayName: string;
  quantity: number;
  status: string;
  failReason: string | null;
  createdAt: string;
  completedAt: string | null;
}

const STATUS_TABS = [
  { label: 'Pending', value: 'pending' },
  { label: 'Processing', value: 'processing' },
  { label: 'Completed', value: 'completed' },
  { label: 'Failed', value: 'failed' },
  { label: 'All', value: 'all' },
];

const STATUS_VARIANT: Record<string, string> = {
  pending: 'warning',
  processing: 'info',
  completed: 'success',
  failed: 'danger',
  cancelled: 'neutral',
};

export default function AdminWithdrawalsPage() {
  const [withdrawals, setWithdrawals] = useState<AdminWithdrawal[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [status, setStatus] = useState('pending');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchWithdrawals = useCallback(() => {
    setLoading(true);
    const statusParam = status !== 'all' ? `&status=${status}` : '';
    apiFetch<{ withdrawals: AdminWithdrawal[]; meta: PaginationMeta }>(`/admin/item-withdrawals?page=${page}&perPage=20${statusParam}`)
      .then((data) => { setWithdrawals(data.withdrawals); setMeta(data.meta); })
      .catch(() => { setWithdrawals([]); setMeta(null); })
      .finally(() => setLoading(false));
  }, [status, page]);

  useEffect(() => { fetchWithdrawals(); }, [fetchWithdrawals]);

  const handleAction = async (id: string, action: 'claim' | 'confirm' | 'fail') => {
    let body = '{}';
    if (action === 'fail') {
      const reason = prompt('Failure reason:');
      if (!reason) return;
      body = JSON.stringify({ reason });
    }
    if (action === 'confirm' && !confirm('Confirm this withdrawal as completed?')) return;
    if (action === 'claim' && !confirm('Claim this withdrawal for processing?')) return;

    setActionLoading(id);
    try {
      await apiFetch(`/admin/item-withdrawals/${id}/${action}`, { method: 'PATCH', body });
      fetchWithdrawals();
    } catch { /* error handled by apiFetch */ }
    setActionLoading(null);
  };

  return (
    <div className="max-w-4xl">
      <FadeIn>
        <PageHeader title="Item Withdrawals" />
      </FadeIn>

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
      ) : withdrawals.length === 0 ? (
        <p className="mt-4 text-sm text-neutral-500">No withdrawals found.</p>
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
                  <Th>Actions</Th>
                </tr>
              </Thead>
              <Tbody>
                {withdrawals.map((w) => (
                  <tr key={w.id}>
                    <Td className="text-xs">{w.username}</Td>
                    <Td className="text-xs">{w.catalogItemDisplayName}</Td>
                    <Td className="text-right text-xs">{w.quantity}</Td>
                    <Td>
                      <Badge variant={STATUS_VARIANT[w.status] as 'warning'}>
                        {w.status}
                      </Badge>
                    </Td>
                    <Td className="whitespace-nowrap text-xs text-neutral-500">
                      {new Date(w.createdAt).toLocaleDateString()}
                    </Td>
                    <Td>
                      <div className="flex gap-1">
                        {w.status === 'pending' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleAction(w.id, 'claim')}
                            disabled={actionLoading === w.id}
                            className="text-blue-400 hover:text-blue-300"
                          >
                            Claim
                          </Button>
                        )}
                        {(w.status === 'pending' || w.status === 'processing') && (
                          <>
                            <Button
                              variant="success"
                              size="sm"
                              onClick={() => handleAction(w.id, 'confirm')}
                              disabled={actionLoading === w.id}
                            >
                              Confirm
                            </Button>
                            <Button
                              variant="danger"
                              size="sm"
                              onClick={() => handleAction(w.id, 'fail')}
                              disabled={actionLoading === w.id}
                            >
                              Fail
                            </Button>
                          </>
                        )}
                        {(w.status === 'completed' || w.status === 'failed') && (
                          <span className="text-xs text-neutral-500">&mdash;</span>
                        )}
                      </div>
                    </Td>
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
