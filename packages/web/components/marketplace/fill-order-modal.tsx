'use client';

import { useState, useCallback } from 'react';
import { apiFetch, ApiError } from '@/lib/api';
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-xl border border-neutral-800 bg-neutral-900/95 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
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
            <input
              id="fill-qty"
              type="number"
              min={1}
              max={maxQty}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              disabled={loading}
              placeholder="0"
              className="w-full rounded-lg border border-neutral-700 bg-neutral-950/50 px-3 py-2 text-sm text-white placeholder-neutral-600 focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600 disabled:opacity-50"
            />
            <button
              onClick={() => setQuantity(maxQty.toString())}
              className="whitespace-nowrap rounded-lg border border-neutral-700 px-2.5 py-1.5 text-xs text-neutral-400 hover:bg-neutral-800"
            >
              Max
            </button>
          </div>
        </div>

        {/* Summary */}
        {fillQty > 0 && (
          <div className="mt-4 rounded-lg border border-neutral-800 bg-neutral-950/50 p-3 text-sm">
            {order.type === 'buy' ? (
              <div className="space-y-1">
                <div className="flex justify-between text-neutral-400">
                  <span>You provide</span>
                  <span className="text-white">{fillQty}x {order.catalogItemDisplayName}</span>
                </div>
                <div className="flex justify-between text-neutral-400">
                  <span>You receive</span>
                  <span className="text-green-400">${(totalCost - commission).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-neutral-500 text-xs">
                  <span>Commission ({(Number(order.commissionRate) * 100).toFixed(0)}%)</span>
                  <span>-${commission.toLocaleString()}</span>
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
              </div>
            )}
          </div>
        )}

        {error && <p className="mt-3 text-xs text-red-400">{error}</p>}

        <button
          onClick={handleSubmit}
          disabled={loading || fillQty < 1}
          className="mt-4 w-full rounded-lg bg-green-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-green-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? 'Filling...' : 'Confirm Fill'}
        </button>

        <button
          onClick={onClose}
          className="mt-2 w-full rounded-lg border border-neutral-700 bg-neutral-800/50 px-4 py-2 text-sm text-neutral-300 transition-colors hover:bg-neutral-700"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
