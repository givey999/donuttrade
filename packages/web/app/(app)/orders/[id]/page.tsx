'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { RequireAuth } from '@/lib/require-auth';
import { useAuth } from '@/lib/auth';
import { apiFetch, ApiError } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, Thead, Tbody, Th, Td } from '@/components/ui/table';
import { FadeIn } from '@/components/ui/animate';
import type { OrderDetailRecord } from '@donuttrade/shared';

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

function OrderDetailContent() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const [order, setOrder] = useState<OrderDetailRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const id = params.id as string;

  useEffect(() => {
    apiFetch<OrderDetailRecord>(`/marketplace/${id}`)
      .then(setOrder)
      .catch(() => setOrder(null))
      .finally(() => setLoading(false));
  }, [id]);

  const handleCancel = async () => {
    setCancelling(true);
    setCancelError(null);
    try {
      await apiFetch(`/orders/${id}`, { method: 'DELETE' });
      setOrder((prev) => prev ? { ...prev, status: 'cancelled' } : null);
    } catch (err) {
      setCancelError(err instanceof ApiError ? err.message : 'Failed to cancel order');
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
      <button onClick={() => router.back()} className="text-sm text-neutral-400 transition-colors hover:text-amber-400">
        &larr; Back
      </button>

      <FadeIn>
        <Card className="mt-4 p-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h1 className="text-[28px] font-extrabold tracking-tight">{order.catalogItemDisplayName}</h1>
            <div className="flex gap-2">
              <Badge variant={TYPE_VARIANT[order.type] as 'emerald'}>
                {order.type}
              </Badge>
              <Badge variant={STATUS_VARIANT[order.status] as 'success'}>
                {order.status}
              </Badge>
            </div>
          </div>

          {/* Details */}
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-neutral-500">By</span>
              <p className="font-medium">{order.username}</p>
            </div>
            <div>
              <span className="text-neutral-500">Price per unit</span>
              <p className="font-medium">${Number(order.pricePerUnit).toLocaleString()}</p>
            </div>
            <div>
              <span className="text-neutral-500">Quantity</span>
              <p className="font-medium">{order.filledQuantity} / {order.quantity}</p>
            </div>
            <div>
              <span className="text-neutral-500">Total value</span>
              <p className="font-medium">${(order.quantity * Number(order.pricePerUnit)).toLocaleString()}</p>
            </div>
            <div>
              <span className="text-neutral-500">Created</span>
              <p className="font-medium">{new Date(order.createdAt).toLocaleString()}</p>
            </div>
            <div>
              <span className="text-neutral-500">Expires</span>
              <p className="font-medium">{new Date(order.expiresAt).toLocaleString()}</p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-5">
            <div className="flex items-center justify-between text-xs text-neutral-400">
              <span>Fill Progress</span>
              <span>{fillPercent.toFixed(0)}%</span>
            </div>
            <div className="mt-1 h-2 rounded-full bg-[#1a1a1a]">
              <div
                className="h-2 rounded-full bg-amber-500 transition-all"
                style={{ width: `${fillPercent}%` }}
              />
            </div>
          </div>

          {/* Cancel button */}
          {isOwner && order.status === 'active' && (
            <Button
              variant="danger"
              onClick={handleCancel}
              disabled={cancelling}
              className="mt-5 w-full"
            >
              {cancelling ? 'Cancelling...' : 'Cancel Order'}
            </Button>
          )}
          {cancelError && (
            <p className="mt-2 text-xs text-red-400">{cancelError}</p>
          )}
        </Card>
      </FadeIn>

      {/* Fill history */}
      {order.fills.length > 0 && (
        <FadeIn delay={100}>
          <div className="mt-6">
            <h2 className="text-lg font-semibold">Fill History</h2>
            <div className="mt-3">
              <Table>
                <Thead>
                  <tr>
                    <Th>Date</Th>
                    <Th>Filled by</Th>
                    <Th>Qty</Th>
                    <Th className="text-right">Total</Th>
                    <Th className="text-right">Commission</Th>
                    <Th className="text-right">Net</Th>
                  </tr>
                </Thead>
                <Tbody>
                  {order.fills.map((fill) => (
                    <tr key={fill.id}>
                      <Td className="whitespace-nowrap text-xs text-neutral-500">
                        {new Date(fill.createdAt).toLocaleDateString()}
                      </Td>
                      <Td>{fill.filledByUsername}</Td>
                      <Td>{fill.quantity}</Td>
                      <Td className="text-right">${Number(fill.totalPrice).toLocaleString()}</Td>
                      <Td className="text-right text-neutral-500">${Number(fill.commissionAmount).toLocaleString()}</Td>
                      <Td className="text-right text-green-400">${Number(fill.netAmount).toLocaleString()}</Td>
                    </tr>
                  ))}
                </Tbody>
              </Table>
            </div>
          </div>
        </FadeIn>
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
