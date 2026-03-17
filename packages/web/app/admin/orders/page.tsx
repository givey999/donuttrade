'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth';
import { apiFetch } from '@/lib/api';
import type { PaginationMeta } from '@donuttrade/shared';

interface AdminOrder {
  id: string;
  userId: string;
  username: string;
  type: string;
  catalogItemId: string;
  catalogItemDisplayName: string;
  category: string;
  quantity: number;
  filledQuantity: number;
  remainingQuantity: number;
  pricePerUnit: string;
  escrowAmount: string;
  isPremium: boolean;
  status: string;
  expiresAt: string;
  createdAt: string;
  completedAt: string | null;
}

const STATUS_TABS = ['active', 'completed', 'cancelled', 'expired', 'all'];

export default function AdminOrdersPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [status, setStatus] = useState('active');
  const [typeFilter, setTypeFilter] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const canCancel = user?.role === 'admin' || user?.role === 'manager';

  const fetchOrders = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('perPage', '20');
    if (status !== 'all') params.set('status', status);
    if (typeFilter) params.set('type', typeFilter);

    apiFetch<{ orders: AdminOrder[]; meta: PaginationMeta }>(`/admin/orders?${params}`)
      .then((data) => { setOrders(data.orders); setMeta(data.meta); })
      .catch(() => { setOrders([]); setMeta(null); })
      .finally(() => setLoading(false));
  }, [status, typeFilter, page]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const handleCancel = async (id: string) => {
    if (!confirm('Cancel this order? This will refund the unfilled portion.')) return;
    setActionLoading(id);
    try {
      await apiFetch(`/admin/orders/${id}`, { method: 'DELETE' });
      fetchOrders();
    } catch { /* error handled by apiFetch */ }
    setActionLoading(null);
  };

  return (
    <div className="max-w-5xl">
      <h1 className="text-xl font-bold">Orders</h1>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <div className="flex gap-1">
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
        <select
          value={typeFilter}
          onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
          className="rounded-lg border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-sm text-neutral-300"
        >
          <option value="">All types</option>
          <option value="buy">Buy</option>
          <option value="sell">Sell</option>
        </select>
      </div>

      {loading ? (
        <p className="mt-4 text-sm text-neutral-400">Loading...</p>
      ) : orders.length === 0 ? (
        <p className="mt-4 text-sm text-neutral-500">No orders found.</p>
      ) : (
        <>
          <div className="mt-3 overflow-x-auto rounded-lg border border-neutral-800">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-neutral-800 bg-neutral-950/50 text-xs text-neutral-400">
                <tr>
                  <th className="px-3 py-2">User</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Item</th>
                  <th className="px-3 py-2 text-right">Qty</th>
                  <th className="px-3 py-2 text-right">Filled</th>
                  <th className="px-3 py-2 text-right">Price/unit</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Expires</th>
                  {canCancel && <th className="px-3 py-2">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/50">
                {orders.map((o) => (
                  <tr key={o.id} className="text-neutral-300">
                    <td className="px-3 py-2 text-xs">{o.username}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${
                        o.type === 'buy'
                          ? 'border-green-900/50 bg-green-950/20 text-green-400'
                          : 'border-blue-900/50 bg-blue-950/20 text-blue-400'
                      }`}>
                        {o.type}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs">{o.catalogItemDisplayName}</td>
                    <td className="px-3 py-2 text-right text-xs">{o.quantity}</td>
                    <td className="px-3 py-2 text-right text-xs">{o.filledQuantity}/{o.quantity}</td>
                    <td className="px-3 py-2 text-right text-xs">${Number(o.pricePerUnit).toLocaleString()}</td>
                    <td className="px-3 py-2">
                      <StatusBadge status={o.status} />
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-xs text-neutral-500">
                      {new Date(o.expiresAt).toLocaleDateString()}
                    </td>
                    {canCancel && (
                      <td className="px-3 py-2">
                        {o.status === 'active' ? (
                          <button
                            onClick={() => handleCancel(o.id)}
                            disabled={actionLoading === o.id}
                            className="rounded bg-red-600/20 px-2 py-0.5 text-xs text-red-400 hover:bg-red-600/30 disabled:opacity-50"
                          >
                            Cancel
                          </button>
                        ) : (
                          <span className="text-xs text-neutral-500">—</span>
                        )}
                      </td>
                    )}
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
    active: 'border-green-900/50 bg-green-950/20 text-green-400',
    completed: 'border-blue-900/50 bg-blue-950/20 text-blue-400',
    cancelled: 'border-red-900/50 bg-red-950/20 text-red-400',
    expired: 'border-neutral-700 bg-neutral-800/50 text-neutral-400',
  };
  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${colors[status] ?? 'border-neutral-700 text-neutral-400'}`}>
      {status}
    </span>
  );
}
