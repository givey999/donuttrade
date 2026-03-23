'use client';

import { useState, useEffect, useCallback } from 'react';
import { RequireAuth } from '@/lib/require-auth';
import { useAuth } from '@/lib/auth';
import { apiFetch, ApiError } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { Table, Thead, Tbody, Th, Td } from '@/components/ui/table';
import { Pagination } from '@/components/ui/pagination';
import { FadeIn } from '@/components/ui/animate';
import { CosmeticsSection } from './cosmetics-section';
import type { TransactionRecord, TransactionType, PaginationMeta, InventoryItemRecord } from '@donuttrade/shared';

const DEPOSIT_BOT_NAME = process.env.NEXT_PUBLIC_DEPOSIT_BOT_NAME || 'DonutTradeDeposit';
const DEPOSIT_MIN = 1;
const DEPOSIT_MAX = 10_000_000;
const WITHDRAWAL_MIN = 1;
const WITHDRAWAL_MAX = 10_000_000;
const DISCORD_INVITE_URL = process.env.NEXT_PUBLIC_DISCORD_INVITE_URL || '#';

interface CatalogItem {
  id: string;
  displayName: string;
  name: string;
  category: string;
  enabled: boolean;
}

// ─── Deposit Modal ─────────────────────────────────────────────────────────────

function DepositModal({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<'money' | 'items'>('money');
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);
  const [selectedItemId, setSelectedItemId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [codeExpiresAt, setCodeExpiresAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (tab === 'items' && catalogItems.length === 0) {
      apiFetch<{ data: CatalogItem[] }>('/catalog/items')
        .then((res) => {
          const enabled = res.data.filter((i) => i.enabled);
          setCatalogItems(enabled);
          if (enabled.length > 0) setSelectedItemId(enabled[0].id);
        })
        .catch(() => setError('Failed to load catalog items'));
    }
  }, [tab]);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<{ data: { code: string; codeExpiresAt: string } }>('/item-deposits', {
        method: 'POST',
        body: JSON.stringify({ catalogItemId: selectedItemId, quantity: parseInt(quantity, 10) || 1 }),
      });
      setGeneratedCode(res.data.code);
      setCodeExpiresAt(res.data.codeExpiresAt);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to generate code');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (generatedCode) {
      navigator.clipboard.writeText(generatedCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Modal onClose={onClose}>
      <h3 className="text-lg font-semibold">Deposit</h3>

      {/* Tab switcher */}
      <div className="mt-3 flex gap-1 border-b border-neutral-800">
        <button
          onClick={() => { setTab('money'); setGeneratedCode(null); setError(null); }}
          className={`px-3 py-1.5 text-xs font-medium rounded-t ${tab === 'money' ? 'bg-white/5 text-amber-400' : 'text-neutral-500'}`}
        >
          Deposit Money
        </button>
        <button
          onClick={() => { setTab('items'); setGeneratedCode(null); setError(null); }}
          className={`px-3 py-1.5 text-xs font-medium rounded-t ${tab === 'items' ? 'bg-white/5 text-amber-400' : 'text-neutral-500'}`}
        >
          Deposit Items
        </button>
      </div>

      {tab === 'money' ? (
        <>
          <p className="mt-3 text-sm text-neutral-400">Send money to the deposit bot in-game:</p>
          <div className="mt-3 rounded-lg border border-[#1a1a1a] bg-white/[0.03] p-3">
            <code className="text-sm text-amber-400">/pay {DEPOSIT_BOT_NAME} &lt;amount&gt;</code>
          </div>
          <div className="mt-4 space-y-2 text-xs text-neutral-500">
            <p>Min: ${DEPOSIT_MIN.toLocaleString()} &mdash; Max: ${DEPOSIT_MAX.toLocaleString()}</p>
            <p>Your balance updates automatically after payment.</p>
            <p>Amounts over the limit will be refunded in full.</p>
          </div>
          <Button variant="secondary" className="mt-5 w-full" onClick={onClose}>Close</Button>
        </>
      ) : generatedCode ? (
        <>
          <p className="mt-3 text-sm font-semibold text-neutral-200">Your Deposit Code</p>
          <div className="mt-2 flex items-center gap-2">
            <div className="flex-1 rounded-lg border border-neutral-700 bg-white/[0.03] p-2.5 overflow-hidden">
              <code className="text-xs text-sky-300 break-all">{generatedCode}</code>
            </div>
            <button onClick={handleCopy} className="shrink-0 rounded-lg border border-neutral-700 bg-white/[0.03] p-2.5 text-neutral-400 hover:text-white" title="Copy">
              {copied ? '✓' : '📋'}
            </button>
          </div>
          <p className="mt-1.5 text-xs text-amber-500/80">This code expires in ~3 hours</p>
          <div className="mt-3 rounded-lg border border-indigo-500/30 bg-indigo-500/10 p-3">
            <p className="text-xs font-semibold text-neutral-300">Next steps:</p>
            <ol className="mt-1 list-decimal pl-4 text-xs text-neutral-400 space-y-0.5">
              <li>Copy this code</li>
              <li>Go to our Discord server</li>
              <li>Click &quot;Deposit Items&quot; in #create-ticket</li>
              <li>Paste your code in the popup</li>
            </ol>
          </div>
          <div className="mt-4 flex gap-2">
            <a href={DISCORD_INVITE_URL} target="_blank" rel="noopener noreferrer" className="flex-1">
              <Button className="w-full bg-indigo-600 hover:bg-indigo-700">Open Discord</Button>
            </a>
            <Button variant="secondary" className="flex-1" onClick={onClose}>Close</Button>
          </div>
        </>
      ) : (
        <>
          <div className="mt-3">
            <label className="block text-xs text-neutral-400">Item</label>
            <select
              value={selectedItemId}
              onChange={(e) => setSelectedItemId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-neutral-700 bg-white/[0.03] px-3 py-2 text-sm text-neutral-200"
            >
              {catalogItems.map((item) => (
                <option key={item.id} value={item.id}>{item.displayName}</option>
              ))}
            </select>
          </div>
          <div className="mt-3">
            <label className="block text-xs text-neutral-400">Quantity</label>
            <Input
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="mt-1"
            />
          </div>
          {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
          <Button onClick={handleGenerate} disabled={loading || !selectedItemId} className="mt-4 w-full">
            {loading ? 'Generating...' : 'Generate Deposit Code'}
          </Button>
          <Button variant="secondary" className="mt-2 w-full" onClick={onClose}>Cancel</Button>
        </>
      )}
    </Modal>
  );
}

// ─── Withdraw Modal ────────────────────────────────────────────────────────────

function WithdrawModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [tab, setTab] = useState<'money' | 'items'>('money');

  // ── Money tab state ──
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);

  // ── Items tab state ──
  const [inventoryItems, setInventoryItems] = useState<InventoryItemRecord[]>([]);
  const [selectedItemId, setSelectedItemId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [itemLoading, setItemLoading] = useState(false);
  const [itemError, setItemError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Countdown timer for money cooldown
  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const timer = setInterval(() => {
      setCooldownSeconds((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldownSeconds]);

  // Load inventory when items tab is selected
  useEffect(() => {
    if (tab === 'items' && inventoryItems.length === 0) {
      apiFetch<{ items: InventoryItemRecord[] }>('/inventory')
        .then((data) => {
          const available = data.items.filter((i) => i.availableQuantity > 0);
          setInventoryItems(available);
          if (available.length > 0) setSelectedItemId(available[0].catalogItemId);
        })
        .catch(() => setItemError('Failed to load inventory'));
    }
  }, [tab]);

  const formatCooldown = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleMoneySubmit = useCallback(async () => {
    const num = parseFloat(amount);
    if (isNaN(num) || num < WITHDRAWAL_MIN || num > WITHDRAWAL_MAX) {
      setError(`Amount must be between $${WITHDRAWAL_MIN.toLocaleString()} and $${WITHDRAWAL_MAX.toLocaleString()}`);
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      await apiFetch<{ id: string; amount: string }>('/withdrawals', {
        method: 'POST',
        body: JSON.stringify({ amount: num }),
      });
      setSuccess(`Withdrawal requested! The bot will send you $${num.toLocaleString()} in-game shortly.`);
      setAmount('');
      onSuccess();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === 'WITHDRAWAL_COOLDOWN') {
          const secs = typeof err.details?.retryAfter === 'number'
            ? err.details.retryAfter
            : 300;
          setCooldownSeconds(secs);
          setError(`Cooldown active. Try again in ${formatCooldown(secs)}.`);
        } else {
          setError(err.message);
        }
      } else {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }, [amount]);

  const handleItemGenerate = async () => {
    setItemLoading(true);
    setItemError(null);
    try {
      const res = await apiFetch<{ data: { code: string; codeExpiresAt: string } }>('/item-withdrawals', {
        method: 'POST',
        body: JSON.stringify({ catalogItemId: selectedItemId, quantity: parseInt(quantity, 10) || 1 }),
      });
      setGeneratedCode(res.data.code);
    } catch (err) {
      setItemError(err instanceof ApiError ? err.message : 'Failed to generate code');
    } finally {
      setItemLoading(false);
    }
  };

  const handleCopy = () => {
    if (generatedCode) {
      navigator.clipboard.writeText(generatedCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const selectedItem = inventoryItems.find((i) => i.catalogItemId === selectedItemId);
  const maxQty = selectedItem?.availableQuantity ?? 1;

  return (
    <Modal onClose={onClose}>
      <h3 className="text-lg font-semibold">Withdraw</h3>

      {/* Tab switcher */}
      <div className="mt-3 flex gap-1 border-b border-neutral-800">
        <button
          onClick={() => { setTab('money'); setGeneratedCode(null); setItemError(null); }}
          className={`px-3 py-1.5 text-xs font-medium rounded-t ${tab === 'money' ? 'bg-white/5 text-amber-400' : 'text-neutral-500'}`}
        >
          Withdraw Money
        </button>
        <button
          onClick={() => { setTab('items'); setGeneratedCode(null); setItemError(null); }}
          className={`px-3 py-1.5 text-xs font-medium rounded-t ${tab === 'items' ? 'bg-white/5 text-amber-400' : 'text-neutral-500'}`}
        >
          Withdraw Items
        </button>
      </div>

      {tab === 'money' ? (
        success ? (
          <>
            <p className="mt-3 text-sm text-green-400">{success}</p>
            <Button variant="secondary" className="mt-5 w-full" onClick={onClose}>Close</Button>
          </>
        ) : (
          <>
            <p className="mt-3 text-xs text-neutral-500">
              Min: ${WITHDRAWAL_MIN.toLocaleString()} &mdash; Max: ${WITHDRAWAL_MAX.toLocaleString()}
            </p>

            <div className="mt-3">
              <label htmlFor="wd-amount" className="block text-xs text-neutral-400">Amount</label>
              <div className="relative mt-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-neutral-500">$</span>
                <Input
                  id="wd-amount"
                  type="number"
                  min={WITHDRAWAL_MIN}
                  max={WITHDRAWAL_MAX}
                  step="1"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  disabled={loading || cooldownSeconds > 0}
                  placeholder="0"
                  className="pl-7"
                />
              </div>
            </div>

            {cooldownSeconds > 0 && (
              <p className="mt-2 text-xs text-amber-400">
                Cooldown: try again in {formatCooldown(cooldownSeconds)}
              </p>
            )}

            {error && !cooldownSeconds && (
              <p className="mt-2 text-xs text-red-400">{error}</p>
            )}

            <Button
              onClick={handleMoneySubmit}
              disabled={loading || cooldownSeconds > 0 || !amount}
              className="mt-4 w-full"
            >
              {loading ? 'Requesting...' : 'Withdraw'}
            </Button>

            <Button variant="secondary" className="mt-2 w-full" onClick={onClose}>Cancel</Button>
          </>
        )
      ) : generatedCode ? (
        <>
          <p className="mt-3 text-sm font-semibold text-neutral-200">Your Withdrawal Code</p>
          <div className="mt-2 flex items-center gap-2">
            <div className="flex-1 rounded-lg border border-neutral-700 bg-white/[0.03] p-2.5 overflow-hidden">
              <code className="text-xs text-sky-300 break-all">{generatedCode}</code>
            </div>
            <button onClick={handleCopy} className="shrink-0 rounded-lg border border-neutral-700 bg-white/[0.03] p-2.5 text-neutral-400 hover:text-white" title="Copy">
              {copied ? '✓' : '📋'}
            </button>
          </div>
          <p className="mt-1.5 text-xs text-amber-500/80">This code expires in ~3 hours</p>
          <div className="mt-3 rounded-lg border border-indigo-500/30 bg-indigo-500/10 p-3">
            <p className="text-xs font-semibold text-neutral-300">Next steps:</p>
            <ol className="mt-1 list-decimal pl-4 text-xs text-neutral-400 space-y-0.5">
              <li>Copy this code</li>
              <li>Go to our Discord server</li>
              <li>Click &quot;Withdraw Items&quot; in #create-ticket</li>
              <li>Paste your code in the popup</li>
            </ol>
          </div>
          <div className="mt-4 flex gap-2">
            <a href={DISCORD_INVITE_URL} target="_blank" rel="noopener noreferrer" className="flex-1">
              <Button className="w-full bg-indigo-600 hover:bg-indigo-700">Open Discord</Button>
            </a>
            <Button variant="secondary" className="flex-1" onClick={onClose}>Close</Button>
          </div>
        </>
      ) : (
        <>
          <div className="mt-3">
            <label className="block text-xs text-neutral-400">Item</label>
            <select
              value={selectedItemId}
              onChange={(e) => { setSelectedItemId(e.target.value); setQuantity('1'); }}
              className="mt-1 w-full rounded-lg border border-neutral-700 bg-white/[0.03] px-3 py-2 text-sm text-neutral-200"
            >
              {inventoryItems.map((item) => (
                <option key={item.catalogItemId} value={item.catalogItemId}>
                  {item.catalogItemDisplayName} ({item.availableQuantity} available)
                </option>
              ))}
            </select>
          </div>
          <div className="mt-3">
            <label className="block text-xs text-neutral-400">Quantity (max: {maxQty})</label>
            <Input
              type="number"
              min={1}
              max={maxQty}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="mt-1"
            />
          </div>
          {itemError && <p className="mt-2 text-xs text-red-400">{itemError}</p>}
          <Button onClick={handleItemGenerate} disabled={itemLoading || !selectedItemId} className="mt-4 w-full">
            {itemLoading ? 'Generating...' : 'Generate Withdrawal Code'}
          </Button>
          <Button variant="secondary" className="mt-2 w-full" onClick={onClose}>Cancel</Button>
        </>
      )}
    </Modal>
  );
}

// ─── Inventory Section ────────────────────────────────────────────────────────

function InventorySection() {
  const [items, setItems] = useState<InventoryItemRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<{ items: InventoryItemRecord[] }>('/inventory')
      .then((data) => setItems(data.items))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="mt-6 text-sm text-neutral-500">Loading inventory...</p>;

  return (
    <FadeIn delay={200} className="mt-8">
      <h3 className="text-lg font-semibold">Inventory</h3>
      {items.length === 0 ? (
        <Card className="mt-3 p-8 text-center">
          <p className="text-sm text-neutral-500">No items yet — deposit spawners in-game to get started</p>
        </Card>
      ) : (
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {items.map((item) => (
            <Card key={item.id} hover className="p-4">
              <p className="text-sm font-semibold">{item.catalogItemDisplayName}</p>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-extrabold text-green-400">{item.availableQuantity}</span>
                {item.reservedQuantity > 0 && (
                  <span className="text-xs text-amber-400">({item.reservedQuantity} reserved)</span>
                )}
              </div>
              <Badge variant="neutral" className="mt-2">
                {(item as { category?: string }).category ?? 'item'}
              </Badge>
            </Card>
          ))}
        </div>
      )}
    </FadeIn>
  );
}

// ─── Transaction History ──────────────────────────────────────────────────────

const TYPE_BADGE_VARIANT: Record<TransactionType, string> = {
  deposit: 'success',
  withdrawal: 'danger',
  purchase: 'info',
  sale: 'amber',
  escrow: 'purple',
  escrow_refund: 'success',
  listing_fee: 'neutral',
  admin_adjustment: 'warning',
  cosmetic_purchase: 'purple',
  hidden_mode_purchase: 'purple',
};

function TransactionHistory() {
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    apiFetch<{ transactions: TransactionRecord[]; meta: PaginationMeta }>(
      `/transactions?page=${page}&perPage=10`,
    )
      .then((data) => {
        if (cancelled) return;
        setTransactions(data.transactions);
        setMeta(data.meta);
      })
      .catch(() => {
        if (cancelled) return;
        setTransactions([]);
        setMeta(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [page]);

  return (
    <FadeIn delay={300} className="mt-8">
      <h3 className="text-lg font-semibold">Transaction History</h3>

      {loading ? (
        <p className="mt-3 text-sm text-neutral-500">Loading...</p>
      ) : transactions.length === 0 ? (
        <p className="mt-3 text-sm text-neutral-500">No transactions yet.</p>
      ) : (
        <>
          <div className="mt-3">
            <Table>
              <Thead>
                <tr>
                  <Th>Date</Th>
                  <Th>Type</Th>
                  <Th>Description</Th>
                  <Th className="text-right">Amount</Th>
                  <Th className="text-right">Balance</Th>
                </tr>
              </Thead>
              <Tbody>
                {transactions.map((tx) => {
                  const isPositive = tx.type === 'deposit' || tx.type === 'sale';
                  return (
                    <tr key={tx.id}>
                      <Td className="whitespace-nowrap text-xs text-neutral-500">
                        {new Date(tx.createdAt).toLocaleDateString()}
                      </Td>
                      <Td>
                        <Badge variant={TYPE_BADGE_VARIANT[tx.type] as 'success'}>
                          {tx.type}
                        </Badge>
                      </Td>
                      <Td className="text-xs text-neutral-400">
                        {tx.description || '—'}
                      </Td>
                      <Td className={`whitespace-nowrap text-right text-xs font-medium ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                        {isPositive ? '+' : '-'}${Number(tx.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </Td>
                      <Td className="whitespace-nowrap text-right text-xs text-neutral-400">
                        ${Number(tx.balanceAfter).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </Td>
                    </tr>
                  );
                })}
              </Tbody>
            </Table>
          </div>

          {meta && <Pagination page={meta.page} totalPages={meta.totalPages} onPageChange={setPage} nextCursor={meta.nextCursor} prevCursor={meta.prevCursor} />}
        </>
      )}
    </FadeIn>
  );
}

// ─── Dashboard Content ─────────────────────────────────────────────────────────

function DashboardContent() {
  const { user, logout, refreshUser, isTimedOut } = useAuth();
  const [showDeposit, setShowDeposit] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);

  if (!user) return null;

  const balance = Number(user.balance);
  const formattedBalance = Number.isFinite(balance)
    ? balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '0.00';

  const isVerified = user.verificationStatus === 'verified';

  const verificationVariant = user.verificationStatus === 'verified' ? 'success'
    : user.verificationStatus === 'expired' ? 'danger' : 'warning';

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      {/* Balance Hero */}
      <FadeIn>
        <div className="relative overflow-hidden">
          <Card className="p-8 text-center">
            {/* Glow behind balance */}
            <div
              className="pointer-events-none absolute left-1/2 top-0 h-40 w-80 -translate-x-1/2"
              style={{ background: 'radial-gradient(ellipse, rgba(34,197,94,0.08) 0%, transparent 70%)' }}
            />
            <p className="text-xs text-neutral-500">Your Balance</p>
            <p className="mt-2 text-4xl font-extrabold text-green-400">
              ${formattedBalance}
            </p>

            {/* Deposit / Withdraw buttons */}
            {isVerified && (
              <div className="mt-6 flex justify-center gap-3">
                <Button onClick={() => setShowDeposit(true)} disabled={isTimedOut}>
                  Deposit
                </Button>
                <Button variant="secondary" onClick={() => setShowWithdraw(true)} disabled={isTimedOut}>
                  Withdraw
                </Button>
              </div>
            )}
          </Card>
        </div>
      </FadeIn>

      {/* Stats row */}
      <FadeIn delay={100}>
        <div className="mt-4 grid grid-cols-3 gap-3">
          <Card className="p-4 text-center">
            <p className="text-[10px] uppercase tracking-wider text-neutral-600">Verification</p>
            <div className="mt-1.5">
              <Badge variant={verificationVariant}>
                {user.verificationStatus}
              </Badge>
            </div>
          </Card>
          <Card className="p-4 text-center">
            <p className="text-[10px] uppercase tracking-wider text-neutral-600">Member Since</p>
            <p className="mt-1.5 text-sm font-medium">{new Date(user.createdAt).toLocaleDateString()}</p>
          </Card>
          <Card className="p-4 text-center">
            <p className="text-[10px] uppercase tracking-wider text-neutral-600">Auth Provider</p>
            <p className="mt-1.5 text-sm font-medium capitalize">{user.authProvider}</p>
          </Card>
        </div>
      </FadeIn>

      {/* Inventory */}
      {isVerified && <InventorySection />}

      {/* Cosmetics */}
      {isVerified && <CosmeticsSection />}

      {/* Transaction history */}
      <TransactionHistory />

      {/* Modals */}
      {showDeposit && <DepositModal onClose={() => setShowDeposit(false)} />}
      {showWithdraw && <WithdrawModal onClose={() => setShowWithdraw(false)} onSuccess={refreshUser} />}
    </main>
  );
}

export default function DashboardPage() {
  return (
    <RequireAuth>
      <DashboardContent />
    </RequireAuth>
  );
}
