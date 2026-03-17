'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '@/lib/api';
import type { PaginationMeta } from '@donuttrade/shared';

interface AuditLogEntry {
  id: string;
  actorId: string;
  actorUsername: string;
  action: string;
  targetType: string;
  targetId: string | null;
  details: Record<string, unknown> | null;
  createdAt: string;
}

const ACTION_LABELS: Record<string, string> = {
  'user.ban': 'Ban User',
  'user.unban': 'Unban User',
  'user.timeout': 'Timeout User',
  'user.remove_timeout': 'Remove Timeout',
  'user.balance_adjust': 'Adjust Balance',
  'user.role_change': 'Change Role',
  'deposit.confirm': 'Confirm Deposit',
  'deposit.reject': 'Reject Deposit',
  'withdrawal.claim': 'Claim Withdrawal',
  'withdrawal.confirm': 'Confirm Withdrawal',
  'withdrawal.fail': 'Fail Withdrawal',
  'order.admin_cancel': 'Cancel Order',
  'catalog.create': 'Create Catalog Item',
  'catalog.update': 'Update Catalog Item',
};

const TARGET_TYPE_TABS = ['all', 'user', 'deposit', 'withdrawal', 'order', 'catalog'];

export default function AdminAuditLogPage() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [targetType, setTargetType] = useState('all');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchLogs = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('perPage', '50');
    if (targetType !== 'all') params.set('targetType', targetType);

    apiFetch<{ logs: AuditLogEntry[]; meta: PaginationMeta }>(`/admin/audit-logs?${params}`)
      .then((data) => { setLogs(data.logs); setMeta(data.meta); })
      .catch(() => { setLogs([]); setMeta(null); })
      .finally(() => setLoading(false));
  }, [targetType, page]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  return (
    <div className="max-w-5xl">
      <h1 className="text-xl font-bold">Audit Log</h1>
      <p className="mt-1 text-xs text-neutral-500">All admin actions are recorded here.</p>

      <div className="mt-4 flex gap-1">
        {TARGET_TYPE_TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => { setTargetType(tab); setPage(1); }}
            className={`rounded-lg px-3 py-1.5 text-sm capitalize transition-colors ${
              targetType === tab ? 'bg-neutral-800 text-white' : 'text-neutral-400 hover:bg-neutral-800/50'
            }`}
          >
            {tab === 'all' ? 'All' : tab}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="mt-4 text-sm text-neutral-400">Loading...</p>
      ) : logs.length === 0 ? (
        <p className="mt-4 text-sm text-neutral-500">No audit logs found.</p>
      ) : (
        <>
          <div className="mt-3 overflow-x-auto rounded-lg border border-neutral-800">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-neutral-800 bg-neutral-950/50 text-xs text-neutral-400">
                <tr>
                  <th className="px-3 py-2">Time</th>
                  <th className="px-3 py-2">Admin</th>
                  <th className="px-3 py-2">Action</th>
                  <th className="px-3 py-2">Target</th>
                  <th className="px-3 py-2">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/50">
                {logs.map((log) => (
                  <tr key={log.id} className="text-neutral-300">
                    <td className="whitespace-nowrap px-3 py-2 text-xs text-neutral-500">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-xs font-medium">{log.actorUsername}</td>
                    <td className="px-3 py-2">
                      <ActionBadge action={log.action} />
                    </td>
                    <td className="px-3 py-2 text-xs">
                      <span className="text-neutral-500">{log.targetType}</span>
                      {log.targetId && (
                        <span className="ml-1 font-mono text-[10px] text-neutral-600" title={log.targetId}>
                          {log.targetId.slice(0, 8)}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {log.details ? (
                        <button
                          onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                          className="rounded bg-neutral-800 px-2 py-0.5 text-[10px] text-neutral-400 hover:bg-neutral-700"
                        >
                          {expandedId === log.id ? 'Hide' : 'View'}
                        </button>
                      ) : (
                        <span className="text-xs text-neutral-600">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Expanded details panel */}
          {expandedId && (() => {
            const log = logs.find((l) => l.id === expandedId);
            if (!log?.details) return null;
            return (
              <div className="mt-2 rounded-lg border border-neutral-800 bg-neutral-950/50 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-neutral-400">Details for action by {log.actorUsername}</span>
                  <button onClick={() => setExpandedId(null)} className="text-xs text-neutral-500 hover:text-neutral-300">Close</button>
                </div>
                <pre className="mt-2 max-h-48 overflow-auto rounded bg-neutral-900 p-2 text-xs text-neutral-300">
                  {JSON.stringify(log.details, null, 2)}
                </pre>
              </div>
            );
          })()}

          {meta && meta.totalPages > 1 && (
            <div className="mt-3 flex items-center justify-between text-xs text-neutral-500">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="rounded border border-neutral-700 px-2.5 py-1 hover:bg-neutral-800 disabled:opacity-40">Previous</button>
              <span>Page {meta.page} of {meta.totalPages}</span>
              <button onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))} disabled={page >= meta.totalPages} className="rounded border border-neutral-700 px-2.5 py-1 hover:bg-neutral-800 disabled:opacity-40">Next</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ActionBadge({ action }: { action: string }) {
  const label = ACTION_LABELS[action] ?? action;

  const colors: Record<string, string> = {
    'user.ban': 'border-red-900/50 bg-red-950/20 text-red-400',
    'user.unban': 'border-green-900/50 bg-green-950/20 text-green-400',
    'user.timeout': 'border-orange-900/50 bg-orange-950/20 text-orange-400',
    'user.remove_timeout': 'border-green-900/50 bg-green-950/20 text-green-400',
    'user.balance_adjust': 'border-amber-900/50 bg-amber-950/20 text-amber-400',
    'user.role_change': 'border-purple-900/50 bg-purple-950/20 text-purple-400',
    'deposit.confirm': 'border-green-900/50 bg-green-950/20 text-green-400',
    'deposit.reject': 'border-red-900/50 bg-red-950/20 text-red-400',
    'withdrawal.claim': 'border-blue-900/50 bg-blue-950/20 text-blue-400',
    'withdrawal.confirm': 'border-green-900/50 bg-green-950/20 text-green-400',
    'withdrawal.fail': 'border-red-900/50 bg-red-950/20 text-red-400',
    'order.admin_cancel': 'border-red-900/50 bg-red-950/20 text-red-400',
    'catalog.create': 'border-blue-900/50 bg-blue-950/20 text-blue-400',
    'catalog.update': 'border-amber-900/50 bg-amber-950/20 text-amber-400',
  };

  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium ${colors[action] ?? 'border-neutral-700 text-neutral-400'}`}>
      {label}
    </span>
  );
}
