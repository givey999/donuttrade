'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { apiFetch } from '@/lib/api';

interface PricePoint {
  timestamp: string;
  avgPrice: string;
  minPrice: string;
  maxPrice: string;
  volume: number;
  fills: number;
}

interface PriceChartProps {
  catalogItemId: string;
}

const PERIODS = [
  { label: '24h', value: '24h', interval: '1h' },
  { label: '7d', value: '7d', interval: '6h' },
  { label: '30d', value: '30d', interval: '1d' },
] as const;

function formatPrice(price: number): string {
  if (price >= 1_000_000_000) return `${(price / 1_000_000_000).toFixed(1)}B`;
  if (price >= 1_000_000) return `${(price / 1_000_000).toFixed(1)}M`;
  if (price >= 1_000) return `${(price / 1_000).toFixed(1)}K`;
  return price.toFixed(0);
}

function formatDate(timestamp: string, period: string): string {
  const d = new Date(timestamp);
  if (period === '24h') {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export function PriceChart({ catalogItemId }: PriceChartProps) {
  const [period, setPeriod] = useState<'24h' | '7d' | '30d'>('7d');
  const [data, setData] = useState<PricePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [hover, setHover] = useState<{ index: number; x: number; y: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const periodConfig = PERIODS.find(p => p.value === period)!;

  useEffect(() => {
    setLoading(true);
    apiFetch<{ history: PricePoint[] }>(
      `/public/stats/price-history/${catalogItemId}?period=${period}&interval=${periodConfig.interval}`
    )
      .then(res => {
        setData(res.history);
        setHover(null);
      })
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [catalogItemId, period, periodConfig.interval]);

  // Chart dimensions
  const width = 600;
  const height = 200;
  const padding = { top: 20, right: 60, bottom: 30, left: 10 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const prices = data.map(d => Number(d.avgPrice));
  const minPrice = prices.length ? Math.min(...prices) : 0;
  const maxPrice = prices.length ? Math.max(...prices) : 1;
  const priceRange = maxPrice - minPrice || 1;

  const getX = useCallback((i: number) => padding.left + (i / Math.max(data.length - 1, 1)) * chartW, [data.length, chartW]);
  const getY = useCallback((price: number) => padding.top + chartH - ((price - minPrice) / priceRange) * chartH, [minPrice, priceRange, chartH]);

  const linePath = data.map((d, i) => {
    const x = getX(i);
    const y = getY(Number(d.avgPrice));
    return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
  }).join(' ');

  const areaPath = data.length > 0
    ? linePath + ` L ${getX(data.length - 1)} ${padding.top + chartH} L ${padding.left} ${padding.top + chartH} Z`
    : '';

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current || data.length === 0) return;
    const rect = svgRef.current.getBoundingClientRect();
    const mouseX = ((e.clientX - rect.left) / rect.width) * width;

    // Find nearest data point
    let nearestIdx = 0;
    let nearestDist = Infinity;
    for (let i = 0; i < data.length; i++) {
      const dist = Math.abs(getX(i) - mouseX);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestIdx = i;
      }
    }

    setHover({ index: nearestIdx, x: getX(nearestIdx), y: getY(Number(data[nearestIdx].avgPrice)) });
  }, [data, getX, getY]);

  const hoveredPoint = hover !== null ? data[hover.index] : null;

  return (
    <div className="rounded-xl border border-[#1a1a1a] bg-[#0d0d14]/50 p-4">
      {/* Period selector */}
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-neutral-300">Price History</h3>
        <div className="flex gap-1">
          {PERIODS.map(p => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`rounded-md px-2.5 py-1 text-xs transition-colors ${
                period === p.value
                  ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                  : 'text-neutral-500 hover:text-neutral-300'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex h-[200px] items-center justify-center">
          <p className="text-sm text-neutral-500">Loading...</p>
        </div>
      ) : data.length === 0 ? (
        <div className="flex h-[200px] items-center justify-center">
          <p className="text-sm text-neutral-500">No price history yet</p>
        </div>
      ) : (
        <div className="relative">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${width} ${height}`}
            className="w-full"
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setHover(null)}
          >
            {/* Gradient definition */}
            <defs>
              <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgb(245 158 11)" stopOpacity="0.2" />
                <stop offset="100%" stopColor="rgb(245 158 11)" stopOpacity="0" />
              </linearGradient>
            </defs>

            {/* Area fill */}
            <path d={areaPath} fill="url(#areaGradient)" />

            {/* Line */}
            <path d={linePath} fill="none" stroke="rgb(245 158 11)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

            {/* Y-axis labels (prices) */}
            <text x={width - 5} y={padding.top + 4} textAnchor="end" className="fill-neutral-600 text-[10px]">
              {formatPrice(maxPrice)}
            </text>
            <text x={width - 5} y={padding.top + chartH} textAnchor="end" className="fill-neutral-600 text-[10px]">
              {formatPrice(minPrice)}
            </text>

            {/* X-axis labels (dates) — show first, middle, last */}
            {data.length > 0 && (
              <>
                <text x={getX(0)} y={height - 5} textAnchor="start" className="fill-neutral-600 text-[10px]">
                  {formatDate(data[0].timestamp, period)}
                </text>
                {data.length > 2 && (
                  <text x={getX(Math.floor(data.length / 2))} y={height - 5} textAnchor="middle" className="fill-neutral-600 text-[10px]">
                    {formatDate(data[Math.floor(data.length / 2)].timestamp, period)}
                  </text>
                )}
                <text x={getX(data.length - 1)} y={height - 5} textAnchor="end" className="fill-neutral-600 text-[10px]">
                  {formatDate(data[data.length - 1].timestamp, period)}
                </text>
              </>
            )}

            {/* Hover indicator */}
            {hover && (
              <>
                <line x1={hover.x} y1={padding.top} x2={hover.x} y2={padding.top + chartH} stroke="rgb(163 163 163)" strokeWidth="1" strokeDasharray="4 2" opacity="0.3" />
                <circle cx={hover.x} cy={hover.y} r="4" fill="rgb(245 158 11)" stroke="#0d0d14" strokeWidth="2" />
              </>
            )}
          </svg>

          {/* Tooltip */}
          {hoveredPoint && hover && (
            <div
              className="pointer-events-none absolute rounded-lg border border-[#1a1a1a] bg-[#0d0d14] px-3 py-2 text-xs shadow-xl"
              style={{
                left: `${(hover.x / width) * 100}%`,
                top: '0',
                transform: 'translateX(-50%)',
              }}
            >
              <p className="text-neutral-400">{formatDate(hoveredPoint.timestamp, period)}</p>
              <p className="text-amber-400">Avg: ${formatPrice(Number(hoveredPoint.avgPrice))}</p>
              <p className="text-neutral-500">
                Min: ${formatPrice(Number(hoveredPoint.minPrice))} · Max: ${formatPrice(Number(hoveredPoint.maxPrice))}
              </p>
              <p className="text-neutral-500">{hoveredPoint.volume} items · {hoveredPoint.fills} fills</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
