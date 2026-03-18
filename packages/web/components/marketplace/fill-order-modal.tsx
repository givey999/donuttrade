'use client';

import { useState, useCallback } from 'react';
import { apiFetch, ApiError } from '@/lib/api';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { OrderRecord } from '@donuttrade/shared';

interface FillOrderModalProps {
  order: OrderRecord;
  onClose: () => void;
  onSuccess: () => void;
}

export function FillOrderModal({ order, onClose, onSuccess }: FillOrderModalProps) {
  const [quantity, setQuantity] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const maxQty = order.remainingQuantity;
  const pricePerUnit = Number(order.pricePerUnit);
  const fillQty = parseInt(quantity, 10) || 0;
  const totalCost = fillQty * pricePerUnit;
  const commission = order.type === 'sell' ? 0 : totalCost * Number(order.commissionRate);

  const handleSubmit = useCallback(async () => {
    if (fillQty < 1 || fillQty > maxQty) {
      setError(`Quantity must be between 1 and ${maxQty}`);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await apiFetch(`/orders/${order.id}/fill`, {
        method: 'POST',
        body: JSON.stringify({ quantity: fillQty }),
      });
      onSuccess();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }, [fillQty, maxQty, order.id, onSuccess]);

  return (
    <Modal onClose={onClose}>
      <h3 className="text-lg font-semibold">
        Fill {order.type === 'buy' ? 'Buy' : 'Sell'} Order
      </h3>

      <div className="mt-3 space-y-1 text-sm text-neutral-400">
        <div className="flex justify-between">
          <span>Item</span>
          <span className="text-white">{order.catalogItemDisplayName}</span>
        </div>
        <div className="flex justify-between">
          <span>Price per unit</span>
          <span className="text-white">${pricePerUnit.toLocaleString()}</span>
        </div>
        <div className="flex justify-between">
          <span>Remaining</span>
          <span className="text-white">{maxQty}</span>
        </div>
      </div>

      <div className="mt-4">
        <label htmlFor="fill-qty" className="block text-xs text-neutral-400">
          Quantity to fill
        </label>
        <div className="mt-1 flex gap-2">
          <Input
            id="fill-qty"
            type="number"
            min={1}
            max={maxQty}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            disabled={loading}
            placeholder="0"
          />
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setQuantity(maxQty.toString())}
          >
            Max
          </Button>
        </div>
      </div>

      {/* Summary */}
      {fillQty > 0 && (
        <div className="mt-4 rounded-lg border border-[#1a1a1a] bg-white/[0.03] p-3 text-sm">
          {order.type === 'buy' ? (
            <div className="space-y-1">
              <div className="flex justify-between text-neutral-400">
                <span>You provide</span>
                <span className="text-white">{fillQty}x {order.catalogItemDisplayName}</span>
              </div>
              <div className="flex justify-between text-neutral-400">
                <span>Subtotal</span>
                <span className="text-white">${totalCost.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-neutral-500 text-xs">
                <span>Commission ({(Number(order.commissionRate) * 100).toFixed(0)}%)</span>
                <span>-${new Intl.NumberFormat('en-US').format(commission)}</span>
              </div>
              <div className="flex justify-between border-t border-[#1a1a1a] pt-1 font-medium text-neutral-400">
                <span>You receive</span>
                <span className="text-green-400">${new Intl.NumberFormat('en-US').format(totalCost - commission)}</span>
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              <div className="flex justify-between text-neutral-400">
                <span>You pay</span>
                <span className="text-red-400">${totalCost.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-neutral-400">
                <span>You receive</span>
                <span className="text-green-400">{fillQty}x {order.catalogItemDisplayName}</span>
              </div>
              {Number(order.commissionRate) > 0 && (
                <div className="flex justify-between text-neutral-500 text-xs">
                  <span>Commission ({(Number(order.commissionRate) * 100).toFixed(0)}%)</span>
                  <span>${new Intl.NumberFormat('en-US').format(totalCost * Number(order.commissionRate))}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {error && <p className="mt-3 text-xs text-red-400">{error}</p>}

      <Button
        onClick={handleSubmit}
        disabled={loading || fillQty < 1}
        className="mt-4 w-full"
      >
        {loading ? 'Filling...' : 'Confirm Fill'}
      </Button>

      <Button variant="secondary" className="mt-2 w-full" onClick={onClose}>
        Cancel
      </Button>
    </Modal>
  );
}
