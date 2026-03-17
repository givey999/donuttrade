'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { RequireAuth } from '@/lib/require-auth';
import { apiFetch } from '@/lib/api';
import { FillOrderModal } from '@/components/marketplace/fill-order-modal';
import type { OrderRecord, PaginationMeta, CatalogItemRecord } from '@donuttrade/shared';

const TYPE_BADGE: Record<string, string> = {
  buy: 'border-blue-900/50 bg-blue-950/20 text-blue-400',
  sell: 'border-amber-900/50 bg-amber-950/20 text-amber-400',
};

function timeRemaining(expiresAt: string): string {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return 'Expired';
  const hours = Math.floor(diff / 3_600_000);
  const mins = Math.floor((diff % 3_600_000) / 60_000);
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

function MarketplaceContent() {
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [catalogItems, setCatalogItems] = useState<CatalogItemRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [fillOrder, setFillOrder] = useState<OrderRecord | null>(null);

  // Filters
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [itemFilter, setItemFilter] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('newest');

  // Load catalog items
  useEffect(() => {
    apiFetch<{ items: CatalogItemRecord[] }>('/catalog/items')
      .then((data) => setCatalogItems(data.items))
      .catch(() => {});
  }, []);

  // Load orders
  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const params = new URLSearchParams();
    params.set('page', page.toString());
    params.set('perPage', '12');
    if (typeFilter) params.set('type', typeFilter);
    if (itemFilter) params.set('catalogItemId', itemFilter);
    if (sortBy) params.set('sort', sortBy);

    apiFetch<{ orders: OrderRecord[]; meta: PaginationMeta }>(`/marketplace?${params}`)
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
  }, [page, typeFilter, itemFilter, sortBy]);

  const handleFillSuccess = () => {
    setFillOrder(null);
    // Refresh
    setPage((p) => p);
    window.location.reload();
  };

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Marketplace</h1>
        <Link
          href="/marketplace/create"
          className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-500"
        >
          Create Order
        </Link>
      </div>

      {/* Filters */}
      <div className="mt-6 flex flex-wrap gap-3">
        <select
          value={typeFilter}
          onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
          className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-sm text-white"
        >
          <option value="">All Types</option>
          <option value="buy">Buy Orders</option>
          <option value="sell">Sell Orders</option>
        </select>

        <select
          value={itemFilter}
          onChange={(e) => { setItemFilter(e.target.value); setPage(1); }}
          className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-sm text-white"
        >
          <option value="">All Items</option>
          {catalogItems.map((item) => (
            <option key={item.id} value={item.id}>{item.displayName}</option>
          ))}
        </select>

        <select
          value={sortBy}
          onChange={(e) => { setSortBy(e.target.value); setPage(1); }}
          className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-sm text-white"
        >
          <option value="newest">Newest</option>
          <option value="price_asc">Price: Low to High</option>
          <option value="price_desc">Price: High to Low</option>
          <option value="expiring_soon">Expiring Soon</option>
        </select>
      </div>

      {/* Orders grid */}
      {loading ? (
        <p className="mt-8 text-center text-sm text-neutral-500">Loading orders...</p>
      ) : orders.length === 0 ? (
        <p className="mt-8 text-center text-sm text-neutral-500">No active orders found.</p>
      ) : (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {orders.map((order) => (
              <div
                key={order.id}
                className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-4 shadow-lg"
              >
                <div className="flex items-center justify-between">
                  <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium uppercase ${TYPE_BADGE[order.type]}`}>
                    {order.type}
                  </span>
                  <span className="text-xs text-neutral-500">{timeRemaining(order.expiresAt)}</span>
                </div>

                <h3 className="mt-3 font-semibold">{order.catalogItemDisplayName}</h3>

                <div className="mt-2 space-y-1 text-sm text-neutral-400">
                  <div className="flex justify-between">
                    <span>Price</span>
                    <span className="text-white">${Number(order.pricePerUnit).toLocaleString()}/ea</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Quantity</span>
                    <span className="text-white">{order.filledQuantity}/{order.quantity}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total</span>
                    <span className="text-white">${(order.remainingQuantity * Number(order.pricePerUnit)).toLocaleString()}</span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="mt-3 h-1.5 rounded-full bg-neutral-800">
                  <div
                    className="h-1.5 rounded-full bg-green-500 transition-all"
                    style={{ width: `${(order.filledQuantity / order.quantity) * 100}%` }}
                  />
                </div>

                <div className="mt-3 flex items-center justify-between">
                  <span className="text-xs text-neutral-500">by {order.username}</span>
                  <button
                    onClick={() => setFillOrder(order)}
                    className="rounded-lg bg-green-600/20 border border-green-800/50 px-3 py-1 text-xs font-medium text-green-400 transition-colors hover:bg-green-600/30"
                  >
                    Fill
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {meta && meta.totalPages > 1 && (
            <div className="mt-6 flex items-center justify-between text-xs text-neutral-500">
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

      {/* Fill modal */}
      {fillOrder && (
        <FillOrderModal
          order={fillOrder}
          onClose={() => setFillOrder(null)}
          onSuccess={handleFillSuccess}
        />
      )}
    </main>
  );
}

export default function MarketplacePage() {
  return (
    <RequireAuth>
      <MarketplaceContent />
    </RequireAuth>
  );
}
