'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '@/lib/api';
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

const STATUS_TABS = ['pending', 'confirmed', 'rejected', 'all'];

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
    if (notes === null) return; // cancelled
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
      <h1 className="text-xl font-bold">Item Deposits</h1>

      {/* Status tabs */}
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
      ) : deposits.length === 0 ? (
        <p className="mt-4 text-sm text-neutral-500">No deposits found.</p>
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
                  {status === 'pending' && <th className="px-3 py-2">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/50">
                {deposits.map((d) => (
                  <tr key={d.id} className="text-neutral-300">
                    <td className="px-3 py-2 text-xs">{d.username}</td>
                    <td className="px-3 py-2 text-xs">{d.catalogItemDisplayName}</td>
                    <td className="px-3 py-2 text-right text-xs">{d.quantity}</td>
                    <td className="px-3 py-2">
                      <StatusBadge status={d.status} />
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-xs text-neutral-500">
                      {new Date(d.createdAt).toLocaleDateString()}
                    </td>
                    {status === 'pending' && (
                      <td className="px-3 py-2">
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleConfirm(d.id)}
                            disabled={actionLoading === d.id}
                            className="rounded bg-green-600/20 px-2 py-0.5 text-xs text-green-400 hover:bg-green-600/30 disabled:opacity-50"
                          >
                            Confirm
                          </button>
                          <button
                            onClick={() => handleReject(d.id)}
                            disabled={actionLoading === d.id}
                            className="rounded bg-red-600/20 px-2 py-0.5 text-xs text-red-400 hover:bg-red-600/30 disabled:opacity-50"
                          >
                            Reject
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {meta && meta.totalPages > 1 && (
            <div className="mt-3 flex items-center justify-between text-xs text-neutral-500">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="rounded border border-neutral-700 px-2.5 py-1 hover:bg-neutral-800 disabled:opacity-40"
              >
                Previous
              </button>
              <span>Page {meta.page} of {meta.totalPages}</span>
              <button
                onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
                disabled={page >= meta.totalPages}
                className="rounded border border-neutral-700 px-2.5 py-1 hover:bg-neutral-800 disabled:opacity-40"
              >
                Next
              </button>
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
    confirmed: 'border-green-900/50 bg-green-950/20 text-green-400',
    rejected: 'border-red-900/50 bg-red-950/20 text-red-400',
  };
  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${colors[status] ?? 'border-neutral-700 text-neutral-400'}`}>
      {status}
    </span>
  );
}
