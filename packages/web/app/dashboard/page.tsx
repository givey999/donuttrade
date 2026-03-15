'use client';

import { useState, useEffect, useCallback } from 'react';
import { RequireAuth } from '@/lib/require-auth';
import { useAuth } from '@/lib/auth';
import { apiFetch, ApiError } from '@/lib/api';
import type { TransactionRecord, TransactionType, PaginationMeta, InventoryItemRecord } from '@donuttrade/shared';

const DEPOSIT_BOT_NAME = process.env.NEXT_PUBLIC_DEPOSIT_BOT_NAME || 'DonutTradeDeposit';
const DEPOSIT_MIN = 1;
const DEPOSIT_MAX = 10_000_000;
const WITHDRAWAL_MIN = 1;
const WITHDRAWAL_MAX = 10_000_000;

function VerificationBadge({ status }: { status: string }) {
  if (status === 'verified') {
    return (
      <span className="inline-flex items-center rounded-full border border-green-900/50 bg-green-950/20 px-2.5 py-0.5 text-xs font-medium text-green-400">
        Verified
      </span>
    );
  }
  if (status === 'expired') {
    return (
      <span className="inline-flex items-center rounded-full border border-red-900/50 bg-red-950/20 px-2.5 py-0.5 text-xs font-medium text-red-400">
        Expired
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full border border-amber-900/50 bg-amber-950/20 px-2.5 py-0.5 text-xs font-medium text-amber-400">
      Pending
    </span>
  );
}

// ─── Deposit Modal ─────────────────────────────────────────────────────────────

function DepositModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-xl border border-neutral-800 bg-neutral-900/95 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold">Deposit</h3>
        <p className="mt-3 text-sm text-neutral-400">
          Send money to the deposit bot in-game:
        </p>

        <div className="mt-3 rounded-lg border border-neutral-700 bg-neutral-950/50 p-3">
          <code className="text-sm text-green-400">
            /pay {DEPOSIT_BOT_NAME} &lt;amount&gt;
          </code>
        </div>

        <div className="mt-4 space-y-2 text-xs text-neutral-500">
          <p>Min: ${DEPOSIT_MIN.toLocaleString()} &mdash; Max: ${DEPOSIT_MAX.toLocaleString()}</p>
          <p>Your balance updates automatically after payment.</p>
          <p>Amounts over the limit will be refunded in full.</p>
        </div>

        <button
          onClick={onClose}
          className="mt-5 w-full rounded-lg border border-neutral-700 bg-neutral-800/50 px-4 py-2 text-sm text-neutral-300 transition-colors hover:bg-neutral-700"
        >
          Close
        </button>
      </div>
    </div>
  );
}

// ─── Withdraw Modal ────────────────────────────────────────────────────────────

function WithdrawModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);

  // Countdown timer for cooldown
  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const timer = setInterval(() => {
      setCooldownSeconds((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldownSeconds]);

  const formatCooldown = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleSubmit = useCallback(async () => {
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
      onSuccess(); // Refresh user profile to update balance
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === 'WITHDRAWAL_COOLDOWN') {
          // Read retryAfter from structured error details
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-xl border border-neutral-800 bg-neutral-900/95 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold">Withdraw</h3>

        {success ? (
          <>
            <p className="mt-3 text-sm text-green-400">{success}</p>
            <button
              onClick={onClose}
              className="mt-5 w-full rounded-lg border border-neutral-700 bg-neutral-800/50 px-4 py-2 text-sm text-neutral-300 transition-colors hover:bg-neutral-700"
            >
              Close
            </button>
          </>
        ) : (
          <>
            <p className="mt-3 text-xs text-neutral-500">
              Min: ${WITHDRAWAL_MIN.toLocaleString()} &mdash; Max: ${WITHDRAWAL_MAX.toLocaleString()}
            </p>

            <div className="mt-3">
              <label htmlFor="wd-amount" className="block text-xs text-neutral-400">
                Amount
              </label>
              <div className="relative mt-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-neutral-500">$</span>
                <input
                  id="wd-amount"
                  type="number"
                  min={WITHDRAWAL_MIN}
                  max={WITHDRAWAL_MAX}
                  step="1"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  disabled={loading || cooldownSeconds > 0}
                  placeholder="0"
                  className="w-full rounded-lg border border-neutral-700 bg-neutral-950/50 py-2 pl-7 pr-3 text-sm text-white placeholder-neutral-600 focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600 disabled:opacity-50"
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

            <button
              onClick={handleSubmit}
              disabled={loading || cooldownSeconds > 0 || !amount}
              className="mt-4 w-full rounded-lg bg-green-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-green-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? 'Requesting...' : 'Withdraw'}
            </button>

            <button
              onClick={onClose}
              className="mt-2 w-full rounded-lg border border-neutral-700 bg-neutral-800/50 px-4 py-2 text-sm text-neutral-300 transition-colors hover:bg-neutral-700"
            >
              Cancel
            </button>
          </>
        )}
      </div>
    </div>
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
  if (items.length === 0) return null;

  return (
    <div className="mt-6">
      <h3 className="text-sm font-medium text-neutral-400">Inventory</h3>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {items.map((item) => (
          <div
            key={item.id}
            className="rounded-lg border border-neutral-800 bg-neutral-950/50 p-3"
          >
            <p className="text-sm font-medium">{item.catalogItemDisplayName}</p>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-lg font-bold text-green-400">{item.availableQuantity}</span>
              {item.reservedQuantity > 0 && (
                <span className="text-xs text-neutral-500">({item.reservedQuantity} reserved)</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Transaction History ──────────────────────────────────────────────────────

const TYPE_BADGE: Record<TransactionType, string> = {
  deposit: 'border-green-900/50 bg-green-950/20 text-green-400',
  withdrawal: 'border-red-900/50 bg-red-950/20 text-red-400',
  purchase: 'border-blue-900/50 bg-blue-950/20 text-blue-400',
  sale: 'border-amber-900/50 bg-amber-950/20 text-amber-400',
  escrow: 'border-purple-900/50 bg-purple-950/20 text-purple-400',
  escrow_refund: 'border-green-900/50 bg-green-950/20 text-green-400',
  listing_fee: 'border-neutral-700 bg-neutral-800/50 text-neutral-400',
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
    <div className="mt-6">
      <h3 className="text-sm font-medium text-neutral-400">Transaction History</h3>

      {loading ? (
        <p className="mt-3 text-sm text-neutral-500">Loading...</p>
      ) : transactions.length === 0 ? (
        <p className="mt-3 text-sm text-neutral-500">No transactions yet.</p>
      ) : (
        <>
          <div className="mt-3 overflow-x-auto rounded-lg border border-neutral-800">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-neutral-800 bg-neutral-950/50 text-xs text-neutral-400">
                <tr>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Description</th>
                  <th className="px-3 py-2 text-right">Amount</th>
                  <th className="px-3 py-2 text-right">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/50">
                {transactions.map((tx) => {
                  const isPositive = tx.type === 'deposit' || tx.type === 'sale';
                  return (
                    <tr key={tx.id} className="text-neutral-300">
                      <td className="whitespace-nowrap px-3 py-2 text-xs text-neutral-500">
                        {new Date(tx.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-3 py-2">
                        <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${TYPE_BADGE[tx.type]}`}>
                          {tx.type}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs text-neutral-400">
                        {tx.description || '—'}
                      </td>
                      <td className={`whitespace-nowrap px-3 py-2 text-right text-xs font-medium ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                        {isPositive ? '+' : '-'}${Number(tx.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-right text-xs text-neutral-400">
                        ${Number(tx.balanceAfter).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {meta && meta.totalPages > 1 && (
            <div className="mt-3 flex items-center justify-between text-xs text-neutral-500">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="rounded border border-neutral-700 px-2.5 py-1 transition-colors hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Previous
              </button>
              <span>Page {meta.page} of {meta.totalPages}</span>
              <button
                onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
                disabled={page >= meta.totalPages}
                className="rounded border border-neutral-700 px-2.5 py-1 transition-colors hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Dashboard Content ─────────────────────────────────────────────────────────

function DashboardContent() {
  const { user, logout, refreshUser } = useAuth();
  const [showDeposit, setShowDeposit] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);

  if (!user) return null;

  const balance = Number(user.balance);
  const formattedBalance = Number.isFinite(balance)
    ? balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '0.00';

  const isVerified = user.verificationStatus === 'verified';

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight">DonutTrade</h1>
          <p className="mt-2 text-sm text-neutral-400">Dashboard</p>
        </div>

        {/* Profile card */}
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-6 shadow-lg backdrop-blur-sm">
          {/* Username + verification */}
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              {user.minecraftUsername ?? 'Unknown Player'}
            </h2>
            <VerificationBadge status={user.verificationStatus} />
          </div>

          {/* Balance */}
          <div className="mt-6 rounded-lg border border-neutral-800 bg-neutral-950/50 p-4 text-center">
            <p className="text-xs text-neutral-400">Balance</p>
            <p className="mt-1 text-2xl font-bold text-green-400">
              ${formattedBalance}
            </p>
          </div>

          {/* Deposit / Withdraw buttons */}
          {isVerified && (
            <div className="mt-4 grid grid-cols-2 gap-3">
              <button
                onClick={() => setShowDeposit(true)}
                className="rounded-lg bg-green-600/20 border border-green-800/50 px-4 py-2 text-sm font-medium text-green-400 transition-colors hover:bg-green-600/30"
              >
                Deposit
              </button>
              <button
                onClick={() => setShowWithdraw(true)}
                className="rounded-lg border border-neutral-700 bg-neutral-800/30 px-4 py-2 text-sm font-medium text-neutral-300 transition-colors hover:bg-neutral-700"
              >
                Withdraw
              </button>
            </div>
          )}

          {/* Inventory */}
          {isVerified && <InventorySection />}

          {/* Transaction history */}
          <TransactionHistory />

          {/* Account details */}
          <div className="mt-6 space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-neutral-400">Auth provider</span>
              <span className="capitalize">{user.authProvider}</span>
            </div>
            {user.email && (
              <div className="flex justify-between">
                <span className="text-neutral-400">Email</span>
                <span className="truncate ml-4">{user.email}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-neutral-400">Member since</span>
              <span>{new Date(user.createdAt).toLocaleDateString()}</span>
            </div>
          </div>

          {/* Sign out */}
          <div className="mt-6 border-t border-neutral-800 pt-6">
            <button
              onClick={logout}
              className="w-full rounded-lg border border-neutral-800 bg-neutral-800/30 px-4 py-2.5 text-sm text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-white"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>

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
