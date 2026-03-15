'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { RequireAuth } from '@/lib/require-auth';
import { useAuth } from '@/lib/auth';
import { apiFetch, ApiError } from '@/lib/api';
import type { CatalogItemRecord } from '@donuttrade/shared';

const PREMIUM_FEE = 10_000_000;

function CreateOrderContent() {
  const router = useRouter();
  const { user, refreshUser } = useAuth();
  const [catalogItems, setCatalogItems] = useState<CatalogItemRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [type, setType] = useState<'buy' | 'sell'>('buy');
  const [catalogItemId, setCatalogItemId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [pricePerUnit, setPricePerUnit] = useState('');
  const [isPremium, setIsPremium] = useState(false);

  useEffect(() => {
    apiFetch<{ items: CatalogItemRecord[] }>('/catalog/items')
      .then((data) => {
        setCatalogItems(data.items);
        if (data.items.length > 0) setCatalogItemId(data.items[0].id);
      })
      .catch(() => {});
  }, []);

  const qty = parseInt(quantity, 10) || 0;
  const price = parseFloat(pricePerUnit) || 0;
  const totalValue = qty * price;
  const premiumFee = isPremium ? PREMIUM_FEE : 0;
  const totalCost = type === 'buy' ? totalValue + premiumFee : premiumFee;
  const selectedItem = catalogItems.find((i) => i.id === catalogItemId);

  const handleSubmit = useCallback(async () => {
    if (!catalogItemId || qty < 1 || price < 1) {
      setError('Please fill in all fields');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await apiFetch('/orders', {
        method: 'POST',
        body: JSON.stringify({
          type,
          catalogItemId,
          quantity: qty,
          pricePerUnit: price,
          isPremium,
        }),
      });
      await refreshUser();
      router.push('/orders');
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }, [type, catalogItemId, qty, price, isPremium, router, refreshUser]);

  return (
    <main className="mx-auto max-w-lg px-4 py-8">
      <h1 className="text-2xl font-bold">Create Order</h1>

      <div className="mt-6 rounded-xl border border-neutral-800 bg-neutral-900/50 p-6 shadow-lg">
        {/* Type toggle */}
        <div>
          <label className="block text-xs text-neutral-400">Order Type</label>
          <div className="mt-1.5 grid grid-cols-2 gap-2">
            <button
              onClick={() => setType('buy')}
              className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                type === 'buy'
                  ? 'border-blue-600 bg-blue-600/20 text-blue-400'
                  : 'border-neutral-700 bg-neutral-800/30 text-neutral-400 hover:bg-neutral-800'
              }`}
            >
              Buy
            </button>
            <button
              onClick={() => setType('sell')}
              className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                type === 'sell'
                  ? 'border-amber-600 bg-amber-600/20 text-amber-400'
                  : 'border-neutral-700 bg-neutral-800/30 text-neutral-400 hover:bg-neutral-800'
              }`}
            >
              Sell
            </button>
          </div>
        </div>

        {/* Item select */}
        <div className="mt-4">
          <label htmlFor="item" className="block text-xs text-neutral-400">Item</label>
          <select
            id="item"
            value={catalogItemId}
            onChange={(e) => setCatalogItemId(e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-neutral-700 bg-neutral-950/50 px-3 py-2 text-sm text-white focus:border-green-600 focus:outline-none"
          >
            {catalogItems.map((item) => (
              <option key={item.id} value={item.id}>{item.displayName}</option>
            ))}
          </select>
        </div>

        {/* Quantity */}
        <div className="mt-4">
          <label htmlFor="qty" className="block text-xs text-neutral-400">Quantity</label>
          <input
            id="qty"
            type="number"
            min={1}
            max={10000}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="1"
            className="mt-1.5 w-full rounded-lg border border-neutral-700 bg-neutral-950/50 px-3 py-2 text-sm text-white placeholder-neutral-600 focus:border-green-600 focus:outline-none"
          />
        </div>

        {/* Price per unit */}
        <div className="mt-4">
          <label htmlFor="price" className="block text-xs text-neutral-400">Price per unit ($)</label>
          <input
            id="price"
            type="number"
            min={1}
            value={pricePerUnit}
            onChange={(e) => setPricePerUnit(e.target.value)}
            placeholder="100000"
            className="mt-1.5 w-full rounded-lg border border-neutral-700 bg-neutral-950/50 px-3 py-2 text-sm text-white placeholder-neutral-600 focus:border-green-600 focus:outline-none"
          />
        </div>

        {/* Duration toggle */}
        <div className="mt-4">
          <label className="block text-xs text-neutral-400">Duration</label>
          <div className="mt-1.5 grid grid-cols-2 gap-2">
            <button
              onClick={() => setIsPremium(false)}
              className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
                !isPremium
                  ? 'border-green-600 bg-green-600/20 text-green-400'
                  : 'border-neutral-700 bg-neutral-800/30 text-neutral-400 hover:bg-neutral-800'
              }`}
            >
              24h (Free)
            </button>
            <button
              onClick={() => setIsPremium(true)}
              className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
                isPremium
                  ? 'border-green-600 bg-green-600/20 text-green-400'
                  : 'border-neutral-700 bg-neutral-800/30 text-neutral-400 hover:bg-neutral-800'
              }`}
            >
              48h ($10M)
            </button>
          </div>
        </div>

        {/* Summary */}
        {qty > 0 && price > 0 && (
          <div className="mt-5 rounded-lg border border-neutral-800 bg-neutral-950/50 p-3 text-sm">
            <div className="space-y-1">
              <div className="flex justify-between text-neutral-400">
                <span>{selectedItem?.displayName ?? 'Item'}</span>
                <span className="text-white">{qty}x @ ${price.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-neutral-400">
                <span>Total value</span>
                <span className="text-white">${totalValue.toLocaleString()}</span>
              </div>
              {isPremium && (
                <div className="flex justify-between text-neutral-400">
                  <span>Premium fee</span>
                  <span className="text-white">${PREMIUM_FEE.toLocaleString()}</span>
                </div>
              )}
              {type === 'buy' && (
                <div className="flex justify-between border-t border-neutral-800 pt-1 font-medium">
                  <span>You pay (escrow)</span>
                  <span className="text-red-400">${totalCost.toLocaleString()}</span>
                </div>
              )}
              {type === 'sell' && (
                <div className="flex justify-between border-t border-neutral-800 pt-1 font-medium">
                  <span>Items reserved</span>
                  <span className="text-amber-400">{qty}x {selectedItem?.displayName}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {error && <p className="mt-3 text-xs text-red-400">{error}</p>}

        <button
          onClick={handleSubmit}
          disabled={loading || qty < 1 || price < 1 || !catalogItemId}
          className="mt-5 w-full rounded-lg bg-green-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-green-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? 'Creating...' : `Create ${type === 'buy' ? 'Buy' : 'Sell'} Order`}
        </button>
      </div>
    </main>
  );
}

export default function CreateOrderPage() {
  return (
    <RequireAuth>
      <CreateOrderContent />
    </RequireAuth>
  );
}
