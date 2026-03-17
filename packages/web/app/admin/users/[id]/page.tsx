'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { apiFetch } from '@/lib/api';
import { TIMEOUT_PRESET_DURATIONS } from '@donuttrade/shared';

interface UserDetail {
  id: string;
  minecraftUsername: string | null;
  email: string | null;
  authProvider: string;
  balance: string;
  role: string;
  verificationStatus: string;
  bannedAt: string | null;
  banReason: string | null;
  timedOutUntil: string | null;
  timeoutReason: string | null;
  createdAt: string;
  lastLoginAt: string | null;
  recentTransactions: Array<{ id: string; type: string; amount: string; description: string | null; createdAt: string }>;
  recentOrders: Array<{ id: string; type: string; catalogItemDisplayName: string; quantity: number; filledQuantity: number; pricePerUnit: string; status: string; createdAt: string }>;
  recentDeposits: Array<{ id: string; catalogItemDisplayName: string; quantity: number; status: string; createdAt: string }>;
  recentWithdrawals: Array<{ id: string; catalogItemDisplayName: string; quantity: number; status: string; createdAt: string }>;
}

const ROLE_COLORS: Record<string, string> = {
  admin: 'border-red-900/50 bg-red-950/20 text-red-400',
  manager: 'border-purple-900/50 bg-purple-950/20 text-purple-400',
  moderator: 'border-blue-900/50 bg-blue-950/20 text-blue-400',
  user: 'border-neutral-700 bg-neutral-800/50 text-neutral-400',
};

export default function AdminUserDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user: currentUser } = useAuth();
  const [userDetail, setUserDetail] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [tab, setTab] = useState<'transactions' | 'orders' | 'deposits' | 'withdrawals'>('transactions');

  // Balance adjust state
  const [balanceAmount, setBalanceAmount] = useState('');
  const [balanceDirection, setBalanceDirection] = useState<'add' | 'subtract'>('add');
  const [balanceReason, setBalanceReason] = useState('');
  const [showBalanceModal, setShowBalanceModal] = useState(false);

  // Timeout state
  const [timeoutReason, setTimeoutReason] = useState('');
  const [customTimeoutMs, setCustomTimeoutMs] = useState('');
  const [showTimeoutModal, setShowTimeoutModal] = useState(false);

  const fetchUser = useCallback(() => {
    setLoading(true);
    apiFetch<UserDetail>(`/admin/users/${params.id}`)
      .then(setUserDetail)
      .catch(() => router.push('/admin/users'))
      .finally(() => setLoading(false));
  }, [params.id, router]);

  useEffect(() => { fetchUser(); }, [fetchUser]);

  if (loading) return <p className="text-sm text-neutral-400">Loading...</p>;
  if (!userDetail) return <p className="text-sm text-red-400">User not found.</p>;

  const isAdmin = currentUser?.role === 'admin';
  const isManagerOrAdmin = currentUser?.role === 'admin' || currentUser?.role === 'manager';
  const isSelf = currentUser?.id === userDetail.id;
  const isTimedOut = userDetail.timedOutUntil && new Date(userDetail.timedOutUntil) > new Date();
  const isBanned = !!userDetail.bannedAt;

  const doAction = async (path: string, body?: unknown) => {
    setActionLoading(true);
    try {
      await apiFetch(`/admin/users/${params.id}${path}`, {
        method: 'PATCH',
        body: body ? JSON.stringify(body) : '{}',
      });
      fetchUser();
    } catch { /* error handled */ }
    setActionLoading(false);
  };

  const handleBan = async () => {
    const reason = prompt('Ban reason:');
    if (!reason) return;
    await doAction('/ban', { reason });
  };

  const handleTimeout = async (durationMs: number) => {
    await doAction('/timeout', { durationMs, reason: timeoutReason });
    setShowTimeoutModal(false);
    setTimeoutReason('');
    setCustomTimeoutMs('');
  };

  const handleBalanceAdjust = async () => {
    const amount = parseFloat(balanceAmount);
    if (isNaN(amount) || amount <= 0) return;
    await doAction('/balance', { amount, direction: balanceDirection, reason: balanceReason });
    setShowBalanceModal(false);
    setBalanceAmount('');
    setBalanceReason('');
  };

  const handleRoleChange = async (newRole: string) => {
    if (!confirm(`Change role to ${newRole}?`)) return;
    await doAction('/role', { role: newRole });
  };

  return (
    <div className="max-w-4xl">
      <button onClick={() => router.push('/admin/users')} className="mb-4 text-xs text-neutral-500 hover:text-neutral-300">
        &larr; Back to Users
      </button>

      {/* Profile section */}
      <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">{userDetail.minecraftUsername ?? 'Unknown'}</h1>
            <p className="mt-0.5 text-xs text-neutral-500">{userDetail.email ?? 'No email'} &middot; {userDetail.authProvider}</p>
          </div>
          <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${ROLE_COLORS[userDetail.role] ?? ROLE_COLORS.user}`}>
            {userDetail.role}
          </span>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-lg border border-neutral-800 bg-neutral-950/50 p-3 text-center">
            <p className="text-[10px] text-neutral-500">Balance</p>
            <p className="text-lg font-bold text-green-400">${Number(userDetail.balance).toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
          </div>
          <div className="rounded-lg border border-neutral-800 bg-neutral-950/50 p-3 text-center">
            <p className="text-[10px] text-neutral-500">Verification</p>
            <p className="mt-0.5 text-sm capitalize">{userDetail.verificationStatus}</p>
          </div>
          <div className="rounded-lg border border-neutral-800 bg-neutral-950/50 p-3 text-center">
            <p className="text-[10px] text-neutral-500">Joined</p>
            <p className="mt-0.5 text-sm">{new Date(userDetail.createdAt).toLocaleDateString()}</p>
          </div>
          <div className="rounded-lg border border-neutral-800 bg-neutral-950/50 p-3 text-center">
            <p className="text-[10px] text-neutral-500">Last Login</p>
            <p className="mt-0.5 text-sm">{userDetail.lastLoginAt ? new Date(userDetail.lastLoginAt).toLocaleDateString() : '—'}</p>
          </div>
        </div>

        {/* Status alerts */}
        {isBanned && (
          <div className="mt-3 rounded-lg border border-red-900/50 bg-red-950/20 p-3 text-sm text-red-400">
            Banned: {userDetail.banReason || 'No reason'} (since {new Date(userDetail.bannedAt!).toLocaleDateString()})
          </div>
        )}
        {isTimedOut && (
          <div className="mt-3 rounded-lg border border-amber-900/50 bg-amber-950/20 p-3 text-sm text-amber-400">
            Timed out until {new Date(userDetail.timedOutUntil!).toLocaleString()} — {userDetail.timeoutReason || 'No reason'}
          </div>
        )}

        {/* Action buttons */}
        <div className="mt-4 flex flex-wrap gap-2">
          {isAdmin && !isSelf && (
            <button onClick={() => setShowBalanceModal(true)} disabled={actionLoading} className="rounded-lg border border-green-800/50 bg-green-600/10 px-3 py-1.5 text-xs text-green-400 hover:bg-green-600/20 disabled:opacity-50">
              Adjust Balance
            </button>
          )}
          {isAdmin && !isSelf && userDetail.role !== 'admin' && (
            <select
              value=""
              onChange={(e) => { if (e.target.value) handleRoleChange(e.target.value); }}
              disabled={actionLoading}
              className="rounded-lg border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-xs text-neutral-300 disabled:opacity-50"
            >
              <option value="">Change Role...</option>
              {['user', 'moderator', 'manager', 'admin'].filter((r) => r !== userDetail.role).map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          )}
          {isManagerOrAdmin && !isSelf && (
            <>
              {isBanned ? (
                <button onClick={() => doAction('/unban')} disabled={actionLoading} className="rounded-lg border border-green-800/50 bg-green-600/10 px-3 py-1.5 text-xs text-green-400 hover:bg-green-600/20 disabled:opacity-50">
                  Unban
                </button>
              ) : (
                <button onClick={handleBan} disabled={actionLoading} className="rounded-lg border border-red-800/50 bg-red-600/10 px-3 py-1.5 text-xs text-red-400 hover:bg-red-600/20 disabled:opacity-50">
                  Ban
                </button>
              )}
              {isTimedOut ? (
                <button onClick={() => doAction('/remove-timeout')} disabled={actionLoading} className="rounded-lg border border-green-800/50 bg-green-600/10 px-3 py-1.5 text-xs text-green-400 hover:bg-green-600/20 disabled:opacity-50">
                  Remove Timeout
                </button>
              ) : (
                <button onClick={() => setShowTimeoutModal(true)} disabled={actionLoading} className="rounded-lg border border-amber-800/50 bg-amber-600/10 px-3 py-1.5 text-xs text-amber-400 hover:bg-amber-600/20 disabled:opacity-50">
                  Timeout
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Activity tabs */}
      <div className="mt-6">
        <div className="flex gap-1">
          {(['transactions', 'orders', 'deposits', 'withdrawals'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-lg px-3 py-1.5 text-sm capitalize transition-colors ${
                tab === t ? 'bg-neutral-800 text-white' : 'text-neutral-400 hover:bg-neutral-800/50'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="mt-3 overflow-x-auto rounded-lg border border-neutral-800">
          {tab === 'transactions' && (
            <table className="w-full text-left text-sm">
              <thead className="border-b border-neutral-800 bg-neutral-950/50 text-xs text-neutral-400">
                <tr>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Description</th>
                  <th className="px-3 py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/50">
                {userDetail.recentTransactions.length === 0 ? (
                  <tr><td colSpan={4} className="px-3 py-4 text-center text-xs text-neutral-500">No transactions</td></tr>
                ) : userDetail.recentTransactions.map((tx) => (
                  <tr key={tx.id} className="text-neutral-300">
                    <td className="whitespace-nowrap px-3 py-2 text-xs text-neutral-500">{new Date(tx.createdAt).toLocaleDateString()}</td>
                    <td className="px-3 py-2 text-xs capitalize">{tx.type}</td>
                    <td className="px-3 py-2 text-xs text-neutral-400">{tx.description || '—'}</td>
                    <td className="px-3 py-2 text-right text-xs">${Number(tx.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {tab === 'orders' && (
            <table className="w-full text-left text-sm">
              <thead className="border-b border-neutral-800 bg-neutral-950/50 text-xs text-neutral-400">
                <tr>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Item</th>
                  <th className="px-3 py-2 text-right">Qty</th>
                  <th className="px-3 py-2 text-right">Price</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/50">
                {userDetail.recentOrders.length === 0 ? (
                  <tr><td colSpan={6} className="px-3 py-4 text-center text-xs text-neutral-500">No orders</td></tr>
                ) : userDetail.recentOrders.map((o) => (
                  <tr key={o.id} className="text-neutral-300">
                    <td className="whitespace-nowrap px-3 py-2 text-xs text-neutral-500">{new Date(o.createdAt).toLocaleDateString()}</td>
                    <td className="px-3 py-2 text-xs capitalize">{o.type}</td>
                    <td className="px-3 py-2 text-xs">{o.catalogItemDisplayName}</td>
                    <td className="px-3 py-2 text-right text-xs">{o.filledQuantity}/{o.quantity}</td>
                    <td className="px-3 py-2 text-right text-xs">${Number(o.pricePerUnit).toLocaleString()}</td>
                    <td className="px-3 py-2 text-xs capitalize">{o.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {tab === 'deposits' && (
            <table className="w-full text-left text-sm">
              <thead className="border-b border-neutral-800 bg-neutral-950/50 text-xs text-neutral-400">
                <tr>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Item</th>
                  <th className="px-3 py-2 text-right">Qty</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/50">
                {userDetail.recentDeposits.length === 0 ? (
                  <tr><td colSpan={4} className="px-3 py-4 text-center text-xs text-neutral-500">No deposits</td></tr>
                ) : userDetail.recentDeposits.map((d) => (
                  <tr key={d.id} className="text-neutral-300">
                    <td className="whitespace-nowrap px-3 py-2 text-xs text-neutral-500">{new Date(d.createdAt).toLocaleDateString()}</td>
                    <td className="px-3 py-2 text-xs">{d.catalogItemDisplayName}</td>
                    <td className="px-3 py-2 text-right text-xs">{d.quantity}</td>
                    <td className="px-3 py-2 text-xs capitalize">{d.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {tab === 'withdrawals' && (
            <table className="w-full text-left text-sm">
              <thead className="border-b border-neutral-800 bg-neutral-950/50 text-xs text-neutral-400">
                <tr>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Item</th>
                  <th className="px-3 py-2 text-right">Qty</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/50">
                {userDetail.recentWithdrawals.length === 0 ? (
                  <tr><td colSpan={4} className="px-3 py-4 text-center text-xs text-neutral-500">No withdrawals</td></tr>
                ) : userDetail.recentWithdrawals.map((w) => (
                  <tr key={w.id} className="text-neutral-300">
                    <td className="whitespace-nowrap px-3 py-2 text-xs text-neutral-500">{new Date(w.createdAt).toLocaleDateString()}</td>
                    <td className="px-3 py-2 text-xs">{w.catalogItemDisplayName}</td>
                    <td className="px-3 py-2 text-right text-xs">{w.quantity}</td>
                    <td className="px-3 py-2 text-xs capitalize">{w.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Balance Adjust Modal */}
      {showBalanceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowBalanceModal(false)}>
          <div className="w-full max-w-sm rounded-xl border border-neutral-800 bg-neutral-900/95 p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold">Adjust Balance</h3>
            <div className="mt-3 space-y-3">
              <div className="flex gap-2">
                <button onClick={() => setBalanceDirection('add')} className={`flex-1 rounded-lg border px-3 py-1.5 text-sm ${balanceDirection === 'add' ? 'border-green-700 bg-green-600/20 text-green-400' : 'border-neutral-700 text-neutral-400'}`}>Add</button>
                <button onClick={() => setBalanceDirection('subtract')} className={`flex-1 rounded-lg border px-3 py-1.5 text-sm ${balanceDirection === 'subtract' ? 'border-red-700 bg-red-600/20 text-red-400' : 'border-neutral-700 text-neutral-400'}`}>Subtract</button>
              </div>
              <input type="number" value={balanceAmount} onChange={(e) => setBalanceAmount(e.target.value)} placeholder="Amount" min="1" className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white placeholder-neutral-500 focus:border-neutral-500 focus:outline-none" />
              <input type="text" value={balanceReason} onChange={(e) => setBalanceReason(e.target.value)} placeholder="Reason" className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white placeholder-neutral-500 focus:border-neutral-500 focus:outline-none" />
            </div>
            <div className="mt-4 flex gap-2">
              <button onClick={handleBalanceAdjust} disabled={!balanceAmount || actionLoading} className="flex-1 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-500 disabled:opacity-50">Confirm</button>
              <button onClick={() => setShowBalanceModal(false)} className="flex-1 rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-300 hover:bg-neutral-800">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Timeout Modal */}
      {showTimeoutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowTimeoutModal(false)}>
          <div className="w-full max-w-sm rounded-xl border border-neutral-800 bg-neutral-900/95 p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold">Timeout User</h3>
            <div className="mt-3 space-y-3">
              <input type="text" value={timeoutReason} onChange={(e) => setTimeoutReason(e.target.value)} placeholder="Reason (optional)" className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white placeholder-neutral-500 focus:border-neutral-500 focus:outline-none" />
              <div className="grid grid-cols-3 gap-2">
                {TIMEOUT_PRESET_DURATIONS.map((preset) => (
                  <button
                    key={preset.ms}
                    onClick={() => handleTimeout(preset.ms)}
                    disabled={actionLoading}
                    className="rounded-lg border border-amber-800/50 bg-amber-600/10 px-2 py-1.5 text-xs text-amber-400 hover:bg-amber-600/20 disabled:opacity-50"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <input type="number" value={customTimeoutMs} onChange={(e) => setCustomTimeoutMs(e.target.value)} placeholder="Custom (hours)" min="1" className="flex-1 rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white placeholder-neutral-500 focus:border-neutral-500 focus:outline-none" />
                <button
                  onClick={() => { const h = parseInt(customTimeoutMs); if (h > 0) handleTimeout(h * 60 * 60 * 1000); }}
                  disabled={!customTimeoutMs || actionLoading}
                  className="rounded-lg border border-amber-800/50 bg-amber-600/10 px-3 py-1.5 text-xs text-amber-400 hover:bg-amber-600/20 disabled:opacity-50"
                >
                  Apply
                </button>
              </div>
            </div>
            <button onClick={() => setShowTimeoutModal(false)} className="mt-4 w-full rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-300 hover:bg-neutral-800">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
