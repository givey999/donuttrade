'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { RequireAuth } from '@/lib/require-auth';
import { useAuth } from '@/lib/auth';
import { apiFetch, ApiError } from '@/lib/api';
import { PageHeader } from '@/components/ui/page-header';
import { Tabs } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Table, Thead, Tbody, Th, Td } from '@/components/ui/table';
import { Pagination } from '@/components/ui/pagination';
import { FadeIn } from '@/components/ui/animate';
import { EditPriceModal } from '@/components/orders/edit-price-modal';
import type { OrderRecord, PaginationMeta, OrderStatus } from '@donuttrade/shared';

const STATUS_TABS = [
  { label: 'All', value: '' },
  { label: 'Active', value: 'active' },
  { label: 'Completed', value: 'completed' },
  { label: 'Cancelled', value: 'cancelled' },
  { label: 'Expired', value: 'expired' },
];

const TYPE_VARIANT: Record<string, string> = {
  buy: 'emerald',
  sell: 'amber',
};

const STATUS_VARIANT: Record<string, string> = {
  active: 'success',
  completed: 'neutral',
  cancelled: 'danger',
  expired: 'neutral',
};

function MyOrdersContent() {
  const { isTimedOut } = useAuth();
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [editingOrder, setEditingOrder] = useState<OrderRecord | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

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
  }, [page, statusFilter, refreshKey]);

  const handleCancel = async (orderId: string) => {
    setCancelling(orderId);
    setCancelError(null);
    try {
      await apiFetch(`/orders/${orderId}`, { method: 'DELETE' });
      setOrders((prev) => prev.map((o) => o.id === orderId ? { ...o, status: 'cancelled' as OrderStatus } : o));
    } catch (err) {
      setCancelError(err instanceof ApiError ? err.message : 'Failed to cancel order');
    } finally {
      setCancelling(null);
    }
  };

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <FadeIn>
        <PageHeader title="My Orders" />
      </FadeIn>

      {/* Status tabs */}
      <FadeIn delay={100}>
        <div className="mt-6">
          <Tabs
            tabs={STATUS_TABS}
            value={statusFilter}
            onChange={(v) => { setStatusFilter(v); setPage(1); }}
          />
        </div>
      </FadeIn>

      {cancelError && (
        <p className="mt-3 text-xs text-red-400">{cancelError}</p>
      )}

      {loading ? (
        <p className="mt-8 text-sm text-neutral-500">Loading orders...</p>
      ) : orders.length === 0 ? (
        <p className="mt-8 text-sm text-neutral-500">No orders found.</p>
      ) : (
        <FadeIn delay={150}>
          <div className="mt-4">
            <Table>
              <Thead>
                <tr>
                  <Th>Item</Th>
                  <Th>Type</Th>
                  <Th>Qty</Th>
                  <Th>Price/ea</Th>
                  <Th>Status</Th>
                  <Th className="hidden sm:table-cell">Expires</Th>
                  <Th className="text-right">Actions</Th>
                </tr>
              </Thead>
              <Tbody>
                {orders.map((order) => (
                  <tr key={order.id}>
                    <Td className="font-medium">{order.catalogItemDisplayName}</Td>
                    <Td>
                      <Badge variant={TYPE_VARIANT[order.type] as 'emerald'}>
                        {order.type}
                      </Badge>
                    </Td>
                    <Td>
                      <span className="text-white">{order.filledQuantity}</span>
                      <span className="text-neutral-500">/{order.quantity}</span>
                    </Td>
                    <Td>${Number(order.pricePerUnit).toLocaleString()}</Td>
                    <Td>
                      <Badge variant={STATUS_VARIANT[order.status] as 'success'}>
                        {order.status}
                      </Badge>
                    </Td>
                    <Td className="hidden sm:table-cell text-xs text-neutral-500">
                      {new Date(order.expiresAt).toLocaleDateString()}
                    </Td>
                    <Td className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/orders/${order.id}`}
                          className="text-xs text-neutral-400 transition-colors hover:text-amber-400"
                        >
                          View
                        </Link>
                        {order.status === 'active' && order.filledQuantity === 0 && !isTimedOut && (
                          <button
                            onClick={() => setEditingOrder(order)}
                            className="text-xs text-amber-400 transition-colors hover:text-amber-300"
                          >
                            Edit
                          </button>
                        )}
                        {order.status === 'active' && !isTimedOut && (
                          <button
                            onClick={() => handleCancel(order.id)}
                            disabled={cancelling === order.id}
                            className="text-xs text-red-400 transition-colors hover:text-red-300 disabled:opacity-50"
                          >
                            {cancelling === order.id ? '...' : 'Cancel'}
                          </button>
                        )}
                      </div>
                    </Td>
                  </tr>
                ))}
              </Tbody>
            </Table>
          </div>

          {meta && <Pagination page={meta.page} totalPages={meta.totalPages} onPageChange={setPage} nextCursor={meta.nextCursor} prevCursor={meta.prevCursor} />}
        </FadeIn>
      )}

      {editingOrder && (
        <EditPriceModal
          order={editingOrder}
          onClose={() => setEditingOrder(null)}
          onSuccess={() => {
            setEditingOrder(null);
            setRefreshKey((k) => k + 1);
          }}
        />
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
