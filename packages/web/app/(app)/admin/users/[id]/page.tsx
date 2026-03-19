'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { apiFetch, getImpersonating } from '@/lib/api';
import { TIMEOUT_PRESET_DURATIONS } from '@donuttrade/shared';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Tabs } from '@/components/ui/tabs';
import { Table, Thead, Tbody, Th, Td } from '@/components/ui/table';
import { FadeIn } from '@/components/ui/animate';

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

const ROLE_VARIANT: Record<string, string> = {
  admin: 'danger',
  manager: 'purple',
  moderator: 'info',
  user: 'neutral',
};

const ACTIVITY_TABS = [
  { label: 'Transactions', value: 'transactions' },
  { label: 'Orders', value: 'orders' },
  { label: 'Deposits', value: 'deposits' },
  { label: 'Withdrawals', value: 'withdrawals' },
];

export default function AdminUserDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user: currentUser, impersonate } = useAuth();
  const [userDetail, setUserDetail] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [tab, setTab] = useState('transactions');

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

  const [actionError, setActionError] = useState<string | null>(null);

  const doAction = async (path: string, body?: unknown) => {
    setActionLoading(true);
    setActionError(null);
    try {
      await apiFetch(`/admin/users/${params.id}${path}`, {
        method: 'PATCH',
        body: body ? JSON.stringify(body) : '{}',
      });
      fetchUser();
    } catch (err: any) {
      setActionError(err?.message || 'Action failed');
    }
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
      <button onClick={() => router.push('/admin/users')} className="mb-4 text-xs text-neutral-500 transition-colors hover:text-amber-400">
        &larr; Back to Users
      </button>

      {/* Profile section */}
      <FadeIn>
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-[28px] font-extrabold tracking-tight">{userDetail.minecraftUsername ?? 'Unknown'}</h1>
              <p className="mt-0.5 text-xs text-neutral-500">{userDetail.email ?? 'No email'} &middot; {userDetail.authProvider}</p>
            </div>
            <Badge variant={ROLE_VARIANT[userDetail.role] as 'danger'}>
              {userDetail.role}
            </Badge>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Card className="p-3 text-center">
              <p className="text-[10px] uppercase tracking-wider text-neutral-600">Balance</p>
              <p className="text-lg font-extrabold text-green-400">${Number(userDetail.balance).toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
            </Card>
            <Card className="p-3 text-center">
              <p className="text-[10px] uppercase tracking-wider text-neutral-600">Verification</p>
              <p className="mt-0.5 text-sm capitalize">{userDetail.verificationStatus}</p>
            </Card>
            <Card className="p-3 text-center">
              <p className="text-[10px] uppercase tracking-wider text-neutral-600">Joined</p>
              <p className="mt-0.5 text-sm">{new Date(userDetail.createdAt).toLocaleDateString()}</p>
            </Card>
            <Card className="p-3 text-center">
              <p className="text-[10px] uppercase tracking-wider text-neutral-600">Last Login</p>
              <p className="mt-0.5 text-sm">{userDetail.lastLoginAt ? new Date(userDetail.lastLoginAt).toLocaleDateString() : '—'}</p>
            </Card>
          </div>

          {/* Status alerts */}
          {isBanned && (
            <div className="mt-3 rounded-lg border border-red-900/50 bg-red-950/20 p-3 text-sm text-red-400">
              Banned: {userDetail.banReason || 'No reason'} (since {new Date(userDetail.bannedAt!).toLocaleDateString()})
            </div>
          )}
          {isTimedOut && (
            <div className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/[0.04] p-3 text-sm text-amber-400">
              Timed out until {new Date(userDetail.timedOutUntil!).toLocaleString()} — {userDetail.timeoutReason || 'No reason'}
            </div>
          )}

          {actionError && (
            <div className="mt-3 rounded-lg border border-red-900/50 bg-red-950/20 p-3 text-sm text-red-400">
              {actionError}
            </div>
          )}

          {/* Action buttons */}
          <div className="mt-4 flex flex-wrap gap-2">
            {isManagerOrAdmin && !isSelf && userDetail.verificationStatus !== 'verified' && (
              <Button variant="primary" size="sm" onClick={() => { if (confirm('Manually verify this user?')) doAction('/verify'); }} disabled={actionLoading}>
                Verify User
              </Button>
            )}
            {isAdmin && !isSelf && (
              <Button variant="success" size="sm" onClick={() => setShowBalanceModal(true)} disabled={actionLoading}>
                Adjust Balance
              </Button>
            )}
            {isAdmin && !isSelf && userDetail.role !== 'admin' && (
              <Select
                value=""
                onChange={(e) => { if (e.target.value) handleRoleChange(e.target.value); }}
                disabled={actionLoading}
                className="text-xs"
              >
                <option value="">Change Role...</option>
                {['user', 'moderator', 'manager', 'admin'].filter((r) => r !== userDetail.role).map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </Select>
            )}
            {isAdmin && !isSelf && userDetail.role !== 'admin' && (
              <Button variant="secondary" size="sm" onClick={() => { if (confirm(`View the platform as ${userDetail.minecraftUsername}?`)) impersonate(userDetail.id); }} disabled={actionLoading}>
                Impersonate
              </Button>
            )}
            {isManagerOrAdmin && !isSelf && (
              <>
                {isBanned ? (
                  <Button variant="success" size="sm" onClick={() => doAction('/unban')} disabled={actionLoading}>
                    Unban
                  </Button>
                ) : (
                  <Button variant="danger" size="sm" onClick={handleBan} disabled={actionLoading}>
                    Ban
                  </Button>
                )}
                {isTimedOut ? (
                  <Button variant="success" size="sm" onClick={() => doAction('/remove-timeout')} disabled={actionLoading}>
                    Remove Timeout
                  </Button>
                ) : (
                  <Button variant="ghost" size="sm" onClick={() => setShowTimeoutModal(true)} disabled={actionLoading} className="text-amber-400 hover:text-amber-300">
                    Timeout
                  </Button>
                )}
              </>
            )}
          </div>
        </Card>
      </FadeIn>

      {/* Activity tabs */}
      <FadeIn delay={100}>
        <div className="mt-6">
          <Tabs tabs={ACTIVITY_TABS} value={tab} onChange={setTab} />

          <div className="mt-3">
            {tab === 'transactions' && (
              <Table>
                <Thead>
                  <tr>
                    <Th>Date</Th>
                    <Th>Type</Th>
                    <Th>Description</Th>
                    <Th className="text-right">Amount</Th>
                  </tr>
                </Thead>
                <Tbody>
                  {userDetail.recentTransactions.length === 0 ? (
                    <tr><td colSpan={4} className="px-3 py-4 text-center text-xs text-neutral-500">No transactions</td></tr>
                  ) : userDetail.recentTransactions.map((tx) => (
                    <tr key={tx.id}>
                      <Td className="whitespace-nowrap text-xs text-neutral-500">{new Date(tx.createdAt).toLocaleDateString()}</Td>
                      <Td className="text-xs capitalize">{tx.type}</Td>
                      <Td className="text-xs text-neutral-400">{tx.description || '—'}</Td>
                      <Td className="text-right text-xs">${Number(tx.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</Td>
                    </tr>
                  ))}
                </Tbody>
              </Table>
            )}
            {tab === 'orders' && (
              <Table>
                <Thead>
                  <tr>
                    <Th>Date</Th>
                    <Th>Type</Th>
                    <Th>Item</Th>
                    <Th className="text-right">Qty</Th>
                    <Th className="text-right">Price</Th>
                    <Th>Status</Th>
                  </tr>
                </Thead>
                <Tbody>
                  {userDetail.recentOrders.length === 0 ? (
                    <tr><td colSpan={6} className="px-3 py-4 text-center text-xs text-neutral-500">No orders</td></tr>
                  ) : userDetail.recentOrders.map((o) => (
                    <tr key={o.id}>
                      <Td className="whitespace-nowrap text-xs text-neutral-500">{new Date(o.createdAt).toLocaleDateString()}</Td>
                      <Td className="text-xs capitalize">{o.type}</Td>
                      <Td className="text-xs">{o.catalogItemDisplayName}</Td>
                      <Td className="text-right text-xs">{o.filledQuantity}/{o.quantity}</Td>
                      <Td className="text-right text-xs">${Number(o.pricePerUnit).toLocaleString()}</Td>
                      <Td className="text-xs capitalize">{o.status}</Td>
                    </tr>
                  ))}
                </Tbody>
              </Table>
            )}
            {tab === 'deposits' && (
              <Table>
                <Thead>
                  <tr>
                    <Th>Date</Th>
                    <Th>Item</Th>
                    <Th className="text-right">Qty</Th>
                    <Th>Status</Th>
                  </tr>
                </Thead>
                <Tbody>
                  {userDetail.recentDeposits.length === 0 ? (
                    <tr><td colSpan={4} className="px-3 py-4 text-center text-xs text-neutral-500">No deposits</td></tr>
                  ) : userDetail.recentDeposits.map((d) => (
                    <tr key={d.id}>
                      <Td className="whitespace-nowrap text-xs text-neutral-500">{new Date(d.createdAt).toLocaleDateString()}</Td>
                      <Td className="text-xs">{d.catalogItemDisplayName}</Td>
                      <Td className="text-right text-xs">{d.quantity}</Td>
                      <Td className="text-xs capitalize">{d.status}</Td>
                    </tr>
                  ))}
                </Tbody>
              </Table>
            )}
            {tab === 'withdrawals' && (
              <Table>
                <Thead>
                  <tr>
                    <Th>Date</Th>
                    <Th>Item</Th>
                    <Th className="text-right">Qty</Th>
                    <Th>Status</Th>
                  </tr>
                </Thead>
                <Tbody>
                  {userDetail.recentWithdrawals.length === 0 ? (
                    <tr><td colSpan={4} className="px-3 py-4 text-center text-xs text-neutral-500">No withdrawals</td></tr>
                  ) : userDetail.recentWithdrawals.map((w) => (
                    <tr key={w.id}>
                      <Td className="whitespace-nowrap text-xs text-neutral-500">{new Date(w.createdAt).toLocaleDateString()}</Td>
                      <Td className="text-xs">{w.catalogItemDisplayName}</Td>
                      <Td className="text-right text-xs">{w.quantity}</Td>
                      <Td className="text-xs capitalize">{w.status}</Td>
                    </tr>
                  ))}
                </Tbody>
              </Table>
            )}
          </div>
        </div>
      </FadeIn>

      {/* Balance Adjust Modal */}
      {showBalanceModal && (
        <Modal onClose={() => setShowBalanceModal(false)}>
          <h3 className="text-lg font-semibold">Adjust Balance</h3>
          <div className="mt-3 space-y-3">
            <div className="flex gap-2">
              <button
                onClick={() => setBalanceDirection('add')}
                className={`flex-1 rounded-lg border px-3 py-1.5 text-sm transition-all duration-200 ${
                  balanceDirection === 'add'
                    ? 'border-green-800/50 bg-green-600/10 text-green-400'
                    : 'border-[#1a1a1a] text-neutral-400'
                }`}
              >
                Add
              </button>
              <button
                onClick={() => setBalanceDirection('subtract')}
                className={`flex-1 rounded-lg border px-3 py-1.5 text-sm transition-all duration-200 ${
                  balanceDirection === 'subtract'
                    ? 'border-red-800/50 bg-red-600/10 text-red-400'
                    : 'border-[#1a1a1a] text-neutral-400'
                }`}
              >
                Subtract
              </button>
            </div>
            <Input type="number" value={balanceAmount} onChange={(e) => setBalanceAmount(e.target.value)} placeholder="Amount" min="1" />
            <Input type="text" value={balanceReason} onChange={(e) => setBalanceReason(e.target.value)} placeholder="Reason" />
          </div>
          <div className="mt-4 flex gap-2">
            <Button onClick={handleBalanceAdjust} disabled={!balanceAmount || actionLoading} className="flex-1">
              Confirm
            </Button>
            <Button variant="secondary" onClick={() => setShowBalanceModal(false)} className="flex-1">
              Cancel
            </Button>
          </div>
        </Modal>
      )}

      {/* Timeout Modal */}
      {showTimeoutModal && (
        <Modal onClose={() => setShowTimeoutModal(false)}>
          <h3 className="text-lg font-semibold">Timeout User</h3>
          <div className="mt-3 space-y-3">
            <Input type="text" value={timeoutReason} onChange={(e) => setTimeoutReason(e.target.value)} placeholder="Reason (optional)" />
            <div className="grid grid-cols-3 gap-2">
              {TIMEOUT_PRESET_DURATIONS.map((preset) => (
                <Button
                  key={preset.ms}
                  variant="ghost"
                  size="sm"
                  onClick={() => handleTimeout(preset.ms)}
                  disabled={actionLoading}
                  className="border border-amber-500/20 text-amber-400 hover:bg-amber-500/[0.06]"
                >
                  {preset.label}
                </Button>
              ))}
            </div>
            <div className="flex gap-2">
              <Input type="number" value={customTimeoutMs} onChange={(e) => setCustomTimeoutMs(e.target.value)} placeholder="Custom (hours)" min="1" className="flex-1" />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { const h = parseInt(customTimeoutMs); if (h > 0) handleTimeout(h * 60 * 60 * 1000); }}
                disabled={!customTimeoutMs || actionLoading}
                className="border border-amber-500/20 text-amber-400 hover:bg-amber-500/[0.06]"
              >
                Apply
              </Button>
            </div>
          </div>
          <Button variant="secondary" className="mt-4 w-full" onClick={() => setShowTimeoutModal(false)}>
            Cancel
          </Button>
        </Modal>
      )}
    </div>
  );
}
