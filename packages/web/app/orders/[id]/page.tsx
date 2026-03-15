'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { RequireAuth } from '@/lib/require-auth';
import { useAuth } from '@/lib/auth';
import { apiFetch, ApiError } from '@/lib/api';
import type { OrderDetailRecord } from '@donuttrade/shared';

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

function OrderDetailContent() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const [order, setOrder] = useState<OrderDetailRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);

  const id = params.id as string;

  useEffect(() => {
    apiFetch<OrderDetailRecord>(`/marketplace/${id}`)
      .then(setOrder)
      .catch(() => setOrder(null))
      .finally(() => setLoading(false));
  }, [id]);

  const handleCancel = async () => {
    setCancelling(true);
    try {
      await apiFetch(`/orders/${id}`, { method: 'DELETE' });
      setOrder((prev) => prev ? { ...prev, status: 'cancelled' } : null);
    } catch {
      // Silently fail
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8">
        <p className="text-sm text-neutral-500">Loading order...</p>
      </main>
    );
  }

  if (!order) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8">
        <p className="text-sm text-red-400">Order not found.</p>
      </main>
    );
  }

  const isOwner = user?.id === order.userId;
  const fillPercent = order.quantity > 0 ? (order.filledQuantity / order.quantity) * 100 : 0;

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <button onClick={() => router.back()} className="text-sm text-neutral-400 hover:text-white">
        &larr; Back
      </button>

      <div className="mt-4 rounded-xl border border-neutral-800 bg-neutral-900/50 p-6 shadow-lg">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">{order.catalogItemDisplayName}</h1>
          <div className="flex gap-2">
            <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium uppercase ${TYPE_BADGE[order.type]}`}>
              {order.type}
            </span>
            <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_BADGE[order.status] ?? ''}`}>
              {order.status}
            </span>
          </div>
        </div>

        {/* Details */}
        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-neutral-400">By</span>
            <p className="font-medium">{order.username}</p>
          </div>
          <div>
            <span className="text-neutral-400">Price per unit</span>
            <p className="font-medium">${Number(order.pricePerUnit).toLocaleString()}</p>
          </div>
          <div>
            <span className="text-neutral-400">Quantity</span>
            <p className="font-medium">{order.filledQuantity} / {order.quantity}</p>
          </div>
          <div>
            <span className="text-neutral-400">Total value</span>
            <p className="font-medium">${(order.quantity * Number(order.pricePerUnit)).toLocaleString()}</p>
          </div>
          <div>
            <span className="text-neutral-400">Created</span>
            <p className="font-medium">{new Date(order.createdAt).toLocaleString()}</p>
          </div>
          <div>
            <span className="text-neutral-400">Expires</span>
            <p className="font-medium">{new Date(order.expiresAt).toLocaleString()}</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-5">
          <div className="flex items-center justify-between text-xs text-neutral-400">
            <span>Fill Progress</span>
            <span>{fillPercent.toFixed(0)}%</span>
          </div>
          <div className="mt-1 h-2 rounded-full bg-neutral-800">
            <div
              className="h-2 rounded-full bg-green-500 transition-all"
              style={{ width: `${fillPercent}%` }}
            />
          </div>
        </div>

        {/* Cancel button */}
        {isOwner && order.status === 'active' && (
          <button
            onClick={handleCancel}
            disabled={cancelling}
            className="mt-5 w-full rounded-lg border border-red-900/50 bg-red-950/20 px-4 py-2 text-sm text-red-400 transition-colors hover:bg-red-950/40 disabled:opacity-50"
          >
            {cancelling ? 'Cancelling...' : 'Cancel Order'}
          </button>
        )}
      </div>

      {/* Fill history */}
      {order.fills.length > 0 && (
        <div className="mt-6">
          <h2 className="text-lg font-semibold">Fill History</h2>
          <div className="mt-3 overflow-x-auto rounded-lg border border-neutral-800">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-neutral-800 bg-neutral-950/50 text-xs text-neutral-400">
                <tr>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Filled by</th>
                  <th className="px-3 py-2">Qty</th>
                  <th className="px-3 py-2 text-right">Total</th>
                  <th className="px-3 py-2 text-right">Commission</th>
                  <th className="px-3 py-2 text-right">Net</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/50">
                {order.fills.map((fill) => (
                  <tr key={fill.id} className="text-neutral-300">
                    <td className="whitespace-nowrap px-3 py-2 text-xs text-neutral-500">
                      {new Date(fill.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-3 py-2">{fill.filledByUsername}</td>
                    <td className="px-3 py-2">{fill.quantity}</td>
                    <td className="px-3 py-2 text-right">${Number(fill.totalPrice).toLocaleString()}</td>
                    <td className="px-3 py-2 text-right text-neutral-500">${Number(fill.commissionAmount).toLocaleString()}</td>
                    <td className="px-3 py-2 text-right text-green-400">${Number(fill.netAmount).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </main>
  );
}

export default function OrderDetailPage() {
  return (
    <RequireAuth>
      <OrderDetailContent />
    </RequireAuth>
  );
}
