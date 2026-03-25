'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiFetch, getAccessToken } from '@/lib/api';
import { PageHeader } from '@/components/ui/page-header';
import { Tabs } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Table, Thead, Tbody, Th, Td } from '@/components/ui/table';
import { Pagination } from '@/components/ui/pagination';
import { FadeIn } from '@/components/ui/animate';
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

const ACTION_VARIANT: Record<string, string> = {
  'user.ban': 'danger',
  'user.unban': 'success',
  'user.timeout': 'orange',
  'user.remove_timeout': 'success',
  'user.balance_adjust': 'warning',
  'user.role_change': 'purple',
  'deposit.confirm': 'success',
  'deposit.reject': 'danger',
  'withdrawal.claim': 'info',
  'withdrawal.confirm': 'success',
  'withdrawal.fail': 'danger',
  'order.admin_cancel': 'danger',
  'catalog.create': 'info',
  'catalog.update': 'warning',
};

const TARGET_TYPE_TABS = [
  { label: 'All', value: 'all' },
  { label: 'User', value: 'user' },
  { label: 'Deposit', value: 'deposit' },
  { label: 'Withdrawal', value: 'withdrawal' },
  { label: 'Order', value: 'order' },
  { label: 'Catalog', value: 'catalog' },
];

export default function AdminAuditLogPage() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [targetType, setTargetType] = useState('all');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleExport = () => {
    const params = new URLSearchParams();
    if (targetType !== 'all') params.set('targetType', targetType);

    const token = getAccessToken();
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://moldo.go.ro:9443';
    const url = `${apiUrl}/admin/audit-logs/export?${params}`;

    fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      credentials: 'include',
    })
      .then((res) => res.blob())
      .then((blob) => {
        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = 'audit-log-export.csv';
        link.click();
        URL.revokeObjectURL(blobUrl);
      })
      .catch(() => {});
  };

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
      <FadeIn>
        <PageHeader title="Audit Log" subtitle="All admin actions are recorded here." />
      </FadeIn>

      <FadeIn delay={100}>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Tabs
            tabs={TARGET_TYPE_TABS}
            value={targetType}
            onChange={(v) => { setTargetType(v); setPage(1); }}
          />
          <button
            onClick={handleExport}
            className="rounded-lg border border-[#1a1a1a] bg-white/[0.03] px-3 py-1.5 text-xs text-neutral-400 transition-colors hover:bg-white/[0.06] hover:text-white"
          >
            Export CSV
          </button>
        </div>
      </FadeIn>

      {loading ? (
        <p className="mt-4 text-sm text-neutral-400">Loading...</p>
      ) : logs.length === 0 ? (
        <p className="mt-4 text-sm text-neutral-500">No audit logs found.</p>
      ) : (
        <FadeIn delay={150}>
          <div className="mt-3">
            <Table>
              <Thead>
                <tr>
                  <Th>Time</Th>
                  <Th>Admin</Th>
                  <Th>Action</Th>
                  <Th>Target</Th>
                  <Th>Details</Th>
                </tr>
              </Thead>
              <Tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <Td className="whitespace-nowrap text-xs text-neutral-500">
                      {new Date(log.createdAt).toLocaleString()}
                    </Td>
                    <Td className="text-xs font-medium">{log.actorUsername}</Td>
                    <Td>
                      <Badge variant={ACTION_VARIANT[log.action] as 'danger' ?? 'neutral'}>
                        {ACTION_LABELS[log.action] ?? log.action}
                      </Badge>
                    </Td>
                    <Td className="text-xs">
                      <span className="text-neutral-500">{log.targetType}</span>
                      {log.targetId && (
                        <span className="ml-1 font-mono text-[10px] text-neutral-600" title={log.targetId}>
                          {log.targetId.slice(0, 8)}
                        </span>
                      )}
                    </Td>
                    <Td>
                      {log.details ? (
                        <button
                          onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                          className="rounded-lg border border-[#1a1a1a] bg-white/[0.03] px-2 py-0.5 text-[10px] text-neutral-400 transition-colors hover:bg-white/[0.06]"
                        >
                          {expandedId === log.id ? 'Hide' : 'View'}
                        </button>
                      ) : (
                        <span className="text-xs text-neutral-600">&mdash;</span>
                      )}
                    </Td>
                  </tr>
                ))}
              </Tbody>
            </Table>
          </div>

          {/* Expanded details panel */}
          {expandedId && (() => {
            const log = logs.find((l) => l.id === expandedId);
            if (!log?.details) return null;
            return (
              <div className="mt-2 rounded-lg border border-[#1a1a1a] bg-white/[0.02] p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-neutral-400">Details for action by {log.actorUsername}</span>
                  <button onClick={() => setExpandedId(null)} className="text-xs text-neutral-500 transition-colors hover:text-violet-500">Close</button>
                </div>
                <pre className="mt-2 max-h-48 overflow-auto rounded-lg border border-[#1a1a1a] bg-[#0d0d14] p-2 text-xs text-neutral-300">
                  {JSON.stringify(log.details, null, 2)}
                </pre>
              </div>
            );
          })()}

          {meta && <Pagination page={meta.page} totalPages={meta.totalPages} onPageChange={setPage} />}
        </FadeIn>
      )}
    </div>
  );
}
