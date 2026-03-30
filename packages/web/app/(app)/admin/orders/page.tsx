'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth';
import { apiFetch, getAccessToken } from '@/lib/api';
import { PageHeader } from '@/components/ui/page-header';
import { Tabs } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/input';
import { Table, Thead, Tbody, Th, Td } from '@/components/ui/table';
import { Pagination } from '@/components/ui/pagination';
import { FadeIn } from '@/components/ui/animate';
import { ConfirmModal } from '@/components/ui/confirm-modal';
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

const STATUS_TABS = [
  { label: 'Active', value: 'active' },
  { label: 'Completed', value: 'completed' },
  { label: 'Cancelled', value: 'cancelled' },
  { label: 'Expired', value: 'expired' },
  { label: 'All', value: 'all' },
];

const TYPE_VARIANT: Record<string, string> = {
  buy: 'emerald',
  sell: 'violet',
};

const STATUS_VARIANT: Record<string, string> = {
  active: 'success',
  completed: 'info',
  cancelled: 'danger',
  expired: 'neutral',
};

export default function AdminOrdersPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [status, setStatus] = useState('active');
  const [typeFilter, setTypeFilter] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const canCancel = user?.role === 'admin' || user?.role === 'manager' || user?.role === 'leader';

  const handleExport = () => {
    const params = new URLSearchParams();
    if (status !== 'all') params.set('status', status);
    if (typeFilter) params.set('type', typeFilter);

    const token = getAccessToken();
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://moldo.go.ro:9443';
    const url = `${apiUrl}/admin/orders/export?${params}`;

    fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      credentials: 'include',
    })
      .then((res) => res.blob())
      .then((blob) => {
        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = 'orders-export.csv';
        link.click();
        URL.revokeObjectURL(blobUrl);
      })
      .catch(() => {});
  };

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

  const [confirmModal, setConfirmModal] = useState<{ id: string } | null>(null);

  const handleCancel = (id: string) => {
    setConfirmModal({ id });
  };

  const doCancelOrder = async (id: string) => {
    setConfirmModal(null);
    setActionLoading(id);
    try {
      await apiFetch(`/admin/orders/${id}`, { method: 'DELETE' });
      fetchOrders();
    } catch { /* error handled by apiFetch */ }
    setActionLoading(null);
  };

  return (
    <div className="max-w-5xl">
      <FadeIn>
        <PageHeader title="Orders" />
      </FadeIn>

      <FadeIn delay={100}>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Tabs
            tabs={STATUS_TABS}
            value={status}
            onChange={(v) => { setStatus(v); setPage(1); }}
          />
          <Select
            value={typeFilter}
            onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
          >
            <option value="">All types</option>
            <option value="buy">Buy</option>
            <option value="sell">Sell</option>
          </Select>
          <button
            onClick={handleExport}
            className="rounded-lg border border-[#1a1a1a] bg-white/[0.03] px-3 py-1.5 text-xs text-neutral-400 transition-colors hover:bg-white/[0.06] hover:text-white"
          >
            Export CSV
          </button>
        </div>
      </FadeIn>

      {loading ? (
        <p className="mt-4 text-sm text-neutral-400">Loading...</p>
      ) : orders.length === 0 ? (
        <p className="mt-4 text-sm text-neutral-500">No orders found.</p>
      ) : (
        <FadeIn delay={150}>
          <div className="mt-3">
            <Table>
              <Thead>
                <tr>
                  <Th>User</Th>
                  <Th>Type</Th>
                  <Th>Item</Th>
                  <Th className="text-right">Qty</Th>
                  <Th className="text-right">Filled</Th>
                  <Th className="text-right">Price/unit</Th>
                  <Th>Status</Th>
                  <Th>Expires</Th>
                  {canCancel && <Th>Actions</Th>}
                </tr>
              </Thead>
              <Tbody>
                {orders.map((o) => (
                  <tr key={o.id}>
                    <Td className="text-xs">{o.username}</Td>
                    <Td>
                      <Badge variant={TYPE_VARIANT[o.type] as 'emerald'}>
                        {o.type}
                      </Badge>
                    </Td>
                    <Td className="text-xs">{o.catalogItemDisplayName}</Td>
                    <Td className="text-right text-xs">{o.quantity}</Td>
                    <Td className="text-right text-xs">{o.filledQuantity}/{o.quantity}</Td>
                    <Td className="text-right text-xs">${Number(o.pricePerUnit).toLocaleString()}</Td>
                    <Td>
                      <Badge variant={STATUS_VARIANT[o.status] as 'success'}>
                        {o.status}
                      </Badge>
                    </Td>
                    <Td className="whitespace-nowrap text-xs text-neutral-500">
                      {new Date(o.expiresAt).toLocaleDateString()}
                    </Td>
                    {canCancel && (
                      <Td>
                        {o.status === 'active' ? (
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => handleCancel(o.id)}
                            disabled={actionLoading === o.id}
                          >
                            Cancel
                          </Button>
                        ) : (
                          <span className="text-xs text-neutral-500">&mdash;</span>
                        )}
                      </Td>
                    )}
                  </tr>
                ))}
              </Tbody>
            </Table>
          </div>

          {meta && <Pagination page={meta.page} totalPages={meta.totalPages} onPageChange={setPage} />}
        </FadeIn>
      )}
      {confirmModal && (
        <ConfirmModal
          title="Cancel Order"
          message="Cancel this order? This will refund the unfilled portion."
          confirmLabel="Cancel Order"
          variant="danger"
          onConfirm={() => doCancelOrder(confirmModal.id)}
          onCancel={() => setConfirmModal(null)}
        />
      )}
    </div>
  );
}
