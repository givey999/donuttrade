'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { RequireAuth } from '@/lib/require-auth';
import { useAuth } from '@/lib/auth';
import { apiFetch, ApiError } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { FadeIn } from '@/components/ui/animate';
import { COSMETIC_COLORS, COSMETIC_FONTS } from '@donuttrade/shared';
import type { CatalogItemRecord } from '@donuttrade/shared';

const PREMIUM_FEE = 10_000_000;

interface CosmeticItem {
  id: string;
  available: boolean;
  reason: string;
}

interface CosmeticsData {
  colors: CosmeticItem[];
  fonts: CosmeticItem[];
  tradingVolume: string;
  hiddenModePurchased: boolean;
  hiddenMode: boolean;
}

function CreateOrderContent() {
  const router = useRouter();
  const { user, refreshUser } = useAuth();
  const [catalogItems, setCatalogItems] = useState<CatalogItemRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cosmetics data
  const [cosmetics, setCosmetics] = useState<CosmeticsData | null>(null);
  const [commissionRate, setCommissionRate] = useState<number>(0);

  // Form state
  const [type, setType] = useState<'buy' | 'sell'>('buy');
  const [catalogItemId, setCatalogItemId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [pricePerUnit, setPricePerUnit] = useState('');
  const [isPremium, setIsPremium] = useState(false);

  // Cosmetic selections
  const [borderColor, setBorderColor] = useState<string>('');
  const [usernameColor, setUsernameColor] = useState<string>('');
  const [usernameFont, setUsernameFont] = useState<string>('');

  useEffect(() => {
    apiFetch<{ items: CatalogItemRecord[] }>('/catalog/items')
      .then((data) => {
        setCatalogItems(data.items);
        if (data.items.length > 0) setCatalogItemId(data.items[0].id);
      })
      .catch(() => {});

    apiFetch<CosmeticsData>('/cosmetics')
      .then(setCosmetics)
      .catch(() => {});

    apiFetch<{ commissionRate: number }>('/public/settings/commission-rate')
      .then((data) => setCommissionRate(data.commissionRate))
      .catch(() => {});
  }, []);

  const qty = parseInt(quantity, 10) || 0;
  const price = parseFloat(pricePerUnit) || 0;
  const totalValue = qty * price;
  const premiumFee = isPremium ? PREMIUM_FEE : 0;
  const totalCost = type === 'buy' ? totalValue + premiumFee : premiumFee;
  const feeAmount = totalValue * commissionRate;
  const selectedItem = catalogItems.find((i) => i.id === catalogItemId);

  // Determine which colors/fonts are unlocked
  const unlockedColors = COSMETIC_COLORS.filter((c) => {
    if (!cosmetics) return c.tier === 'free';
    const match = cosmetics.colors.find((cc) => cc.id === c.id);
    return match?.available ?? false;
  });

  const unlockedFonts = COSMETIC_FONTS.filter((f) => {
    if (!cosmetics) return f.tier === 'free';
    const match = cosmetics.fonts.find((ff) => ff.id === f.id);
    return match?.available ?? false;
  });

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
          ...(borderColor ? { borderColor } : {}),
          ...(usernameColor ? { usernameColor } : {}),
          ...(usernameFont ? { usernameFont } : {}),
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
  }, [type, catalogItemId, qty, price, isPremium, borderColor, usernameColor, usernameFont, router, refreshUser]);

  return (
    <main className="mx-auto max-w-lg px-4 py-8">
      <FadeIn>
        <PageHeader title="Create Order" />
      </FadeIn>

      <FadeIn delay={100}>
        <Card className="mt-6 p-6">
          {/* Type toggle */}
          <div>
            <label className="block text-xs text-neutral-400">Order Type</label>
            <div className="mt-1.5 grid grid-cols-2 gap-2">
              <button
                onClick={() => setType('buy')}
                className={`rounded-lg border px-3 py-2 text-sm font-medium transition-all duration-200 ${
                  type === 'buy'
                    ? 'border-emerald-500/30 bg-emerald-500/[0.08] text-emerald-400'
                    : 'border-[#1a1a1a] bg-white/[0.02] text-neutral-400 hover:bg-white/[0.04]'
                }`}
              >
                Buy
              </button>
              <button
                onClick={() => setType('sell')}
                className={`rounded-lg border px-3 py-2 text-sm font-medium transition-all duration-200 ${
                  type === 'sell'
                    ? 'border-amber-500/30 bg-amber-500/[0.08] text-amber-500'
                    : 'border-[#1a1a1a] bg-white/[0.02] text-neutral-400 hover:bg-white/[0.04]'
                }`}
              >
                Sell
              </button>
            </div>
          </div>

          {/* Item select */}
          <div className="mt-4">
            <label htmlFor="item" className="block text-xs text-neutral-400">Item</label>
            <Select
              id="item"
              value={catalogItemId}
              onChange={(e) => setCatalogItemId(e.target.value)}
              className="mt-1.5 w-full"
            >
              {catalogItems.map((item) => (
                <option key={item.id} value={item.id}>{item.displayName}</option>
              ))}
            </Select>
          </div>

          {/* Quantity */}
          <div className="mt-4">
            <label htmlFor="qty" className="block text-xs text-neutral-400">Quantity</label>
            <Input
              id="qty"
              type="number"
              min={1}
              max={10000}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="1"
              className="mt-1.5"
            />
          </div>

          {/* Price per unit */}
          <div className="mt-4">
            <label htmlFor="price" className="block text-xs text-neutral-400">Price per unit ($)</label>
            <Input
              id="price"
              type="number"
              min={1}
              value={pricePerUnit}
              onChange={(e) => setPricePerUnit(e.target.value)}
              placeholder="100000"
              className="mt-1.5"
            />
          </div>

          {/* Duration toggle */}
          <div className="mt-4">
            <label className="block text-xs text-neutral-400">Duration</label>
            <div className="mt-1.5 grid grid-cols-2 gap-2">
              <button
                onClick={() => setIsPremium(false)}
                className={`rounded-lg border px-3 py-2 text-sm transition-all duration-200 ${
                  !isPremium
                    ? 'border-amber-500/30 bg-amber-500/[0.08] text-amber-500'
                    : 'border-[#1a1a1a] bg-white/[0.02] text-neutral-400 hover:bg-white/[0.04]'
                }`}
              >
                24h (Free)
              </button>
              <button
                onClick={() => setIsPremium(true)}
                className={`rounded-lg border px-3 py-2 text-sm transition-all duration-200 ${
                  isPremium
                    ? 'border-amber-500/30 bg-amber-500/[0.08] text-amber-500'
                    : 'border-[#1a1a1a] bg-white/[0.02] text-neutral-400 hover:bg-white/[0.04]'
                }`}
              >
                48h ($10M)
              </button>
            </div>
          </div>

          {/* Cosmetics: Border Color */}
          {cosmetics && unlockedColors.length > 0 && (
            <div className="mt-4">
              <label className="block text-xs text-neutral-400">Border Color</label>
              <div className="mt-1.5 flex flex-wrap gap-2">
                <button
                  onClick={() => setBorderColor('')}
                  className={`h-7 w-7 rounded-full border-2 transition-all ${
                    !borderColor ? 'border-amber-500 ring-2 ring-amber-500/30' : 'border-[#1a1a1a]'
                  } bg-[#1a1a1a]`}
                  title="None"
                />
                {unlockedColors.map((color) => (
                  <button
                    key={color.id}
                    onClick={() => setBorderColor(color.id)}
                    className={`h-7 w-7 rounded-full border-2 transition-all ${
                      borderColor === color.id ? 'border-white ring-2 ring-white/30' : 'border-[#1a1a1a]'
                    }`}
                    style={{
                      background: color.tier === 'volume'
                        ? `linear-gradient(135deg, ${color.hex}, #0a0a0a, ${color.hex})`
                        : color.tier === 'paid'
                          ? `linear-gradient(135deg, ${color.hex}, ${color.hex}dd, white, ${color.hex}dd, ${color.hex})`
                          : color.hex,
                    }}
                    title={color.name}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Cosmetics: Username Color */}
          {cosmetics && unlockedColors.length > 0 && (
            <div className="mt-4">
              <label className="block text-xs text-neutral-400">Username Color</label>
              <div className="mt-1.5 flex flex-wrap gap-2">
                <button
                  onClick={() => setUsernameColor('')}
                  className={`h-7 w-7 rounded-full border-2 transition-all ${
                    !usernameColor ? 'border-amber-500 ring-2 ring-amber-500/30' : 'border-[#1a1a1a]'
                  } bg-[#1a1a1a]`}
                  title="None"
                />
                {unlockedColors.map((color) => (
                  <button
                    key={color.id}
                    onClick={() => setUsernameColor(color.id)}
                    className={`h-7 w-7 rounded-full border-2 transition-all ${
                      usernameColor === color.id ? 'border-white ring-2 ring-white/30' : 'border-[#1a1a1a]'
                    }`}
                    style={{
                      background: color.tier === 'volume'
                        ? `linear-gradient(135deg, ${color.hex}, #0a0a0a, ${color.hex})`
                        : color.tier === 'paid'
                          ? `linear-gradient(135deg, ${color.hex}, ${color.hex}dd, white, ${color.hex}dd, ${color.hex})`
                          : color.hex,
                    }}
                    title={color.name}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Cosmetics: Username Font */}
          {cosmetics && unlockedFonts.length > 0 && (
            <div className="mt-4">
              <label className="block text-xs text-neutral-400">Username Font</label>
              <div className="mt-1.5 flex flex-wrap gap-2">
                <button
                  onClick={() => setUsernameFont('')}
                  className={`rounded-lg border px-3 py-1.5 text-xs transition-all ${
                    !usernameFont
                      ? 'border-amber-500/30 bg-amber-500/[0.08] text-amber-500'
                      : 'border-[#1a1a1a] bg-white/[0.02] text-neutral-400 hover:bg-white/[0.04]'
                  }`}
                >
                  Default
                </button>
                {unlockedFonts.map((font) => (
                  <button
                    key={font.id}
                    onClick={() => setUsernameFont(font.id)}
                    className={`rounded-lg border px-3 py-1.5 text-xs transition-all ${
                      usernameFont === font.id
                        ? 'border-amber-500/30 bg-amber-500/[0.08] text-amber-500'
                        : 'border-[#1a1a1a] bg-white/[0.02] text-neutral-400 hover:bg-white/[0.04]'
                    }`}
                    style={{ fontFamily: font.fontFamily }}
                  >
                    {font.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Summary */}
          {qty > 0 && price > 0 && (
            <div className="mt-5 rounded-lg border border-[#1a1a1a] bg-white/[0.03] p-3 text-sm">
              <div className="space-y-1">
                <div className="flex justify-between text-neutral-400">
                  <span>{selectedItem?.displayName ?? 'Item'}</span>
                  <span className="text-white">{qty}x @ ${price.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-neutral-400">
                  <span>Total value</span>
                  <span className="text-white">${totalValue.toLocaleString()}</span>
                </div>
                {commissionRate > 0 && (
                  <div className="flex justify-between text-neutral-400">
                    <span>Fee ({(commissionRate * 100).toFixed(0)}% of ${totalValue.toLocaleString()})</span>
                    <span className="text-neutral-500">${new Intl.NumberFormat('en-US').format(feeAmount)}</span>
                  </div>
                )}
                {isPremium && (
                  <div className="flex justify-between text-neutral-400">
                    <span>Premium fee</span>
                    <span className="text-white">${PREMIUM_FEE.toLocaleString()}</span>
                  </div>
                )}
                {type === 'buy' && (
                  <div className="flex justify-between border-t border-[#1a1a1a] pt-1 font-medium">
                    <span>You pay (escrow)</span>
                    <span className="text-red-400">${totalCost.toLocaleString()}</span>
                  </div>
                )}
                {type === 'sell' && (
                  <div className="flex justify-between border-t border-[#1a1a1a] pt-1 font-medium">
                    <span>Items reserved</span>
                    <span className="text-amber-400">{qty}x {selectedItem?.displayName}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {error && <p className="mt-3 text-xs text-red-400">{error}</p>}

          <Button
            onClick={handleSubmit}
            disabled={loading || qty < 1 || price < 1 || !catalogItemId}
            className="mt-5 w-full"
          >
            {loading ? 'Creating...' : `Create ${type === 'buy' ? 'Buy' : 'Sell'} Order`}
          </Button>
        </Card>
      </FadeIn>
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
