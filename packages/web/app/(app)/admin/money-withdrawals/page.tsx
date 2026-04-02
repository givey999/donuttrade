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
import { ConfirmModal } from '@/components/ui/confirm-modal';
import type { PaginationMeta } from '@donuttrade/shared';

interface AdminMoneyWithdrawal {
  id: string;
  userId: string;
  username: string;
  amount: string;
  status: string;
  failReason: string | null;
  createdAt: string;
  completedAt: string | null;
}

const STATUS_TABS = [
  { label: 'Pending', value: 'pending' },
  { label: 'Processing', value: 'processing' },
  { label: 'Completed', value: 'completed' },
  { label: 'Denied', value: 'denied' },
  { label: 'Failed', value: 'failed' },
  { label: 'All', value: 'all' },
];

const STATUS_VARIANT: Record<string, string> = {
  pending: 'warning',
  approved: 'info',
  processing: 'info',
  completed: 'success',
  denied: 'danger',
  failed: 'danger',
};

function formatAmount(amount: string): string {
  return `$${Number(amount).toLocaleString()}`;
}

export default function AdminMoneyWithdrawalsPage() {
  const [withdrawals, setWithdrawals] = useState<AdminMoneyWithdrawal[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [status, setStatus] = useState('pending');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchWithdrawals = useCallback(() => {
    setLoading(true);
    const statusParam = status !== 'all' ? `&status=${status}` : '';
    apiFetch<{ withdrawals: AdminMoneyWithdrawal[]; meta: PaginationMeta }>(`/admin/withdrawals?page=${page}&perPage=20${statusParam}`)
      .then((data) => { setWithdrawals(data.withdrawals); setMeta(data.meta); })
      .catch(() => { setWithdrawals([]); setMeta(null); })
      .finally(() => setLoading(false));
  }, [status, page]);

  useEffect(() => { fetchWithdrawals(); }, [fetchWithdrawals]);

  const [confirmModal, setConfirmModal] = useState<{
    id: string;
    action: 'approve' | 'deny';
    username?: string;
    amount?: string;
  } | null>(null);

  const handleAction = (w: AdminMoneyWithdrawal, action: 'approve' | 'deny') => {
    setConfirmModal({ id: w.id, action, username: w.username, amount: w.amount });
  };

  const doAction = async (id: string, action: string, reason?: string) => {
    setConfirmModal(null);
    setActionLoading(id);
    try {
      const body = reason ? JSON.stringify({ reason }) : '{}';
      await apiFetch(`/admin/withdrawals/${id}/${action}`, { method: 'PATCH', body });
      fetchWithdrawals();
    } catch { /* error handled by apiFetch */ }
    setActionLoading(null);
  };

  return (
    <div className="max-w-4xl">
      <FadeIn>
        <PageHeader title="Money Withdrawals" />
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
                  <Th className="text-right">Amount</Th>
                  <Th>Status</Th>
                  <Th>Date</Th>
                  <Th>Actions</Th>
                </tr>
              </Thead>
              <Tbody>
                {withdrawals.map((w) => (
                  <tr key={w.id}>
                    <Td className="text-xs">{w.username}</Td>
                    <Td className="text-right text-xs font-mono">{formatAmount(w.amount)}</Td>
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
                          <>
                            <Button
                              variant="success"
                              size="sm"
                              onClick={() => handleAction(w, 'approve')}
                              disabled={actionLoading === w.id}
                            >
                              Process
                            </Button>
                            <Button
                              variant="danger"
                              size="sm"
                              onClick={() => handleAction(w, 'deny')}
                              disabled={actionLoading === w.id}
                            >
                              Deny
                            </Button>
                          </>
                        )}
                        {w.failReason && (
                          <span className="text-xs text-neutral-500" title={w.failReason}>
                            {w.failReason.length > 30 ? w.failReason.slice(0, 30) + '...' : w.failReason}
                          </span>
                        )}
                        {(w.status === 'completed' || w.status === 'denied' || w.status === 'failed') && !w.failReason && (
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

      {confirmModal?.action === 'approve' && (
        <ConfirmModal
          title="Process Withdrawal"
          message={`Approve this withdrawal? ${formatAmount(confirmModal.amount || '0')} will be sent to ${confirmModal.username} in-game.`}
          confirmLabel="Approve & Send"
          variant="success"
          onConfirm={() => doAction(confirmModal.id, 'approve')}
          onCancel={() => setConfirmModal(null)}
        />
      )}
      {confirmModal?.action === 'deny' && (
        <ConfirmModal
          title="Deny Withdrawal"
          message="The user will be refunded and notified with the reason below."
          inputPlaceholder="Denial reason..."
          inputRequired
          confirmLabel="Deny & Refund"
          variant="danger"
          onConfirm={(reason) => doAction(confirmModal.id, 'deny', reason)}
          onCancel={() => setConfirmModal(null)}
        />
      )}
    </div>
  );
}
