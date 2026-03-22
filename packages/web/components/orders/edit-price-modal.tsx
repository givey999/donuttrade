'use client';

import { useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiFetch, ApiError } from '@/lib/api';
import { useToast } from '@/lib/toast';

interface EditPriceModalProps {
  order: {
    id: string;
    type: string;
    quantity: number;
    pricePerUnit: string;
    catalogItemDisplayName: string;
  };
  onClose: () => void;
  onSuccess: () => void;
}

export function EditPriceModal({ order, onClose, onSuccess }: EditPriceModalProps) {
  const currentPrice = Number(order.pricePerUnit);
  const [newPrice, setNewPrice] = useState(currentPrice.toString());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { toast } = useToast();

  const newPriceNum = Number(newPrice) || 0;
  const priceDiff = newPriceNum - currentPrice;
  const escrowDiff = priceDiff * order.quantity;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPriceNum <= 0 || newPriceNum === currentPrice) return;

    setLoading(true);
    setError('');

    try {
      await apiFetch(`/orders/${order.id}/price`, {
        method: 'PATCH',
        body: JSON.stringify({ pricePerUnit: newPriceNum }),
      });
      toast('Order price updated', 'success');
      onSuccess();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Failed to update price');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal onClose={onClose}>
      <h3 className="text-lg font-semibold text-white">Edit Price</h3>
      <p className="mt-1 text-sm text-neutral-400">
        {order.catalogItemDisplayName} · {order.quantity}x · {order.type}
      </p>

      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <div>
          <label className="mb-1 block text-xs text-neutral-400">Current price per unit</label>
          <p className="text-sm text-white">${currentPrice.toLocaleString()}</p>
        </div>

        <div>
          <label className="mb-1 block text-xs text-neutral-400">New price per unit</label>
          <Input
            type="number"
            min={1}
            value={newPrice}
            onChange={(e) => setNewPrice(e.target.value)}
            placeholder="Enter new price"
          />
        </div>

        {newPriceNum > 0 && newPriceNum !== currentPrice && order.type === 'buy' && (
          <div className={`rounded-lg border px-3 py-2 text-sm ${
            escrowDiff > 0
              ? 'border-amber-500/30 bg-amber-500/10 text-amber-200'
              : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
          }`}>
            {escrowDiff > 0
              ? `You'll pay an additional $${escrowDiff.toLocaleString()} from your balance`
              : `You'll be refunded $${Math.abs(escrowDiff).toLocaleString()} to your balance`
            }
          </div>
        )}

        {order.type === 'sell' && newPriceNum > 0 && newPriceNum !== currentPrice && (
          <p className="text-xs text-neutral-500">No balance change — items are already reserved</p>
        )}

        {error && <p className="text-xs text-red-400">{error}</p>}

        <div className="flex gap-2">
          <Button type="submit" disabled={loading || newPriceNum <= 0 || newPriceNum === currentPrice}>
            {loading ? 'Updating...' : 'Update Price'}
          </Button>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </form>
    </Modal>
  );
}
