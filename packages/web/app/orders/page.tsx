'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { RequireAuth } from '@/lib/require-auth';
import { apiFetch, ApiError } from '@/lib/api';
import type { OrderRecord, PaginationMeta, OrderStatus } from '@donuttrade/shared';

const STATUS_TABS: { label: string; value: string }[] = [
  { label: 'All', value: '' },
  { label: 'Active', value: 'active' },
  { label: 'Completed', value: 'completed' },
  { label: 'Cancelled', value: 'cancelled' },
  { label: 'Expired', value: 'expired' },
];

const TYPE_BADGE: Record<string, string> = {
  buy: 'border-blue-900/50 bg-blue-950/20 text-blue-400',
  sell: 'border-amber-900/50 bg-amber-950/20 text-amber-400',
};

const STATUS_BADGE: Record<string, string> = {
  active: 'border-green-900/50 bg-green-950/20 text-green-400',
  completed: 'border-neutral-700 bg-neutral-800/50 text-neutral-400',
  cancelled: 'border-red-900/50 bg-red-950/20 text-red-400',
  expired: 'border-neutral-700 bg-neutral-800/50 text-neutral-500',
};

function MyOrdersContent() {
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [cancelling, setCancelling] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const params = new URLSearchParams();
    params.set('page', page.toString());
    params.set('perPage', '15');
    if (statusFilter) params.set('status', statusFilter);

    apiFetch<{ orders: OrderRecord[]; meta: PaginationMeta }>(`/orders/my?${params}`)
      .then((data) => {
        if (cancelled) return;
        setOrders(data.orders);
        setMeta(data.meta);
      })
      .catch(() => {
        if (cancelled) return;
        setOrders([]);
        setMeta(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [page, statusFilter]);

  const handleCancel = async (orderId: string) => {
    setCancelling(orderId);
    try {
      await apiFetch(`/orders/${orderId}`, { method: 'DELETE' });
      setOrders((prev) => prev.map((o) => o.id === orderId ? { ...o, status: 'cancelled' as OrderStatus } : o));
    } catch (err) {
      // Silently fail — user can retry
    } finally {
      setCancelling(null);
    }
  };

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-bold">My Orders</h1>

      {/* Status tabs */}
      <div className="mt-6 flex gap-1">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => { setStatusFilter(tab.value); setPage(1); }}
            className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
              statusFilter === tab.value
                ? 'bg-neutral-800 text-white'
                : 'text-neutral-400 hover:bg-neutral-800/50 hover:text-neutral-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="mt-8 text-sm text-neutral-500">Loading orders...</p>
      ) : orders.length === 0 ? (
        <p className="mt-8 text-sm text-neutral-500">No orders found.</p>
      ) : (
        <>
          <div className="mt-4 overflow-x-auto rounded-lg border border-neutral-800">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-neutral-800 bg-neutral-950/50 text-xs text-neutral-400">
                <tr>
                  <th className="px-3 py-2">Item</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Qty</th>
                  <th className="px-3 py-2">Price/ea</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Expires</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/50">
                {orders.map((order) => (
                  <tr key={order.id} className="text-neutral-300">
                    <td className="px-3 py-2 font-medium">{order.catalogItemDisplayName}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium uppercase ${TYPE_BADGE[order.type]}`}>
                        {order.type}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span className="text-white">{order.filledQuantity}</span>
                      <span className="text-neutral-500">/{order.quantity}</span>
                    </td>
                    <td className="px-3 py-2">${Number(order.pricePerUnit).toLocaleString()}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${STATUS_BADGE[order.status] ?? ''}`}>
                        {order.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-neutral-500">
                      {new Date(order.expiresAt).toLocaleDateString()}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/orders/${order.id}`}
                          className="text-xs text-neutral-400 hover:text-white"
                        >
                          View
                        </Link>
                        {order.status === 'active' && (
                          <button
                            onClick={() => handleCancel(order.id)}
                            disabled={cancelling === order.id}
                            className="text-xs text-red-400 hover:text-red-300 disabled:opacity-50"
                          >
                            {cancelling === order.id ? '...' : 'Cancel'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {meta && meta.totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between text-xs text-neutral-500">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="rounded border border-neutral-700 px-2.5 py-1 transition-colors hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Previous
              </button>
              <span>Page {meta.page} of {meta.totalPages}</span>
              <button
                onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
                disabled={page >= meta.totalPages}
                className="rounded border border-neutral-700 px-2.5 py-1 transition-colors hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </main>
  );
}

export default function MyOrdersPage() {
  return (
    <RequireAuth>
      <MyOrdersContent />
    </RequireAuth>
  );
}
