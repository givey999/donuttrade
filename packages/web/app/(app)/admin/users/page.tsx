'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import type { PaginationMeta } from '@donuttrade/shared';

interface AdminUser {
  id: string;
  minecraftUsername: string | null;
  email: string | null;
  authProvider: string;
  balance: string;
  role: string;
  verificationStatus: string;
  isBanned: boolean;
  isTimedOut: boolean;
  createdAt: string;
}

const ROLE_COLORS: Record<string, string> = {
  admin: 'border-red-900/50 bg-red-950/20 text-red-400',
  manager: 'border-purple-900/50 bg-purple-950/20 text-purple-400',
  moderator: 'border-blue-900/50 bg-blue-950/20 text-blue-400',
  user: 'border-neutral-700 bg-neutral-800/50 text-neutral-400',
};

export default function AdminUsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const fetchUsers = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('perPage', '20');
    if (search) params.set('search', search);
    if (roleFilter) params.set('role', roleFilter);

    apiFetch<{ users: AdminUser[]; meta: PaginationMeta }>(`/admin/users?${params}`)
      .then((data) => { setUsers(data.users); setMeta(data.meta); })
      .catch(() => { setUsers([]); setMeta(null); })
      .finally(() => setLoading(false));
  }, [search, roleFilter, page]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  // Debounced search
  const [searchInput, setSearchInput] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => { setSearch(searchInput); setPage(1); }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  return (
    <div className="max-w-5xl">
      <h1 className="text-xl font-bold">Users</h1>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search username or email..."
          className="rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-1.5 text-sm text-white placeholder-neutral-500 focus:border-neutral-500 focus:outline-none"
        />
        <select
          value={roleFilter}
          onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
          className="rounded-lg border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-sm text-neutral-300"
        >
          <option value="">All roles</option>
          <option value="admin">Admin</option>
          <option value="manager">Manager</option>
          <option value="moderator">Moderator</option>
          <option value="user">User</option>
        </select>
      </div>

      {loading ? (
        <p className="mt-4 text-sm text-neutral-400">Loading...</p>
      ) : users.length === 0 ? (
        <p className="mt-4 text-sm text-neutral-500">No users found.</p>
      ) : (
        <>
          <div className="mt-3 overflow-x-auto rounded-lg border border-neutral-800">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-neutral-800 bg-neutral-950/50 text-xs text-neutral-400">
                <tr>
                  <th className="px-3 py-2">Username</th>
                  <th className="px-3 py-2">Email</th>
                  <th className="px-3 py-2 text-right">Balance</th>
                  <th className="px-3 py-2">Role</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/50">
                {users.map((u) => (
                  <tr
                    key={u.id}
                    onClick={() => router.push(`/admin/users/${u.id}`)}
                    className="cursor-pointer text-neutral-300 transition-colors hover:bg-neutral-800/30"
                  >
                    <td className="px-3 py-2 text-xs font-medium">{u.minecraftUsername ?? '—'}</td>
                    <td className="px-3 py-2 text-xs text-neutral-500">{u.email ?? '—'}</td>
                    <td className="px-3 py-2 text-right text-xs text-green-400">
                      ${Number(u.balance).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${ROLE_COLORS[u.role] ?? ROLE_COLORS.user}`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      {u.isBanned ? (
                        <span className="text-xs text-red-400">Banned</span>
                      ) : u.isTimedOut ? (
                        <span className="text-xs text-amber-400">Timed Out</span>
                      ) : u.verificationStatus === 'verified' ? (
                        <span className="text-xs text-green-400">Verified</span>
                      ) : (
                        <span className="text-xs text-neutral-500 capitalize">{u.verificationStatus}</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-xs text-neutral-500">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

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
