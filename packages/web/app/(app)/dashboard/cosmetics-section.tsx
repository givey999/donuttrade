'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiFetch, ApiError } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FadeIn } from '@/components/ui/animate';
import { COSMETIC_COLORS, COSMETIC_FONTS } from '@donuttrade/shared';
import type { CosmeticColor, CosmeticFont } from '@donuttrade/shared';

interface CosmeticsData {
  colors: string[];
  fonts: string[];
  tradingVolume: string;
  hiddenModePurchased: boolean;
  hiddenMode: boolean;
}

export function CosmeticsSection() {
  const [data, setData] = useState<CosmeticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(() => {
    apiFetch<CosmeticsData>('/cosmetics')
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleUnlock = useCallback(async (type: 'color' | 'font', id: string) => {
    setActionLoading(`${type}-${id}`);
    setError(null);
    try {
      await apiFetch('/cosmetics/unlock', {
        method: 'POST',
        body: JSON.stringify({ type, id }),
      });
      fetchData();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Something went wrong');
      }
    } finally {
      setActionLoading(null);
    }
  }, [fetchData]);

  const handlePurchaseHidden = useCallback(async () => {
    setActionLoading('hidden-purchase');
    setError(null);
    try {
      await apiFetch('/cosmetics/hidden/purchase', { method: 'POST' });
      fetchData();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Something went wrong');
      }
    } finally {
      setActionLoading(null);
    }
  }, [fetchData]);

  const handleToggleHidden = useCallback(async () => {
    setActionLoading('hidden-toggle');
    setError(null);
    try {
      await apiFetch('/cosmetics/hidden/toggle', { method: 'POST' });
      fetchData();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Something went wrong');
      }
    } finally {
      setActionLoading(null);
    }
  }, [fetchData]);

  if (loading) return <p className="mt-6 text-sm text-neutral-500">Loading cosmetics...</p>;
  if (!data) return null;

  const tradingVolume = Number(data.tradingVolume);

  const isColorUnlocked = (color: CosmeticColor): boolean => {
    if (color.tier === 'free') return true;
    return data.colors.includes(color.id);
  };

  const isColorVolumeReached = (color: CosmeticColor): boolean => {
    if (color.tier !== 'volume') return false;
    return tradingVolume >= (color.requiredVolume || 0);
  };

  const isFontUnlocked = (font: CosmeticFont): boolean => {
    if (font.tier === 'free') return true;
    return data.fonts.includes(font.id);
  };

  const isFontVolumeReached = (font: CosmeticFont): boolean => {
    if (font.tier !== 'volume') return false;
    return tradingVolume >= (font.requiredVolume || 0);
  };

  return (
    <FadeIn delay={400} className="mt-8">
      <h3 className="text-lg font-semibold">Cosmetics</h3>

      {error && (
        <p className="mt-2 text-xs text-red-400">{error}</p>
      )}

      {/* Colors Section */}
      <Card className="mt-3 p-5">
        <h4 className="text-sm font-medium text-neutral-400">Colors</h4>
        <div className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
          {COSMETIC_COLORS.map((color) => {
            const unlocked = isColorUnlocked(color);
            const isLoadingThis = actionLoading === `color-${color.id}`;

            return (
              <div
                key={color.id}
                className="flex flex-col items-center gap-2 rounded-lg border border-[#1a1a1a] bg-white/[0.02] p-3"
              >
                <div className="relative">
                  <div
                    className="h-8 w-8 rounded-full border-2 border-[#1a1a1a]"
                    style={{ backgroundColor: color.hex }}
                  />
                  {unlocked && (
                    <div className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-green-500 text-[10px] text-white">
                      &#10003;
                    </div>
                  )}
                </div>
                <span className="text-xs text-neutral-300">{color.name}</span>

                {color.tier === 'free' && (
                  <Badge variant="neutral" className="text-[10px]">Free</Badge>
                )}

                {color.tier === 'paid' && !unlocked && (
                  <Button
                    size="sm"
                    onClick={() => handleUnlock('color', color.id)}
                    disabled={isLoadingThis}
                    className="text-[10px] px-2 py-1"
                  >
                    {isLoadingThis ? '...' : `$${(color.price || 0).toLocaleString()}`}
                  </Button>
                )}

                {color.tier === 'paid' && unlocked && (
                  <Badge variant="success" className="text-[10px]">Owned</Badge>
                )}

                {color.tier === 'volume' && unlocked && (
                  <Badge variant="purple" className="text-[10px]">Volume</Badge>
                )}

                {color.tier === 'volume' && !unlocked && (
                  <div className="w-full">
                    <p className="text-center text-[10px] text-neutral-500">
                      ${(color.requiredVolume || 0).toLocaleString()} vol
                    </p>
                    <div className="mt-1 h-1 w-full rounded-full bg-[#1a1a1a]">
                      <div
                        className="h-1 rounded-full bg-amber-500 transition-all"
                        style={{
                          width: `${Math.min(100, (tradingVolume / (color.requiredVolume || 1)) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* Fonts Section */}
      <Card className="mt-4 p-5">
        <h4 className="text-sm font-medium text-neutral-400">Fonts</h4>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {COSMETIC_FONTS.map((font) => {
            const unlocked = isFontUnlocked(font);
            const isLoadingThis = actionLoading === `font-${font.id}`;

            return (
              <div
                key={font.id}
                className="flex flex-col items-center gap-2 rounded-lg border border-[#1a1a1a] bg-white/[0.02] p-3"
              >
                <span
                  className="text-sm text-white"
                  style={{ fontFamily: font.fontFamily }}
                >
                  {font.name}
                </span>

                {unlocked && (
                  <div className="flex h-4 w-4 items-center justify-center rounded-full bg-green-500 text-[10px] text-white">
                    &#10003;
                  </div>
                )}

                {font.tier === 'free' && (
                  <Badge variant="neutral" className="text-[10px]">Free</Badge>
                )}

                {font.tier === 'paid' && !unlocked && (
                  <Button
                    size="sm"
                    onClick={() => handleUnlock('font', font.id)}
                    disabled={isLoadingThis}
                    className="text-[10px] px-2 py-1"
                  >
                    {isLoadingThis ? '...' : `$${(font.price || 0).toLocaleString()}`}
                  </Button>
                )}

                {font.tier === 'paid' && unlocked && (
                  <Badge variant="success" className="text-[10px]">Owned</Badge>
                )}

                {font.tier === 'volume' && unlocked && (
                  <Badge variant="purple" className="text-[10px]">Volume</Badge>
                )}

                {font.tier === 'volume' && !unlocked && (
                  <div className="w-full">
                    <p className="text-center text-[10px] text-neutral-500">
                      ${(font.requiredVolume || 0).toLocaleString()} vol
                    </p>
                    <div className="mt-1 h-1 w-full rounded-full bg-[#1a1a1a]">
                      <div
                        className="h-1 rounded-full bg-amber-500 transition-all"
                        style={{
                          width: `${Math.min(100, (tradingVolume / (font.requiredVolume || 1)) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* Hidden Mode Section */}
      <Card className="mt-4 p-5">
        <h4 className="text-sm font-medium text-neutral-400">Hidden Mode</h4>
        <p className="mt-1 text-xs text-neutral-500">
          Hide your username on marketplace listings
        </p>

        <div className="mt-3">
          {!data.hiddenModePurchased ? (
            <Button
              onClick={handlePurchaseHidden}
              disabled={actionLoading === 'hidden-purchase'}
            >
              {actionLoading === 'hidden-purchase' ? 'Purchasing...' : 'Purchase Hidden Mode'}
            </Button>
          ) : (
            <div className="flex items-center gap-3">
              <button
                onClick={handleToggleHidden}
                disabled={actionLoading === 'hidden-toggle'}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  data.hiddenMode ? 'bg-amber-500' : 'bg-neutral-700'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                    data.hiddenMode ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
              <span className="text-sm text-neutral-400">
                {data.hiddenMode ? 'Active' : 'Inactive'}
              </span>
            </div>
          )}

          {data.hiddenMode && (
            <p className="mt-2 text-xs text-amber-400">
              Your customizations are hidden on listings while this is active
            </p>
          )}
        </div>
      </Card>
    </FadeIn>
  );
}
