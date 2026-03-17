'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '@/lib/api';
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

const STATUS_TABS = ['pending', 'processing', 'completed', 'failed', 'all'];

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
      <h1 className="text-xl font-bold">Item Withdrawals</h1>

      <div className="mt-4 flex gap-1">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => { setStatus(tab); setPage(1); }}
            className={`rounded-lg px-3 py-1.5 text-sm capitalize transition-colors ${
              status === tab ? 'bg-neutral-800 text-white' : 'text-neutral-400 hover:bg-neutral-800/50'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="mt-4 text-sm text-neutral-400">Loading...</p>
      ) : withdrawals.length === 0 ? (
        <p className="mt-4 text-sm text-neutral-500">No withdrawals found.</p>
      ) : (
        <>
          <div className="mt-3 overflow-x-auto rounded-lg border border-neutral-800">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-neutral-800 bg-neutral-950/50 text-xs text-neutral-400">
                <tr>
                  <th className="px-3 py-2">User</th>
                  <th className="px-3 py-2">Item</th>
                  <th className="px-3 py-2 text-right">Qty</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/50">
                {withdrawals.map((w) => (
                  <tr key={w.id} className="text-neutral-300">
                    <td className="px-3 py-2 text-xs">{w.username}</td>
                    <td className="px-3 py-2 text-xs">{w.catalogItemDisplayName}</td>
                    <td className="px-3 py-2 text-right text-xs">{w.quantity}</td>
                    <td className="px-3 py-2">
                      <StatusBadge status={w.status} />
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-xs text-neutral-500">
                      {new Date(w.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex gap-1">
                        {w.status === 'pending' && (
                          <button
                            onClick={() => handleAction(w.id, 'claim')}
                            disabled={actionLoading === w.id}
                            className="rounded bg-blue-600/20 px-2 py-0.5 text-xs text-blue-400 hover:bg-blue-600/30 disabled:opacity-50"
                          >
                            Claim
                          </button>
                        )}
                        {(w.status === 'pending' || w.status === 'processing') && (
                          <>
                            <button
                              onClick={() => handleAction(w.id, 'confirm')}
                              disabled={actionLoading === w.id}
                              className="rounded bg-green-600/20 px-2 py-0.5 text-xs text-green-400 hover:bg-green-600/30 disabled:opacity-50"
                            >
                              Confirm
                            </button>
                            <button
                              onClick={() => handleAction(w.id, 'fail')}
                              disabled={actionLoading === w.id}
                              className="rounded bg-red-600/20 px-2 py-0.5 text-xs text-red-400 hover:bg-red-600/30 disabled:opacity-50"
                            >
                              Fail
                            </button>
                          </>
                        )}
                        {(w.status === 'completed' || w.status === 'failed') && (
                          <span className="text-xs text-neutral-500">—</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {meta && meta.totalPages > 1 && (
            <div className="mt-3 flex items-center justify-between text-xs text-neutral-500">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="rounded border border-neutral-700 px-2.5 py-1 hover:bg-neutral-800 disabled:opacity-40">Previous</button>
              <span>Page {meta.page} of {meta.totalPages}</span>
              <button onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))} disabled={page >= meta.totalPages} className="rounded border border-neutral-700 px-2.5 py-1 hover:bg-neutral-800 disabled:opacity-40">Next</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pending: 'border-amber-900/50 bg-amber-950/20 text-amber-400',
    processing: 'border-blue-900/50 bg-blue-950/20 text-blue-400',
    completed: 'border-green-900/50 bg-green-950/20 text-green-400',
    failed: 'border-red-900/50 bg-red-950/20 text-red-400',
    cancelled: 'border-neutral-700 bg-neutral-800/50 text-neutral-400',
  };
  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${colors[status] ?? 'border-neutral-700 text-neutral-400'}`}>
      {status}
    </span>
  );
}
