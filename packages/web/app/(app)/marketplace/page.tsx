'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { RequireAuth } from '@/lib/require-auth';
import { apiFetch } from '@/lib/api';
import { FillOrderModal } from '@/components/marketplace/fill-order-modal';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/input';
import { Pagination } from '@/components/ui/pagination';
import { FadeIn } from '@/components/ui/animate';
import { useAuth } from '@/lib/auth';
import { COSMETIC_COLORS, COSMETIC_FONTS } from '@donuttrade/shared';
import type { OrderRecord, PaginationMeta, CatalogItemRecord } from '@donuttrade/shared';

function timeRemaining(expiresAt: string): string {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return 'Expired';
  const hours = Math.floor(diff / 3_600_000);
  const mins = Math.floor((diff % 3_600_000) / 60_000);
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

function MarketplaceContent() {
  const { isTimedOut } = useAuth();
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [catalogItems, setCatalogItems] = useState<CatalogItemRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [fillOrder, setFillOrder] = useState<OrderRecord | null>(null);
  const [commissionRate, setCommissionRate] = useState<number | null>(null);

  // Filters
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [itemFilter, setItemFilter] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('newest');

  // Load catalog items and commission rate
  useEffect(() => {
    apiFetch<{ items: CatalogItemRecord[] }>('/catalog/items')
      .then((data) => setCatalogItems(data.items))
      .catch(() => {});
    apiFetch<{ commissionRate: number }>('/public/settings/commission-rate')
      .then((data) => setCommissionRate(data.commissionRate))
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
      <FadeIn>
        <PageHeader title="Marketplace" subtitle="Browse and fill active orders">
          {commissionRate !== null && (
            <span className="text-xs text-neutral-500">
              Platform fee: {(commissionRate * 100).toFixed(0)}%
            </span>
          )}
          {!isTimedOut && (
            <Link href="/marketplace/create">
              <Button>Create Order</Button>
            </Link>
          )}
        </PageHeader>
      </FadeIn>

      {/* Filters */}
      <FadeIn delay={100}>
        <div className="mt-6 flex flex-wrap gap-3">
          <Select
            value={typeFilter}
            onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
          >
            <option value="">All Types</option>
            <option value="buy">Buy Orders</option>
            <option value="sell">Sell Orders</option>
          </Select>

          <Select
            value={itemFilter}
            onChange={(e) => { setItemFilter(e.target.value); setPage(1); }}
          >
            <option value="">All Items</option>
            {catalogItems.map((item) => (
              <option key={item.id} value={item.id}>{item.displayName}</option>
            ))}
          </Select>

          <Select
            value={sortBy}
            onChange={(e) => { setSortBy(e.target.value); setPage(1); }}
          >
            <option value="newest">Newest</option>
            <option value="price_asc">Price: Low to High</option>
            <option value="price_desc">Price: High to Low</option>
            <option value="expiring_soon">Expiring Soon</option>
          </Select>
        </div>
      </FadeIn>

      {/* Orders grid */}
      {loading ? (
        <p className="mt-8 text-center text-sm text-neutral-500">Loading orders...</p>
      ) : orders.length === 0 ? (
        <p className="mt-8 text-center text-sm text-neutral-500">No active orders found.</p>
      ) : (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {orders.map((order, i) => (
              <FadeIn key={order.id} delay={50 * i}>
                <Card
                  hover
                  className="p-4 transition-transform duration-200 hover:scale-[1.01]"
                  style={order.borderColor ? {
                    borderColor: COSMETIC_COLORS.find(c => c.id === order.borderColor)?.hex || undefined,
                  } : undefined}
                >
                  <div className="flex items-center justify-between">
                    <Badge variant={order.type === 'buy' ? 'emerald' : 'amber'}>
                      {order.type}
                    </Badge>
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
                  <div className="mt-3 h-1.5 rounded-full bg-[#1a1a1a]">
                    <div
                      className="h-1.5 rounded-full bg-amber-500 transition-all"
                      style={{ width: `${(order.filledQuantity / order.quantity) * 100}%` }}
                    />
                  </div>

                  <div className="mt-3 flex items-center justify-between">
                    <span
                      className={`text-xs text-neutral-500 ${order.usernameFont === 'premium' ? 'sparkle-name' : ''}`}
                      style={{
                        ...(order.usernameColor ? { color: COSMETIC_COLORS.find(c => c.id === order.usernameColor)?.hex } : {}),
                        ...(order.usernameFont ? { fontFamily: COSMETIC_FONTS.find(f => f.id === order.usernameFont)?.fontFamily } : {}),
                      }}
                    >
                      by {order.username}
                      {order.usernameFont === 'premium' && <span className="sparkle-extra">✦</span>}
                    </span>
                    <Button size="sm" onClick={() => setFillOrder(order)} disabled={isTimedOut}>
                      Fill
                    </Button>
                  </div>
                </Card>
              </FadeIn>
            ))}
          </div>

          {meta && <Pagination page={meta.page} totalPages={meta.totalPages} onPageChange={setPage} />}
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
